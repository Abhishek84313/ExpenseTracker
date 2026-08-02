# Expense Tracker

A full-stack expense tracking application: a React frontend for logging and reviewing spending, backed by a Spring Boot API and a MySQL database. The interesting part of this README isn't the feature list — it's the deployment path, because each of the three free-tier services involved (Aiven, Render, Vercel) has its own small, sharp edge that will cost you a confusing half hour if you don't know it's there going in.

```
Frontend/expensetracker   React app      -> Vercel
Backend/ExpenseTracker    Spring Boot    -> Render
                          MySQL          -> Aiven
```

## Local development

Running the app locally means starting the backend and frontend as two separate processes, each in its own terminal.

**Backend**

```bash
cd Backend/ExpenseTracker
./mvnw spring-boot:run
```

By default this points at `jdbc:mysql://localhost:3306/expensetracker` using the `root` user — in other words, it assumes you have a local MySQL instance already running with that database created. If your local setup looks different, override it with the `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` environment variables rather than editing the source.

**Frontend**

```bash
cd Frontend/expensetracker
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_URL` if your API isn't running on the default `localhost:8080` — for example, if you've moved the backend to a different port locally.

## Environment variables

Every credential the app needs is read from the environment rather than hardcoded, which is what makes it safe to commit the codebase publicly and what makes the same code work unmodified across local development, Render, and Vercel — only the values change between environments, never the code that reads them.

| Service  | Variable               | Purpose                                            |
| -------- | ---------------------- | -------------------------------------------------- |
| Backend  | `DB_URL`               | JDBC URL of the MySQL database                     |
| Backend  | `DB_USERNAME`          | Database user                                      |
| Backend  | `DB_PASSWORD`          | Database password                                  |
| Backend  | `CORS_ALLOWED_ORIGINS` | Comma separated origins allowed to call the API    |
| Backend  | `PORT`                 | Injected by Render; the app binds to it            |
| Frontend | `VITE_API_URL`         | Base URL of the deployed API, no trailing slash    |

No credentials are committed anywhere in the repository — everything above is supplied at runtime, by whichever platform is running that piece.

## Deployment

The three pieces have to be deployed in a specific order — **database, then backend, then frontend** — and that order isn't arbitrary. Each later step needs a concrete URL produced by the step before it: the backend can't be configured without a database connection string to point at, and the frontend can't be configured without a live backend URL to call. Deploying out of order just means doing the same step twice once the dependency is finally available.

### 1. MySQL on Aiven

1. Create a free MySQL service at [console.aiven.io](https://console.aiven.io) and wait for its status to reach *Running* — provisioning takes a couple of minutes, and connecting before it's ready just produces a generic connection failure that has nothing to do with your credentials.
2. On the service's **Overview** tab, note down the `Host`, `Port`, `User`, `Password`, and `Database name` (this last one is usually `defaultdb` by default).
3. From those pieces, build a proper JDBC connection URL by hand. Aiven requires SSL for all connections, so the flag has to be included explicitly:

   ```
   jdbc:mysql://<host>:<port>/defaultdb?sslMode=REQUIRED
   ```

   This step trips people up more than any other part of the deployment, for a specific reason: Aiven's dashboard prominently displays a **Service URI** that looks like a connection string — something in the form `mysql://user:password@host...` — but that is a generic MySQL URI, not a JDBC URL, and the two are not interchangeable. Pasting the Service URI directly into `DB_URL` doesn't produce a warning; it produces a JDBC driver that rejects the string outright, and the Spring Boot application simply exits during startup with no application logs pointing at the real cause. The working URL has to be built manually in the `jdbc:mysql://...` form shown above, and it has to use `sslMode` in camelCase — Aiven's own dashboard uses the hyphenated `ssl-mode`, which the JDBC driver won't recognize.

   There's a second, quieter trap in the same step: Aiven exposes two different ports for MySQL, a standard port (`19593` in this project's case) and an X Protocol port (`19597`). The JDBC driver only speaks the standard MySQL wire protocol, not the X Protocol, so pointing `DB_URL` at the X Protocol port produces the same kind of opaque connection failure as the Service URI mistake above.

Tables are created automatically the first time the application boots, via Hibernate's `spring.jpa.hibernate.ddl-auto=update` setting — there's no manual migration step to run. On the live service, both the `users` and `expenses` tables have been confirmed present after this automatic bootstrap.

### 2. Spring Boot on Render

