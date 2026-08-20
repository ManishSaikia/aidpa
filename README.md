# AIDPA — AI Data Platform

> Upload CSVs, run instant analysis, ask questions in plain English, and uncover insights with AI.

[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://aidpa-production-4207.up.railway.app/docs)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black?logo=next.js)](https://aidpa.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.13+-3776ab?logo=python)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://typescriptlang.org)

---

## What is AIDPA?

AIDPA is a full-stack AI-powered data analysis platform. Upload any CSV file and immediately:

- **Automatic analysis** — schema detection, column stats, anomaly detection, data quality scoring
- **Natural language queries** — ask questions in plain English, get SQL + results + explanation
- **AI agent chat** — persistent conversational AI with memory across sessions
- **Semantic search** — find past analyses using vector similarity
- **Cost tracking** — per-endpoint API cost monitoring

---

## Architecture

```
AIDPA/
+-- aidpa-backend/          # FastAPI — deployed on Railway
|   +-- routes/             # API route handlers
|   +-- services/           # Business logic
|   +-- models/             # Pydantic models
|   +-- db/                 # DB pool & connection helpers
|   +-- middleware/         # Logging middleware
|   +-- migrations/         # 11 SQL migration files
|   +-- prompts/            # Jinja2 prompt templates
|   +-- tests/              # Pytest test suite
|   +-- Dockerfile          # Multi-stage production build
|   +-- railway.toml        # Railway deployment config
|
+-- aipda-frontend/         # Next.js 15 — deployed on Vercel
    +-- app/                # App Router pages & layouts
    +-- components/         # React components
    +-- lib/                # API client, auth helpers
    +-- types/              # TypeScript type definitions
```

### Infrastructure

| Layer | Service |
|---|---|
| Frontend | Vercel (CDN, edge, preview deployments) |
| Backend | Railway (Docker, auto-deploy from GitHub) |
| Database | Supabase (PostgreSQL + connection pooler) |
| Storage | Supabase Storage (CSV file uploads) |
| Auth | Supabase Auth (JWT) |
| AI | Google Gemini (analysis, agent, embeddings) |
| Vector Store | pgvector via Supabase |
| Monitoring | Sentry (backend + frontend) |

---

## Getting Started Locally

### Prerequisites

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- A [Supabase](https://supabase.com) project
- A [Google AI](https://aistudio.google.com/) API key

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### 2. Backend setup

```bash
cd aidpa-backend

# Install dependencies
uv sync

# Copy env file and fill in values
cp .env.example .env

# Run migrations in Supabase SQL editor (001_ through 011_ in order)

# Start the dev server
uv run fastapi dev main.py
```

Backend: http://localhost:8000  
API docs: http://localhost:8000/docs

### 3. Frontend setup

```bash
cd aipda-frontend

npm install
cp .env.local.example .env.local
# Fill in your values
npm run dev
```

Frontend: http://localhost:3000

---

## Environment Variables

### Backend (aidpa-backend/.env)

| Variable | Description |
|---|---|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_KEY | Supabase anon public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (admin ops) |
| POSTGRES_DIRECT_URL | Supabase Session Pooler URI (aws-0-*.pooler.supabase.com:5432) |
| GOOGLE_API_KEY | Google AI Studio API key (Gemini) |
| ALLOWED_ORIGINS | Frontend URL for CORS — no trailing slash (e.g. https://aidpa.vercel.app) |
| ADMIN_USER_IDS | Comma-separated Supabase user IDs with admin access |
| SENTRY_DSN | Sentry DSN for backend error tracking (optional) |

> **Important:** Use the Supabase Session Pooler URL (not Direct Connection) for POSTGRES_DIRECT_URL when deploying to Railway. Direct connection resolves to IPv6 which Railway does not support.

### Frontend (aipda-frontend/.env.local)

| Variable | Description |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Your Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon public key |
| NEXT_PUBLIC_API_URL | Backend base URL — with https://, no trailing slash |
| NEXT_PUBLIC_SENTRY_DSN | Sentry DSN for frontend error tracking (optional) |

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /ready | Readiness probe (DB ping) |
| POST | /upload | Upload a CSV file |
| GET | /datasets | List datasets |
| GET | /datasets/{id} | Get dataset details |
| DELETE | /datasets/{id} | Delete a dataset |
| POST | /query | Natural language to SQL to results |
| GET | /query/history | Past query history |
| POST | /agent | AI agent chat (persistent memory) |
| GET | /chat/sessions | List chat sessions |
| GET | /chat/sessions/{id} | Get session messages |
| POST | /embed | Semantic search over past analyses |
| GET | /user/me/stats | User usage statistics |
| DELETE | /user/me | Delete account and all data |
| GET | /admin/costs | API cost breakdown (admin only) |

Full interactive docs: https://aidpa-production-4207.up.railway.app/docs

---

## Database Migrations

Run in Supabase SQL editor in order:

| File | Description |
|---|---|
| 001_datasets_metadata.sql | Datasets table |
| 002_chat_sessions.sql | Chat sessions |
| 003_chat_sessions_add_title_messages.sql | Title & messages columns |
| 004_query_history.sql | Query history log |
| 005_analysis_embeddings_add_metadata.sql | Vector embeddings metadata |
| 006_add_user_id.sql | User ID columns |
| 007_update_match_analyses_rpc.sql | Semantic search RPC function |
| 008_add_audit_log.sql | Audit log table |
| 009_checkpoint_tables_rls.sql | LangGraph checkpoint tables + RLS |
| 010_audit_log_nullable_user_id.sql | Nullable user in audit log |
| 011_api_cost_log.sql | API cost tracking table |

---

## Deployment

### Backend to Railway

1. Railway — New Service — GitHub Repo
2. Set Root Directory to aidpa-backend
3. Railway auto-detects the Dockerfile
4. Set all backend env vars in Railway → Variables
5. Auto-deploys on every push to master

### Frontend to Vercel

1. Import your GitHub repo in Vercel
2. Set Root Directory to aipda-frontend
3. Set Production Branch to master (Settings → Git)
4. Set all frontend env vars in Vercel → Settings → Environment Variables
5. Auto-deploys on every push to master

> After changing any NEXT_PUBLIC_* env var in Vercel, manually trigger a redeploy — these are baked into the JS bundle at build time.

---

## Key Features

### AI Agent (LangGraph)
Persistent conversational AI via PostgresSaver. Sessions survive server restarts, stored in Supabase.

### Automatic Analysis Pipeline
On upload: schema inference, column stats, anomaly detection, natural language summary, vector embeddings.

### Text-to-SQL
Natural language queries converted to SQL by Gemini, executed, and results explained in plain English.

### Cost Tracking
Every Gemini API call logged with tokens and USD cost. Admin breakdown at /admin/costs.

---

## Tech Stack

**Backend:** FastAPI, LangGraph, Google Gemini, psycopg, Supabase, structlog, Sentry, uv

**Frontend:** Next.js 15, TypeScript, Supabase JS, Recharts, Sentry

---

## Contributing

1. Fork the repo
2. Create a branch: git checkout -b feature/my-feature
3. Commit: git commit -m "feat: add my feature"
4. Push: git push origin feature/my-feature
5. Open a Pull Request

---

## License

MIT
