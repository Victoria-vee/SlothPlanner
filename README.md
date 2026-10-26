# BrainDump

BrainDump is an AI-powered productivity app for people who have things to do but don't want to spend half their day figuring out how to do them.

Dump your messy to-do list into BrainDump. Let AI organize the chaos, let Deadline Detective investigate your deadlines, and get a realistic plan for getting things done with less mental effort.

**The mission: reward laziness by eliminating unnecessary work.**

> Built for Hacktoberfest Dev Challenge Week 3 — *Slow and Steady: Build Something with Open-Source AI at Its Core.*

## ✨ Features

### 🧠 1. AI Brain Dump

Stop organizing your thoughts before you write them down.

- Paste messy, unstructured to-do lists.
- Extract individual tasks using AI.
- Identify deadlines, estimated effort, and dependencies where possible.
- Review and edit extracted tasks before saving them.
- Flag missing or ambiguous information for clarification.

### 🕵️ 2. Deadline Detective

Your deadlines leave clues. BrainDump investigates.

Deadline Detective helps identify:

- **Urgent tasks** that need attention soon.
- **At-risk tasks** that may not be completed on time.
- **Overdue tasks** that need a recovery plan.
- **Conflicting deadlines** competing for limited time.
- **Blocked tasks** waiting on another task or dependency.

Instead of simply telling you that you're behind, it explains why a task is at risk and recommends a practical next step.

### 📅 3. Realistic Daily Planner

Get a plan that respects the hours you actually have.

BrainDump considers available time, deadlines, estimated task duration, and dependencies to create a practical daily plan.

If everything cannot reasonably fit into your schedule, it should say so instead of pretending you can accomplish 15 hours of work in three.

### 🪜 4. Minimum-Effort Task Breakdown

Big tasks are intimidating. Small steps are easier to start.

Turn overwhelming goals into manageable actions.

For example:

**Task:** Build a portfolio website.

**Minimum-effort first step:** Choose one project to showcase.

Less overthinking. More starting.

### 🔄 5. Replan My Day

Plans change. Your productivity app shouldn't make that another problem.

When you fall behind or an urgent task appears, BrainDump helps reorganize the remaining work while preserving completed tasks.

Temporal can orchestrate the multi-step planning workflow and support recovery from temporary failures.

### 🗂️ 6. Saved Tasks and Plan History

Keep your tasks and generated plans available between sessions.

MongoDB Atlas provides persistent storage for task information and planning history.

## 🛠️ Tech Stack

| Technology | Purpose |
||--|---|
| React | Frontend user interface |
| JavaScript + JSX | Application logic and React components |
| Vite | Frontend development and build tooling |
| CSS | Styling, layouts, responsive design, and visual polish |
| Node.js | Backend JavaScript runtime |
| Express | Backend API and request handling |
| Ollama Cloud | AI inference for task extraction, breakdowns, and planning assistance |
| MongoDB Atlas | Persistent task and plan storage |
| Temporal | Durable orchestration for multi-step AI planning workflows |
| Render | Hosting and deployment |

### Why this stack?

- **React** makes it easier to build reusable UI components.
- **JavaScript** keeps the frontend and backend in one language.
- **CSS** provides control over the app's visual identity without requiring a separate styling framework.
- **Ollama Cloud** provides remote model inference without requiring a local GPU.
- **MongoDB Atlas** stores structured task and plan data.
- **Temporal** coordinates workflows that may need retries or recovery.
- **Render** makes the application accessible through a public deployment.

The AI handles language-heavy tasks. JavaScript handles deterministic calculations such as date comparisons, task validation, and schedule feasibility. Temporal coordinates the workflow rather than replacing the application's business logic.

## 🏗️ Architecture

```text
React + Vite + CSS
        |
        v
Express API (Node.js)
        |
        v
Temporal Workflow
        |
        +---- AI extraction / suggestions
        |           |
        |           v
        |      Ollama Cloud
        |
        +---- Deadline analysis
        |      JavaScript logic
        |
        +---- Plan generation
        |
        v
MongoDB Atlas
        |
        v
Results returned to React
```

Temporal workflows should use activities for external operations, such as calling the AI provider and saving results. Activities can be retried when appropriate, with timeouts and idempotency safeguards to prevent duplicate side effects.

## 🚀 Getting Started

### Prerequisites

Install or create accounts for:

- [Node.js](https://nodejs.org/)
- [Ollama Cloud](https://ollama.com/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Temporal](https://temporal.io/)
- [Render](https://render.com/) for deployment

You'll also need an Ollama Cloud API key and a compatible model identifier.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd task-tamer
```

### 2. Install dependencies

The following assumes a project structure with separate `client` and `server` directories.

```bash
cd client
npm install

cd ../server
npm install
```

The exact directory names and scripts should match the repository as it develops.

### 3. Configure environment variables

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then fill in your own values (see the variable tables in [Deploying to Render](#-deploying-to-render)).

**Important:** Never commit `.env` files, expose secrets in frontend code, or publish database credentials.

### 4. Start the application locally

Start the backend API (from `server/`):

```bash
npm run dev
```

Start the frontend separately:

```bash
cd client
npm run dev
```

You also need MongoDB Atlas network access for your machine. The frontend URL will be printed by Vite.

## 🚀 Deploying to Render

BrainDump deploys as two Render services from this one repository (a Blueprint is provided in `render.yaml`):

| | Backend | Frontend |
|---|---|---|
| Type | Web Service (Node) | Static Site |
| Root Directory | `server` | `client` |
| Build Command | `npm install` | `npm install && npm run build` |
| Start Command | `npm start` | n/a |
| Publish Directory | n/a | `dist` |
| Health Check Path | `/api/health` | n/a |

Deploy the backend first, because the frontend needs its URL at build time.

### Backend environment variables (Web Service)

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string. Secret. |
| `MONGODB_DB_NAME` | yes | e.g. `sloth_planner` (the existing database name). |
| `OLLAMA_API_KEY` | yes | Secret. Without it Brain Dump and Lazy Mode return an error. |
| `OLLAMA_MODEL` | yes | A model name from `https://ollama.com/api/tags`. |
| `CORS_ORIGIN` | yes | The deployed frontend URL, e.g. `https://braindump-web.onrender.com`, with no trailing slash. Comma separate several. |
| `PORT` | no | Set by Render automatically. The server listens on `0.0.0.0:$PORT`. |
| `OLLAMA_BASE_URL`, `OLLAMA_TIMEOUT_MS` | no | Defaults are `https://ollama.com` and `60000`. |
| `NODE_VERSION` | recommended | `22` (the server needs Node 20.12 or newer). |

### Frontend environment variable (Static Site)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | yes | The backend URL, e.g. `https://braindump-api.onrender.com`. It is baked in at build time, so changing it needs a rebuild. Never put secrets in `VITE_` variables. |

### Order of steps

1. In MongoDB Atlas, allow Render to connect (Network Access). Render's outbound IPs can change, so the simplest option is `0.0.0.0/0`, protected by a strong database user password.
2. Create the Web Service, set its variables, deploy, then open `<backend-url>/api/health`. Expect `status: "ok"` and the database reported as connected.
3. Create the Static Site with `VITE_API_URL` set to the backend URL and deploy it.
4. Set `CORS_ORIGIN` on the backend to the static site URL and let it redeploy.
5. Open the frontend, then try a brain dump and save a task.

### Notes

- Routing uses URL hashes (`#/tasks`), so no rewrite rule is needed on the Static Site.
- The free Web Service sleeps when idle, so the first request after a pause can take about a minute.
- The API has no authentication or rate limiting yet. Anyone who knows the backend URL can read and change tasks and spend your Ollama quota, so treat a public deployment as a demo.

## 🎨 Styling

BrainDump uses regular CSS alongside React.

The styling should reinforce the product's playful personality while keeping the task-management experience clear and easy to use.

Suggested design principles:

- A friendly, slightly humorous visual identity.
- Clear visual distinctions between urgent, at-risk, overdue, and completed tasks.
- Responsive layouts for desktop and mobile.
- Reusable CSS classes and component-specific styles.
- Accessible color contrast, keyboard navigation, and visible focus states.
- Clear loading, error, and empty states.

No additional CSS framework is required.

## 🔐 Security and Reliability

- Keep AI API keys and database credentials on the backend.
- Validate and constrain AI-generated structured output before using it.
- Handle unavailable AI services and malformed responses gracefully.
- Configure Temporal retries and timeouts carefully.
- Make database-writing activities safe to retry.
- Avoid logging API keys or unnecessary sensitive task content.
- Tell users when their information is being sent to a remote AI provider.

## 🌱 Open-Source AI in Practice

BrainDump explores how AI can reduce the effort required to manage everyday responsibilities.

Rather than using AI only to generate text, it incorporates model inference into a practical workflow:

1. Interpret unstructured task descriptions.
2. Extract and validate useful task information.
3. Identify deadline risks using application logic.
4. Generate actionable suggestions and plans.
5. Coordinate multi-step work with durable workflows.

The goal is to demonstrate AI as a useful part of a working application, not simply a chatbot attached to a to-do list.

## 🗺️ Project Status

BrainDump is being developed as a focused MVP.

Planned capabilities include AI-powered task extraction, Deadline Detective, realistic daily planning, task breakdowns, replanning, and saved task history.

Features should be marked complete only after they have been implemented and tested. Temporal orchestration, production deployment, and observability should likewise be documented according to their actual implementation.
