# DevFlow AI — AI-Powered Developer Issue & Resolution Platform

> **From Bug Report → AI Analysis → Code Context → AI Fix Prompt → GitHub Pull Request → AI Validation**

DevFlow AI is a full-stack developer intelligence platform engineered to bridge the gap between reporting software defects and executing targeted fixes. Rather than acting as a generic ticketing tracker with a sidebar chatbot, DevFlow AI integrates AI directly into core developer engineering workflows.

---

## 🏗️ Architecture & Resolution Pipeline

```text
Developer Reports Issue
          ↓
  ✨ AI Issue Triage
  (Type, Priority, Confidence, Labels, Root Cause)
          ↓
  🔍 Relevant Code Context
  (Identifies affected files and confidence percentages)
          ↓
  🧠 AI Fix Prompt Generator
  (Synthesizes prompt for Cursor / Copilot / Claude)
          ↓
  💻 Developer Applies Fix & Opens GitHub PR
          ↓
  🔗 PR Automatically Linked to Issue
  (Closes #124, Fixes #124, Resolves #124)
          ↓
  📡 GitHub Webhook Event Received
  (HMAC SHA256 Signature Verified)
          ↓
  🤖 AI Pull Request Analysis
  (Alignment check, regression risks, suggested tests)
          ↓
  ✅ PR Merged → Issue Marked RESOLVED → Team Notified
```

---

## ⚡ Key Features

### 1. AI-Powered Issue Triage & Root Cause Analysis
- **Automatic Classification**: Classifies issues into `BUG`, `FEATURE`, `IMPROVEMENT`, `DOCUMENTATION`, or `TASK`.
- **Intelligent Priority Suggestion**: Suggests `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW` based on impact, keywords, and stack traces.
- **Root Cause Hypothesis**: Generates a technical hypothesis explaining the failure mechanism.
- **Resilient AI Service Architecture**: Seamlessly calls external LLMs (Gemini, OpenAI, Groq, Anthropic) when `AI_API_KEY` is provided, with an autonomous engineering heuristic engine fallback when offline.

### 2. Relevant Code Context Identification
- Inspects repository file trees and matches domain patterns to identify candidate source files with relevance scores (e.g. `authMiddleware.js 94%`, `tokenService.js 87%`, `authController.js 71%`).

### 3. AI Fix Prompt Generator (For Cursor / Copilot / Claude)
- Generates comprehensive engineering fix prompts designed to be pasted directly into modern AI coding assistants.
- Structured with:
  - **ROLE**: Contextualized engineer persona.
  - **PROBLEM**: Exact issue description.
  - **EXPECTED vs CURRENT BEHAVIOR**: Precise acceptance criteria.
  - **POSSIBLE ROOT CAUSE**: Failure hypothesis.
  - **FILES TO INVESTIGATE**: Specific targeted code files.
  - **IMPLEMENTATION REQUIREMENTS**: Step-by-step instructions.
  - **CONSTRAINTS**: Preservation of architecture and backwards compatibility.
  - **TESTING REQUIREMENTS**: Concrete unit and integration test assertions.
- Features **1-Click Copy Prompt** with toast notifications and **Regenerate Prompt**.

### 4. Real-Time AI Duplicate Detection
- Compares draft issue titles and descriptions against existing project issues using N-gram token overlap and Jaccard similarity.
- Displays inline warnings with similarity percentages (e.g. `Similarity: 87%`) and quick links to existing issues before filing duplicates.

### 5. Interactive Kanban Board
- 5 columns: `OPEN`, `IN_PROGRESS`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.
- Drag-and-drop card state transitions with real-time optimistic UI updates.
- Fast status step buttons for touch and accessibility.
- Automatic Activity Log recording on every state transition.

