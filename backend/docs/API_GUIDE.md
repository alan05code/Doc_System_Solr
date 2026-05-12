# API Reference Guide

Base URL: `http://localhost:8000`

## Authentication

Tutti gli endpoint `/documents/*` richiedono JWT token nel header.

### POST /auth/register

Registra nuovo utente.

**Request**
```json
POST /auth/register
Content-Type: application/json

{
  "username": "mario_rossi",
  "password": "SecurePass123!",
  "role": "admin"  // "admin" o "user"
}
```

**Response** (201)
```json
{
  "id": "65a8b1c2d3e4f5g6h7i8j9k0",
  "username": "mario_rossi",
  "role": "admin"
}
```

**Errors**
- `400 Bad Request`: username già esiste
- `422 Unprocessable Entity`: password/username validation fallita

---

### POST /auth/login

Login e ottieni JWT token.

**Request**
```json
POST /auth/login
Content-Type: application/json

{
  "username": "mario_rossi",
  "password": "SecurePass123!"
}
```

**Response** (200)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 480
}
```

**Usage nei successivi endpoint**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Errors**
- `401 Unauthorized`: username/password errato

---

## Documents Endpoints

### POST /documents/analyze

Analizza file senza salvare in database (preview).

**Request**
```
POST /documents/analyze
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary file content>
```

**Response** (200)
```json
{
  "title": "Contratto Fornitura Alfa",
  "type": "contratto",
  "author": "Ufficio Legale",
  "tags": ["fornitori", "2024"],
  "summary": "Accordo di fornitura con Alfa SpA per 24 mesi."
}
```

**Notes**
- Estrae testo da file
- Ollama genera metadata + summary
- Nessun salvataggio in MongoDB/Solr
- Utile per preview prima upload

**Errors**
- `401 Unauthorized`: JWT scaduto/mancante
- `422 Unprocessable Entity`: formato file non supportato o file troppo grande

---

### POST /documents/upload

Carica documento, estrae testo, genera metadati + sommario, salva MongoDB + Solr.

**Request**
```
POST /documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary PDF/DOCX/TXT>
title: "Contratto Fornitura Alfa"
type: "contratto"
author: "Ufficio Legale"
tags: "fornitori,2024,approvato"
summary: "Optional pre-generated summary"
```

**Form Parameters**
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `file` | binary | ✓ | PDF/DOCX/TXT, max 50 MB |
| `title` | string | ✓ | 1-200 chars |
| `type` | string | ✓ | contratto\|fattura\|ordine\|cv\|comunicazione\|altro |
| `author` | string | ✓ | 1-100 chars |
| `tags` | string | — | comma-separated, auto-split |
| `summary` | string | — | if provided, uses instead of AI-generated |

**Response** (201)
```json
{
  "id": "65a8b1c2d3e4f5g6h7i8j9k0",
  "title": "Contratto Fornitura Alfa",
  "type": "contratto",
  "author": "Ufficio Legale",
  "upload_date": "2024-05-12T14:30:00+00:00",
  "tags": ["fornitori", "2024", "approvato"],
  "summary": "Accordo di fornitura con Alfa SpA per materiali grezzi. Durata 24 mesi. Prezzo fissato.",
  "original_filename": "contratto_fornitura_alfa.pdf",
  "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0"
}
```

**Processing Steps**
1. Valida file (estensione + dimensione)
2. Estrae testo raw (PDF/DOCX/TXT)
3. AI metadata extraction (Ollama) — opzionale se `summary` provided
4. Salva in MongoDB (insert_one)
5. Indicizza in Solr (add)
6. Salva file su disco (uploads/UUID_filename)
7. Log action in audit_log

**Errors**
- `401 Unauthorized`: JWT scaduto
- `422 Unprocessable Entity`: file format/size validation fallita

---

### GET /documents/

Lista documenti paginati (tutti, senza ricerca full-text).

**Request**
```
GET /documents/?page=1&page_size=10
Authorization: Bearer <token>
```

**Query Parameters**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `page` | int | 1 | pagina (1-indexed) |
| `page_size` | int | 10 | risultati per pagina (1-100) |

**Response** (200)
```json
{
  "total": 42,
  "page": 1,
  "page_size": 10,
  "items": [
    {
      "id": "65a8b1c2d3e4f5g6h7i8j9k0",
      "title": "Contratto Fornitura Alfa",
      "type": "contratto",
      "author": "Ufficio Legale",
      "upload_date": "2024-05-12T14:30:00+00:00",
      "tags": ["fornitori", "2024"],
      "summary": "...",
      "original_filename": "contratto_fornitura_alfa.pdf",
      "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0"
    },
    ...
  ]
}
```

**Notes**
- Sorted by upload_date descending
- text_content escluso (usa /documents/{id} per dettaglio)
- Paginazione: (page-1) * page_size

---

### GET /documents/search

Ricerca full-text con filtri.

**Request**
```
GET /documents/search?q=contratto&type=contratto&author=Ufficio&date_from=2024-05-01T00:00:00&page=1&page_size=10
Authorization: Bearer <token>
```

**Query Parameters**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `q` | string | `*` | query full-text (edismax) |
| `type` | string | — | filter: contratto\|fattura\|ordine\|cv\|comunicazione\|altro |
| `author` | string | — | filter: exact match (quoted in Solr) |
| `date_from` | ISO 8601 | — | filter: from date (inclusive) |
| `date_to` | ISO 8601 | — | filter: to date (inclusive) |
| `page` | int | 1 | pagina (1-indexed) |
| `page_size` | int | 10 | risultati per pagina (1-100) |

**Response** (200)
```json
{
  "total": 5,
  "page": 1,
  "page_size": 10,
  "items": [
    {
      "id": "65a8b1c2d3e4f5g6h7i8j9k0",
      "title": "Contratto Fornitura Alfa",
      "type": "contratto",
      "author": "Ufficio Legale",
      "upload_date": "2024-05-12T14:30:00+00:00",
      "tags": ["fornitori"],
      "summary": "...",
      "original_filename": "contratto_fornitura_alfa.pdf",
      "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0"
    },
    ...
  ]
}
```

**Query Syntax** (edismax)
- `q="contratto"` — cerca "contratto" in title^3, text_content, summary, tags
- `q="contratto fornitura"` — cerca documenti con entrambi i termini (AND default)
- `q="*"` — match all documenti (default se q omesso)

**Date Format**
```
ISO 8601 with timezone:
2024-05-12T14:30:00+00:00  (UTC)
2024-05-12T14:30:00        (interpreted as UTC)
```

**Example Queries**
```
# Tutti i contratti
GET /documents/search?type=contratto

