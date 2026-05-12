# Architettura Sistema Documentale

## Overview

Sistema di gestione documenti aziendali con stack:
- **Backend**: FastAPI + Python 3.11+
- **Database**: MongoDB 7 (storage strutturato)
- **Search**: Apache Solr 9 (ricerca full-text con analizzatore italiano)
- **AI locale**: Ollama (metadata extraction, sommari)
- **Frontend**: React 18 + TypeScript

## Topologia Componenti

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)              │
│  LoginPage | UploadPage | SearchPage | DocPage │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/JWT
┌──────────────────▼──────────────────────────────┐
│            FastAPI Backend (main.py)            │
│  ┌─────────────────────────────────────────┐   │
│  │  Router: /auth, /documents              │   │
│  │  CORS: localhost:5173, localhost:3000   │   │
│  └─────────────────────────────────────────┘   │
└────┬──────────────────┬──────────────────┬──────┘
     │                  │                  │
┌────▼─────┐   ┌───────▼────┐   ┌────────▼────┐
│ MongoDB  │   │ Solr Core  │   │   Ollama    │
│ ┌──────┐ │   │ documents  │   │  llm/embed  │
│ │ docs │ │   │ (indexed)  │   └─────────────┘
│ │users │ │   │            │
│ │audit │ │   │ ItalianLang
│ └──────┘ │   │ Analyzer
└──────────┘   └────────────┘
  Port:27017   Port:8983
```

## Flusso Dati

### Upload Documento

```
1. Frontend POST /documents/upload (multipart)
   ├─ File (PDF/DOCX/TXT)
   ├─ Metadati (title, type, author, tags)
   └─ Summary opzionale

2. Backend (document_service.upload_document)
   ├─ Valida: estensione + dimensione
   ├─ Estrai testo (PDF/DOCX/TXT)
   ├─ AI metadata extraction (Ollama)
   ├─ AI summary generation (Ollama)
   ├─ Salva MongoDB (insert)
   ├─ Serializza metadati per Solr
   ├─ Index in Solr (pysolr.add)
   ├─ Salva file su disco (UUID_filename)
   ├─ Log action in audit_log
   └─ Ritorna DocumentOut

3. Frontend riceve ID, mostra success + preview
```

### Ricerca Full-text

```
1. Frontend GET /documents/search?q=...&type=...&author=...&date_from=...&page=...

