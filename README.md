# SlothPlanner


Sloth Planner is an AI-powered productivity app for people who have things to do but don't want to spend half their day figuring out how to do them.

Dump your messy to-do list into Sloth Planner. Let AI organize the chaos, let Deadline Detective investigate your deadlines, and get a realistic plan for getting things done with less mental effort.

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

Your deadlines leave clues. Sloth Planner investigates.

Deadline Detective helps identify:

- **Urgent tasks** that need attention soon.
- **At-risk tasks** that may not be completed on time.
- **Overdue tasks** that need a recovery plan.
- **Conflicting deadlines** competing for limited time.
- **Blocked tasks** waiting on another task or dependency.

Instead of simply telling you that you're behind, it explains why a task is at risk and recommends a practical next step.

### 📅 3. Realistic Daily Planner

Get a plan that respects the hours you actually have.

Sloth Planner considers available time, deadlines, estimated task duration, and dependencies to create a practical daily plan.

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

When you fall behind or an urgent task appears, Sloth Planner helps reorganize the remaining work while preserving completed tasks.

Temporal can orchestrate the multi-step planning workflow and support recovery from temporary failures.

### 🗂️ 6. Saved Tasks and Plan History

Keep your tasks and generated plans available between sessions.

MongoDB Atlas provides persistent storage for task information and planning history.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
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

Create a `.env` file in the backend directory:

```env
PORT=3000
OLLAMA_API_KEY=your_ollama_api_key
OLLAMA_MODEL=your_supported_cloud_model
MONGODB_URI=your_mongodb_connection_string
TEMPORAL_ADDRESS=your_temporal_service_address
TEMPORAL_NAMESPACE=your_temporal_namespace
TEMPORAL_TASK_QUEUE=task-tamer-queue
```

Use the Temporal connection settings required by your chosen Temporal deployment. Authentication credentials may also be necessary.

**Important:** Never commit `.env` files, expose secrets in frontend code, or publish database credentials.

### 4. Start the application locally

Start the backend API and Temporal worker using the development scripts configured in the server's `package.json`.

For example, if you define a development script:

```bash
npm run dev
```

Start the frontend separately:

```bash
cd client
npm run dev
```

You will also need a reachable Temporal service and the necessary MongoDB Atlas network access. The frontend URL will be printed by Vite.

*These are setup examples, not a claim that the scripts or Temporal worker have already been implemented.*

## 🎨 Styling

Sloth Planner uses regular CSS alongside React.

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

Sloth Planner explores how AI can reduce the effort required to manage everyday responsibilities.

Rather than using AI only to generate text, it incorporates model inference into a practical workflow:

1. Interpret unstructured task descriptions.
2. Extract and validate useful task information.
3. Identify deadline risks using application logic.
4. Generate actionable suggestions and plans.
5. Coordinate multi-step work with durable workflows.

The goal is to demonstrate AI as a useful part of a working application, not simply a chatbot attached to a to-do list.

## 🗺️ Project Status

Sloth Planner is being developed as a focused MVP.

Planned capabilities include AI-powered task extraction, Deadline Detective, realistic daily planning, task breakdowns, replanning, and saved task history.

Features should be marked complete only after they have been implemented and tested. Temporal orchestration, production deployment, and observability should likewise be documented according to their actual implementation.