# Fatture di maggio 2024
GET /documents/search?type=fattura&date_from=2024-05-01&date_to=2024-05-31

# Documenti di un autore specifico
GET /documents/search?author=Mario%20Rossi

# Full-text + filtri
GET /documents/search?q=manutenzione&type=contratto&page=2&page_size=20
```

**Error Handling**
- Se Solr offline: `SearchResult(total=0, items=[])`
- Nessun errore se nessun risultato

---

### GET /documents/{doc_id}

Dettaglio documento (include text_content).

**Request**
```
GET /documents/65a8b1c2d3e4f5g6h7i8j9k0
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "id": "65a8b1c2d3e4f5g6h7i8j9k0",
  "title": "Contratto Fornitura Alfa",
  "type": "contratto",
  "author": "Ufficio Legale",
  "upload_date": "2024-05-12T14:30:00+00:00",
  "tags": ["fornitori", "2024"],
  "summary": "Accordo di fornitura con Alfa SpA per materiali grezzi...",
  "original_filename": "contratto_fornitura_alfa.pdf",
  "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0",
  "text_content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit..."
}
```

**Errors**
- `404 Not Found`: documento non esiste
- `401 Unauthorized`: JWT scaduto

---

### PATCH /documents/{doc_id}

Aggiorna metadati (title, type, author, tags) e re-indexa Solr.

**Request**
```json
PATCH /documents/65a8b1c2d3e4f5g6h7i8j9k0
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Contratto Fornitura Alfa Aggiornato",
  "author": "Ufficio Legale Centrale",
  "tags": ["fornitori", "2024", "approvato", "principale"]
}
```

**Body Fields** (tutti opzionali)
| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | 1-200 chars |
| `type` | string | contratto\|fattura\|ordine\|cv\|comunicazione\|altro |
| `author` | string | 1-100 chars |
| `tags` | array | list of strings |

**Response** (200)
```json
{
  "id": "65a8b1c2d3e4f5g6h7i8j9k0",
  "title": "Contratto Fornitura Alfa Aggiornato",
  "type": "contratto",
  "author": "Ufficio Legale Centrale",
  "upload_date": "2024-05-12T14:30:00+00:00",
  "tags": ["fornitori", "2024", "approvato", "principale"],
  "summary": "...",
  "original_filename": "contratto_fornitura_alfa.pdf",
  "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0"
}
```

**Processing**
1. Valida ObjectId
2. MongoDB: find_one_and_update con $set
3. Solr: re-index documento (delete + add)
4. Log action

**Errors**
- `404 Not Found`: documento non esiste
- `422 Unprocessable Entity`: validation error (title/author/type)

---

### POST /documents/{doc_id}/regenerate-summary

Rigenera sommario AI usando Ollama.

**Request**
```
POST /documents/65a8b1c2d3e4f5g6h7i8j9k0/regenerate-summary
Authorization: Bearer <token>
```

**Response** (200)
```json
{
  "id": "65a8b1c2d3e4f5g6h7i8j9k0",
  "title": "Contratto Fornitura Alfa",
  "type": "contratto",
  "author": "Ufficio Legale",
  "upload_date": "2024-05-12T14:30:00+00:00",
  "tags": ["fornitori", "2024"],
  "summary": "Nuovo sommario generato da Ollama...",
  "original_filename": "contratto_fornitura_alfa.pdf",
  "uploaded_by": "55a8b1c2d3e4f5g6h7i8j9k0"
}
```

**Processing**
1. Leggi text_content da MongoDB
2. Ollama: generate_summary (30 sec timeout)
3. MongoDB: update summary field
4. Solr: re-index
5. Log action

**Errors**
- `404 Not Found`: documento non esiste
- Ollama timeout/offline: summary rimane null, operation completa

---

### DELETE /documents/{doc_id}

Elimina documento da MongoDB, Solr e filesystem.

**Request**
```
DELETE /documents/65a8b1c2d3e4f5g6h7i8j9k0
Authorization: Bearer <token>
```

**Response** (204 No Content)

**Processing**
1. Leggi file_path da MongoDB
2. Elimina file da disco (no error se missing)
3. MongoDB: delete_one
4. Solr: delete by id
5. Log action

**Errors**
- `404 Not Found`: documento non esiste

---

### GET /documents/{doc_id}/preview

Serve file originale inline (PDF/TXT in browser).

**Request**
```
GET /documents/65a8b1c2d3e4f5g6h7i8j9k0/preview
Authorization: Bearer <token>
```

**Response** (200)
```
Content-Type: application/pdf
Content-Disposition: inline

