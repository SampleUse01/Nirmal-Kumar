# Enterprise Workforce Management System

A TypeScript monorepo starter for a secure workforce-management product. The current runnable slices cover authentication, role checks, employee and department records, general-shift attendance, request workflows, notifications, and an audit trail. It is still a foundation; the remaining modules listed in the roadmap are not yet implemented.

## What works in this foundation

- React, Vite, Tailwind CSS, Framer Motion, React Router, and TanStack Query.
- Express, MongoDB/Mongoose, Zod request validation, Helmet, CORS, and rate limits.
- Backend MVC separation: Express route files define paths and middleware; request validation and endpoint logic live in `apps/api/src/controllers/`.
- A dedicated MongoDB connection module with colored connection/reconnection logs and credential-safe error hints.
- App-wide light/dark theme toggle that persists the selected preference across pages and reloads.
- Shared animated toast notifications for sign-in/out, profile and password updates, attendance actions, and employee/department changes; notifications can be dismissed and pause their timeout while hovered.
- Role-wide profile screen with synchronized employee/account email updates and a password-change flow.
- Super-admin bootstrap, admin-created employee accounts, password hashing, temporary-password change on first sign-in, lockout after repeated failed logins, and HttpOnly JWT cookies.
- Access-token refresh rotation and logout-all-sessions behavior.
- Role-gated department and employee management, employee search/pagination, and soft deactivation.
- Super Admin CSV employee/department import with template downloads, preview, explicit confirmation, duplicate/validation reports, and per-row results; filtered CSV exports for employees, departments, dashboard attendance, and audit logs.
- Server-side search and UTC date filters (today, 7 days, 1 month, 1 year, or custom dates) on employee, department, attendance, request, notification, and audit-log data. Export applies the same active filters as the page.
- Super-admin role/permission console with configurable permissions for built-in Admin and Employee roles, API-side permission guards, role-aware navigation/actions, Admin account creation/deactivation, and forced temporary-password rotation.
- Employee check-in/check-out, daily attendance view, and general-shift late/early/overtime calculations.
- Leave, permission, overtime, and attendance-regularization request submission, employee self-scoping, admin review, mandatory rejection reasons, request cancellation, and status history.
- Approved regularizations recalculate attendance; approved late-arrival/early-exit permissions adjust attendance metrics, and approved overtime is included in overtime recalculation.
- Persistent in-app decision notifications, notification read/archive actions, audit records for authentication/profile changes, successful API mutations, and request reviews; audit-log viewing is super-admin-only.
- Role-specific navigation and route guards for the implemented employee, admin, and super-admin pages.
- API health endpoint and focused attendance-calculation tests.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm.
- MongoDB Atlas or a local MongoDB instance.

On Windows PowerShell systems that block script execution, use `npm.cmd` instead of `npm`.

## Start locally

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Set `MONGODB_URI`, `WEB_ORIGIN`, and the bootstrap administrator email/password. The bootstrap password must have uppercase, lowercase, a number, a special character, and at least eight characters.
3. Install dependencies from the repository root:

   ```sh
   npm install
   ```

4. Generate two independent, cryptographically random JWT secrets. This writes them to `apps/api/.env` without printing their values:

   ```sh
   npm run jwt:secrets -w @wms/api
   ```

   To rotate already-generated secrets, run `npm run jwt:secrets -w @wms/api -- --rotate`. Rotation invalidates all existing access and refresh tokens.

5. Create the first super-admin (this command refuses to overwrite an existing account):

   ```sh
   npm run seed:admin -w @wms/api
   ```

6. Start the API and web app:

   ```sh
   npm run dev
   ```

7. Open `http://localhost:5173`, sign in with the bootstrap credentials, create departments, and add employees. Each employee receives a temporary password and must change it at first sign-in.

### MongoDB Atlas connection troubleshooting

- Copy the URI from Atlas **Database → Connect → Drivers** and use a **Database Access** user, not your Atlas website login.
- For Atlas, include `authSource=admin` in the query string, for example `mongodb+srv://<encoded-user>:<encoded-password>@<cluster-host>/<database>?retryWrites=true&w=majority&authSource=admin`. Replace every placeholder; never commit or share the real URI.
- URL-encode special characters in the database username and password (for example `@` as `%40`, `:` as `%3A`, `/` as `%2F`, and `#` as `%23`). Keep the URI on one line in `.env`.
- Confirm the database user password is current and the user has read/write access to the intended database. Check Atlas **Network Access** allows the development machine's current public IP; do not use an unrestricted IP rule for production.
- An Atlas `bad auth` / code `8000` error points to credentials, URI encoding, or `authSource`; an IP access-list problem has a different network/connection error.
- If an Atlas user's password is unknown, reset it in Atlas Database Access and update the local `.env` yourself. Do not paste the URI, username/password, or secrets into chat.
- The API owns MongoDB startup and shutdown in `apps/api/src/config/database.ts`; colored status messages use the `colors` package and never print the connection URI.