2. Backend (search_service.full_text_search)
   ├─ Build query: q.strip() or "*:*"
   ├─ Build filter query (fq):
   │  ├─ type: exact match
   │  ├─ author: quoted string (escape")
   │  └─ upload_date: range [from TO to]
   ├─ Query Solr (edismax):
   │  ├─ Boost: title^3 > text_content > summary > tags
   │  ├─ Pagination: start = (page-1)*page_size, rows = page_size
   │  └─ Field list (fl): id, title, type, author, upload_date, tags, summary
   ├─ Convert Solr Results → DocumentOut objects
   └─ Ritorna SearchResult(total, page, page_size, items)

3. Frontend mostra risultati paginati con highlights
```

### Modifica Documento

```
1. Frontend PATCH /documents/{doc_id} (JSON body)
   └─ Aggiorna: title, type, author, tags (nullable)

2. Backend (document_service.update_document)
   ├─ Valida ObjectId
   ├─ MongoDB: find_one_and_update con $set
   ├─ Re-indexa in Solr (intera riga)
   ├─ Log action in audit_log
   └─ Ritorna DocumentOut aggiornato
```

### Rigenerazione Sommario

```
1. Frontend POST /documents/{doc_id}/regenerate-summary

2. Backend (document_service.regenerate_summary)
   ├─ Leggi text_content da MongoDB
   ├─ AI generate_summary (Ollama)
   ├─ MongoDB: update summary field
   ├─ Re-indexa in Solr
   ├─ Log action
   └─ Ritorna DocumentOut con nuovo summary
```

### Eliminazione Documento

```
1. Frontend DELETE /documents/{doc_id}

2. Backend (document_service.delete_document)
   ├─ Leggi file_path da MongoDB
   ├─ Elimina file da disco (unlink, no error se missing)
   ├─ MongoDB: delete_one
   ├─ Solr: delete by id
   ├─ Log action
   └─ Ritorna 204 No Content
```

## Servizi Principali

### Document Service (`services/document_service.py`)
- **upload_document**: full pipeline (validate→extract→AI→save→index)
- **update_document**: patch MongoDB + re-index Solr
- **regenerate_summary**: rigenera con Ollama + update
- **delete_document**: sync MongoDB + Solr + filesystem
- **get_document**: detail view con text_content
- **list_documents**: paginazione, sort by upload_date desc
- **analyze_document**: analisi pre-upload senza salvare

### Search Service (`services/search_service.py`)
- **full_text_search**: Solr query builder + pagination
- **_build_fq**: filter query construction (type, author, date range)
- **_solr_to_doc**: mapping Solr result → DocumentOut

### Auth Service (`services/auth_service.py`)
- **register/login**: JWT token generation
- **log_action**: audit log in MongoDB (user, action, timestamp, details)

### AI Service (`services/ai_service.py`)
- **extract_metadata**: Ollama JSON parsing (title, type, author, tags)
- **generate_summary**: Ollama testo summary (max 3 frasi, 3000 char input)
- Fallback: empty/null se Ollama offline

### Extractors (`services/extractors.py`)
- **extract_text**: PDF (pymupdf), DOCX (python-docx), TXT (plain)
- Output: raw text string

## Database Layer

### MongoDB Clients (`db/mongo.py`)
- `get_client()`: cached MongoClient (lru_cache)
- `get_db()`: database handle
- `documents_col()`, `users_col()`, `audit_col()`: collection accessors

### Solr Client (`db/solr.py`)
- `get_solr()`: cached pysolr.Solr instance
  - `always_commit=True` → cambio indexing immediato
  - timeout=10 secondi
- `index_document(doc)`: aggiungi/update in Solr
- `delete_document(doc_id)`: elimina da Solr
- `search(query, **kwargs)`: query builder, returns pysolr.Results

## Security

### Authentication
- JWT (HS256, default 480 min expiry)
- Bcrypt password hashing
- Dependency injection (get_current_user in deps.py)
- Header: `Authorization: Bearer <token>`

### Authorization
- Role-based (admin, user) — implementazione futura
- Per-user file upload tracking (uploaded_by)
- Audit log per tutte operazioni

### Validation
- Pydantic models (title max 200, author max 100, tags list)
- File extension whitelist (pdf, docx, txt)
- File size limit (default 50 MB configurabile)
- ObjectId validation in update/delete

## Error Handling

| Scenario | Comportamento |
|----------|---|
| File extension non supportato | ValueError → 422 Unprocessable Entity |
| File troppo grande | ValueError → 422 Unprocessable Entity |
| ObjectId invalido | try/except → None → 404 Not Found |
| Solr offline | Exception catchata → SearchResult(total=0) |
| Ollama offline | Fallback: summary=null, tags=[] |
| MongoDB error | Exception propagata (500) |
| JWT scaduto | 401 Unauthorized |
| File mancante | 404 Not Found |

## Performance & Scaling

### Ottimizzazioni Attuali
1. **MongoDB**: ObjectId (_id) autoindicizzato
2. **Solr**: ItalianLightStemmer + ElisionFilter (ricerca veloce)
3. **Cache**: lru_cache su get_client() e get_solr()
4. **Pagination**: limit + skip (default 10, max 100 per page)
5. **File I/O**: write sync, read lazy (on request)

### Bottleneck Potenziali
- **Solr indexing**: fallback non-bloccante ma log error
- **Ollama**: 30 sec timeout, non-bloccante con fallback
- **Testo grande**: primi 2000 char per metadata, 3000 char per summary
- **File filesystem**: storage su disco locale (singolo nodo)

### Miglioramenti Suggeriti
- Index MongoDB su (type, author, upload_date) per query frequenti
- Cache Solr results (Redis/Memcached)
- Async file uploads (Celery task queue)
- Sharded storage (S3/GCS) per multi-node
