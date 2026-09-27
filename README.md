# 🚀 ReachInbox – Full-Stack Distributed Email Job Scheduler

A production-grade, distributed email scheduler service and real-time dashboard built for the **ReachInbox** engineering assignment.

The system accepts email scheduling requests, persists them in a relational database (**PostgreSQL**), schedules them using **BullMQ delayed jobs** backed by **Redis** (**zero cron jobs**), enforces **configurable worker concurrency**, provider **throttling delays**, and distributed **hourly rate limits** per sender. When rate limits are reached, jobs are safely rescheduled into the next available hour window, and a live alert is dispatched to **Slack**. All emails are searchable in real-time via **Elasticsearch**, and emails sent via fake SMTP (**Ethereal Email**) provide live preview links directly in the dashboard.

---

## 📑 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Tech Stack](#-tech-stack)
3. [Core Feature Highlights](#-core-feature-highlights)
4. [Project Structure](#-project-structure)
5. [Quick Start & Setup](#-quick-start--setup)
   - [Step 1: Start Infrastructure (Docker)](#step-1-start-infrastructure-docker)
   - [Step 2: Backend Setup](#step-2-backend-setup)
   - [Step 3: Frontend Setup](#step-3-frontend-setup)
6. [Environment Variables Guide](#-environment-variables-guide)
7. [Scheduler & Concurrency Mechanics](#-scheduler--concurrency-mechanics)
   - [BullMQ Delayed Jobs (No Cron)](#bullmq-delayed-jobs-no-cron)
   - [Restart Persistence & Recovery](#restart-persistence--recovery)
   - [Idempotency Guarantees](#idempotency-guarantees)
   - [Throttling & Hourly Rate Limiting](#throttling--hourly-rate-limiting)
8. [Live Slack Rate-Limit Notifications](#-live-slack-rate-limit-notifications)
9. [Elasticsearch Search Engine](#-elasticsearch-search-engine)
10. [BullMQ Real-Time Monitoring Dashboard](#-bullmq-real-time-monitoring-dashboard)
11. [Testing & Load Simulation](#-testing--load-simulation)
12. [5-Minute Demo Video Checklist](#-5-minute-demo-video-checklist)
13. [Assumptions & Design Trade-offs](#-assumptions--design-trade-offs)

---

## 🏗 Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + Vite + Tailwind)"]
        UI["Dashboard & Compose Modal\n(CSV Lead Parser)"]
        OAuth["Google OAuth Login"]
        SlackBtn["Connect Slack Button"]
    end

    subgraph Backend ["Backend Service (Express + TypeScript)"]
        API["REST API (/api/emails, /api/auth, /api/slack)"]
        BullBoard["BullMQ Admin Board (/admin/queues)"]
        DBAdapter["Prisma ORM"]
        ESService["Elasticsearch Service"]
        SlackService["Slack Notification Service"]
    end

    subgraph Storage ["Persistent Infrastructure"]
        PG[("PostgreSQL\n(Relational State & History)")]
        Redis[("Redis\n(BullMQ Delayed Queue & Rate Counters)")]
        ES[("Elasticsearch\n(Full-text Index)")]
    end

    subgraph Execution ["BullMQ Workers & External Services"]
        Worker["BullMQ Worker Pool\n(Configurable Concurrency)"]
        Ethereal["Ethereal SMTP\n(Fake Email Delivery & Previews)"]
        SlackAPI["Slack Webhook / OAuth API\n(Live Alert on Hourly Limit)"]
    end

    UI -->|1. Schedule / Search| API
    OAuth -->|Google ID Token| API
    SlackBtn -->|OAuth / Webhook| API
    API -->|Store records| DBAdapter --> PG
    API -->|Index email docs| ESService --> ES
    API -->|Enqueues delayed jobs| Redis
    Redis -->|Dispatches at scheduled time| Worker
    Worker -->|Check hourly limits & last send| Redis
    Worker -->|Exceeded threshold| SlackService --> SlackAPI
    Worker -->|Deliver email| Ethereal
    Worker -->|Update SENT / FAILED status| DBAdapter
    Worker -->|Update index| ESService
    BullBoard -->|Monitor queue state| Redis
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | TypeScript, Express.js | Strongly-typed API and controller architecture |
| **Queue Engine** | BullMQ + Redis | Persistent delayed job scheduling without cron jobs |
| **Database** | PostgreSQL + Prisma ORM | Relational schema, indices, atomic transactions, state persistence |
| **Search Engine** | Elasticsearch (`@elastic/elasticsearch`) | Full-text fuzzy multi-match search over subject, body, recipient, sender |
| **Queue UI** | Bull Board (`@bull-board/express`) | Real-time queue telemetry (`/admin/queues`) |
| **Email SMTP** | Nodemailer + Ethereal Email | Fake SMTP server with live test preview links |
| **Alerts** | Slack Web API / Webhook | Live Block Kit notifications upon hourly rate limit breaches |
| **Frontend** | React 18, Vite, TypeScript | Modern reactive UI |
| **Styling** | Tailwind CSS | Sleek dark-mode aesthetic matching Figma specifications |
| **Auth** | Google OAuth & JWT | Google Identity Services integration with local demo bypass |

---

## ✨ Core Feature Highlights

### 1. Scheduler Engine
- **No Cron Jobs:** Scheduling uses BullMQ persistent delayed jobs stored in Redis.
- **Restart Persistence:** Delayed jobs persist in Redis across server restarts. On boot, the server additionally reconciles any unqueued database entries to guarantee zero job loss.
- **Idempotency:** Unique job IDs and database status guards prevent duplicate deliveries.

### 2. Throughput, Delay & Rate Limiting
- **Worker Concurrency:** Configurable worker concurrency (`WORKER_CONCURRENCY`, default `5`).
- **Provider Throttling Delay:** Enforces a minimum interval between consecutive sends per sender (`DEFAULT_MIN_DELAY_SECONDS`, default `2s`) using Redis timestamp tracking.
- **Distributed Hourly Rate Limiter:** Tracks hourly send counts using Redis counters (`email_rate_limit:sender:{email}:{hourWindow}`).
- **Automatic Deferral:** When an hourly limit is reached, jobs are **never dropped**. They are deferred and rescheduled to the beginning of the next hourly window.
- **Live Slack Alert:** The exact moment a sender hits their limit, an alert is dispatched to the user's connected Slack workspace.

### 3. Frontend Dashboard
- **Figma Design Alignment:** Navigation tabs for Scheduled and Sent emails, real-time metrics cards, search bar, and compose modal.
- **CSV & Text Lead Parser:** Drag-and-drop CSV lead list parser that extracts valid emails and reports the total detected count.
- **Interactive Ethereal Preview:** Every sent email includes a direct link to view the rendered email on Ethereal Email.
- **Search:** Instant search powered by Elasticsearch with graceful database fallback.

---

## 📂 Project Structure

```
ReachInbox/
├── docker-compose.yml              # PostgreSQL, Redis, and Elasticsearch containers
├── sample_leads.csv                # Sample leads file for compose drag-and-drop testing
├── scripts/
│   └── simulate_load.js            # Load & rate-limit simulation test script
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   └── schema.prisma           # Prisma models: User, ScheduledEmail, SlackIntegration, RateLimitIncident
│   └── src/
│       ├── config/                 # Environment validation and defaults
│       ├── db/                     # Prisma & Redis client connection singletons
│       ├── queues/
│       │   ├── emailQueue.ts       # BullMQ Queue instance and helper operations
│       │   ├── emailWorker.ts      # BullMQ Worker: concurrency, delays, SMTP delivery, retries
│       │   └── rateLimiter.ts      # Distributed hourly rate limiter & next-window calculator
│       ├── services/
│       │   ├── emailService.ts     # Nodemailer + Ethereal SMTP with test preview URLs
│       │   ├── elasticsearchService.ts # Index creation, document indexing, and search queries
│       │   ├── slackService.ts     # Slack OAuth and rate-limit Block Kit alert notifications
│       │   └── authService.ts      # Google ID token verification and JWT session tokens
│       ├── controllers/            # Route handlers for emails, auth, and Slack
│       ├── middlewares/            # Auth and request context middleware
│       ├── routes/                 # Express API routes
│       ├── bullboard/              # Bull Board dashboard mounted at /admin/queues
│       ├── server.ts               # Server bootstrap and restart reconciliation
│       └── worker.ts               # Standalone worker entry point
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── types/                  # TypeScript interfaces
        ├── services/api.ts         # Axios API client
        ├── contexts/AuthContext.tsx # Google OAuth state and demo login provider
        ├── components/
        │   ├── Header.tsx          # Branding, Slack status, BullMQ link, user profile
        │   ├── StatsCards.tsx      # Overview metrics
        │   ├── SearchBar.tsx       # Elasticsearch search input
        │   ├── ComposeModal.tsx    # Campaign composer with CSV lead parser
        │   ├── ScheduledTable.tsx  # Scheduled email list with cancellation
        │   ├── SentTable.tsx       # Sent email list with Ethereal preview links
        │   ├── SlackModal.tsx      # Slack OAuth & incoming webhook modal
        │   └── LoginModal.tsx      # Google Sign-In & demo account modal
        ├── App.tsx                 # Main layout and polling engine
        └── main.tsx
```

---

## 🚀 Quick Start & Setup

### Prerequisites
- **Node.js**: v18.0 or higher
- **Docker & Docker Compose**: For running PostgreSQL, Redis, and Elasticsearch

---

### Step 1: Start Infrastructure (Docker)

From the project root, launch PostgreSQL, Redis, and Elasticsearch:

```bash
docker compose up -d
```

Verify containers are running:
```bash
docker ps
```
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Elasticsearch**: `localhost:9200`

---

### Step 2: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Push the database schema to PostgreSQL:
   ```bash
   npx prisma db push
   ```

4. Start the backend development server (starts Express, BullMQ Queue, and Worker in-process):
   ```bash
   npm run dev
   ```

The backend will start on **`http://localhost:5001`**:
- **API Base**: `http://localhost:5001/api`
- **BullMQ Live Board**: `http://localhost:5001/admin/queues`
- **Health Check**: `http://localhost:5001/health`

*(Optional)* To run the worker in a separate process:
```bash
npm run worker
```

---

### Step 3: Frontend Setup

1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open **`http://localhost:3000`** in your browser.

---

## ⚙️ Environment Variables Guide

### Backend (`backend/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5001` | Express server port |
| `DATABASE_URL` | `postgresql://postgres:postgrespassword@localhost:5432/reachinbox?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL for BullMQ and rate limiter |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent jobs processed by the BullMQ worker |
| `DEFAULT_MIN_DELAY_SECONDS` | `2` | Minimum interval (in seconds) between consecutive sends |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | Maximum allowable emails per sender per hourly window |
| `GLOBAL_MAX_EMAILS_PER_HOUR` | `200` | Global rate limit across all senders per hour |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL |
| `ELASTICSEARCH_INDEX` | `reachinbox_emails` | Index name for email documents |
| `ETHEREAL_USER` | `""` | Optional Ethereal user (auto-generated if omitted) |
| `ETHEREAL_PASS` | `""` | Optional Ethereal password (auto-generated if omitted) |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth Client ID for real Google Sign-In |
| `SLACK_CLIENT_ID` | `""` | Slack App Client ID for OAuth flow |
| `SLACK_CLIENT_SECRET` | `""` | Slack App Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:5001/api/slack/oauth/callback` | Slack OAuth callback URL |
| `DEFAULT_SLACK_WEBHOOK_URL`| `""` | Fallback Slack Incoming Webhook URL |
| `JWT_SECRET` | `supersecret...` | Secret key for signing session tokens |
| `FRONTEND_URL` | `http://localhost:3000` | Client origin for CORS and OAuth redirects |

---

## ⏱ Scheduler & Concurrency Mechanics

### BullMQ Delayed Jobs (No Cron)
Cron-based schedulers are strictly avoided. Instead:
1. When a user schedules an email for a future time `T`, the backend calculates `delayMs = Math.max(0, T - now)`.
2. For multiple leads in a campaign, consecutive jobs receive an incremental spacing delay:
   $$\text{jobDelay}_i = \text{baseDelay} + (i \times \text{delaySeconds} \times 1000)$$
3. The job is enqueued in BullMQ with `{ delay: jobDelay_i, jobId: email-job-<id> }`.
4. BullMQ stores delayed jobs in a Redis sorted set ordered by execution timestamp. Redis triggers jobs exactly when their timestamp elapses.

### Restart Persistence & Recovery
- BullMQ delayed jobs are natively persistent in Redis. If the backend process crashes or is restarted, scheduled timers are preserved in Redis.
- During server startup (`server.ts`), the backend runs `reconcilePendingJobsOnStartup()`:
  - Queries PostgreSQL for all emails marked `SCHEDULED` or `RATE_LIMITED`.
  - Verifies whether each job exists in the BullMQ queue.
  - If a job was missing (e.g., in the event of an unexpected Redis restart), it re-enqueues the job with the remaining delay to guarantee no emails are lost.

### Idempotency Guarantees
- Every database record has a unique ID and is mapped to a deterministic BullMQ `jobId`.
- Before executing the SMTP delivery in `emailWorker.ts`, the worker performs an atomic read of the email's database record.
- If the email is already in the `SENT` status, the worker exits immediately without re-sending.

### Throttling & Hourly Rate Limiting
1. **Per-Sender Minimum Delay:** The worker checks `sender_last_send_timestamp:{sender}` in Redis. If less than `delaySeconds` (minimum 2s) has passed since the sender's previous email, the worker pauses for the remaining duration.
2. **Hourly Window Counter:** The rate limiter checks atomic Redis keys formatted as:
   `email_rate_limit:sender:{senderEmail}:{YYYY-MM-DDTHH}`
3. **Threshold Reached:** If `currentCount >= senderLimit`:
   - The job is **not failed** and **not dropped**.
   - The worker computes milliseconds remaining until the start of the next hour window:
     $$\text{delayMs} = (\text{nextHourTimestamp} - \text{now}) + 2000\text{ms}$$
   - The database status is updated to `RATE_LIMITED`.
   - A new delayed job is scheduled for that next hour window.
   - A live Slack alert is triggered (deduplicated per window via Redis `SETNX`).

---

## 💬 Live Slack Rate-Limit Notifications

The system includes a verifiable, real-time Slack integration:
1. **OAuth Flow:** Clicking **"Connect Slack"** in the dashboard initiates the standard OAuth 2.0 flow (`/api/slack/oauth/start`), storing the user's access token and channel webhook in PostgreSQL upon callback.
2. **Instant Webhook Input:** Users can also paste a standard Slack Incoming Webhook URL (`https://hooks.slack.com/...`) directly in the modal for rapid testing.
3. **Trigger:** The moment any sender hits their hourly limit (or upon clicking **"Test Alert"** in the UI), a live Block Kit message is dispatched to the Slack channel with the sender email, current window volume, and rescheduling action.
4. **Graceful Disconnect:** If Slack is disconnected, rate limits continue to safely reschedule emails without throwing errors.

---

## 🔍 Elasticsearch Search Engine

- All scheduled and sent emails are indexed into the `reachinbox_emails` index in Elasticsearch upon creation and status transition.
- The search bar queries Elasticsearch using a `multi_match` query with fuzziness over `recipient^3`, `subject^2`, `body`, and `senderEmail`.
- A status badge (`Elastic` vs `DB`) in the search bar dynamically indicates whether results are served by Elasticsearch or the database fallback.

---

## 📊 BullMQ Real-Time Monitoring Dashboard

The server mounts Bull Board at **`http://localhost:5001/admin/queues`**.
It provides:
- Live visibility into **Waiting**, **Active**, **Delayed**, **Completed**, and **Failed** queues.
- Inspection of job payloads, attempts, stack traces, and remaining delay timers.
- Manual retry, pause, and clean operations for testing.

---

## 🧪 Testing & Load Simulation

### 1. Manual Testing via Frontend
1. Open `http://localhost:3000`.
2. Click **"Sign In"** -> click **"Continue as Demo Outreach Lead"** (or use Google Sign-In).
3. Click **"Connect Slack"** -> enter your Slack webhook or click Connect OAuth. Click **"Test Alert"** to verify delivery to your channel.
4. Click **"Compose New Email"**:
   - Drag and drop `sample_leads.csv` (located in the project root) or paste sample emails.
   - Observe the detected leads badge.
   - Set **Delay** (e.g., `2` seconds) and **Hourly Limit** (e.g., `5` emails/hour).
   - Click **"Schedule Campaign"**.
5. Observe the **Scheduled Emails** table:
   - Status updates in real time (`SCHEDULED` -> `PROCESSING` -> `SENT`).
   - Switch to the **Sent Emails** tab and click **"View Ethereal"** on any row to open the rendered fake email preview in a new tab.

### 2. Automated Load & Rate-Limit Simulation Script
Run the automated load simulation script:
```bash
node scripts/simulate_load.js
```
This script schedules 15 emails with an hourly limit of 5. You will observe:
- 5 emails process and deliver.
- Subsequent emails are deferred with status `RATE_LIMITED (Rescheduled)`.
- A live rate-limit alert is posted to Slack.
- Bull Board displays the deferred jobs in the **Delayed** queue.

### 3. Testing Server Restart Persistence
1. Schedule a batch of emails with a start time 2 minutes into the future (or a high delay).
2. Note the pending jobs in the dashboard.
3. Stop the backend server (`Ctrl + C`).
4. Wait 10 seconds, then restart the server (`npm run dev`).
5. Notice the console output reconciling the pending jobs and confirming jobs remain in Redis without duplication.
6. The jobs will execute at their scheduled time.

---

## 📹 5-Minute Demo Video Checklist

When recording your submission walkthrough:
- [ ] **Google Login:** Demonstrate login (Google OAuth or demo lead) showing user name, email, and avatar in the header.
- [ ] **Compose & CSV Parsing:** Open compose modal, upload `sample_leads.csv`, point out the parsed email count badge, configure delay and hourly limit.
- [ ] **Scheduled & Sent Tabs:** Show the Scheduled tab with pending jobs, then wait for jobs to execute and transition to the Sent tab.
- [ ] **Ethereal Preview:** Click **"View Ethereal"** to open and display the rendered fake email in your browser.
- [ ] **Rate Limiting & Slack Alert:** Show rate limit triggering and show the notification appearing in your Slack channel.
- [ ] **BullMQ Dashboard:** Show `http://localhost:5001/admin/queues` showing delayed and active jobs.
- [ ] **Server Restart:** Kill the backend server while jobs are queued, restart it, and show that future emails still send without duplicates.

---

## ⚖️ Assumptions & Design Trade-offs

1. **SMTP Provider:** Ethereal Email is used for fake SMTP as specified. If no credentials are supplied in `.env`, the service automatically calls `nodemailer.createTestAccount()` on boot and logs the test inbox.
2. **Distributed Rate Limiting:** A sliding hourly window with Redis atomic counters (`INCR` + `EXPIRE`) was chosen for speed, multi-worker safety, and zero lock contention compared to database-level locks.
3. **Rescheduling Strategy:** When an hourly limit is breached, pending jobs are deferred with a delay equal to the remaining time in the current hour plus a 2-second buffer. This preserves order and prevents jobs from being permanently lost.
4. **Search Resilience:** While Elasticsearch is the primary search engine, the backend automatically detects if Elasticsearch is reachable and falls back to database querying so local testing without Elasticsearch never breaks.
