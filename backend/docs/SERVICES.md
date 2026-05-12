# Services Layer Documentation

## Overview

Layer di business logic che coordina database, search engine, AI e filesystem.

```
API Layer (documents.py, auth.py)
    ↓
Services (document_service, search_service, auth_service, ai_service)
    ↓
DB Layer (mongo.py, solr.py) + Extractors + AI
    ↓
External (MongoDB, Solr, Ollama, Filesystem)
```

---

## Document Service (`services/document_service.py`)

Orchestrazione completa per operazioni CRUD documenti.

### Functions

#### `analyze_document(filename, content) → DocumentAnalysis`

Pre-upload analysis senza salvataggio.

```python
def analyze_document(filename: str, content: bytes) -> DocumentAnalysis:
    # 1. Valida file (estensione + size)
    ext = _validate_file(filename, content)
    
    # 2. Estrai testo raw
    text = extract_text(filename, content)
    
    # 3. AI: metadata extraction
    meta = extract_metadata(text)  # {title, type, author, tags}
    
    # 4. AI: summary generation
    summary = generate_summary(text)
    
    # 5. Ritorna senza salvare
    return DocumentAnalysis(**meta, summary=summary)
```

**Input**
- `filename`: string con estensione (.pdf, .docx, .txt)
- `content`: bytes (file binary)

**Output**
```python
DocumentAnalysis(
    title="Contratto Fornitura",
    type="contratto",
    author="Ufficio Legale",
    tags=["fornitori", "2024"],
    summary="Accordo fornitura 24 mesi..."
)
```

**Errors**
- `ValueError`: formato non supportato, file troppo grande

**Side Effects**
- None (lettura sola AI, no persistence)

---

#### `upload_document(filename, content, meta, user_id, pregenerated_summary=None) → DocumentOut`

Full pipeline: validate → extract → AI → save MongoDB → index Solr → save disk.

```python
def upload_document(
    filename: str,
    content: bytes,
    meta: DocumentMeta,
    user_id: str,
    pregenerated_summary: Optional[str] = None,
) -> DocumentOut:
    # 1. Valida file
    ext = _validate_file(filename, content)
    
    # 2. Estrai testo
    text_content = extract_text(filename, content)
    
    # 3. Salva file su disco (generate UUID per unicità)
    upload_dir = Path(get_settings().upload_dir)  # "uploads/"
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = upload_dir / stored_name
    file_path.write_bytes(content)
    
    # 4. AI: summary (usa provided o genera)
    summary = pregenerated_summary or generate_summary(text_content)
    
    # 5. Crea documento MongoDB
    now = datetime.now(timezone.utc)
    doc = {
        "title": meta.title,
        "type": meta.type,
        "author": meta.author,
        "upload_date": now,
        "tags": meta.tags,
        "text_content": text_content,
        "summary": summary,
        "original_filename": filename,
        "file_path": str(file_path),
        "uploaded_by": ObjectId(user_id),
    }
    
    # 6. Insert in MongoDB
    result = documents_col().insert_one(doc)
    doc["_id"] = result.inserted_id
    
    # 7. Index in Solr
    _index_in_solr(doc)
    
    # 8. Ritorna serializzato
    return _serialize(doc)
```

**Input**
- `filename`: string (.pdf, .docx, .txt)
- `content`: bytes (file binary)
- `meta`: DocumentMeta object {title, type, author, tags}
- `user_id`: string (ObjectId format)
- `pregenerated_summary`: optional string (skip AI if provided)

**Output**
```python
DocumentOut(
    id="65a8b1c2d3e4f5g6h7i8j9k0",
    title="Contratto Fornitura",
    type="contratto",
    author="Ufficio Legale",
    upload_date=datetime(...),
    tags=["fornitori"],
    summary="...",
    original_filename="contratto.pdf",
    uploaded_by="55a8b1c2d3e4f5g6h7i8j9k0"
)
```

**Errors**
- `ValueError`: formato/size validation

**Side Effects**
- File salvo su disco (uploads/UUID_filename)
- MongoDB insert
- Solr index add
- Non transazionale: se Solr fallisce, MongoDB commit rimane

---

#### `update_document(doc_id, fields) → Optional[DocumentOut]`

Aggiorna campi metadata in MongoDB e re-indexa Solr.

