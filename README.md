# FitBit

A full-stack fitness tracking application that lets a user log workouts, watch their progress accumulate over time, and set goals against the metrics that matter to them. Under the hood it's a REST API talking to a document database, paired with a React single-page app — but the interesting part of this project isn't the CRUD, it's the handful of deliberate decisions made to keep a single MongoDB collection safe, keep a hand-rolled chart honest, and keep a deployment across three different free-tier hosts from falling over in the ways free-tier deployments usually do.

**Stack:** C# .NET 10 Web API · React 19 (Vite) · MongoDB

---

## Prerequisites

Before running anything locally, make sure the following are installed and — in MongoDB's case — actually listening on the port the API expects.

| | Version | Notes |
|---|---|---|
| .NET SDK | 10.0.x | `winget install --id Microsoft.DotNet.SDK.10 -e` |
| Node.js | 20.19+ / 22.12+ | built against v24 |
| MongoDB | 6.0+ | must be listening on `127.0.0.1:27017` |

The application expects a database named `Fitbit` with a single collection, `FitnessTracker`. You don't need to create either by hand — the app creates the database on first write and builds its indexes automatically the moment it starts up, so a completely fresh MongoDB install is a valid starting point.

## Running

The app is two independent processes — an API and a Vite dev server — so you'll want two terminals open side by side.

```powershell
# 1 — API  →  http://localhost:5099  (Swagger at /swagger)
dotnet run --project server\FitBit.Api --launch-profile http

# 2 — client  →  http://localhost:5173
cd client
npm install      # first time only
npm run dev
```

Once both are running, open <http://localhost:5173>, register a new account, and — if you'd rather not spend ten minutes manually logging workouts before you can see the dashboard render properly — hit the **Seed sample data** endpoint described below to populate a couple of weeks of realistic activity in one call.

## Architecture

```
server/FitBit.Api/
  Models/          UserDocument · ActivityDocument · GoalDocument · DocTypes
  Repositories/    MongoRepositoryBase (docType scoping) + one repo per doc type
  Services/        Auth · Activity · Goal · Dashboard · JwtToken · Seed · DateKey
  Controllers/     Auth · Activities · Goals · Dashboard · Dev (Development only)
client/src/
  api/             axios instance + interceptors, one module per resource
  context/         AuthContext (loading-gated session hydration)
  components/      TrendChart (hand-rolled SVG) · Meter · StatCard · tables · forms
  pages/           Login · Register · Dashboard · Activities · Goals
```

The layering is fairly conventional — controllers stay thin, services hold the logic, repositories own the data access — but the data model itself is where most of the interesting constraints live.

### One collection, three document shapes

Rather than three MongoDB collections (`users`, `activities`, `goals`), everything is deliberately stored together in a single collection, `FitnessTracker`, and each document declares which "shape" it is via a `docType` field:

```js
{ _id, docType: "user",     email, displayName, passwordHash, createdAt }
{ _id, docType: "activity", userId, type, date, dateKey, durationMinutes,
                            distanceKm?, calories?, notes?, createdAt, updatedAt }
{ _id, docType: "goal",     userId, title, metric, targetValue, period,
                            startDate, endDate?, isActive, createdAt, updatedAt }
```

This single-collection pattern is common in MongoDB modeling, but it comes with a sharp edge that's easy to miss: **the `docType` filter is a security boundary, not a convenience** — and MongoDB will not enforce it for you.

Here's the trap. The .NET driver's discriminator support — the mechanism that would normally let you treat a collection as polymorphic — is wired to `OfType<TDerived>()`, not to the collection's generic type parameter. That means a call like `GetCollection<ActivityDocument>(…).Find(Empty)` doesn't quietly filter to activities; it issues a bare `find({})` against the whole collection and hands back *every* document, including user records. And because three different shapes are packed into one collection, every model needs `[BsonIgnoreExtraElements]` to deserialize without blowing up on fields it doesn't recognize — which means those user documents don't fail to deserialize as `ActivityDocument`. They succeed, silently, as half-populated activities that happen to be carrying a `passwordHash` field nobody asked for.

