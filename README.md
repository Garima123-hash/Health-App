# CareSphere | Cryptographic Healthcare Platform & Blockchain Vault

CareSphere is an enterprise-grade, full-stack connected healthcare platform designed to solve one of the most critical challenges in modern medicine: **fragmented patient records, lack of cross-hospital data portability, and vulnerable audit trails.**

CareSphere connects multiple hospital facilities, specialist physicians, and patients under a unified portal backed by an **in-engine Cryptographic SHA-256 Blockchain Ledger** running entirely on **MongoDB**. Every clinical report, appointment lifecycle transition, doctor onboarding, and patient registration is immutably fingerprinted and sealed into the blockchain ledger.

---

## 🌟 Executive Summary & Key Highlights

* **Cross-Hospital Clinical Records Dossier**: When a patient visits any connected hospital (e.g., *CareSphere Central Hospital*, *Apollo Multi-Specialty Hospital*, *Metro City Healthcare*), authorized doctors and hospital staff have immediate access to the patient's complete cross-hospital medical dossier and latest diagnostic spotlight.
* **Bi-directional Report Visibility**:
  * **Hospitals** can issue diagnostic lab results, consultation notes, prescriptions, and radiology files directly to any patient's vault.
  * **Patients** see all medical documents in a unified vault—both hospital-issued clinical reports (`🏥 Issued by [Hospital]`) and self-uploaded personal health documents (`👤 Uploaded by You`).
* **In-Engine SHA-256 Blockchain Vault**:
  * Every uploaded medical report is cryptographically fingerprinted using native SHA-256 digests.
  * Every consultation status update, doctor onboarding, and registration event is mined into a discrete blockchain block with proof-of-work (`nonce`) and parent linking (`previousHash`).
* **Live Hackathon Judge Demonstration Suite**: Built-in interactive controls to verify ledger integrity in real time, simulate malicious database tampering on Block #1, and restore the cryptographic chain.
* **100% Cloud-Native MongoDB Architecture**: Complete migration away from legacy file-based SQLite to scalable MongoDB (Atlas & local), with connection fallback, public DNS SRV resolution (`8.8.8.8`, `1.1.1.1`), and persistent session storage via `connect-mongo`.

---

## 🏗️ System Architecture & Workflow

```text
+---------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                 |
|   Vanilla JS Single-Page App (SPA) • Reactive State Machine • Responsive CSS3 UI      |
+-------------------------------------------+-------------------------------------------+
                                            |
                         HTTPS REST / Session Cookies
                                            |
+-------------------------------------------v-------------------------------------------+
|                                  BACKEND API (EXPRESS)                                |
|   • Helmet Security Headers               • bcryptjs Password Hashing (Salt 10)       |
|   • express-rate-limit Defense             • express-session + connect-mongo (Atlas)   |
|   • Multer Multipart File Ingestion       • Role-Based Access Control (Admin/Patient) |
+---------------------+-------------------------------------+---------------------------+
                      |                                     |
                      v                                     v
+-------------------------------------+   +---------------------------------------------+
|        MONGODB CLUSTER (ATLAS)      |   |       CRYPTOGRAPHIC BLOCKCHAIN ENGINE       |
|   • Users (Patients & Admins)       |   |   • Genesis Block Initialization            |
|   • Hospitals & Doctor Rosters      |   |   • SHA-256 Fingerprint Mining              |
|   • Appointments & Schedules        |   |   • Cryptographic Hash Chaining             |
|   • Medical Reports & Meta Vault    |   |   • Real-Time Chain Validator               |
|   • Blockchain Block Collection     |   |   • Tamper Detection & Recovery Engine      |
+---------------------+---------------+   +---------------------------------------------+
                      |
                      v
+---------------------------------------------------------------------------------------+
|                        SECURE AT-REST FILE STORAGE SYSTEM                             |
|   • Isolated directory: /backend/data/uploads/                                        |
|   • Stored under sanitized UUIDs, streamed securely with role-based validation         |
+---------------------------------------------------------------------------------------+
```

---

## 🚀 Core Features & Functional Modules