### 6. GitHub Repository Integration & Webhooks
- Connects GitHub repositories (`owner`, `repo`, `url`, `defaultBranch`).
- Automatic issue linking via PR title or description keywords (`Fixes #124`, `Closes #124`, `Resolves #124`).
- **Webhook Endpoint**: `POST /api/github/webhook` with HMAC-SHA256 signature verification (`X-Hub-Signature-256`) using `crypto.timingSafeEqual`.
- Automatically transitions linked issues to `RESOLVED` when a PR is merged.
- **Interactive Webhook Simulator**: Built-in 1-click simulator modal in the top navbar (`Webhook Sim`) to test PR opened / merged webhook events locally without requiring ngrok or public IP tunnels!

### 7. AI Pull Request Alignment Analysis
- Compares linked Pull Requests against the original bug report.
- Evaluates **Issue Alignment** (`HIGH`, `MEDIUM`, `LOW`), **Confidence %**, **Summary of Changes**, **Potential Edge Cases / Regression Risks**, and **Suggested Automated Test Cases**.

### 8. Project Analytics & AI Diagnostics
- Real-time Recharts visualizations:
  - Issues by Status
  - Issues by Priority Severity
  - Issues by Category Type
  - Active Workload per Developer
- **AI Project Insights Banner**:
  - Detects inactive issues (>14 days without updates).
  - Pinpoints top bug hotspots (e.g., authentication domain).
  - Tracks resolution velocity and overall workspace health score (0–100).