```python
def update_document(doc_id: str, fields: dict) -> Optional[DocumentOut]:
    # 1. Valida ObjectId
    try:
        oid = ObjectId(doc_id)
    except Exception:
        return None
    
    # 2. Se nessun field, ritorna documento attuale
    if not fields:
        return get_document(doc_id)
    
    # 3. MongoDB: find_one_and_update con $set
    doc = documents_col().find_one_and_update(
        {"_id": oid},
        {"$set": fields},  # fields: {title, type, author, tags} opzionali
        return_document=ReturnDocument.AFTER,  # ritorna documento aggiornato
    )
    
    # 4. If not found
    if not doc:
        return None
    
    # 5. Re-index in Solr (complete document)
    _index_in_solr(doc)
    
    # 6. Serializza
    return _serialize(doc)
```

**Input**
- `doc_id`: string (MongoDB ObjectId hex format)
- `fields`: dict con {title, type, author, tags} opzionali

**Output**
- DocumentOut aggiornato, o None se documento non trovato

**Errors**
- ObjectId parse error: ritorna None
- Solr error: logged ma non bloccante

**Side Effects**
- MongoDB update
- Solr re-index

---

#### `regenerate_summary(doc_id) → Optional[DocumentOut]`

Rigenera sommario da text_content usando Ollama.

```python
def regenerate_summary(doc_id: str) -> Optional[DocumentOut]:
    # 1. Valida ObjectId
    try:
        oid = ObjectId(doc_id)
    except Exception:
        return None
    
    # 2. Leggi document per text_content
    doc = documents_col().find_one({"_id": oid}, {"text_content": 1})
    if not doc:
        return None
    
    # 3. AI: genera sommario
    summary = generate_summary(doc.get("text_content", ""))
    
    # 4. MongoDB: update summary field
    updated = documents_col().find_one_and_update(
        {"_id": oid},
        {"$set": {"summary": summary}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return None
    
    # 5. Solr: re-index
    _index_in_solr(updated)
    
    # 6. Log + return
    return _serialize(updated)
```

**Input**
- `doc_id`: string

**Output**
- DocumentOut con nuovo summary, o None se non trovato

**Side Effects**
- Ollama call (30 sec timeout)
- MongoDB update
- Solr re-index

---

#### `delete_document(doc_id) → bool`

Elimina documento da MongoDB, Solr, filesystem.

```python
def delete_document(doc_id: str) -> bool:
    # 1. Valida ObjectId
    try:
        oid = ObjectId(doc_id)
    except Exception:
        return False
    
    # 2. Leggi document per file_path
    doc = documents_col().find_one({"_id": oid}, {"file_path": 1})
    if not doc:
        return False
    
    # 3. Elimina file da disco (no error se missing)
    file_path = Path(doc.get("file_path", ""))
    if file_path.exists():
        file_path.unlink(missing_ok=True)
    
    # 4. MongoDB: delete_one
    documents_col().delete_one({"_id": oid})
    
    # 5. Solr: delete (best effort)
    try:
        solr_delete(doc_id)
    except Exception as exc:
        logger.error("Solr delete failed for %s: %s", doc_id, exc)
    
    # 6. Return success
    return True
```

**Input**
- `doc_id`: string

**Output**
- bool: True se cancellato, False se ObjectId invalid o documento non trovato

**Side Effects**
- File unlink
- MongoDB delete
- Solr delete (non bloccante)

---

#### `get_document(doc_id) → Optional[DocumentDetail]`

Dettaglio documento (include text_content).

```python
def get_document(doc_id: str) -> Optional[DocumentDetail]:
    try:
        doc = documents_col().find_one({"_id": ObjectId(doc_id)})
    except Exception:
        return None
    
    if not doc:
        return None
    
    out = _serialize(doc)
    return DocumentDetail(**out.model_dump(), text_content=doc.get("text_content", ""))
```

**Input**
- `doc_id`: string

**Output**
- DocumentDetail (include text_content), or None

---

#### `list_documents(page=1, page_size=10) → tuple[list[DocumentOut], int]`

Lista paginata, ordered by upload_date desc.

```python
def list_documents(page: int = 1, page_size: int = 10) -> tuple[list[DocumentOut], int]:
    col = documents_col()
    skip = (page - 1) * page_size
    total = col.count_documents({})  # Total documents in collection
    
    # Query: sort descending, pagination
    docs = col.find(
        {},
        {"text_content": 0}  # Exclude large field
    ).sort("upload_date", -1).skip(skip).limit(page_size)
    
    return [_serialize(d) for d in docs], total
```

**Input**
- `page`: 1-indexed
- `page_size`: limit per page

**Output**
- tuple: (list of DocumentOut, total count)

---