The API listens on port 4000 by default; the Vite development server proxies `/api` requests to `127.0.0.1:4000`. The web and API listen on network interfaces so a LAN device can open the web app. `WEB_ORIGIN` accepts a comma-separated allowlist; for LAN access, include both local and LAN frontend origins, such as `http://localhost:5173,http://192.168.1.46:5173`. Replace the IP with the development machine's current LAN IP. Copy `apps/web/.env.example` to `apps/web/.env` only when overriding the default API URL.

The API starts even when MongoDB is temporarily unavailable so the frontend can load and show a useful connection message. `/api/health` reports a `503` degraded status until MongoDB connects, and database-dependent endpoints return `503`. The API retries a failed initial MongoDB connection every 10 seconds; fix the Atlas URI/IP allowlist and it will recover without restarting.

### JWT session lifecycle

- `JWT_ACCESS_SECRET` signs short-lived access JWTs (15 minutes by default); `JWT_REFRESH_SECRET` signs refresh JWTs (7 days by default). Keep them distinct and private. The API requires at least 32 characters for each.
- Successful login places the access token in an HttpOnly cookie and the refresh token in a path-limited HttpOnly cookie. The browser does not store or read tokens in local storage.
- When an API request returns 401, the web client calls `/api/auth/refresh` and retries once. Refresh increments the account token version, so older sessions for that account are invalidated. Logging out, changing the password, or deactivating an account also invalidates existing sessions.
- Local development uses HTTP on localhost. Production cookies require HTTPS; configure `WEB_ORIGIN` to the exact frontend origin and use a same-site domain or reverse proxy to avoid third-party-cookie restrictions.
- Never paste secrets into chat, commit `.env`, reuse JWT secrets across environments, or use access/refresh tokens as the secret values. The `jwt:secrets` command generates signing secrets; login tokens themselves are issued by the API at runtime.

### Seed a complete local demo workspace

1. In `apps/api/.env`, set the bootstrap super-admin email/password and the demo admin/employee email/passwords. The example file includes the four `DEMO_*` settings. Use unique emails and strong passwords (8-128 characters with uppercase, lowercase, a number, and a special character). Never use demo accounts in production.
2. Ensure `NODE_ENV=development`, MongoDB credentials/network access are correct, and the database is reachable.
3. From the repository root, run:

   ```powershell
   npm.cmd run seed:demo -w @wms/api
   ```

   On systems where `npm` works directly, use `npm run seed:demo -w @wms/api`.
4. Start the app using `npm.cmd run dev`, then sign in with one of the configured emails and its matching password from `.env`.

The seed creates or reuses three accounts (Super Admin, Admin, Employee), People Operations and Engineering departments, linked employee profiles, yesterday's completed general-shift attendance, and today's open attendance. Demo Admin and Employee accounts must change their password at first login. The command is idempotent: existing accounts keep their passwords, and existing matching profiles/attendance are not overwritten. It fails on conflicting demo identities and refuses to run when `NODE_ENV=production`.

### Seed a complete 10-employee workflow demo

1. Configure all bootstrap/demo email and strong password values in `apps/api/.env`, including `DEMO_EMPLOYEE_PASSWORD`. Newly created employee accounts use this demo password and must change it at first sign-in; existing account passwords are preserved. The first employee is the existing `DEMO_EMPLOYEE_EMAIL`; the other nine use plus-addresses such as `employee.demo+02@example.com`. The script never prints passwords.
2. Verify MongoDB is connected and `NODE_ENV=development`.
3. From the repository root, run:

   ```powershell
   npm.cmd run seed:workforce -w @wms/api
   ```

   The command first runs the base demo seed, then provisions exactly ten complete employee profiles across People Operations, Engineering, Operations, and Finance, including employee ID, name, email, dummy phone/address, designation, department, manager, joining date, active status, and linked user account. It adds ten weekdays of attendance per employee, Leave/Permission/Overtime/Regularization examples with pending, approved, rejected, and cancelled states, linked employee/admin notifications, and audit entries. Super Admin can inspect system data, Admin can review team requests, and each Employee login sees only its own attendance, requests, and notifications. The seed is idempotent, preserves existing records/passwords and non-empty profile values, and is blocked in production.

To run only the original one-account setup, use `npm.cmd run seed:admin -w @wms/api`; it creates the bootstrap Super Admin and refuses to overwrite an existing user.

## End-to-end core flow

