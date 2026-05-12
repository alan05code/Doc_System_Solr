# Database Schema & Query Patterns

## MongoDB

### Connection
```python
# config.py
mongo_url: str = "mongodb://admin:secret@localhost:27017"
mongo_db: str = "docmanager"

# Usage
from app.db.mongo import documents_col, users_col, audit_col
col = documents_col()
```

### Collection: `documents`

**Schema**
```json
{
  "_id": ObjectId,
  "title": "string (1-200 chars)",
  "type": "contratto|fattura|ordine|cv|comunicazione|altro",
  "author": "string (1-100 chars)",
  "upload_date": ISODate,
  "tags": ["string"],
  "text_content": "string (estratto file)",
  "summary": "string|null (max 3 frasi)",
  "original_filename": "string",
  "file_path": "string (percorso disco)",
  "uploaded_by": ObjectId (user._id)
}
```

**Sample Doc**
```json
{
  "_id": ObjectId("65a8b1c2d3e4f5g6h7i8j9k0"),
  "title": "Contratto Fornitura Alfa",
  "type": "contratto",
  "author": "Ufficio Legale",
  "upload_date": ISODate("2024-05-12T14:30:00Z"),
  "tags": ["fornitori", "2024", "approvato"],
  "text_content": "Lorem ipsum dolor sit amet...",
  "summary": "Accordo di fornitura con Alfa SpA per materiali grezzi. Durata 24 mesi. Prezzo fissato.",
  "original_filename": "contratto_fornitura_alfa.pdf",
  "file_path": "/app/uploads/7f3e2d1c0b9a8765_contratto_fornitura_alfa.pdf",
  "uploaded_by": ObjectId("55a8b1c2d3e4f5g6h7i8j9k0")
}
```

**Operazioni Comuni**

| Operazione | Query | Uso |
|-----------|-------|-----|
| Insert | `insert_one(doc)` | Upload documento |
| Find by ID | `find_one({"_id": ObjectId(id)})` | Detail view |
| List (paginated) | `find({}, sort=[("upload_date", -1)]).skip(n).limit(m)` | Lista documenti |
| Update metadata | `find_one_and_update({"_id": oid}, {"$set": fields})` | Modifica titolo/autore |
| Delete | `delete_one({"_id": oid})` | Elimina documento |
| Count | `count_documents({})` | Totale documenti |

**Indici Consigliati** (futuri)
```python
# Accelera ricerche frequenti
db.documents.create_index([("type", 1)])
db.documents.create_index([("author", 1)])
db.documents.create_index([("upload_date", -1)])
db.documents.create_index([("uploaded_by", 1)])
db.documents.create_index([("tags", 1)])
```

---

### Collection: `users`

**Schema**
```json
{
  "_id": ObjectId,
  "username": "string (unique, 3-50 chars)",
  "password_hash": "string (bcrypt)",
  "role": "admin|user",
  "created_at": ISODate
}
```

**Operazioni**
- `insert_one(user)` — register
- `find_one({"username": username})` — login
- `find_one({"_id": ObjectId(user_id)})` — get user info

---

### Collection: `audit_log`

**Schema**
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "action": "upload|search|view|download|edit|delete|regenerate_summary",
  "document_id": ObjectId|null,
  "timestamp": ISODate,
  "details": {
    "filename": "string",
    "q": "query string",
    "type": "filter value",
    "author": "filter value"
  }
}
```

**Sample Log**
```json
{
  "_id": ObjectId("65a8b1c2d3e4f5g6h7i8j9k0"),
  "user_id": ObjectId("55a8b1c2d3e4f5g6h7i8j9k0"),
  "action": "upload",
  "document_id": ObjectId("65a8b1c2d3e4f5g6h7i8j9k0"),
  "timestamp": ISODate("2024-05-12T14:30:00Z"),
  "details": {
    "filename": "contratto_fornitura_alfa.pdf"
  }
}
```

---

## Solr

### Core Configuration
- **Core name**: `documents`
- **Schema**: managed (auto-generated da setup_solr.py)
- **Analyzer**: Italian language (ItalianLightStemmer + ElisionFilter + StopFilter)
- **URL**: `http://localhost:8983/solr/documents`

### Index Schema

**Fields**
```xml
<!-- Unique ID (required) -->
<field name="id" type="string" indexed="true" stored="true" required="true"/>

<!-- Full-text search fields -->
<field name="title" type="text_it" indexed="true" stored="true"/>
<field name="text_content" type="text_it" indexed="true" stored="false"/>
<field name="summary" type="text_it" indexed="true" stored="true"/>
<field name="tags" type="text_it" indexed="true" stored="true" multiValued="true"/>

<!-- Filterable fields -->
<field name="type" type="string" indexed="true" stored="true"/>
<field name="author" type="string" indexed="true" stored="true"/>
<field name="upload_date" type="date" indexed="true" stored="true"/>
<field name="original_filename" type="string" indexed="true" stored="true"/>
<field name="uploaded_by" type="string" indexed="true" stored="true"/>
```