The fix isn't "remember to filter on docType at every call site" — that's exactly the kind of discipline that erodes the first time someone's in a hurry. Instead, the filtering is structural: in `MongoRepositoryBase<T>`, the underlying `IMongoCollection<T>` is **private**, and nothing on the repository exposes it, or an `IFindFluent`/`IQueryable` over it, to callers. Every single read and write is forced through a method called `Scoped()`, which ANDs the repository's `docType` into the query before it ever reaches Mongo. There is no code path that can accidentally see across document types, because there's no handle to the raw collection to misuse.

Ownership checks follow the identical philosophy. `userId` is folded into the query itself — never checked afterward with an `if (doc.UserId != currentUser) return Forbid()`. And when a lookup for another user's document comes back empty, the API returns a plain **404**, not a 403. A 403 would confirm that the id exists and simply isn't yours; a 404 gives an attacker nothing to work with.

### Dates

Every activity stores its date twice, in two different forms, and that duplication is intentional:

- `date` — a UTC instant, used for sorting and for range queries where you genuinely care about the exact moment.
- `dateKey` — a plain `"yyyy-MM-dd"` string representing the *calendar day the user meant*, independent of timezone.

**All bucketing, grouping, and goal-window comparison runs off `dateKey`**, never off `date` directly. The reason is timezone arithmetic: for a user in IST (UTC+5:30), anything logged before 5:30am local time falls on the *previous* UTC calendar day. If bucketing used the raw UTC instant, a workout logged at 6am IST would silently land in yesterday's column of the trend chart — a bug that's invisible in testing during the day and only shows up for early risers. Storing the resolved local date as a plain string sidesteps the whole class of bug. As a bonus, `yyyy-MM-dd` is one of the rare date formats where lexicographic string comparison and chronological comparison agree, so range queries on `dateKey` are just string comparisons — no date parsing required.

### Goal progress

Fields like `currentValue`, `progressPercent`, and `status` are **never stored** on a goal document — they're computed fresh every time a goal is read. Storing them would mean invalidating and recalculating on every single activity write that might affect any active goal, and the moment that invalidation logic drifts even slightly out of sync, the dashboard and the goals page start disagreeing with each other — a bug class that's notoriously hard to track down because both numbers *look* plausible. Computing on read sidesteps the whole problem: there's nothing to invalidate. Both the dashboard and the dedicated goals page call the same `GoalService.Project()` method, so there is exactly one code path that can produce a progress number, and the two views are structurally incapable of diverging.

The trend aggregation for the dashboard is done as in-memory LINQ rather than a MongoDB `$group` aggregation pipeline, which sounds like it's leaving performance on the table until you consider what it's actually trading for. A `$group` pipeline only returns days that have at least one matching document — but the trend chart needs to show a bar (even a zero-height one) for every day in the window, including days nothing was logged. Getting that zero-fill behavior out of an aggregation pipeline means bypassing the same `Scoped()` safety net described above. And practically speaking, a 7-day window pulls back on the order of 20 documents — small enough that doing the grouping in application code costs nothing measurable while keeping every query routed through the one code path that enforces the security boundary.

## API

| Verb | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | `201` · `409` if the email is taken |
| POST | `/api/auth/login` | `200` · `401` |
| GET | `/api/auth/me` | 🔒 |
| GET | `/api/activities` | 🔒 `?type=&from=&to=&page=&pageSize=&sort=` → `PagedResult` |
| GET | `/api/activities/types` | 🔒 static list |
| GET/POST/PUT/DELETE | `/api/activities[/{id}]` | 🔒 full CRUD |
| GET/POST/PUT/DELETE | `/api/goals[/{id}]` | 🔒 `?activeOnly=` |
| GET | `/api/dashboard/summary?days=7\|14\|30` | 🔒 totals, previous window, streak, zero-filled trend, goal progress |