### 1. Multi-Hospital Administration & Facility Management
* **Hospital-Specific Staff Login**: Administrators can specify their hospital affiliation upon sign-in. The system synchronizes their hospital profile directly into session memory and the server `.env` configuration (`ADMIN_HOSPITAL`).
* **Doctor Onboarding per Hospital**: Administrators can register medical specialists directly to their hospital's roster with specialty, years of experience, and visual badge. Each onboarding event triggers a `DOCTOR_ONBOARDED` blockchain transaction.
* **Hospital Directory Auto-Discovery**: As doctors and facilities are registered, hospitals are automatically exposed to the patient booking engine.

### 2. Cross-Hospital Clinical Records & Diagnostic Vault
* **Global Report Issuance**: Hospital staff can upload and issue medical records for any registered patient across the network through:
  * The dedicated **Health records** tab (`➕ Issue Report to Patient`).
  * The **Patient directory** (`➕ Add Report` next to any patient row).
  * Inside the **Patient Clinical Records Modal** directly from an active appointment.
* **Supported Record Categories**:
  * 🧪 *Diagnostic Lab Report*
  * 🩺 *Consultation Notes*
  * 💊 *Prescription*
  * 📋 *Discharge Summary*
  * 🩻 *Imaging / Radiology*
  * 💉 *Vaccination Record*
  * 📄 *General Medical Record*
* **🔥 Latest Report Spotlight**:
  * The top of the records modal spotlights the most recent diagnostic file for the patient, showcasing the document name, category badge, issuing hospital, timestamp, file size, SHA-256 cryptographic verification seal, and an instant `⬇ View / Download` button.
* **Cross-Hospital Clinical Timeline**:
  * A chronological history of all past documents issued across any connected facility.
* **Patient-Side Experience**:
  * Patients can log in to view their complete consolidated records.
  * Every record visibly displays its provenance (`🏥 Issued by [Hospital Name]` vs. `👤 Uploaded by You`).
  * Patients can upload personal past test results and download any document securely.

### 3. Smart Hospital-Aware Appointment Booking
* **Facility & Specialist Filtering**: Patients select their preferred hospital facility; the doctor selector automatically filters to doctors practicing at that hospital.
* **Validation & Conflict Prevention**: Rejects past dates, prevents double-booking, and validates future timestamps.
* **Live Appointment Lifecycle**:
  * Admin appointments table features interactive status dropdowns: `⏳ Pending`, `✅ Confirmed`, `🏆 Completed`, `❌ Cancelled`.
  * Every status change is cryptographically sealed onto the blockchain ledger with admin attribution and timestamp.
* **Immediate Record Access from Appointments**:
  * Admin appointment rows display a live records badge: `📋 X Records • Latest: [filename]`.
  * One-click access to the patient's records modal directly from the consultation schedule.

### 4. Cryptographic SHA-256 Blockchain Ledger
* **Block Anatomy**:
  * `index`: Sequential block position.
  * `timestamp`: ISO-8601 creation time.
  * `type`: Transaction category (`GENESIS`, `PATIENT_REGISTRATION`, `DOCTOR_ONBOARDED`, `APPOINTMENT`, `APPOINTMENT_STATUS_UPDATE`, `MEDICAL_RECORD`, `HOSPITAL_PROFILE_UPDATED`).
  * `title`: Human-readable summary of the medical transaction.
  * `actor_id` & `actor_name`: Identity of the performing user or medical staff.
  * `data`: Full transaction payload.
  * `data_hash`: SHA-256 fingerprint of the data payload.
  * `previous_hash`: SHA-256 link to the preceding block.
  * `hash`: Calculated cryptographic SHA-256 block hash.
  * `nonce`: Proof-of-work iteration counter.
* **Real-Time Cryptographic Validation**: Recalculates hashes sequentially from Genesis to the latest block to guarantee no records have been altered.
* **Interactive Hackathon Judge Demo Suite**:
  * `✓ Verify Chain Integrity`: Recalculates cryptographic hashes on demand.
  * `🚨 Simulate Tamper (Judge Demo)`: Modifies payload data in Block #1 to simulate a database injection attack, immediately turning the blockchain interface red and displaying the corrupted block index.
  * `↺ Restore Ledger`: Cryptographically recalculates and re-seals the chain back to valid state.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, Modern CSS3 (CSS Variables, Flexbox/Grid, Dark/Light Accents), Vanilla JavaScript SPA (No heavy build steps, instant load) |