**Data Synchronization**
MongoDB è source of truth. Solr è replica denormalizzata:

| Operazione | MongoDB | Solr |
|-----------|---------|------|
| Upload | insert_one | add (index_document) |
| Update metadata | find_one_and_update | delete + add |
| Rigenera summary | update (summary) | delete + add |
| Delete | delete_one | delete |

---

## Query Patterns

### Pattern 1: Full-text Search con Filtri

```python
# Backend: search_service.full_text_search()

query = "contratto fornitura"  # Solr edismax
fq = [
    "type:contratto",
    'author:"Ufficio Legale"',
    "upload_date:[2024-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]"
]

params = {
    "rows": 10,
    "start": 0,
    "fl": "id,title,type,author,upload_date,tags,summary",
    "defType": "edismax",
    "qf": "title^3 text_content summary tags"
}

results = solr.search(query, fq=fq, **params)
```

**Cosa succede**
1. edismax parser interpreta "contratto fornitura" con stemming italiano
2. Boost: titolo (^3) più rilevante di testo
3. Filter query esclude documenti non-matching (type, author, date)
4. Paginazione: start=0, rows=10
5. Ritorna: id, title, type, author, upload_date, tags, summary

---

### Pattern 2: Range Query su Data

```python
# Frontend: /documents/search?date_from=2024-05-01&date_to=2024-05-31

# Backend: _build_fq()
date_from = datetime(2024, 5, 1, tzinfo=timezone.utc)
date_to = datetime(2024, 5, 31, 23, 59, 59, tzinfo=timezone.utc)

dfrom = date_from.strftime("%Y-%m-%dT%H:%M:%SZ")  # "2024-05-01T00:00:00Z"
dto = date_to.strftime("%Y-%m-%dT%H:%M:%SZ")       # "2024-05-31T23:59:59Z"

fq = f"upload_date:[{dfrom} TO {dto}]"
# fq = "upload_date:[2024-05-01T00:00:00Z TO 2024-05-31T23:59:59Z]"
```

---

### Pattern 3: Wildcard Query (Match All)

```python
# Frontend: /documents/search (nessun q param)

# Backend
q = "*"  # oppure "*:*" in Solr

# Ritorna tutti documenti (senza filter query applicati)
results = solr.search("*", rows=10, start=0, ...)
```

---

### Pattern 4: Exact Match + Pagination

```python
# Frontend: /documents/search?author="John Doe"&page=2

# Backend
author = "John Doe"
safe_author = author.replace('"', '\\"')  # Escape double quotes
fq = f'author:"{safe_author}"'

start = (page - 1) * page_size  # (2 - 1) * 10 = 10
params = {
    "rows": 10,
    "start": 10,
    "fl": "id,title,author,upload_date,summary"
}

results = solr.search("*", fq=[fq], **params)
# Ritorna righe 10-19
```

---

### Pattern 5: Escape Query String

```python
# User input con caratteri speciali
user_query = 'contratto "Alfa Inc." AND manutenzione'

# Escape per Solr
escaped = user_query.replace('"', '\\"')  # In context SearchFilters non fatto
# Better: usare handler Solr con dismax

# O passare raw e lasciare edismax parsare
results = solr.search(user_query, defType="edismax", ...)
```

---

## Sync Failures & Recovery

### Scenario: Solr Index Desync

**Causa**: Solr offline durante upload, MongoDB salva ma Solr non indicizza.

**Recovery**
```python
# Script di ri-indexing (manuale)
from app.db.mongo import documents_col
from app.db.solr import get_solr

for doc in documents_col().find({}):
    solr_doc = {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "type": doc["type"],
        "author": doc["author"],
        "upload_date": doc["upload_date"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "text_content": doc.get("text_content", ""),
        "summary": doc.get("summary") or "",
        "tags": doc.get("tags", []),
    }
    get_solr().add([solr_doc])

print("Re-index complete")
```

---

## Configuration

**MongoDB Auth** (.env)
```
MONGO_URL=mongodb://admin:secret@localhost:27017
MONGO_DB=docmanager
```

**Solr URL** (.env)
```
SOLR_URL=http://localhost:8983/solr/documents
```

**Limits**
```
MAX_FILE_SIZE_MB=50  # Max file size
```

---

## Performance Notes

1. **Text content indexed**: full-text search veloce
2. **Type/Author indexed**: filtri veloci
3. **Upload date indexed**: range query velocity
4. **No denormalization in MongoDB**: source of truth unico
5. **Solr caching**: pysolr gestisce internally
6. **Pagination**: limit+skip + Solr start/rows (non fetch all)