🔒 = requires `Authorization: Bearer <jwt>`.

The login endpoint is deliberately boring from an attacker's point of view: an unknown email and a correct email with a wrong password both return the **exact same `401`**, and when the email doesn't exist at all, the handler still runs a dummy BCrypt verification against a throwaway hash rather than short-circuiting immediately. Without that dummy verify, a missing account would respond measurably faster than a wrong password — turning response time itself into a way to enumerate which emails are registered. Neither the message nor the timing gives that information away.

### Development-only endpoints

These four routes exist purely to make local development and demoing less tedious, and they are **removed from the application model entirely** outside the `Development` environment — not just hidden behind a check, but absent from routing, so there's no code path that could expose them in production by misconfiguration.

| Verb | Route | |
|---|---|---|
| GET | `/api/dev/health` | Mongo reachability + document count |
| GET | `/api/dev/indexes` | confirms the partial unique email index without a shell |
| POST | `/api/dev/seed` | 🔒 ~18 activities over 14 days (with 2 deliberately empty) + 3 goals |
| DELETE | `/api/dev/reset` | 🔒 deletes **only the calling user's** documents |

The seed data intentionally includes two empty days in its 14-day span, specifically so the trend chart's zero-fill and "empty day" rendering can be eyeballed without having to manually engineer a gap.

To seed sample data for a fresh account:

```powershell
$base = "http://localhost:5099/api"
$reg = Invoke-RestMethod "$base/auth/register" -Method Post `
  -ContentType 'application/json; charset=utf-8' `
  -Body (@{ email="you@test.com"; password="Passw0rd!"; displayName="You" } | ConvertTo-Json)
Invoke-RestMethod "$base/dev/seed" -Method Post -Headers @{ Authorization = "Bearer $($reg.token)" }
```

> One PowerShell gotcha worth knowing about: in Windows PowerShell 5.1, `curl` is aliased to `Invoke-WebRequest`, which doesn't understand `-X`, `-H`, or `-d`. If you want real curl syntax, call `curl.exe` explicitly.

## Notable implementation details

These are the small, easy-to-miss decisions that would otherwise cost someone an afternoon of debugging if they were made the "obvious" way instead.

**Backend**
- `MapInboundClaims` is set to `false` so the JWT's `sub` claim arrives exactly as written. Left at its default, the JWT handler silently rewrites `sub` into the older WS-Federation `nameidentifier` URI, and any later call to `FindFirst("sub")` quietly returns null instead of the user id.
- `ClockSkew` is tightened from the library's default of 5 minutes down to 30 seconds. A 5-minute skew allowance means a token that should have expired keeps working for up to 5 extra minutes — which makes any test written to check expiry behavior lie to you.
- The unique index on `email` is **partial**, scoped to `docType: "user"`. Without that scoping, a plain unique index on `{email:1}` would treat every activity and goal document as having `email: null` — and since a unique index only allows one document with a given value, the *second* activity ever inserted would fail with a MongoDB `E11000` duplicate-key error, for a field that activities don't even logically have.
- CORS middleware (`UseCors`) is registered **before** authentication (`UseAuthentication`) in the pipeline. If the order were reversed, a browser's CORS preflight `OPTIONS` request — which never carries an `Authorization` header — would hit the auth middleware first, get rejected with a 401, and never receive CORS headers back. The browser then reports a generic CORS failure that has nothing to do with CORS and everything to do with pipeline ordering.
- `UseHttpsRedirection` is intentionally not used locally: its 307 redirects break the Vite dev server's proxy, which isn't expecting to be redirected mid-request.
- The connection string points at `127.0.0.1`, not `localhost`. `mongod` on Windows binds to IPv4 only, but Windows resolves `localhost` to the IPv6 loopback `::1` first — so a connection string using `localhost` doesn't fail outright, it just times out after 30 seconds in a way that looks exactly like "the database isn't running" when it's actually running fine.

