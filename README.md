# CareSphere — frontend + Node.js + SQLite

This version keeps the existing HTML/CSS/JavaScript design and adds an Express backend with an SQLite database.

## Requirements
- Node.js 20 or newer (Node 24 is suitable)
- VS Code

## 1. Open the project
Extract the ZIP, then in VS Code choose **File → Open Folder** and select `caresphere-frontend`.

## 2. Configure environment
In the VS Code terminal, run:

```powershell
Copy-Item .env.example .env
```

Open `.env`. Replace `SESSION_SECRET` with a long random string. For patient testing, leave `ADMIN_EMAIL` and `ADMIN_PASSWORD` blank. To enable the administrator role, set both to an email and a strong `ADMIN_PASSWORD` of at least 12 characters. This account is created/updated at server startup. Never share `.env` or commit it to Git.

## 3. Install dependencies

```powershell
npm install
```

If `npm` is not recognized, install the current Node.js LTS release from https://nodejs.org, then close and reopen VS Code.

## 4. Start the backend

```powershell
npm start
```

Open **http://localhost:3000** in Chrome/Edge. Do not double-click `index.html`; use the localhost URL so API calls and sessions work.

Keep the terminal running while using the website. Stop the server with `Ctrl+C`.

## 5. Test it
1. Visit `http://localhost:3000/api/health`. Expected JSON includes `"status":"ok"` and `"database":"connected"`.
2. Open the website, click sign in, and choose **Create an account**.
3. Register using a test email address you control and a password of at least 8 characters.
4. Go to **Find a doctor** and book an appointment. Choose a doctor and a future date/time when prompted.
5. Open **My appointments**, refresh the page, or sign out and sign back in. The appointment should remain because it is stored in `backend/data/caresphere.sqlite`.
6. To test login, sign out and sign back in with the same credentials. Incorrect credentials should be rejected.

## API endpoints
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/doctors` (signed in)
- `GET /api/appointments` (signed in; admins can see all)
- `POST /api/appointments` (patient)
- `PATCH /api/appointments/:id/status` (admin)
- `PATCH /api/profile` (signed in)
- `GET /api/admin/patients` (admin)

## Important scope and safety
Registration, password hashing, server-side sessions, doctor listings, appointment requests, appointment status storage, and profile-name updates use the backend/database. Existing overview metrics, prescriptions, health-records, billing, some administrator screens/actions and notification widgets are still illustrative frontend content and are **not** connected to real hospital systems. Do not use real patient or medical data. This is a local learning prototype, not a production healthcare service. Before deployment, use a persistent production session store, HTTPS, CSRF protection as appropriate, audit logs, backups, strict role-based access, privacy review, and professional security testing.
