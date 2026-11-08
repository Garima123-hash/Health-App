# HealthVault AI 🏥

### Making healthcare records easier to manage and understand.

HealthVault AI is a healthcare platform we are developing to make medical records more accessible, organized, and easier for patients to understand.

Medical reports often contain technical terms, test values, and medical abbreviations that are difficult for many people to interpret. At the same time, hospitals need a convenient way to manage doctors, patients, and appointments.

We started building HealthVault AI with these problems in mind. Our goal is to bring patients and hospital administration together through one platform, with AI-powered report explanations and an additional layer for checking the integrity of medical records.

This project is currently under development as part of our hackathon work.

---

## 💡 What are we trying to build?

HealthVault AI is designed around three main ideas:

**1. A better way to manage medical records**

Patients should be able to upload, store, organize, and access their medical reports digitally instead of searching through multiple physical documents.

**2. Medical reports explained with AI**

We want patients to understand what their reports contain without having to struggle with complicated medical terminology.

Our planned AI feature will explain extracted report information in both English and Hindi, using simple language.

**3. Better hospital management**

Instead of giving every hospital access to the same administrative data, we are designing a multi-hospital system where each hospital can manage its own doctors, departments, and appointments.

We are also exploring SHA-256 hash-chain technology to help detect unauthorized modifications to stored medical reports.

---

## ✨ Features and Development Plan

The following features represent the current project scope. Some are already part of the existing application, while others are still being developed.

### Patient Portal
- Patient registration and login.
- Patient dashboard.
- Medical report upload and management.
- Access to personal medical records.
- AI-based report explanations in English and Hindi.

### Hospital Administration
- Separate administration for multiple hospitals.
- Hospital administrators can add and manage their doctors.
- Department and specialization management.
- Doctor availability and appointment management.
- Hospital-specific access to information.

### AI-Powered Report Explanation
- Extract information from PDF and image-based medical reports.
- Explain medical terminology in simpler language.
- Help patients understand test values and reference ranges.
- Support both English and Hindi.
- Generate useful questions that patients can discuss with their doctors.

### Medical Record Integrity
- Generate SHA-256 hashes for uploaded reports.
- Maintain linked integrity records using a hash chain.
- Verify reports to identify possible unauthorized modifications.

*Note: The initial implementation uses a tamper-evident hash chain. It is not a decentralized blockchain network.*

---

## 🛠️ Technology Stack

We are keeping the development stack relatively simple and practical so that we can build, test, and improve the application step by step.

| Technology | Purpose |
|---|---|
| HTML | Application structure |
| CSS | Styling and layout |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Backend APIs and routing |
| SQLite | Database |
| better-sqlite3 | SQLite integration with Node.js |
| Multer | File uploads |
| Google Gemini API | Planned AI report explanations |
| Node.js Crypto | SHA-256 hashing and integrity verification |
| Git and GitHub | Version control and team collaboration |

---

## 📂 Project Structure

```text
HealthVault-AI/
│
├── backend/
│   ├── server.js
│   └── data/
│
├── css/
│   └── styles.css
│
├── js/
│   └── app.js
│
├── index.html
│
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
│
└── README.md
```

The project structure may change as we add more modules and organize the backend.

---

## 🚀 Running the Project Locally

If you want to explore the application or contribute to its development, follow these steps.

### Prerequisites

- Node.js 20 or later
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Garima123-hash/HealthVault-AI.git
```

### 2. Open the project directory

```bash
cd HealthVault-AI
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

Add your own local configuration and credentials.

**Never upload your actual `.env` file or API keys to GitHub.**

### 5. Start the application

```bash
npm start
```

### 6. Open in your browser

```text
http://localhost:3000
```

---

## 👥 Team Collaboration

We are using GitHub to work together and manage changes without affecting the stable version of the application.

Our basic workflow:

- `main` – stable application code.
- `feature/...` – new features and development work.
- `fix/...` – bug fixes.

We use Pull Requests to review and merge changes into the main branch.

This also allows different team members to work on the frontend, backend, AI integration, and other modules independently.

---

## 🗺️ What's Next?

Our development roadmap includes:

- [ ] Complete medical report upload and management.
- [ ] Implement multi-hospital architecture.
- [ ] Build the hospital administrator dashboard.
- [ ] Add doctor and department management.
- [ ] Integrate AI-powered report explanations.
- [ ] Add English and Hindi language support.
- [ ] Implement SHA-256 hash-chain verification.
- [ ] Test hospital-level data isolation.
- [ ] Complete the application demonstration.

---

## 🔐 Privacy and Medical Disclaimer

HealthVault AI is an academic and hackathon project under development. It is not a replacement for qualified medical advice, diagnosis, or treatment.

Medical records are sensitive information. We aim to keep uploaded reports private, protect access through authentication and authorization, and avoid exposing patient information through public repositories or blockchain records.

For development and demonstrations, synthetic medical records should be used instead of real patient reports.

---

## 🤝 Contributions

We welcome collaboration from our team members.

If you are working on this project:

1. Clone the repository.
2. Create a separate branch for your feature.
3. Make and test your changes.
4. Commit and push your work.
5. Open a Pull Request for review.

Let's keep improving HealthVault AI together.

---

**HealthVault AI — Because understanding your health records should be easier.**