**Frontend**
- The axios request interceptor pulls the auth token straight out of `localStorage` on every request, rather than from React state. It's registered once at module scope — outside any component — so if it captured a React state value instead, it would close over whatever `null` existed at registration time, and every request after login would still go out unauthenticated.
- The global 401 response interceptor explicitly **exempts requests to `/auth/*`**. Without that exemption, a wrong password submitted on the login page would trigger the same "redirect to login" handling used everywhere else — which, on the login page, means remounting the login form and wiping out the error message before the user has a chance to read it.
- `ProtectedRoute` doesn't just check "is there a user" — it also gates on a `loading` flag. Without that, every page refresh has a brief window where `user === null` simply because the `/auth/me` request hasn't resolved yet, and an already-authenticated user would get bounced to `/login` on every single F5.
- Activity filters are stored in the URL via `useSearchParams` rather than component state, which means a filtered view of the activity list is a real, shareable, bookmarkable link, and it survives a page refresh instead of resetting.
- When data is refetching, the previous render is dimmed rather than replaced with a loading skeleton. A skeleton would change the layout's height and cause a visible jump every time a filter is changed; dimming keeps the existing content in place while new data loads in.

**Chart** (`TrendChart.jsx`, hand-rolled SVG)

A charting library was deliberately skipped here — rendering seven data points in a single series doesn't come close to justifying the dependency weight or API surface of a full charting library, so the chart is plain hand-written SVG.

- Data is rendered as columns, not a connected line. With daily sums where some days are genuinely zero, a line dropping to the baseline visually implies "activity dipped," when the truth is "nothing was logged that day" — a meaningfully different message. Empty days instead render as a small 2px stub sitting on the baseline, clearly present but clearly not a real value.
- The SVG is sized to its **measured pixel width** on the page rather than using a fixed `viewBox` stretched with `width:100%`. A fixed viewBox scales *everything* inside it uniformly, including text — so the same 11px axis label would render at roughly 17px on a wide card and shrink to around 5px, unreadable, on a 375px-wide phone screen. Measuring the actual rendered width keeps text a consistent, legible size regardless of the container.
- Columns are capped at 24px wide with a 4px rounded top and a square base, separated by a 2px gap, sitting over solid hairline gridlines. Only the peak value in the series is labeled directly, to avoid cluttering seven columns with seven overlapping numbers.
- Hover targets span the entire height of each column's band — not just the bar itself — so a short or zero-height column is just as easy to interact with as a tall one. Keyboard users get the same detail panel via `Tab` navigation, and a **Table** view toggle exposes every underlying value for anyone who'd rather not hover at all.
- The series colors (`#2a78d6` for light mode, `#3987e5` for dark mode) were checked for contrast against both surfaces rather than picked by eye. Goal-status indicators always pair a color with both an icon and a text label — color alone is never the only signal, for the sake of colorblind users and anyone in bright sunlight.

## Deployment

The app is spread across three separate free tiers, one per architectural layer:

| Layer | Host | URL |
|---|---|---|
| SPA | Vercel | `https://<project>.vercel.app` |
| API | MonsterASP.NET | `https://fitbit.runasp.net` |
| Database | MongoDB Atlas M0 | `mongodb+srv://…` |

`appsettings.json` in the repository contains **local development values only** — nothing that touches production. The real production configuration is generated on the CI runner, written into `appsettings.Production.json` directly from GitHub Actions secrets, and never committed to the repo at any point; the file is gitignored specifically so that a developer's local copy of it can't be accidentally pushed. On MonsterASP, the `ASPNETCORE_ENVIRONMENT` variable is left unset, and ASP.NET Core's own default in that situation is `Production` — which is precisely why `appsettings.Production.json` is the file that ends up loading at runtime, with no explicit configuration needed to make that happen.

> One config-file placement detail worth flagging: `Urls` lives in `appsettings.Development.json`, deliberately *not* in the root `appsettings.json`. If it were left in the root config, it would pin the app to `localhost:5099` even under IIS — where the ASP.NET Core Module, not the app itself, is responsible for assigning the actual listening port. The result would be the app binding to a port nothing is routing traffic to, and the site returning a 502 with no obvious cause.

