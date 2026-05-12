# Sistema Documentale Aziendale

Esercitazione ITS-AI — sistema di gestione documenti aziendali con Python, MongoDB, Apache Solr e AI locale.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Backend | FastAPI · Python 3.11+ · Uvicorn |
| Database | MongoDB 7 |
| Search engine | Apache Solr 9 (analizzatore italiano) |
| AI | Ollama (locale) — modello configurabile |
| Estrazione testo | pymupdf (PDF) · python-docx (DOCX) |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS v4 · Axios |

## Prerequisiti

- Docker + Docker Compose
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.ai) installato con un modello testuale (es. `schien/qwen3.5-lite:latest`)

## Avvio rapido

### 1. Configura l'ambiente

```bash
cp backend/.env.example backend/.env
# Modifica backend/.env: JWT_SECRET, OLLAMA_MODEL, ecc.
```

### 2. Avvia MongoDB e Solr

```bash
docker compose up -d
```

Attendi ~30 secondi. Verifica:
- MongoDB: `localhost:27017`
- Solr Admin: `http://localhost:8983/solr`

### 3. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
python scripts/setup_solr.py   # crea e configura il core Solr
uvicorn main:app --reload
```

API disponibile su `http://localhost:8000`
Swagger UI: `http://localhost:8000/docs`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App disponibile su `http://localhost:5173`

## Primo utilizzo

1. Registra il primo utente via Swagger (`POST /auth/register` con `role: "admin"`)
2. Accedi con le credenziali create
3. Carica i documenti di esempio da `data/sample/`

## API