1. Bootstrap a super-admin from server-side environment variables.
2. Sign in; the server issues HttpOnly access and refresh cookies. The browser never reads JWTs.
3. Create departments, then create employee records with a temporary password. Account and employee record are linked.
4. An employee signs in, changes the temporary password, and can then see only their own employee record and attendance.
5. The employee checks in and checks out. The API stores timestamps and derives work minutes, late minutes, early departure, and overtime against a 09:00–18:00 UTC baseline.
6. Admins can view team attendance and manage employee/department records; deactivation is soft-delete behavior.

## API routes

All routes are prefixed with `/api`.

| Route | Access | Purpose |
|---|---|---|
| `GET /health` | Public | Health probe |
| `POST /auth/login` | Public, rate-limited | Sign in |
| `POST /auth/refresh` | Refresh cookie | Rotate refresh/access cookies |
| `POST /auth/change-password` | Signed-in user | Change current/temporary password |
| `POST /auth/logout` | Signed-in user | Invalidate all sessions and clear cookies |
| `GET /auth/me` | Signed-in user | Current user and linked employee |
| `/departments` | Signed-in; writes by admin | List/create/update/deactivate departments |
| `/employees` | Signed-in; CSV import/export by Super Admin | Search, paginate, date-filter, create, update, deactivate, CSV import/export |
| `/departments` | Admin or Super Admin; CSV import/export by Super Admin | Search, date-filter, CRUD, CSV import/export |
| `/attendance` | Signed-in; employee data is self-scoped | Date-filtered list and summary, check in/out, attendance CSV export |
| `/work-requests` | Signed-in; employee self-scoped, admin review | Search/date/status-filter, submit/list/cancel requests, approve/reject |
| `/notifications` | Signed-in; own notifications only | List, mark read, and archive in-app notifications |
| `/audit-logs` | Super Admin | Search/date-filtered audit trail and CSV export |
| `/access/roles`, `/access/admins` | Super Admin | Configure built-in role permissions and manage Admin accounts |

JSON errors use `{ "message": "..." }`; validation errors include an `issues` array. Attendance date boundaries and the default shift baseline are UTC in this starter.

### CSV imports and date filters

The employee and department pages provide CSV templates, a client-side file preview, and a separate confirmation step. Imports are sent to the API as validated batches (maximum 1,000 records / 1 MB request body); the response reports each source row's outcome. Employee CSV columns are `employeeId,name,email,phone,department,designation,joiningDate,initialPassword`. An unknown department name is created as an active department during the confirmed employee import; an archived department must first be restored. Each initial password must meet the existing password policy and is marked for change at first login. Passwords are masked in previews and excluded from audit entries and exports; securely deliver temporary credentials to employees. Department CSV columns are `name,description`.

List and export endpoints accept `search` plus `preset=today|7d|1m|1y`, or `preset=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`. Custom end dates are inclusive. Date filters use UTC day boundaries; CSV exports apply the same search/date/status filters currently selected in the UI. Import and export actions are added to the audit trail.

## Checks

```sh
npm test
npm run build
```

## Deploy to Render and Vercel

This repository is an npm-workspaces monorepo. Deploy the API and frontend as separate services, and keep MongoDB on MongoDB Atlas. Do not commit credentials or paste them into build logs.

### 1. Prepare MongoDB Atlas

1. Create a production database and a dedicated Atlas **Database Access** user with only the required database permissions.
2. In **Network Access**, allow the outbound IP addresses for the Render region/service you use. Avoid `0.0.0.0/0` for production.
3. Copy the Atlas driver URI and URL-encode special characters in the database username/password. Use a database name in the URI and add `authSource=admin` if needed.
4. Keep this URI for Render's `MONGODB_URI` environment variable only.

### 2. Deploy the API on Render