| **Backend** | Node.js (v20+), Express.js |
| **Database** | MongoDB (v6+) with Mongoose ODM, MongoDB Atlas Cloud Support |
| **Cryptography** | Node.js native `crypto` module (SHA-256 digests, Proof-of-Work engine) |
| **Session & Auth** | `express-session`, `connect-mongo` (Atlas-backed persistent sessions), `bcryptjs` (Salt rounds: 10) |
| **Security** | `helmet` (HTTP security headers), `express-rate-limit` (brute-force defense), HTTP-only cookies |
| **File Ingestion** | `multer` multipart streaming to secure storage |

---

## 📂 Project Directory Structure

```text
caresphere/
├── backend/
│   ├── server.js                 # Unified backend server: Express, Mongoose schemas,
│   │                             # Blockchain engine, Multer upload, and 20+ API routes
│   └── data/
│       └── uploads/              # Isolated directory for uploaded medical reports
├── css/
│   └── styles.css                # Responsive UI system, CSS tokens, dashboard layout,
│                                 # records spotlight card, and blockchain explorer styling
├── js/
│   └── app.js                    # Frontend Single Page Application (SPA), state management,
│                                 # modals, records renderer, and blockchain visualizer
├── index.html                    # Main entry HTML, navigation tabs, and dialog overlays
├── scripts/
│   └── migrate-sqlite-to-mongo.js# Historical migration utility from SQLite to MongoDB
├── .env.example                  # Environment variable blueprint
├── package.json                  # Dependencies and execution scripts
└── README.md                     # Comprehensive system documentation
```

---

## ⚙️ Installation & Local Setup

### Prerequisites
1. **Node.js**: Version 20.x or higher installed (`node -v`).
2. **MongoDB**: Local MongoDB instance running on `mongodb://localhost:27017` **OR** a MongoDB Atlas connection string.

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd herhack
npm install
```

### Step 2: Configure Environment Variables

Create your local `.env` configuration file:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Open `.env` and verify the settings:

```dotenv
PORT=3000
NODE_ENV=development
SESSION_SECRET=a_long_random_secure_secret_phrase_for_caresphere

# Administrator Credentials (Optional - pre-seeded if left empty)
ADMIN_EMAIL=admin@caresphere.com
ADMIN_PASSWORD=AdminPassword@123
ADMIN_HOSPITAL=CareSphere Central Hospital

# MongoDB Connection String (Local or MongoDB Atlas)
MONGODB_URI=mongodb://localhost:27017/caresphere
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000
```

> **Note for MongoDB Atlas Users**:
> Paste your Atlas connection string into `MONGODB_URI`:
> ```dotenv
> MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/caresphere?retryWrites=true&w=majority
> ```
> CareSphere automatically configures public DNS servers (`8.8.8.8`, `1.1.1.1`) to resolve MongoDB SRV records reliably.

### Step 3: Start the Application

```bash
npm start
```

For automatic reloading during development:

```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 🔑 Pre-Seeded Demo Credentials (Hackathon Ready)

When booted against a clean database, CareSphere automatically seeds realistic records, clinical staff, and initial blockchain blocks.

### 1. Hospital Administrator Portal
* **Role**: Admin / Hospital Staff
* **Email**: `admin@caresphere.com`
* **Password**: `AdminPassword@123`
* **Hospital Name**: `CareSphere Central Hospital` *(Can be changed during login or in settings)*
* **Capabilities**: Issue diagnostic reports for any patient, view all appointments across hospitals, onboard specialist doctors, update appointment statuses, inspect and simulate tampering on the blockchain ledger.

### 2. Patient Portal
* **Role**: Patient
* **Email**: `vedant@example.com`
* **Password**: `Password@123`
* **Capabilities**: View personalized health records (hospital-issued + self-uploaded), book appointments by hospital and doctor, upload personal lab documents, view blockchain verification seals, update profile.
* *Alternative seeded patients*: `aarav@example.com`, `meera@example.com`, `kabir@example.com`, `anaya@example.com` (All passwords: `Password@123`).

---

## 📡 Complete REST API Reference