### Autenticazione

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/auth/register` | Registra utente (`username`, `password`, `role`) |
| POST | `/auth/login` | Login → restituisce JWT |

Tutti gli endpoint `/documents/*` richiedono header `Authorization: Bearer <token>`.

### Documenti

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/documents/analyze` | Analisi AI del file (titolo, tipo, autore, tag, sommario) senza salvare |
| POST | `/documents/upload` | Carica file → estrai testo → salva MongoDB → indicizza Solr → sommario AI |
| GET | `/documents/` | Lista documenti paginata |
| GET | `/documents/search` | Ricerca full-text con filtri (vedi parametri sotto) |
| GET | `/documents/{id}` | Metadati + testo estratto + sommario |
| PATCH | `/documents/{id}` | Aggiorna metadati (titolo, tipo, autore, tag) e re-indicizza |
| DELETE | `/documents/{id}` | Elimina da MongoDB, Solr e disco |
| POST | `/documents/{id}/regenerate-summary` | Rigenera sommario AI per documento esistente |
| GET | `/documents/{id}/preview` | Serve il file originale inline (PDF/TXT in browser) |
| GET | `/documents/{id}/download` | Scarica il file originale come allegato |

#### Parametri ricerca (`GET /documents/search`)

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| `q` | string | Query full-text (default `*`) |
| `type` | string | Filtro tipologia: `contratto`, `fattura`, `ordine`, `cv`, `comunicazione`, `altro` |
| `author` | string | Filtro autore (ricerca parziale) |
| `date_from` | ISO 8601 | Data caricamento da |
| `date_to` | ISO 8601 | Data caricamento a |
| `page` | int | Pagina (default 1) |
| `page_size` | int | Risultati per pagina (default 10, max 100) |

## Modello dati MongoDB

### Collection `documents`

```json
{
  "_id": "ObjectId",
  "title": "string",
  "type": "contratto|fattura|ordine|cv|comunicazione|altro",
  "author": "string",
  "upload_date": "ISODate",
  "tags": ["string"],
  "text_content": "string",
  "summary": "string|null",
  "original_filename": "string",
  "file_path": "string",
  "uploaded_by": "ObjectId"
}
```

### Collection `users`

```json
{
  "_id": "ObjectId",
  "username": "string",
  "password_hash": "string",
  "role": "admin|user",
  "created_at": "ISODate"
}
```

### Collection `audit_log`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "action": "upload|search|view|download|edit|delete|regenerate_summary",
  "document_id": "ObjectId|null",
  "timestamp": "ISODate",
  "details": {}
}
```

## Configurazione Solr

Core: `documents` — analizzatore italiano (`text_it`) con:
- `ItalianLightStemFilter`
- `StopFilter` (stopwords italiane)
- `ElisionFilter` (contrazioni: dell', dell', ecc.)

Script di configurazione: `backend/scripts/setup_solr.py`

## AI: Ollama (locale)

Sostituisce Claude/GPT con un modello locale — alternativa equivalente giustificata dalla necessità di operare offline e senza costi per token.

**Funzionalità implementate:**

| Funzione | Trigger | Input | Output |
|----------|---------|-------|--------|
| Estrazione metadati | Upload / Analisi pre-upload | Primi 2000 caratteri del testo | JSON: titolo, tipo, autore, tag |
| Generazione sommario | Upload / Rigenera manuale | Primi 3000 caratteri del testo | Testo: max 3 frasi |

**Fallback:** se Ollama non risponde o restituisce JSON non parsabile, l'operazione continua con campi vuoti/null — nessun errore bloccante.

## Variabili `.env`

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `MONGO_URL` | `mongodb://admin:secret@localhost:27017` | Connection string MongoDB |
| `MONGO_DB` | `docmanager` | Nome database |
| `SOLR_URL` | `http://localhost:8983/solr/documents` | URL core Solr |
| `OLLAMA_URL` | `http://localhost:11434` | URL Ollama locale |
| `OLLAMA_MODEL` | `schien/qwen3.5-lite:latest` | Modello Ollama |
| `OLLAMA_TIMEOUT` | `60` | Timeout secondi per chiamata AI |
| `JWT_SECRET` | — | **Obbligatorio cambiare in produzione** |
| `JWT_EXPIRE_MINUTES` | `480` | Durata token JWT |
| `UPLOAD_DIR` | `uploads` | Cartella file caricati |
| `MAX_FILE_SIZE_MB` | `20` | Dimensione massima file |

## Dataset di esempio

14 documenti fittizi in `data/sample/`:

| Tipo | File |
|------|------|
| Contratto | `contratto_fornitura_alfa.txt` |
| Contratto | `contratto_consulenza_delta.txt` |
| Contratto | `contratto_manutenzione_impianti.txt` |
| Contratto | `contratto_servizi_cloud_techsolutions.docx` |
| Fattura | `fattura_beta_systems.txt` |
| Fattura | `fattura_omega_logistica.txt` |
| Fattura | `fattura_consulenza_legale.txt` |
| Ordine | `ordine_acquisto_2024_042.txt` |
| Ordine | `ordine_informatica_maggio2024.txt` |
| CV | `cv_mario_bianchi.txt` |
| CV | `cv_giulia_conti.txt` |
| CV | `cv_marco_ferrari.docx` |
| Comunicazione | `comunicazione_sicurezza_2024.txt` |
| Comunicazione | `comunicazione_riunione_cda.txt` |

## Struttura progetto

```
RAG_Solr/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # POST /auth/login, /auth/register
│   │   │   ├── documents.py     # tutti gli endpoint /documents/*
│   │   │   └── deps.py          # dipendenza JWT
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings + .env)
│   │   │   └── security.py      # JWT encode/decode, bcrypt
│   │   ├── db/
│   │   │   ├── mongo.py         # client pymongo
│   │   │   └── solr.py          # client pysolr
│   │   ├── models/
│   │   │   ├── document.py      # DocumentMeta, DocumentOut, DocumentDetail, ...
│   │   │   └── user.py          # UserIn, UserOut, AuthToken
│   │   └── services/
│   │       ├── document_service.py  # pipeline upload, update, delete, analyze
│   │       ├── extractors.py        # estrazione testo PDF/DOCX/TXT
│   │       ├── search_service.py    # query builder Solr
│   │       ├── ai_service.py        # Ollama: sommario + metadati
│   │       └── auth_service.py      # login, register, audit log
│   ├── scripts/
│   │   ├── setup_solr.py        # configura core e schema Solr
│   │   └── gen_sample_docx.py   # genera documenti DOCX di esempio
│   ├── uploads/                 # file caricati (gitignored)
│   ├── main.py                  # factory FastAPI, CORS, router
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx       # login con redirect post-auth
│       │   ├── DashboardPage.tsx   # statistiche + documenti recenti
│       │   ├── UploadPage.tsx      # upload multiplo + analisi AI per file
│       │   ├── SearchPage.tsx      # ricerca full-text + filtri
│       │   └── DocumentPage.tsx    # dettaglio, modifica, preview, elimina
│       ├── components/
│       │   ├── Layout.tsx          # sidebar fissa + main scrollable
│       │   └── DocumentCard.tsx    # card documento per liste
│       ├── services/
│       │   └── api.ts              # axios + interceptors JWT
│       ├── hooks/
│       │   └── useAuth.ts
│       └── types/
│           └── index.ts
├── solr/conf/                   # managed-schema, solrconfig.xml, stopwords
├── data/sample/                 # 14 documenti fittizi (TXT + DOCX)
├── docker-compose.yml
└── README.md
```
