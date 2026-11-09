# CareSphere

CareSphere is a local healthcare-management prototype built with HTML, CSS, vanilla JavaScript, Node.js, Express, and MongoDB. The frontend and API are served from the same origin.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB 6.0 or newer (local server or MongoDB Atlas)

## Run locally

Start MongoDB locally, or create a MongoDB Atlas database and obtain its connection URI. Then run these commands from the project folder:

```powershell
npm install
Copy-Item configuration\.env.example .env
```

Edit `.env` and set `MONGODB_URI` to the URI for your database. For example, the supplied local default is `mongodb://127.0.0.1:27017/caresphere`. For Atlas, use the URI from your cluster and keep its credentials private. Start the server:

```powershell
npm start
```

Run the integration suite with `npm test`. Tests use separate randomly named MongoDB databases and drop them after each test; they require a reachable MongoDB server. Set `MONGODB_TEST_URI` to a test-only MongoDB URI if the default local server is not appropriate. The tests do not clear the configured base database.

Open [http://localhost:3000](http://localhost:3000) and leave the terminal running. Do not open `index.html` directly or use a separate static server such as VS Code Live Server. If port 3000 is already in use, set a different `PORT` in `.env`.

## Environment settings

- `MONGODB_URI` is required. The database is selected from the URI path. Use a dedicated test database/cluster for automated tests.
- `MONGODB_MAX_POOL_SIZE` and `MONGODB_SERVER_SELECTION_TIMEOUT_MS` optionally control the MongoDB driver's connection pool and server selection timeout.
- Set `JWT_SECRET` to a random value of at least 32 bytes. Access JWTs expire after 15 minutes. Rotating refresh tokens are stored as SHA-256 hashes and delivered only in an HttpOnly, SameSite=Strict cookie.
- To seed an administrator, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The password must be at least 12 characters. Leave both blank to use patient accounts only.
- `DEFAULT_HOSPITAL_NAME` sets the initial patient hospital. `ADMIN_HOSPITAL_NAME` selects the seeded administrator's initial workspace. Administrators may create and switch between workspaces assigned to their account.

Keep `.env` private; it is excluded from Git. Never use real patient information with this prototype. Use TLS and least-privilege database credentials in any shared deployment, and restrict network access to MongoDB.

## Try the app

1. Check that [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"status":"ok"` and `"database":"connected"`.
2. Select **Get started**, choose **Create an account**, choose a hospital location, and register with a test email and a password of at least 8 characters. Age is optional.
3. Use **Find a doctor** to request an appointment. Patients can retrieve only their own appointments.
4. Sign out and sign in again to verify that the account and appointment persist.
5. To use the administrator portal, sign in with the credentials configured in `.env`.
6. Patients can upload reports and create a local text overview. This helper is not an AI model and does not provide medical advice.
7. The optional **Women’s Health** section supports private mood and period-date logs and a local, source-linked health-information guide. It does not diagnose PCOS/PCOD, interpret medical history, or prescribe treatment. Patients separately choose whether their own mood logs or specific PDF reports are included.
8. Administrators add prescriptions for patients in their active hospital workspace. Invoice payment choices are simulations and never charge money.

The starter directory includes CareSphere Community Hospital, CareSphere North Clinic, and CareSphere South Clinic with fictional sample doctors.

## MongoDB persistence

The API uses the official MongoDB Node.js driver. Startup connects once, applies collection JSON Schema validators and indexes, seeds initial records, and only then begins listening. SIGINT/SIGTERM closes the HTTP server and MongoDB client. An unavailable or misconfigured database prevents startup.

Collections cover hospitals, users, doctors, appointments, reports, Women’s Health entries, prescriptions, invoices, hospital-admin assignments, refresh-token families, and counters. Numeric IDs are retained for existing API clients. Indexes enforce unique hospital names, emails, hospital-scoped doctor names, per-user mood/cycle dates, refresh-token hashes, and ID values; additional compound indexes support scoped lookups and date ordering. Routes use async MongoDB operations and add owner/hospital predicates directly to data queries.

Uploaded PDF/JPG/PNG files remain local in `backend/data/uploads` and are not stored in MongoDB. Configure private durable storage and backups appropriate to your deployment. Existing SQLite database files are not used by the new server; back up legacy data before retiring it and plan/perform any legacy data import separately before switching production traffic.

## Project layout

```text
.
├── backend/
│   ├── database.js         # MongoDB connection, validators, indexes, numeric IDs
│   ├── server.js           # Express API and asynchronous MongoDB operations
│   └── data/uploads/       # Private local report files
├── configuration/
│   └── .env.example        # Environment template (copy to .env)
├── test/                   # API integration tests
├── helpers.cjs             # Test server and request helpers
├── index.html
├── package.json
└── README.md
```

## Backend API

- `GET /api/health`, `GET /api/hospitals`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/doctors`, `POST /api/admin/doctors`, `PATCH /api/admin/doctors/:id`
- `GET /api/hospital/me`; `GET /api/admin/hospitals`, `POST /api/admin/hospitals`, `POST /api/admin/hospitals/select`, `PATCH /api/admin/hospital`
- `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id/status`, `PATCH /api/profile`
- `GET /api/admin/patients`
- `GET /api/reports`, `POST /api/reports`, `GET /api/reports/:id/download`, `POST /api/reports/:id/summary`, `PATCH /api/reports/:id/share`, `DELETE /api/reports/:id`
- `GET /api/womens-health`, `POST /api/womens-health/consent`, `POST /api/womens-health/mood`, `POST /api/womens-health/cycle`, `POST /api/womens-health/guide`, `DELETE /api/womens-health/data`
- `GET /api/admin/reports` (patient-shared reports at the active hospital)
- `GET /api/prescriptions`, `POST /api/admin/prescriptions`, `PATCH /api/admin/prescriptions/:id`
- `GET /api/invoices`, `POST /api/admin/invoices`, `POST /api/invoices/:id/pay-demo`
- `GET /api/admin/analytics`, `GET /api/notifications`

Protected requests use `Authorization: Bearer <access-token>`. Access tokens are short-lived and should not be persisted in browser storage; the frontend keeps them in memory and uses the HttpOnly refresh cookie after reload.

## Prototype limitations

This remains a local learning prototype. File uploads accept PDF, JPG, and PNG files up to 10 MB and are stored locally. The PDF helper extracts selectable text and selects representative sentences; it is not an AI model, sends no files to an external provider, cannot read scanned documents or images, and is not diagnosis or medical advice. The Women’s Health guide retrieves matching passages from a small bundled set of public health-information summaries and optionally selected PDFs. Mood and cycle logs are private to the patient account and can be deleted from the section.