#### `_validate_file(filename, content) → str`

Valida estensione e dimensione.

```python
def _validate_file(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    
    if ext not in ALLOWED_EXTENSIONS:  # {"pdf", "docx", "txt"}
        raise ValueError(f"Formato non supportato: {ext}. Usa PDF, DOCX o TXT.")
    
    max_bytes = get_settings().max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(f"File troppo grande (max {get_settings().max_file_size_mb} MB)")
    
    return ext
```

**Raises**
- `ValueError`: invalid extension or size

---

#### `_index_in_solr(doc) → None`

Serializza documento MongoDB → schema Solr, indexa.

```python
def _index_in_solr(doc: dict) -> None:
    try:
        index_document({
            "id": str(doc["_id"]),
            "title": doc["title"],
            "type": doc["type"],
            "author": doc["author"],
            "upload_date": doc["upload_date"].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tags": doc.get("tags", []),
            "text_content": doc.get("text_content", ""),
            "summary": doc.get("summary") or "",
            "uploaded_by": str(doc["uploaded_by"]),
        })
    except Exception as exc:
        logger.error("Solr indexing failed for %s: %s", doc["_id"], exc)
```

**Side Effects**
- Solr index add (best effort, logged on error)

---

## Search Service (`services/search_service.py`)

Ricerca full-text con filtri.

### Functions

#### `full_text_search(filters: SearchFilters) → SearchResult`

Query Solr con filtri e paginazione.

```python
def full_text_search(filters: SearchFilters) -> SearchResult:
    # 1. Query string: default "*:*" se empty
    query = filters.q.strip() or "*:*"
    
    # 2. Build filter queries (fq)
    fq = _build_fq(filters)
    
    # 3. Pagination
    start = (filters.page - 1) * filters.page_size
    
    # 4. Solr params
    params = {
        "rows": filters.page_size,
        "start": start,
        "fl": "id,title,type,author,upload_date,tags,summary,original_filename,uploaded_by",
        "defType": "edismax",  # Extended dismax parser
        "qf": "title^3 text_content summary tags",  # Query fields + boost
    }
    
    # 5. Add fq if present
    if fq:
        params["fq"] = fq
    
    # 6. Execute search
    try:
        results = search(query, **params)
        total = results.hits
        items = [_solr_to_doc(r) for r in results]
    except Exception as exc:
        logger.error("Solr search error: %s", exc)
        return SearchResult(total=0, page=filters.page, page_size=filters.page_size, items=[])
    
    # 7. Return paginated result
    return SearchResult(total=total, page=filters.page, page_size=filters.page_size, items=items)
```

**Input**
- `filters`: SearchFilters object
  - q: string (default "*")
  - type: optional (filter)
  - author: optional (filter)
  - date_from, date_to: optional (range filter)
  - page, page_size: pagination

**Output**
- SearchResult(total, page, page_size, items=[DocumentOut])
- If Solr error: SearchResult(total=0, items=[])

---

#### `_build_fq(filters) → list[str]`

Costruisce filter query per Solr.

```python
def _build_fq(filters: SearchFilters) -> list[str]:
    fq = []
    
    # Type: exact match
    if filters.type:
        fq.append(f"type:{filters.type}")
    
    # Author: quoted (escape internal quotes)
    if filters.author:
        safe = filters.author.replace('"', '\\"')
        fq.append(f'author:"{safe}"')
    
    # Date range: upload_date:[from TO to]
    if filters.date_from or filters.date_to:
        dfrom = filters.date_from.strftime("%Y-%m-%dT%H:%M:%SZ") if filters.date_from else "*"
        dto = filters.date_to.strftime("%Y-%m-%dT%H:%M:%SZ") if filters.date_to else "*"
        fq.append(f"upload_date:[{dfrom} TO {dto}]")
    
    return fq
```

**Example Output**
```python
[
    "type:contratto",
    'author:"Ufficio Legale"',
    "upload_date:[2024-05-01T00:00:00Z TO 2024-05-31T23:59:59Z]"
]
```

---

#### `_solr_to_doc(r: dict) → DocumentOut`

Mapping Solr result → DocumentOut.

```python
def _solr_to_doc(r: dict) -> DocumentOut:
    # Parse upload_date string → datetime
    upload_date = r.get("upload_date")
    if isinstance(upload_date, str):
        upload_date = datetime.fromisoformat(upload_date.replace("Z", "+00:00"))
    
    # Parse tags (può essere string o list)
    tags = r.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    
    return DocumentOut(
        id=r["id"],
        title=r.get("title", ""),
        type=r.get("type", "altro"),
        author=r.get("author", ""),
        upload_date=upload_date or datetime.now(),
        tags=tags,
        summary=r.get("summary") or None,
        original_filename=r.get("original_filename", ""),
        uploaded_by=r.get("uploaded_by", ""),
    )
```