### System & Configuration
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Server health status and MongoDB connectivity state |
| `GET` | `/api/auth/config` | Public | Returns available authentication modes and default hospital facility |

### Authentication & Identity
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new patient account; hashes password with bcrypt, logs into session, and mines a `PATIENT_REGISTRATION` block |
| `POST` | `/api/auth/login` | Public | Authenticate patient or admin; verifies password hash and sets up secure session |
| `GET` | `/api/auth/me` | Public | Returns active user session identity, role, and hospital affiliation |
| `POST` | `/api/auth/logout` | Authenticated | Terminates active session and destroys session cookie |
| `PATCH` | `/api/profile` | Authenticated | Updates personal profile information (name, email, password) |

### Hospitals & Doctors
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/hospitals` | Authenticated | Lists all registered hospital facilities across the platform |
| `GET` | `/api/doctors` | Authenticated | Returns active doctors list (supports filter query `?hospital=`) |
| `POST` | `/api/admin/doctors` | Admin Only | Onboards a new doctor to a specific hospital and mines a `DOCTOR_ONBOARDED` block |
| `PATCH` | `/api/admin/hospital` | Admin Only | Renames hospital facility, updates roster, synchronizes `.env`, and mines a `HOSPITAL_PROFILE_UPDATED` block |

### Appointments Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/appointments` | Authenticated | Returns appointments (Admin: all platform appointments with patient ID; Patient: personal bookings) |
| `POST` | `/api/appointments` | Patient Only | Books a new appointment with chosen hospital and doctor; mines an `APPOINTMENT` block |
| `PATCH` | `/api/appointments/:id/status` | Admin Only | Updates appointment status (`Pending`, `Confirmed`, `Completed`, `Cancelled`); mines an `APPOINTMENT_STATUS_UPDATE` block |

### Cross-Hospital Medical Records & Vault
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/reports` | Authenticated | Returns medical records (Admin: all records or filtered by `?patientId=`; Patient: all records belonging to their account) |
| `POST` | `/api/reports/upload` | Authenticated | Accepts multipart file (`report`), computes SHA-256 hash, stores file on disk, saves metadata to MongoDB, and mines a `MEDICAL_RECORD` block |
| `GET` | `/api/reports/:id/download` | Authenticated | Streams file securely inline or attachment; enforces role-based access validation |

### Blockchain Ledger & Integrity
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/blockchain` | Public | Retrieves complete array of blockchain blocks and validation status |
| `GET` | `/api/blockchain/verify` | Public | Recalculates cryptographic SHA-256 hashes across all blocks |
| `POST` | `/api/blockchain/simulate-tamper` | Public | Intentionally alters payload data of Block #1 to demonstrate instant tamper detection |
| `POST` | `/api/blockchain/repair` | Public | Recalculates and re-seals cryptographic hashes to restore chain integrity |

---

## 🗄️ Database Schemas (MongoDB / Mongoose)

### 1. `User` Schema
```javascript
{
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, required: true, enum: ['patient', 'admin'], default: 'patient' },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  created_at: Date,
  updated_at: Date
}
```

### 2. `Hospital` Schema
```javascript
{
  name: { type: String, required: true, unique: true, trim: true },
  city: { type: String, default: 'Metro Campus', trim: true },
  created_at: Date,
  updated_at: Date
}
```

### 3. `Doctor` Schema
```javascript
{
  name: { type: String, required: true, trim: true },
  specialty: { type: String, required: true, trim: true },
  experience: { type: String, default: '10 years experience', trim: true },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  symbol: { type: String, default: '👨‍⚕️' },
  available: { type: Boolean, default: true },
  created_at: Date,
  updated_at: Date
}
```

### 4. `Appointment` Schema
```javascript
{
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_name: { type: String, required: true, trim: true },
  patient_email: { type: String, default: '', lowercase: true, trim: true },
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  appointment_at: { type: Date, required: true },
  reason: { type: String, default: 'Consultation', trim: true },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending' },
  created_at: Date,
  updated_at: Date
}
```

