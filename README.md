# CareSphere

CareSphere is a local healthcare-management prototype built with HTML, CSS, vanilla JavaScript, Node.js, Express, and SQLite. The frontend and API are served from the same origin so browser sessions and backend requests work together.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

Run these commands from the project folder:

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000) and leave the terminal running. Do not open `index.html` directly or use a separate static server such as VS Code Live Server: the app's API requests and sign-in session need to use the Express server.

If port 3000 is already in use, set a different `PORT` in `.env`, restart the server, and open that port in your browser.

### Environment settings

Edit `.env` before starting the server:

- Set `SESSION_SECRET` to a long, random value.
- To create an administrator account, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The password must be at least 12 characters. Leave both blank to use patient accounts only.

Keep `.env` private; it is excluded from Git. Never use real patient information with this prototype.

## Try the app

1. Check that [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"status":"ok"` and `"database":"connected"`.
2. Select **Get started**, choose **Create an account**, and register with a test email and a password of at least 8 characters.
3. Use **Find a doctor** to submit an appointment request. The appointment is saved in SQLite and appears under **My appointments**.
4. Sign out and sign in again to verify that the account and appointment persist.
5. To use the administrator portal, sign in with the credentials configured in `.env`.

## Project layout

```text
.
├── backend/
│   ├── server.js
│   └── data/              # SQLite database created at runtime
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── index.html
├── .env.example
├── package.json
└── README.md
```

## Backend API

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/doctors` (signed in)
- `GET /api/appointments` (signed in; administrators can see all appointments)
- `POST /api/appointments` (patient account)
- `PATCH /api/appointments/:id/status` (administrator)
- `PATCH /api/profile` (signed in)
- `GET /api/admin/patients` (administrator)

Registration, password hashing, session-based authentication, doctor listings, appointment requests, and profile updates use the backend and SQLite database.

## Prototype limitations

Health records, prescriptions, billing, reports, staff management, and several administrator dashboard actions are still demonstration screens; they are not connected to persistent backend features. Do not use this prototype for real medical records, clinical decisions, or production healthcare services. A production deployment would require, among other things, a persistent session store, HTTPS, appropriate CSRF protections, access-control and privacy reviews, audit logging, backups, and professional security testing.