### 9. Global Command Palette (`Ctrl + K` / `Cmd + K`)
- Fast global search across issues (#number, title, keywords).
- Quick keyboard actions: Create Issue, Open Board, Open Analytics, Switch Workspace.

### 10. In-App Notification Center
- Dropdown bell with live unread counter badge.
- Automatic notifications when:
  - An issue is assigned to you.
  - A teammate comments on your issue.
  - A GitHub PR is linked or merged.
  - Status changes occur.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Axios, Recharts, Lucide Icons |
| **Backend** | Node.js (v24), Express.js, REST APIs, JSON Web Tokens (JWT), Bcrypt.js, Zod validation |
| **Database** | MongoDB, Mongoose ODM (with automatic embedded In-Memory MongoDB fallback) |
| **Security** | Helmet, CORS, Express-Rate-Limit, HMAC SHA256 Webhook Verification |
| **AI Layer** | Configurable LLM Service (Gemini / OpenAI / Groq) with autonomous heuristic engine |
| **Testing** | Node.js Test Runner (`node:test`, `node:assert`), Supertest |

---

## 📁 Repository Structure

```text
DevFlow/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Navbar.jsx      # Top bar with project switcher, search, notifications
│   │   │   ├── Sidebar.jsx     # Navigation sidebar
│   │   │   ├── CommandPalette.jsx  # Global Ctrl+K command search
│   │   │   ├── CreateIssueModal.jsx # Issue creation with live AI duplicate detection
│   │   │   ├── WebhookSimulatorModal.jsx # 1-click GitHub webhook simulator
│   │   │   └── GithubIcon.jsx  # SVG GitHub icon
│   │   ├── pages/              # Application pages
│   │   │   ├── LoginPage.jsx   # Login with 1-click demo accounts
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx # Metrics, active issues, activity timeline
│   │   │   ├── KanbanBoardPage.jsx # Drag-and-drop workflow board
│   │   │   ├── IssuesListPage.jsx # Filterable table view with pagination
│   │   │   ├── IssueDetailPage.jsx # Flagship page: AI Analysis, Fix Prompt, PR review
│   │   │   ├── ProjectsPage.jsx # Workspace management
│   │   │   ├── ProjectSettingsPage.jsx # GitHub repo & member management
│   │   │   └── AnalyticsPage.jsx # Recharts charts & AI insights
│   │   ├── context/            # AuthContext & ProjectContext
│   │   ├── services/           # Axios API client with auth interceptors
│   │   ├── layouts/            # AppLayout
│   │   └── App.jsx             # React router
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                     # Express.js REST API Backend
│   ├── src/
│   │   ├── config/             # Database connection & memory fallback (db.js)
│   │   ├── models/             # Mongoose schemas (User, Project, Issue, PR, Comment, Activity, Notification)
│   │   ├── middleware/         # Auth (JWT), Role-checking, Zod validator, Centralized error handler
│   │   ├── validators/         # Zod validation schemas
│   │   ├── services/
│   │   │   ├── ai/             # Modular AI layer (aiClient, issueAnalyzer, fixPromptGenerator, duplicateDetector, prAnalyzer, projectInsights)
│   │   │   └── github/         # GitHub integration (githubClient, issueLinker, webhookHandler)
│   │   ├── controllers/        # Express route controllers
│   │   ├── routes/             # Modular Express routers
│   │   ├── utils/              # Seed data script
│   │   └── tests/              # Automated backend test suite (api.test.js)
│   ├── package.json
│   ├── server.js               # Entry point
│   └── .env.example
│
└── package.json                # Root package configuration
```

---

## 🗄️ Database Schema & Indexing Rationale

- **User**: Name, email (unique), password (hashed with bcrypt), role (`ADMIN`, `DEVELOPER`, `VIEWER`), avatar, githubUsername, githubId, githubAccessToken (stored encrypted/hidden with `select: false`).
- **Project**: Name, key (unique), description, owner (ref User), members (user, role), github (`connected`, `owner`, `repository`, `repositoryId`, `defaultBranch`, `url`), issueCounter (atomic increment counter).
- **Issue**:
  - `project`, `issueNumber`: Compound unique index `{ project: 1, issueNumber: 1 }` ensuring sequential issue numbers per project.
  - `status`, `priority`, `assignee`: Single-field indexes to optimize Kanban column filtering and user workload queries without full collection scans.
  - `createdAt`: Indexed for chronological pagination.
  - `aiAnalysis`, `relevantCode`, `aiFixPrompt`: Structured nested schemas.
- **PullRequest**: `project`, `issue`, `prNumber`, `title`, `body`, `status`, `commits`, `changedFiles` (filename, additions, deletions, patch snippet), `aiAnalysis`. Compound index `{ project: 1, prNumber: 1 }`.
- **WebhookDelivery**: `deliveryId` (unique index), `event`, `action`, `repository`, `prNumber`, `processedAt`, `status`. Auto-expiring 30-day TTL index for delivery deduplication / idempotency.
- **Activity**: `project`, `issue`, `actor`, `action`, `entityType`, `metadata`, `timestamp`. Compound index `{ project: 1, timestamp: -1 }`.
- **Notification**: `recipient`, `sender`, `issue`, `title`, `message`, `read`, `type`. Index on `{ recipient: 1, read: 1 }`.

---

## 🐙 Real GitHub Integration

DevFlow AI features a real, production-ready GitHub integration connecting DevFlow issues and projects directly with live GitHub repositories, pull requests, and webhook event pipelines.

```text
DevFlow Project
       ↓
GitHub Repository (e.g. Astha-codes16/BlogIt)
       ↓
Pull Requests (Live PRs, branches, commits, changed files)
       ↓
GitHub Webhook (POST /api/github/webhook)
       ↓
DevFlow Status Sync & Activity (PR Merged → Issue RESOLVED)
       ↓
AI PR Analysis (Changed files & diff patches validated against issue)
```

### 1. GitHub OAuth & Authentication
DevFlow supports real GitHub OAuth so team members can authenticate their GitHub identity without exposing personal access tokens to the frontend:
1. Go to **GitHub Settings → Developer Settings → OAuth Apps → New OAuth App**.
2. Set **Application Name**: `DevFlow AI`.
3. Set **Homepage URL**: `http://localhost:5173`.
4. Set **Authorization Callback URL**: `http://localhost:5000/api/auth/github/callback`.
5. Copy the generated **Client ID** and generate a **Client Secret**.
6. Set these values in `server/.env`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
   ```
> **Backend Token Fallback:** You can also configure a server-level `GITHUB_TOKEN` (Fine-grained or classic GitHub Personal Access Token with `repo` and `read:user` permissions) in `server/.env`. This enables the backend to query public or organization repositories even when users are browsing without personal OAuth.

### 2. Connecting a Repository
- Administrators can navigate to **Project → GitHub & PRs** or **Project Settings**.
- Provide `owner/repo` (e.g., `Astha-codes16/BlogIt` or any real public/private GitHub repository).
- DevFlow verifies that the project exists, current user has administrative permissions, the repository exists on GitHub, and fetches real repository metadata:
  - Stars ⭐, Forks 🍴, Open Issues, Open PRs count
  - Default branch (`main` / `master`)
  - List of remote branches
  - Recent repository commits
  - Active Pull Requests with real status badges (`OPEN`, `MERGED`, `CLOSED`)

> **Demo & Empty State Guarantee:** If GitHub is not connected, DevFlow displays a clean connection guide:
> *"GitHub not connected. Connect a repository to enable: Pull Requests, Commits, Branches, Webhooks, AI PR Analysis"*.
> DevFlow **never fabricates fake GitHub PRs** or mock commit hashes.

### 3. Issue ↔ Pull Request Linking
DevFlow automatically parses PR titles and descriptions for issue keywords:
- Standard convention: `Fixes #124`, `Closes #124`, `Resolves #124`
- Scoped project convention: `Fixes DEVFLOW-124`, `Closes FLOW-124`
- Manual linking: In the Issue Detail page under **GitHub Pull Requests**, developers can manually link or unlink any PR number from the connected repository.

### 4. GitHub Webhook Configuration & Security
Real-time synchronization is driven by real GitHub webhooks.

#### Configuring Webhooks on GitHub:
1. In your GitHub repository, navigate to **Settings → Webhooks → Add webhook**.
2. Set **Payload URL**: `https://<your-public-url>/api/github/webhook` (see Local Testing below).
3. Set **Content type**: `application/json`.
4. Set **Secret**: Matches your `GITHUB_WEBHOOK_SECRET` in `server/.env`.
5. Select **Let me select individual events**:
   - Check `Pull requests`
   - Check `Pushes`
6. Click **Add webhook**.

#### Security & Signature Verification:
- DevFlow verifies every incoming webhook payload using GitHub's `X-Hub-Signature-256` HMAC-SHA256 signature header.
- Verification uses `crypto.timingSafeEqual` to prevent timing attacks.
- Payloads with missing or invalid signatures are rejected immediately with `401 Unauthorized`.

#### Idempotency & Delivery Deduplication:
- GitHub webhooks can be retried or delivered redundantly.
- DevFlow tracks the `X-GitHub-Delivery` GUID in the database (`WebhookDelivery` model with a 30-day auto-expiring TTL index).
- If an event ID has already been processed, it is acknowledged and ignored (`status: duplicate`), preventing duplicate status transitions or activity logs.

### 5. Automatic Issue Status Synchronization
When a webhook arrives:
- `pull_request.opened` / `reopened`: DevFlow creates an activity event and notifies team members.
- `pull_request.closed` (where `merged === true`):
  - Automatically advances linked issues from `OPEN` or `IN_REVIEW` to `RESOLVED`.
  - Records an activity timeline entry: `Astha merged PR #48 linked to issue #124.`
  - Dispatches in-app notifications to issue assignees and reporters.

### 6. AI PR Analysis with Real Code Diffs
When reviewing linked pull requests on the Issue Detail page:
- DevFlow fetches changed files (`+ additions`, `- deletions`) and real diff patch snippets from GitHub API (`/repos/{owner}/{repo}/pulls/{num}/files`).
- The AI PR Analyzer compares the real diff patches against the original issue description, expected behavior, and error trace.
- Returns a structured assessment:
  - Alignment Level (`HIGH`, `MEDIUM`, `LOW`)
  - Confidence Score (%)
  - Summary of Changes
  - Regression Risks & Potential Concerns
  - Suggested Automated Test Scenarios

### 7. Local Webhook Testing (Tunneling)
Since GitHub webhooks require a publicly reachable URL, when developing locally you can expose your local backend server using any secure tunnel:

**Option A: Using ngrok**
```bash
ngrok http 5000
```
Copy the forwarding HTTPS URL (e.g., `https://abc-123.ngrok-free.app`) and set your GitHub webhook Payload URL to:
`https://abc-123.ngrok-free.app/api/github/webhook`

**Option B: Using Cloudflare Tunnels (cloudflared)**
```bash
cloudflared tunnel --url http://localhost:5000
```

**Option C: DevFlow Built-in Webhook Simulator**
DevFlow includes an interactive **Webhook Simulator** accessible directly from the top navigation bar (`Webhook Sim`). It signs test payloads with the real HMAC-SHA256 secret, tests idempotency, and exercises the live PR merge workflow without needing external network tunnels!

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm or yarn

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/devflow-ai.git
cd DevFlow

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Variables
Create `server/.env` based on `server/.env.example`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (Leave empty or default to use automatic In-Memory MongoDB)
MONGODB_URI=mongodb://127.0.0.1:27017/devflow

# Auth
JWT_SECRET=devflow_super_secret_jwt_key_2026_production_grade
JWT_EXPIRES_IN=7d

# AI Configuration (Optional: Gemini, OpenAI, Groq, Ollama)
# If left blank, DevFlow uses high-fidelity heuristic simulation so all features work immediately!
AI_API_KEY=
AI_MODEL=gemini-1.5-flash

# GitHub Integration (OAuth or Backend Personal Access Token)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=devflow_webhook_secret_key_2026
```

### 3. Start Development Servers
In two separate terminals:

**Terminal 1 (Backend):**
```bash
cd server
npm start
# Server starts on http://localhost:5000
```
*Note: If local MongoDB is not running, DevFlow automatically launches an embedded In-Memory MongoDB and seeds it with demo data!*

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
# Vite runs on http://localhost:5173
```

---

## 🧪 Automated Testing

Run the automated backend test suite:
```bash
cd server
npm test
```
The test suite verifies:
- Health check endpoints
- User registration, login, and JWT bearer token authorization
- Project creation and retrieval
- Issue creation with atomic sequential issueNumber generation
- Status transitions and activity recording
- AI response schema validation and heuristic categorization
- GitHub Webhook HMAC-SHA256 signature verification

---

## 👥 Demo Accounts (1-Click Login)

The login screen (`/login`) includes 1-click demo login buttons for instant demonstration:
- **Astha Sharma** (`astha@devflow.ai` / `password123`) — **Role: ADMIN**
- **Rahul Verma** (`rahul@devflow.ai` / `password123`) — **Role: DEVELOPER**
- **Ananya Iyer** (`ananya@devflow.ai` / `password123`) — **Role: DEVELOPER**

---

## 🎯 SDE Interview Walkthrough Guide

When presenting DevFlow AI in a technical interview, walk through this end-to-end user story:

1. **Problem Statement**: Standard issue trackers (Jira/Linear) require developers to manually diagnose bugs, write reproduction steps, search through codebases, craft fix instructions for LLMs, and track PRs manually. DevFlow AI unifies this into a single closed-loop pipeline.
2. **AI Modular Architecture**: Explain why AI logic is decoupled from controllers into `server/src/services/ai/`. Explain prompt structure and JSON schema validation.
3. **Relevant Code Heuristic**: Explain how file trees and error stack traces are analyzed to propose candidate files with confidence percentages.
4. **Fix Prompt Engineering**: Show Issue #124 and click "Generate Fix Prompt". Point out how the generated prompt includes constraints ("preserve architecture"), testing requirements, and reproduction steps for Cursor/Copilot.
5. **GitHub Webhook Verification**: Click the "Webhook Sim" button in the top navbar. Explain HMAC-SHA256 signature validation with `crypto.timingSafeEqual` and show how merging PR #48 automatically updates Issue #124 to `RESOLVED` and generates an activity log and notification.
6. **Database Indexing**: Explain the compound index `{ project: 1, issueNumber: 1 }` and `{ project: 1, status: 1 }` to prevent COLLSCAN bottlenecks on the Kanban board.
