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

Tables are created automatically on first boot (`spring.jpa.hibernate.ddl-auto=update`).

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
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` for now, updated in step 3 |

4. Deploy, then note the service URL, e.g. `https://expensetracker-api.onrender.com`.

> Render's free tier sleeps after ~15 minutes of inactivity; the first request afterwards takes 30-60s to wake it.

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