---

## AI Service (`services/ai_service.py`)

Ollama integration per metadata extraction e summary generation.

### Functions

#### `extract_metadata(text: str) → dict`

Estrae metadata JSON da Ollama.

```python
def extract_metadata(text: str) -> dict:
    # Input: primi 2000 caratteri text
    prompt = f"""Analizza questo documento e estrai in JSON:
    - title (stringa max 200 chars)
    - type (contratto|fattura|ordine|cv|comunicazione|altro)
    - author (stringa max 100 chars)
    - tags (list di stringhe)

    Documento: {text[:2000]}
    
    Ritorna solo JSON valido.
    """
    
    # Ollama call (30 sec timeout)
    response = ollama.generate(
        model=get_settings().ollama_model,
        prompt=prompt,
        stream=False,
        timeout=get_settings().ollama_timeout,
    )
    
    # Parse JSON
    try:
        return json.loads(response["response"])
    except (json.JSONDecodeError, KeyError):
        # Fallback se parse fallisce
        return {
            "title": "",
            "type": "altro",
            "author": "",
            "tags": []
        }
```

**Input**
- `text`: raw text string (primi 2000 chars usati)

**Output**
- dict: {title, type, author, tags}
- Fallback se Ollama offline: empty values

---

#### `generate_summary(text: str) → Optional[str]`

Genera summary con Ollama.

```python
def generate_summary(text: str) -> Optional[str]:
    prompt = f"""Riassumi questo documento in massimo 3 frasi.

    Documento: {text[:3000]}
    
    Riassunto:
    """
    
    try:
        response = ollama.generate(
            model=get_settings().ollama_model,
            prompt=prompt,
            stream=False,
            timeout=get_settings().ollama_timeout,
        )
        return response.get("response", "").strip() or None
    except Exception:
        logger.exception("Summary generation failed")
        return None
```

**Input**
- `text`: raw text (primi 3000 chars)

**Output**
- Optional[str]: sommario, o None se fallisce

---

## Auth Service (`services/auth_service.py`)

JWT e audit logging.

### Functions

#### `log_action(user_id, action, document_id=None, details=None) → None`

Salva action log in audit_log collection.

```python
def log_action(
    user_id: str,
    action: str,  # "upload|search|view|download|edit|delete|regenerate_summary"
    document_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    audit_col().insert_one({
        "user_id": ObjectId(user_id),
        "action": action,
        "document_id": ObjectId(document_id) if document_id else None,
        "timestamp": datetime.now(timezone.utc),
        "details": details or {},
    })
```

---

## Extractors (`services/extractors.py`)

Testo extraction da PDF/DOCX/TXT.

### Functions

#### `extract_text(filename: str, content: bytes) → str`

```python
def extract_text(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    
    if ext == "pdf":
        return _extract_pdf(content)
    elif ext == "docx":
        return _extract_docx(content)
    elif ext == "txt":
        return content.decode("utf-8", errors="ignore")
    else:
        return ""
```

**Libraries**
- PDF: `pymupdf` (fitz)
- DOCX: `python-docx`
- TXT: plain UTF-8 decode

---

## Error Handling Summary

| Service | Error Type | Handling |
|---------|-----------|----------|
| Document Service | ValueError (validate) | Raise → API returns 422 |
| Document Service | ObjectId error | Return None → API returns 404 |
| Document Service | Solr indexing | Log error, non-bloccante |
| Document Service | File I/O | Raise → API returns 500 |
| Search Service | Solr exception | Return empty SearchResult(total=0) |
| AI Service | Ollama timeout | Return empty/null, log error |
| AI Service | JSON parse error | Return fallback values |
| Auth Service | MongoDB error | Raise → API returns 500 |

---

## Performance Considerations

1. **Text Limiting**: metadata ← 2000 chars, summary ← 3000 chars (speed up AI)
2. **Lazy Loading**: text_content excluded from list queries
3. **Pagination**: limit+skip pattern (not fetch all)
4. **Cache**: lru_cache on get_client(), get_solr()
5. **Error Fallbacks**: Ollama offline non-bloccante, Solr search graceful
6. **Async**: Frontend async API calls, backend sync (future: Celery for AI tasks)
