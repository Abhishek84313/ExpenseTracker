# Expense Tracker

Full-stack expense tracker: React (Vite + Tailwind) frontend, Spring Boot + MySQL backend.

```
Frontend/expensetracker   React app      -> Vercel
Backend/ExpenseTracker    Spring Boot    -> Render
                          MySQL          -> Aiven
```

## Local development

**Backend**

```bash
cd Backend/ExpenseTracker
./mvnw spring-boot:run
```

Defaults to `jdbc:mysql://localhost:3306/expensetracker` with user `root`. Override with
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD` environment variables.

**Frontend**

```bash
cd Frontend/expensetracker
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_API_URL` if the API is not on `localhost:8080`.

## Environment variables

| Service  | Variable               | Purpose                                            |
| -------- | ---------------------- | -------------------------------------------------- |
| Backend  | `DB_URL`               | JDBC URL of the MySQL database                     |
| Backend  | `DB_USERNAME`          | Database user                                      |
| Backend  | `DB_PASSWORD`          | Database password                                  |
| Backend  | `CORS_ALLOWED_ORIGINS` | Comma separated origins allowed to call the API    |
| Backend  | `PORT`                 | Injected by Render; the app binds to it            |
| Frontend | `VITE_API_URL`         | Base URL of the deployed API, no trailing slash    |

No credentials are committed — everything is read from the environment.

## Deployment

Deploy in this order: **database -> backend -> frontend**, since each step needs the URL from the previous one.

### 1. MySQL on Aiven

1. Create a free MySQL service at [console.aiven.io](https://console.aiven.io) and wait for it to reach *Running*.
2. On the service **Overview** tab, note `Host`, `Port`, `User`, `Password`, and `Database name` (usually `defaultdb`).
3. Build the JDBC URL — Aiven requires SSL:

   ```
   jdbc:mysql://<host>:<port>/defaultdb?sslMode=REQUIRED
   ```

> Aiven shows a **Service URI** starting with `mysql://user:password@host...`. That is *not* a JDBC
> URL — pasting it into `DB_URL` makes the driver reject it and the app exits at startup. Build the
> `jdbc:mysql://...` form above by hand, and use `sslMode` (camelCase), not Aiven's `ssl-mode`.
> Use the MySQL port (`19593`), not the MySQL**x** port (`19597`) — the JDBC driver does not speak
> the X Protocol.

Tables are created automatically on first boot (`spring.jpa.hibernate.ddl-auto=update`); the
`users` and `expenses` tables are confirmed present on the live service.

### 2. Spring Boot on Render

1. [dashboard.render.com](https://dashboard.render.com) -> **New** -> **Web Service** -> connect this GitHub repo.
2. Settings:
   - **Root Directory**: `Backend/ExpenseTracker`
   - **Runtime**: Docker (the `Dockerfile` is picked up automatically)
   - **Instance type**: Free
3. Add environment variables:

   | Key                    | Value                                              |
   | ---------------------- | -------------------------------------------------- |
   | `DB_URL`               | the JDBC URL from step 1                           |
   | `DB_USERNAME`          | Aiven user (e.g. `avnadmin`)                       |
   | `DB_PASSWORD`          | Aiven password                                     |
   | `PORT`                 | `8080` — must match the Dockerfile's `EXPOSE`      |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` for now, updated in step 3 |

4. Deploy, then note the service URL, e.g. `https://expensetracker-api.onrender.com`.

> Render's free tier sleeps after ~15 minutes of inactivity; the first request afterwards takes 30-60s to wake it.

`render.yaml` at the repo root codifies these settings. Note that it only applies to services created
from a Render **Blueprint** — a service created by hand in the dashboard keeps its own settings, so
changes there must be made in the dashboard too.

#### Troubleshooting: "Port scan timeout reached, no open ports detected"

Render never saw a listening socket. Two independent causes, both worth ruling out:

1. **The app exited before binding.** Almost always a bad `DB_URL` (see the Service URI warning
   above) — Hibernate cannot determine a dialect without a live connection, so startup aborts.
   Check the Render logs for `Communications link failure` or `Driver claims to not accept jdbcUrl`.
2. **Port mismatch.** The `Dockerfile` declares `EXPOSE 8080`, and Render prefers the exposed port
   when detecting. Render's own default `PORT` is `10000`, so without an explicit override the app
   binds 10000 while Render scans 8080 and finds nothing. Setting `PORT=8080` makes both agree.

### 3. React on Vercel

1. [vercel.com/new](https://vercel.com/new) -> import this GitHub repo.
2. Settings:
   - **Root Directory**: `Frontend/expensetracker`
   - Framework preset **Vite** (build command and output directory come from `vercel.json`)
3. Add environment variable `VITE_API_URL` = the Render URL from step 2 (no trailing slash).
4. Deploy.

Already deployed at **https://expensetracker-jet-pi.vercel.app**
(project `abhishek-gajavillis-projects/expensetracker`).

### 4. Close the CORS loop

Back in Render, set `CORS_ALLOWED_ORIGINS` to the Vercel URL and redeploy:

```
https://expensetracker-jet-pi.vercel.app
```

Multiple origins are comma separated, and `http://localhost:5173` can stay in the list for local work.

Vite inlines `VITE_API_URL` at build time, so changing it in Vercel requires a redeploy to take effect.