1. Go to [dashboard.render.com](https://dashboard.render.com), choose **New** -> **Web Service**, and connect this GitHub repository.
2. Configure the service with these settings:
   - **Root Directory**: `Backend/ExpenseTracker` — necessary because the backend isn't at the repo root; without this, Render would look for a Dockerfile in the wrong place and fail immediately.
   - **Runtime**: Docker — Render auto-detects and uses the repo's own `Dockerfile` rather than trying to guess a Java build process.
   - **Instance type**: Free.
3. Add the following environment variables in the Render dashboard:

   | Key                    | Value                                              |
   | ---------------------- | -------------------------------------------------- |
   | `DB_URL`               | the JDBC URL built in step 1                       |
   | `DB_USERNAME`          | Aiven user (e.g. `avnadmin`)                       |
   | `DB_PASSWORD`          | Aiven password                                     |
   | `PORT`                 | `8080` — must match the Dockerfile's `EXPOSE`      |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` for now, updated in step 3 |

4. Trigger a deploy, and once it succeeds, note the generated service URL — something like `https://expensetracker-api.onrender.com`. You'll need this exact URL for the frontend deployment in the next section.

> Worth knowing before you get confused by it later: Render's free tier spins the service down after roughly 15 minutes of no traffic. The very next request after that idle period has to wait for the container to cold-start again, which typically takes 30–60 seconds — this shows up as the frontend appearing to hang or time out on its first request of the day, not as an actual bug.

The repository also includes a `render.yaml` at its root, which codifies all of the settings above as infrastructure-as-code. It's worth being clear about its scope, though: `render.yaml` only takes effect for services that are *created from a Render Blueprint* — a service you set up manually through the dashboard (as described in the steps above) keeps its own independent settings, and any future changes to those settings have to be made in the dashboard directly. The YAML file doesn't retroactively take over a dashboard-created service.

#### Troubleshooting: "Port scan timeout reached, no open ports detected"

This specific error means Render's platform never observed the application binding to a listening socket at all — not a crash after startup, but a failure to ever reach the point of accepting connections. There are two distinct, unrelated causes worth checking, and it's worth ruling out both rather than assuming which one it is:

1. **The application exited before it ever got to bind a port.** This is almost always caused by a bad `DB_URL` — see the Service URI trap described in step 1. Spring's Hibernate layer needs a live database connection just to determine which SQL dialect to use, so if that connection fails, the application aborts during startup, well before it would have opened a port. Check the Render logs specifically for `Communications link failure` or `Driver claims to not accept jdbcUrl` — either one points straight back to the database connection string, not to anything in the application code itself.
2. **The application started fine, but bound the wrong port.** The `Dockerfile` declares `EXPOSE 8080`, and Render's port-detection logic prefers that declared port when scanning for the running service. Render's own platform default for the `PORT` environment variable, however, is `10000` — so if `PORT` isn't explicitly set to `8080` in the Render dashboard, Spring Boot dutifully binds to `10000` (following its own environment variable) while Render is scanning `8080` (following the Dockerfile) and finds nothing there. Explicitly setting `PORT=8080` in the Render environment variables makes both sides agree on the same number.

### 3. React on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this same GitHub repository.
2. Configure the project:
   - **Root Directory**: `Frontend/expensetracker` — same reasoning as the Render root directory setting; the frontend isn't at the repo root.
   - Framework preset: **Vite**. With this preset selected, Vercel reads the build command and output directory straight from the project's own `vercel.json`, rather than needing them typed in manually.
3. Add one environment variable, `VITE_API_URL`, set to the Render backend URL obtained in the previous section — with no trailing slash, since the app's API calls concatenate a path directly onto this base URL.
4. Deploy.

This project is already deployed and live at **https://expensetracker-jet-pi.vercel.app** (under the Vercel project `abhishek-gajavillis-projects/expensetracker`).

### 4. Close the CORS loop

There's one last step that's easy to forget precisely because everything will appear to work up to this point and then fail specifically on API calls from the deployed frontend. Back in the Render dashboard, update `CORS_ALLOWED_ORIGINS` to include the live Vercel URL, and redeploy the backend so the change takes effect:

```
https://expensetracker-jet-pi.vercel.app
```

Multiple allowed origins are separated with commas in that same variable, so `http://localhost:5173` can safely stay in the list alongside the production URL — that way local development against the deployed backend keeps working too, without needing to swap the variable back and forth.

One more thing worth knowing about the frontend side specifically: Vite bakes the value of `VITE_API_URL` directly into the built JavaScript bundle at build time — it isn't read at runtime the way the backend's environment variables are. That means changing `VITE_API_URL` in the Vercel dashboard has no effect on the live site until you trigger a fresh redeploy; the old value stays baked into whatever bundle is currently being served.