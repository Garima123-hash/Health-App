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
- `DEFAULT_HOSPITAL_NAME` sets the initial patient hospital. `ADMIN_HOSPITAL_NAME` assigns the seeded administrator to a hospital with that name. Administrators may create and switch between workspaces assigned to their account.

Keep `.env` private; it is excluded from Git. Never use real patient information with this prototype.

## Try the app

1. Check that [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"status":"ok"` and `"database":"connected"`.
2. Select **Get started**, choose **Create an account**, choose a hospital, and register with a test email and a password of at least 8 characters. Age is optional and can also be added under **My profile**.
3. Use **Find a doctor** to submit an appointment request. The appointment is saved in SQLite and appears under **My appointments**.
4. Sign out and sign in again to verify that the account and appointment persist.
5. To use the administrator portal, sign in with the credentials configured in `.env`.

## Project layout

```text
.
├── backend/
│   ├── server.js           # Express API and SQLite schema
│   └── data/               # Local database and private uploaded files
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
- `GET /api/hospitals` (public hospital choices)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/doctors` (signed in)
- `POST /api/admin/doctors` and `PATCH /api/admin/doctors/:id` (administrator)
- `GET /api/hospital/me`; `GET /api/admin/hospitals`, `POST /api/admin/hospitals`, `POST /api/admin/hospitals/select`, and `PATCH /api/admin/hospital` (administrator workspaces)
- `GET /api/appointments` (signed in; administrators can see all appointments)
- `POST /api/appointments` (patient account)
- `PATCH /api/appointments/:id/status` (administrator)
- `PATCH /api/profile` (signed in)
- `GET /api/admin/patients` (administrator)
- `GET /api/reports`, `POST /api/reports`, `GET /api/reports/:id/download`, `POST /api/reports/:id/summary`, `PATCH /api/reports/:id/share`, `DELETE /api/reports/:id` (patients; own files only)
- `GET /api/admin/reports` (administrator; only patient-shared reports at the active hospital)
- `GET /api/prescriptions` (signed in; administrators can see all)
- `POST /api/admin/prescriptions` (administrator)
- `GET /api/invoices` (signed in; administrators can see all)
- `POST /api/admin/invoices` (administrator)
- `POST /api/invoices/:id/pay-demo` (patient account; simulated status only)
- `GET /api/admin/analytics` (administrator)
- `GET /api/notifications` (signed in)

Registration, password hashing, session-based authentication, hospital selection, hospital-scoped doctors and administrators, appointment requests and statuses, age/profile updates, private report uploads, patient-controlled report sharing, prescription and invoice records, operational counts, and notifications use the backend and SQLite database. Administrators can create hospital workspaces; patient records and doctor management are scoped to the currently selected hospital.

## Prototype limitations

This remains a local learning prototype. File uploads accept PDF, JPG, and PNG files up to 10 MB and are stored locally. The PDF helper extracts selectable text on the server and selects representative sentences; it is not an AI model, sends no files to an external provider, cannot read scanned documents or images, and is not diagnosis or medical advice. Patients control whether each file is shared with their hospital; unshared files remain private. Prescription entries are record-keeping features, and invoice payments are simulated. Do not use real patient information or rely on this app for clinical decisions. A production deployment would require, among other things, malware scanning, a persistent session store, HTTPS, appropriate CSRF protections, access-control and privacy reviews, audit logging, backups, and professional security testing.
