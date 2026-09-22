# FinTrack — Production-Ready Personal Finance Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)]()
[![Target: Google Cloud Run](https://img.shields.io/badge/target-Cloud%20Run-4285F4.svg)]()
[![Target: Firebase Hosting](https://img.shields.io/badge/frontend-Firebase%20Hosting-FFCA28.svg)]()

**FinTrack** is an enterprise-grade, end-to-end encrypted personal finance dashboard. It features **zero-knowledge client-side encryption**, multi-bank CSV normalization, automated recurring subscription tracking, customizable retention purges, and a dual-tier AI financial assistant (**Google Gemini 2.5 Flash** default with BYO-key support for OpenAI and Anthropic Claude).

---

## Architecture Overview

```mermaid
graph TD
    UserBrowser["User Browser (Client SPA)"]
    KDF["PBKDF2 (600,000 rounds)"]
    WebCrypto["WebCrypto API (AES-256-GCM)"]
    LocalCategorizer["Client Categorizer & Aggregator"]
    
    CloudRun["Google Cloud Run (Node.js/Express Container)"]
    Postgres["PostgreSQL (Cloud SQL / Supabase / Neon)"]
    Gemini["Google Gemini 2.5 Flash (Default Tier)"]
    BYO["BYO Provider (OpenAI / Anthropic Claude)"]
    Firebase["Firebase Hosting (Edge Global CDN)"]

    UserBrowser -->|Master Passphrase| KDF
    KDF -->|In-Memory AES Key| WebCrypto
    WebCrypto -->|Encrypted Blob + Blind HMAC Hash| CloudRun
    CloudRun -->|Only Ciphertext + Metadata| Postgres

    Firebase -->|Static SPA Assets| UserBrowser
    LocalCategorizer -->|Decrypted Records in Memory| UserBrowser

    UserBrowser -->|Opt-in Anonymized Context| CloudRun
    CloudRun -->|Shared Bounded Quota| Gemini
    CloudRun -->|BYO Key (Encrypted at Rest)| BYO
```

---

## 1. Zero-Knowledge Client-Side Encryption Model

FinTrack is built from the ground up on a strict **Zero-Knowledge Privacy Architecture**:

1. **Client-Side Key Derivation**: When a user registers or logs in, their password or master passphrase derives a 256-bit cryptographic key entirely inside the browser using **PBKDF2** with **600,000 iterations** of SHA-256 (in adherence to OWASP recommendations).
2. **AES-256-GCM**: Before any financial statement record (description, amount, category, memo) leaves the client, it is encrypted via the browser's hardware-accelerated `window.crypto.subtle` API. The payload is packaged as an authenticated `${iv_base64}:${ciphertext_base64}` bundle.
3. **Blind HMAC-SHA256 Deduplication**: To prevent users from uploading the same bank statement lines multiple times, the client calculates a deterministic HMAC-SHA256 signature using a derived authentication key:
   $$\text{Hash} = \text{HMAC-SHA256}(K_{\text{auth}}, \text{date} \parallel \text{amount} \parallel \text{normalized\_description})$$
   The server compares hashes to filter duplicates **without ever knowing the plaintext amount or description**.
4. **Server Isolation**: The server database stores only `id`, `user_id`, `account_id`, `date`, `encrypted_blob`, and `hash`. Even in the event of a full database leak, user balances, transactions, and merchants cannot be decrypted by anyone without the user's master password.

### Architectural Trade-Offs & AI Consent
- **Client-Side Compute**: Because the server never sees plaintext figures, all transaction categorization, monthly budget reconciliation, cash flow summaries, and trend charts run **locally in the browser** after decrypting records into memory.
- **Opt-In AI Consent**: Sending financial data to an AI model inherently breaks end-to-end encryption in transit to that third party. For this reason:
  - AI features are **strictly opt-in (off by default)**.
  - Users must explicitly check the AI Consent toggle in Settings ("AI Insights will send transaction data to Google's Gemini API — off by default, opt-in").
  - Only anonymized category summaries necessary for the prompt are dispatched.

---

## 2. Authentication & Session Security

- **Google OAuth 2.0**: Native sign-in option for frictionless onboarding.
- **Apple Sign-In**: Dedicated support for Apple ID and iCloud keychain users.
- **Email + Password Fallback**:
  - Securely hashed with `bcrypt` (12 salt rounds) or Argon2id. Never stored plaintext or reversible.
  - Email verification token flow before full activation.
  - Time-limited password reset tokens (`/api/auth/forgot-password` and `/api/auth/reset-password`).
- **Session Management**: Dual-mode session handling supporting secure, `httpOnly`, `SameSite=Lax/None`, signed cookies (`fintrack_session`) and short-lived JWT authorization headers.
- **Brute-Force Rate Limiting**: In-memory IP window rate limiting on all `/api/auth/*` routes (maximum 30 attempts per 15-minute window).

---

## 3. Data Retention & Deletion Lifecycle

- **Configurable Retention Horizons**: Users can configure automated purging in Settings:
  - `1 day` (ephemeral statement inspection)
  - `7 days`
  - `1 month`
  - `3 months`
  - `1 year`
  - `Custom cutoff date` (date picker)
  - `Never` (retained until manual deletion)
- **Background Purge Worker**: A scheduled task runs periodically (or via Google Cloud Scheduler hitting `POST /api/jobs/cleanup` with `CRON_SECRET`) to delete expired records.
- **Manual Data Deletion ("Delete My Data")**:
  - Sets `deleted_at = NOW()` immediately hiding records from the user's view.
  - Automatically hard-purged (permanently erased from the physical database) within 24–48 hours.
- **Cascade Account Deletion**: Deleting the account cascades across all accounts, transactions, custom rules, budgets, and AI conversation histories.
- **Privacy Audit Logs**: Deletion and security events are logged with timestamp and action code only (`user_id`, `event_type`, `records_deleted`, `created_at` — zero financial data stored in audit logs).

---

## 4. Dual-Tier AI Integration (Gemini + BYO-Key)

- **Default Tier (Google Gemini 2.5 Flash)**:
  - Fast, cost-efficient natural language spending Q&A ("how much did I spend on food last month?"), spending summaries, and auto-categorizing transactions.
  - Configurable via `GEMINI_MODEL` env var (supports `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`).
  - Built-in per-user free quota (e.g. 20 queries/day) so costs remain bounded.
- **BYO-Key Support (Bring Your Own Key)**:
  - Connect your own API key for **Google Gemini**, **OpenAI (`gpt-4o-mini`)**, or **Anthropic (`claude-3-5-haiku`)**.
  - BYO keys bypass shared quotas with higher/unlimited queries directly through the user's provider account.
  - Keys are stored **AES-256 encrypted at rest** in the database using a server-side encryption secret, never logged, and dispatched only to the respective provider's HTTPS endpoint.
  - Provider selector lets users choose which connected AI model processes their prompts.

---

## 5. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons, WebCrypto API (AES-256-GCM + PBKDF2) |
| **Backend** | Node.js 22, Express, TypeScript, pg (PostgreSQL), cookie-parser, multer, bcryptjs |
| **Database** | PostgreSQL (Google Cloud SQL, Supabase, Neon) with SQLite fallback for local offline testing |
| **Container** | Hardened multi-stage Docker (`node:22-alpine`, non-root user `fintrack`, port 8080) |
| **Cloud Target**| Google Cloud Run (Backend Container) + Firebase Hosting (Frontend Static CDN) |
| **AI Providers** | Google Gemini 2.5 Flash (default), OpenAI gpt-4o-mini, Anthropic claude-3-5-haiku |

---

## 6. Local Development Setup

### Prerequisites
- Node.js 22+ and npm
- (Optional) Docker or local PostgreSQL instance

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/your-username/FinTrack.git
cd FinTrack

# 2. Copy environment template
cp .env.example .env

# 3. Install dependencies
npm install --prefix server
npm install --prefix client

# 4. Start concurrent development servers
npm run dev
```

Visit `http://localhost:5001` to view FinTrack. If `DATABASE_URL` is omitted, FinTrack automatically initializes local SQLite data in `./data/fintrack.db` with sample data.

---

## 7. Google Cloud Production Deployment Guide

### A. Deploy Backend to Google Cloud Run

#### 1. Setup Google Artifact Registry & Cloud SQL
```bash
# Set your project ID & region
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com

# Create an Artifact Registry repository for Docker images
gcloud artifacts repositories create fintrack-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="FinTrack Docker Repository"
```

#### 2. Configure Production Secrets
```bash
# Create database and cryptographic secrets in Secret Manager
gcloud secrets create fintrack-db-url --data-file=- <<< "postgresql://fintrack_user:password@/fintrack?host=/cloudsql/$PROJECT_ID:$REGION:fintrack-db"
gcloud secrets create fintrack-jwt-secret --data-file=- <<< "$(openssl rand -hex 32)"
gcloud secrets create fintrack-cookie-secret --data-file=- <<< "$(openssl rand -hex 32)"
gcloud secrets create fintrack-server-enc-key --data-file=- <<< "$(openssl rand -hex 32)"
gcloud secrets create fintrack-cron-secret --data-file=- <<< "$(openssl rand -hex 32)"
gcloud secrets create fintrack-gemini-key --data-file=- <<< "AIzaSyYourGeminiApiKey"
```

#### 3. Build & Deploy via Google Cloud Build
```bash
# Submit build to Google Cloud Build
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_REPO_NAME=fintrack-repo,_SERVICE_NAME=fintrack-service
```

### B. Deploy Frontend to Firebase Hosting

```bash
# 1. Install Firebase CLI and login
npm install -g firebase-tools
firebase login

# 2. Link your Firebase project
firebase use --add $PROJECT_ID

# 3. Build client SPA
npm run build --prefix client

# 4. Deploy static bundle with Cloud Run API rewrites
firebase deploy --only hosting
```

---

## 8. Custom Domain Configuration (e.g. `fintrack.app`)

1. **In Firebase Hosting Console**:
   - Go to **Hosting** $\rightarrow$ **Custom Domains** $\rightarrow$ **Add Custom Domain**.
   - Enter `fintrack.app` (and `www.fintrack.app`).
2. **Update DNS Records with your Registrar**:
   - Add the two `A` records provided by Google/Firebase to your DNS zone apex (`@`):
     ```text
     Type: A     Host: @    Value: 199.36.158.100
     Type: A     Host: @    Value: 199.36.158.100
     ```
   - For `www`, add a `CNAME` pointing to `fintrack.app` or the Firebase hosting subdomain.
3. **SSL Provisioning**:
   - Firebase automatically provisions and renews Let's Encrypt / Google Trust Services SSL certificates within minutes.
4. **Cloud Run API Mapping**:
   - The included `firebase.json` automatically rewrites all requests to `/api/**` to your Cloud Run service (`fintrack-service`), preserving HTTPS across custom domains with zero CORS friction.

---

## 9. Google Cloud Scheduler (Automated Retention Purge)

To trigger the retention cleaner worker automatically every 24 hours:

```bash
gcloud scheduler jobs create http fintrack-retention-purge \
  --schedule="0 3 * * *" \
  --time-zone="Etc/UTC" \
  --uri="https://fintrack-service-<hash>-uc.a.run.app/api/jobs/cleanup" \
  --http-method=POST \
  --headers="Authorization=Bearer YOUR_CRON_SECRET"
```

---

## 10. Automated Tests & Quality Verification

Run the comprehensive test suite:

```bash
npm test --prefix server
```

Build verification:
```bash
npm run build --prefix client
npm run build --prefix server
```

---

## License
MIT License. FinTrack — Privacy-First Financial Intelligence.