### 1 · MongoDB Atlas

Create a free **M0** cluster and add a database user. Under **Network Access**, allow `0.0.0.0/0` — this isn't laziness, it's a constraint of the hosting choice: MonsterASP.NET doesn't publish a fixed, stable outbound IP address, so there's no specific IP or range that could be safely allowlisted instead. Keep the database named `Fitbit`; as with local development, the collection and its indexes are created automatically the first time the app starts against it.

### 2 · API on MonsterASP.NET

In the hosting control panel: turn on the free **Let's Encrypt SSL** certificate first (this is required, not optional — see the HTTPS note below), then activate the **WebDeploy** account and copy out its generated credentials.

In the GitHub repo, add the following under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `WEBSITE_NAME` | `siteXXXX` from the panel |
| `SERVER_COMPUTER_NAME` | `https://siteXXXX.siteasp.net:8172` |
| `SERVER_USERNAME` | `siteXXXX` |
| `SERVER_PASSWORD` | the WebDeploy password |
| `MONGODB_CONNECTION_STRING` | the Atlas `mongodb+srv://…` string |
| `JWT_KEY` | a fresh random string, **32+ characters** |
| `CORS_ALLOWED_ORIGINS` | the Vercel origin, comma-separated for several |

`.github/workflows/deploy-api.yml` runs on every push to `main` that touches anything under `server/`, and it publishes with `--runtime win-x86 --no-self-contained` — matching two specifics of the MonsterASP environment: its app pool runs as a 32-bit process, and the .NET 10 runtime is already preinstalled there, so the app doesn't need to be published as self-contained.

### 3 · SPA on Vercel

Import the repository, and set the **Root Directory** to `client` (Vercel's Vite framework preset handles the rest). Add one environment variable:

```
VITE_API_BASE_URL = https://fitbit.runasp.net/api
```

`vercel.json` rewrites any non-asset path to `index.html`. Without that rewrite, a deep link straight to something like `/activities` would 404 at Vercel's edge before React Router ever gets a chance to mount and handle the route client-side.

**The API must be reachable over `https`, not `http`.** A page served from `https://…vercel.app` is not allowed to call out to a plain `http://fitbit.runasp.net` endpoint — browsers block this as mixed content — and the failure that surfaces in the console is a generic network error that gives no indication the actual cause is a protocol mismatch.

Vercel also assigns a distinct hostname to every preview deployment, not just production, so preview branches will fail CORS checks against the API until each preview's origin is added to `CORS_ALLOWED_ORIGINS` as well.

## Security notes for production

The deployment steps above already take care of two of the basics: `Jwt:Key` and the MongoDB connection string are injected from secrets rather than hardcoded, and `Cors:AllowedOrigins` is narrowed down to just the deployed frontend's origin. Still outstanding, in rough order of how much they matter:

1. **Enable MongoDB authentication.** Atlas turns this on by default, so it's already covered there — but it's worth calling out explicitly for anyone who later points this same codebase at a self-hosted MongoDB instance, which does *not* enable auth out of the box.
2. **Re-enable HTTPS enforcement inside the app itself** — turn `UseHttpsRedirection` back on and set `RequireHttpsMetadata = true`. Right now TLS termination happens entirely at the hosting layer, and the application has no opinion of its own about whether a request arrived encrypted.
3. Atlas's network access is open to `0.0.0.0/0` out of necessity, as explained above — which means the database user's password is the *only* thing standing between the internet and the database. It should be long, random, and unique to this project.
4. The JWT currently lives in `localStorage`, which is readable by any successful XSS attack against the frontend. That trade-off was reasonable when this was a local-only app with no real exposure; now that it's deployed and publicly reachable, the more defensible approach is an httpOnly refresh cookie — which in turn means taking on the CORS-with-credentials, `SameSite`, and CSRF-protection work that an httpOnly cookie setup requires.