<binary PDF/TXT data>
```

**MIME Types**
- `.pdf` → `application/pdf`
- `.txt` → `text/plain; charset=utf-8`
- others → `application/octet-stream`

**Errors**
- `404 Not Found`: documento/file non esiste

---

### GET /documents/{doc_id}/download

Scarica file originale come allegato.

**Request**
```
GET /documents/65a8b1c2d3e4f5g6h7i8j9k0/download
Authorization: Bearer <token>
```

**Response** (200)
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="contratto_fornitura_alfa.pdf"

<binary data>
```

**Errors**
- `404 Not Found`: documento/file non esiste

---

## Health & Status

### GET /health

Health check (no auth required).

**Request**
```
GET /health
```

**Response** (200)
```json
{
  "status": "ok",
  "app": "Sistema Documentale"
}
```

---

## Common Error Codes

| Code | Scenario |
|------|----------|
| `200 OK` | Success (GET, PATCH, POST /analyze) |
| `201 Created` | Document created (POST /upload) |
| `204 No Content` | Deleted successfully (DELETE) |
| `400 Bad Request` | Malformed request, username exists |
| `401 Unauthorized` | JWT missing/expired, wrong password |
| `404 Not Found` | Resource not found |
| `422 Unprocessable Entity` | Validation error (file format, size, metadata) |
| `500 Internal Server Error` | MongoDB/Solr error |

---

## Rate Limiting

Non implementato (futura feature).

---

## Pagination Best Practices

```
# Page 1: 10 risultati per pagina
GET /documents/search?q=contratto&page=1&page_size=10

# Page 2: skip 10, limit 10
GET /documents/search?q=contratto&page=2&page_size=10

# Navigare al totale:
// total = 42, page_size = 10 → max_page = ceil(42/10) = 5
GET /documents/search?q=contratto&page=5&page_size=10
```

---

## Example Workflows

### Upload + Search Workflow
```bash
# 1. Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"mario","password":"pass","role":"admin"}'

# 2. Login
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mario","password":"pass"}' | jq -r '.access_token')

# 3. Upload document
curl -X POST http://localhost:8000/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@contratto.pdf" \
  -F "title=Contratto Alfa" \
  -F "type=contratto" \
  -F "author=Ufficio Legale" \
  -F "tags=fornitori,2024"

# 4. Search
curl -X GET "http://localhost:8000/documents/search?q=contratto&type=contratto&page=1" \
  -H "Authorization: Bearer $TOKEN"
```
