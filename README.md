# Sistema Documentale Aziendale

Esercitazione ITS-AI — Sistema di gestione documenti aziendali con Python, MongoDB, Apache Solr e AI.

## Stack

- **Backend**: FastAPI · Python 3.11+ · pymongo · pysolr · httpx
- **Database**: MongoDB 7
- **Search**: Apache Solr 9 (analizzatore italiano)
- **AI**: Ollama (locale) · modello configurabile via `.env`
- **Frontend**: React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Axios

## Prerequisiti

- Docker + Docker Compose
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.ai) installato e in esecuzione con il modello desiderato

## Avvio rapido

### 1. Clona e configura

```bash
# Copia i file di configurazione
cp backend/.env.example backend/.env
# Modifica backend/.env se necessario (JWT_SECRET, OLLAMA_MODEL, ecc.)
```

### 2. Avvia MongoDB e Solr

```bash
docker compose up -d
```

Attendi ~30 secondi per l'inizializzazione di Solr. Verifica:
- MongoDB: `http://localhost:27017`
- Solr Admin: `http://localhost:8983/solr`

### 3. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
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

### 5. Verifica Solr

```bash
cd backend
python scripts/setup_solr.py
```

## Primo utilizzo

1. Apri `http://localhost:5173`
2. Registra il primo utente via Swagger (`POST /auth/register` con `role: "admin"`)
3. Accedi con le credenziali create
4. Carica i documenti di esempio da `data/sample/`

## Dataset di esempio

11 documenti fittizi in `data/sample/`:
- 3 contratti (fornitura, consulenza, manutenzione)
- 3 fatture (software, logistica, legale)
- 2 CV (sviluppatore, marketing manager)
- 2 ordini di acquisto (arredamento, informatica)
- 1 comunicazione interna

## API principali

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/auth/register` | Registra utente |
| POST | `/auth/login` | Login → JWT |
| POST | `/documents/upload` | Carica file + estrai testo + AI summary |
| GET | `/documents/search?q=contratto&type=contratto` | Ricerca full-text |
| GET | `/documents/{id}` | Dettaglio documento |
| GET | `/documents/{id}/download` | Scarica file originale |

## Variabili .env principali

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `MONGO_URL` | `mongodb://admin:secret@localhost:27017` | Connection string MongoDB |
| `SOLR_URL` | `http://localhost:8983/solr/documents` | URL core Solr |
| `OLLAMA_URL` | `http://localhost:11434` | URL Ollama locale |
| `OLLAMA_MODEL` | `schien/qwen3.5-lite:latest` | Modello Ollama da usare |
| `JWT_SECRET` | — | **Cambiare in produzione** |

## Struttura progetto

```
RAG_Solr/
├── backend/
│   ├── app/
│   │   ├── api/          # Routers FastAPI
│   │   ├── core/         # Config + security
│   │   ├── db/           # Client MongoDB e Solr
│   │   ├── models/       # Modelli Pydantic
│   │   └── services/     # Business logic
│   ├── scripts/          # Script utilità
│   ├── uploads/          # File caricati (gitignored)
│   └── main.py
├── frontend/
│   └── src/
│       ├── pages/        # LoginPage, Dashboard, Upload, Search, Document
│       ├── components/   # Layout, DocumentCard
│       ├── services/     # api.ts (Axios)
│       └── hooks/        # useAuth
├── solr/conf/            # Schema e config Solr
├── data/sample/          # Dataset di prova (11 documenti)
└── docker-compose.yml
```
