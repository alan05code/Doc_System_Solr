# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Infrastructure
```bash
docker compose up -d        # start MongoDB 7, Solr 9, Kafka (KRaft)
docker compose down         # stop all
docker compose logs solr    # debug Solr startup
```

### Backend (FastAPI, Python)
```bash
cd backend
.venv\Scripts\Activate.ps1           # activate virtualenv (Windows)
pip install -r requirements.txt      # install deps
uvicorn main:app --reload            # dev server on :8000
```
API docs available at `http://localhost:8000/docs`.

### Frontend (React + Vite, TypeScript)
```bash
cd frontend
npm install
npm run dev      # dev server on :5173, proxies API calls to :8000
npm run build    # tsc + vite build
```

No test suite exists in this project.

## Architecture

Two-tier app: FastAPI backend + React SPA. All infrastructure runs in Docker.

### Backend (`backend/`)

Entry point: `backend/main.py` — mounts two routers and CORS middleware.

| Layer | Path | Responsibility |
|-------|------|----------------|
| API routes | `app/api/auth.py`, `app/api/documents.py` | HTTP endpoints, auth dependency injection via `app/api/deps.py` |
| Services | `app/services/` | Business logic (see below) |
| DB clients | `app/db/mongo.py`, `app/db/solr.py` | Singleton clients via `@lru_cache` |
| Config | `app/core/config.py` | `pydantic-settings` reads `.env` from `backend/` dir; also cached via `@lru_cache` |
| Security | `app/core/security.py` | JWT (HS256) + bcrypt password hashing |

Key services:
- `document_service.py` — upload/CRUD; on every write calls `_index_in_solr()` to keep Solr in sync
- `search_service.py` — eDisMax query against Solr (`title^3 text_content summary tags`)
- `ai_service.py` — calls local Ollama for Italian summaries and metadata extraction (title, type, author, tags); failures are soft (returns `None`/defaults)
- `extractors.py` — text extraction: PDF via `pymupdf`, DOCX via `python-docx`, TXT via UTF-8 decode
- `auth_service.py` — registration, login, and audit log writes to MongoDB

MongoDB collections: `documents`, `users`, `audit_log`. Uploaded files stored on disk under `upload_dir` (default `uploads/`).

Document types are a closed enum: `contratto, fattura, ordine, cv, comunicazione, altro`.

### Frontend (`frontend/`)

React 18 + TypeScript SPA. `@` alias maps to `frontend/src/`.

Vite dev server proxies `/auth`, `/health`, `/documents` to `http://localhost:8000` — no full URL needed in `api.ts`. The proxy skips browser page navigations (`Accept: text/html`) to let React Router handle them.

| Directory | Contents |
|-----------|----------|
| `src/pages/` | LoginPage, DashboardPage, UploadPage, SearchPage, DocumentPage |
| `src/components/` | Layout, DocumentCard |
| `src/hooks/useAuth.ts` | `AuthContext` + `useAuth` — JWT stored in `localStorage` |
| `src/services/api.ts` | Axios instance; attaches Bearer token; redirects to `/login` on 401/403 |
| `src/types/index.ts` | Shared TypeScript types |

State management: TanStack Query for server state; no global store.

### Infrastructure

`docker-compose.yml` starts:
- **MongoDB 7** — primary document store + user store + audit log
- **Solr 9** — full-text search index; custom schema in `solr/conf/`
- **Kafka** (KRaft, single broker) — present in compose but **not yet wired to any backend service**

### Configuration

Backend reads from `backend/.env` (copy `.env.example`). Key variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `MONGO_URL` | `mongodb://admin:secret@localhost:27017` | |
| `SOLR_URL` | `http://localhost:8983/solr/documents` | |
| `JWT_SECRET` | `change-me-in-production` | Must change for any real deployment |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama instance |
| `OLLAMA_MODEL` | `schien/qwen3.5-lite:latest` | Any Ollama-compatible model |
| `UPLOAD_DIR` | `uploads` | Relative to `backend/` working dir |
| `MAX_FILE_SIZE_MB` | `50` | |

Frontend reads from `frontend/.env` — only `VITE_API_BASE` (used when not proxying through Vite dev server).

`get_settings()` is `@lru_cache` — call `get_settings.cache_clear()` between tests if overriding env vars.

## Development Guide

See [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) for rules on security, MongoDB indexes, Solr configuration, frontend patterns, and a checklist for new endpoints. Rules are derived from real bugs found during code review.