### 5. `Report` Schema (Cross-Hospital Records)
```javascript
{
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patient_name: { type: String, required: true, trim: true },
  patient_email: { type: String, default: '', lowercase: true, trim: true },
  hospital_name: { type: String, default: 'CareSphere Central Hospital', trim: true },
  uploaded_by_role: { type: String, enum: ['patient', 'admin', 'hospital'], default: 'patient' },
  uploaded_by_name: { type: String, default: 'Patient', trim: true },
  original_name: { type: String, required: true },
  stored_name: { type: String, required: true },
  mime_type: { type: String, default: 'application/octet-stream' },
  file_size: { type: Number, default: 0 },
  status: { type: String, default: 'Sealed' },
  category: { type: String, default: 'Diagnostic Report', trim: true },
  document_hash: { type: String, default: '' }, // SHA-256 Digest of file
  block_index: { type: Number, default: 0 },    // Mined Blockchain Block Index
  created_at: Date,
  updated_at: Date
}
```

### 6. `Block` Schema (Cryptographic Ledger)
```javascript
{
  index: { type: Number, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  title: { type: String, required: true },
  actor_id: { type: String, default: 'SYSTEM' },
  actor_name: { type: String, default: 'CareSphere Engine' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  data_hash: { type: String, default: '' },
  previous_hash: { type: String, required: true },
  hash: { type: String, required: true },
  nonce: { type: Number, default: 0 },
  created_at: Date,
  updated_at: Date
}
```

---

## 🔒 Security & Privacy Highlights

1. **Cryptographic SHA-256 Immutability**:
   Files and transactions cannot be secretly modified. The blockchain validator calculates SHA-256 hashes across the full chain:
   $$\text{Block Hash} = \text{SHA256}(\text{index} + \text{timestamp} + \text{dataHash} + \text{previousHash} + \text{nonce})$$
2. **Defensive Web Security**:
   * **Helmet Protection**: Protects against XSS, clickjacking, and MIME-type sniffing.
   * **Rate Limiting**: Protects sensitive endpoints (`/api/auth/login`, `/api/auth/register`) against credential stuffing and brute-force attacks.
   * **Secure Cookies**: HTTP-only session cookies (`caresphere.sid`) prevent token theft via client-side scripts.
3. **Password Security**:
   * Passwords hashed using `bcryptjs` with salt round factor 10. Raw passwords are never stored or logged.
4. **Access Control & Storage Isolation**:
   * Medical files are stored in `backend/data/uploads/` outside the web root, accessible only through the authenticated streaming route (`/api/reports/:id/download`) which validates user ownership or admin authority before serving.

---

## 🧪 Testing the Live Hackathon Demo

Follow this step-by-step procedure to showcase the platform:

1. **Hospital Login & Records Issuance**:
   * Open the app and log in as **Hospital Staff** (`admin@caresphere.com` / `AdminPassword@123`).
   * Navigate to **Appointments**. Notice the patient record count and latest report pill next to each patient.
   * Click **📋 Records** on any row to open the **Patient Clinical Records Modal**.
   * Observe the **🔥 Latest Report Spotlight** and historical timeline.
   * Upload a diagnostic PDF or image file right inside the modal. Watch the blockchain transaction seal immediately with a toast notification showing the newly mined block index.
2. **Cross-Hospital Verification from Patient Side**:
   * Log out from the top right user menu.
   * Log in as the patient (`vedant@example.com` / `Password@123`).
   * Go to **Health records**.
   * Verify that the newly issued hospital report is visible in the patient's records table, clearly tagged with `🏥 Issued by CareSphere Central Hospital`.
   * Click **⬇ View** to verify that the file opens/downloads securely.
3. **Blockchain Tamper & Recovery Demonstration**:
   * Navigate to the **Blockchain Vault** (`Blockchain Ledger ⛓️` in navigation or dashboard).
   * Review the list of cryptographically sealed blocks.
   * Click **`✓ Verify Chain Integrity`**: Notice the green badge indicating `100% Verified`.
   * Click **`🚨 Simulate Tamper (Judge Demo)`**: Watch the UI instantly detect the tampering, switch to an urgent red alert, and identify the compromised block.
   * Click **`↺ Restore Ledger`**: Watch the engine recalculate the cryptographic hashes and restore the chain back to valid status.

---

## 📄 License & Credits

Built with ❤️ for the Hackathon by the CareSphere Team. Designed to empower patients, healthcare workers, and medical institutions with secure, verifiable, and interoperable health data.