1. Push this repository to GitHub and create a Render **Web Service** from it.
2. Use these settings (the project root must remain the service's root so npm can see the workspace lockfile):

   | Setting | Value |
   |---|---|
   | Root Directory | `.` (repository root) |
   | Runtime | Node |
   | Node Version | 22.x (22.12 or newer) |
   | Build Command | `npm ci && npm run build -w @wms/api` |
   | Start Command | `npm run start -w @wms/api` |
   | Health Check Path | `/api/health` |

3. Add these environment variables in Render's service settings. `PORT` is supplied by Render; do not hardcode it.

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas production URI |
   | `WEB_ORIGIN` | Exact Vercel frontend origin, such as `https://wms.example.com` (origin only; no path or trailing slash) |
   | `JWT_ACCESS_SECRET` | Random secret of at least 32 characters |
   | `JWT_REFRESH_SECRET` | Different random secret of at least 32 characters |
   | `BOOTSTRAP_ADMIN_EMAIL` | Initial Super Admin email |
   | `BOOTSTRAP_ADMIN_PASSWORD` | Strong, unique password for the initial Super Admin |

   `ACCESS_TOKEN_MINUTES` and `REFRESH_TOKEN_DAYS` are optional; defaults are 15 minutes and 7 days. Do not set demo credentials in production. You can generate the two JWT secrets locally with `npm.cmd run jwt:secrets -w @wms/api`, then enter their values directly into Render's secret environment fields. Do not commit generated `.env` values.

4. Deploy and wait for the service to become healthy. Open `https://<your-render-service>.onrender.com/api/health`; it should return HTTP 200 and `"database":"connected"`. If it does not, check Render logs, Atlas credentials, and Atlas Network Access.
5. Create the initial Super Admin exactly once using the production service environment. If Render Shell is available, run `npm run seed:admin -w @wms/api` from the checked-out repository. Otherwise run the same command once from a trusted local checkout with Node/npm, setting the production `MONGODB_URI`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in that process's environment. Never save production credentials in a committed file. The seed command refuses to overwrite an existing account.

### 3. Deploy the frontend on Vercel

1. Import the same GitHub repository as a Vercel project. Keep **Root Directory** set to the repository root (`.`), select Node.js 22.x, and leave the project as a static Vite deployment; the included [`vercel.json`](./vercel.json) defines the npm workspace build, static output directory, and SPA route fallback.
2. Add this environment variable for **Production** (and Preview only if you want previews to use a real API):

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-render-service>.onrender.com/api` |

   Use the real Render service hostname, not a placeholder, and include `/api`. This variable is embedded into the frontend at build time, so redeploy after changing it.
3. Deploy. Open the Vercel URL and confirm the login page loads. The React Router fallback is configured so direct links and page refreshes resolve to the app.

### 4. Set cookie-compatible production domains

The app uses secure HttpOnly cookies and credentialed cross-origin API requests. Add the final Vercel origin (exact scheme and host, no path) to Render's `WEB_ORIGIN`, then redeploy the API. For example, `https://wms.example.com`; if using multiple frontend origins, separate them with commas.

For the most reliable browser cookie behavior, use a custom domain on the same site for both services, such as `wms.example.com` on Vercel and `api.example.com` on Render, and set `VITE_API_URL=https://api.example.com/api`. Configure the custom domains and DNS in each provider, then set `WEB_ORIGIN=https://wms.example.com`. The default `*.vercel.app` and `*.onrender.com` hosts are on different sites; some browsers/privacy settings can block cookies between them even though CORS is configured. Verify login, refresh, and logout in the browsers your users will use before production launch.

### 5. Production smoke checks

1. Visit `/api/health` on the Render domain and verify database connectivity.
2. Sign in through the Vercel frontend with the bootstrapped Super Admin and complete the forced password change if prompted.
3. Refresh the browser and verify the session remains active; sign out and verify protected routes return to login.
4. Confirm Render `WEB_ORIGIN` exactly matches the deployed frontend origin. Browser CORS/CSRF failures usually indicate a missing or mismatched origin.
5. Create a department and a test employee, verify the employee's temporary-password flow, then remove/deactivate test data before inviting real users.

Render's free web services may sleep while idle and can have slower first requests; select an appropriate plan for production availability. Configure MongoDB backups and restore drills before storing real employee data. Uploaded documents, outbound email, and automated backups are not implemented in this foundation.

## Product roadmap

Implement and validate these as separate vertical slices before production rollout:

1. Organization settings, configurable workweek/timezone/shift rules, configurable leave entitlements and balance deductions, leave-to-attendance integration, and multi-level approvals.
2. Shift templates, assignment/history/calendar, rotational and overnight shifts, shift swaps, location/IP policy, holiday calendar, and timezone-aware attendance.
3. Supporting-document uploads, email delivery, policy/announcement content and acknowledgements, public-holiday calendar, and birthday/work-anniversary reminders.
4. Monthly working-hour, attendance-percentage, and shift-compliance summaries; additional attendance/leave/department report exports and CSV dry-run workflows.
5. Dashboard trends and analytics, OpenAPI documentation, email verification, forgot/reset-password flows, accessibility/responsive polish, observability, and backup/restore verification.

The application supports three built-in roles (Super Admin, Admin, Employee); it does not create arbitrary role names. Admin and Employee permission changes are stored in MongoDB and enforced by API middleware. The current leave workflow counts inclusive calendar days and records approval status; it does not calculate configured leave balances or automatically create leave attendance records. Before enabling payroll or compliance decisions, define leave entitlements, organization-local timezone semantics, overnight-shift rules, holiday/weekend calendars, approval authority, and audit retention with the business owner. The current general-shift calculations are a starter baseline, not a substitute for those rules.
