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

Run the isolated backend integration tests with `npm test`. They create temporary SQLite databases and clean them up after each flow.

Open [http://localhost:3000](http://localhost:3000) and leave the terminal running. Do not open `index.html` directly or use a separate static server such as VS Code Live Server: the app's API requests and sign-in session need to use the Express server.

If port 3000 is already in use, set a different `PORT` in `.env`, restart the server, and open that port in your browser.

### Environment settings

Edit `.env` before starting the server:

- Set `SESSION_SECRET` to a long, random value.
- To create an administrator account, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The password must be at least 12 characters. Leave both blank to use patient accounts only.
- `DEFAULT_HOSPITAL_NAME` sets the initial patient hospital. `ADMIN_HOSPITAL_NAME` selects the seeded administrator's initial workspace; the demo administrator is also assigned to the three starter workspaces. Administrators may create and switch between workspaces assigned to their account.

Keep `.env` private; it is excluded from Git. Never use real patient information with this prototype.

## Try the app

1. Check that [http://localhost:3000/api/health](http://localhost:3000/api/health) returns `"status":"ok"` and `"database":"connected"`.
2. Select **Get started**, choose **Create an account**, choose one of the hospital locations, and register with a test email and a password of at least 8 characters. Age is optional and can also be added under **My profile**.
3. Use **Find a doctor** to choose a visit reason and request an appointment. The request is saved in SQLite and opens under **My appointments**; each patient can retrieve only their own appointments.
4. Sign out and sign in again to verify that the account and appointment persist.
5. To use the administrator portal, sign in with the credentials configured in `.env`.
6. Patients can upload reports under **Health records** and open **Reports & AI** to create a local text overview and see per-report usage counts. This helper is not an AI model and does not provide medical advice.
7. Administrators add prescription records for patients in their active hospital workspace. Patients see only records associated with their account. Invoice payment choices are simulations and never charge money.

The starter directory includes CareSphere Community Hospital, CareSphere North Clinic, and CareSphere South Clinic with clearly fictional sample doctors. The configured administrator can manage these workspaces and create additional hospital workspaces.

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
- `GET /api/prescriptions` (signed in; administrators can see saved and pending records for the active hospital)
- `POST /api/admin/prescriptions`, `PATCH /api/admin/prescriptions/:id` (administrator; create for an existing hospital patient or save for a new patient by name/email, and update saved records)
- `GET /api/invoices` (signed in; administrators can see all)
- `POST /api/admin/invoices` (administrator)
- `POST /api/invoices/:id/pay-demo` (patient account; accepts `pay-at-hospital`, `upi-demo`, or `card-demo`; simulated status only)
- `GET /api/admin/analytics` (administrator)
- `GET /api/notifications` (signed in)

Registration, password hashing, session-based authentication, hospital selection, hospital-scoped doctors and administrators, appointment requests and statuses, age/profile updates, private report uploads, patient-controlled report sharing, prescription and invoice records, operational counts, and notifications use the backend and SQLite database. Administrators can create hospital workspaces; patient records and doctor management are scoped to the currently selected hospital. Hospital administrators can save prescriptions for unregistered patients using their name and email; the record remains pending within that hospital and is linked to the account when the patient registers there with the same email address.

## Prototype limitations

This remains a local learning prototype. File uploads accept PDF, JPG, and PNG files up to 10 MB and are stored locally. The PDF helper extracts selectable text on the server and selects representative sentences; it is not an AI model, sends no files to an external provider, cannot read scanned documents or images, and is not diagnosis or medical advice. The Reports & AI section records local overview counts per report; it does not record external AI usage because no external AI is called. Prescription entries are entered by the hospital care team. The app does not use AI to recommend, interpret, or change medicines or doses. Invoice choices (pay at hospital, UPI demo, and card demo) only mark a demo invoice paid; they do not collect payment details, contact a bank, or charge money. Do not use real patient information or rely on this app for clinical decisions. A production deployment would require, among other things, malware scanning, a persistent session store, HTTPS, appropriate CSRF protections, access-control and privacy reviews, audit logging, backups, and professional security testing.
