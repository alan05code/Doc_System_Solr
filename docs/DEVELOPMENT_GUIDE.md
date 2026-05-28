# Guida allo Sviluppo — Sistema Documentale

Regole derivate dai bug reali trovati nell'analisi del codice (`docs/analisi_qualita_codice.md`).
Ogni regola ha la motivazione e il riferimento al problema originale.

---

## 1. Sicurezza — Backend

### 1.1 Ogni endpoint di scrittura deve verificare l'ownership

**Regola:** prima di cancellare o modificare una risorsa, verificare che `current_user.id == resource.owner_id` oppure `current_user.role == "admin"`.

**Perché:** senza questo controllo qualsiasi utente autenticato può cancellare documenti altrui conoscendo solo l'ID. Questo si chiama *IDOR* (Insecure Direct Object Reference) ed è nella OWASP Top 10.

```python
# Pattern corretto
def _check_ownership(doc_id: str, current_user: UserOut) -> None:
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Non trovato")
    if doc.uploaded_by != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Non autorizzato")
```

### 1.2 Validare tutti i campi usati nelle query Solr

**Regola:** qualsiasi parametro che finisce in una query Solr (`fq`, `q`, ecc.) deve essere validato con un pattern Pydantic **prima** di arrivare al service layer.

**Perché:** un campo `type` non validato in `SearchFilters` permetteva Solr injection via `fq.append(f"type:{filters.type}")`. La validazione Pydantic con `pattern=` blocca l'input prima che raggiunga Solr.

```python
# Sbagliato
type: Optional[str] = None  # accetta qualsiasi stringa

# Corretto
type: Optional[str] = Field(None, pattern=_TYPE_PATTERN)
```

### 1.3 Non esporre Swagger in produzione

**Regola:** `docs_url` e `redoc_url` devono dipendere da `settings.debug`.

```python
app = FastAPI(
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)
```

**Perché:** la documentazione interattiva in produzione permette a chiunque di esplorare e testare le API senza autenticazione.

### 1.4 Non usare credenziali root di MongoDB

**Regola:** creare un utente MongoDB dedicato con accesso limitato al solo database dell'applicazione. Non usare mai `admin:secret` come default in produzione.

**Perché:** se l'app viene compromessa, l'attaccante ottiene accesso a tutto MongoDB.

### 1.5 CORS: permettere solo ciò che serve

**Regola:** specificare metodi e header esplicitamente, non usare `"*"`.

```python
# Sbagliato
allow_methods=["*"],
allow_headers=["*"],

# Corretto
allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type"],
```

### 1.6 Non passare messaggi di eccezione interni al client

**Regola:** usare messaggi di errore controllati, non `str(exc)` nelle HTTPException.

**Perché:** errori interni possono contenere percorsi di file, query, o dettagli di configurazione sensibili.

```python
# Sbagliato
raise HTTPException(status_code=409, detail=str(exc))

# Corretto
raise HTTPException(status_code=409, detail="Username già in uso")
```

---

## 2. MongoDB

### 2.1 Creare gli indici una volta sola, all'avvio

**Regola:** tutti gli indici devono essere definiti in un'unica funzione `ensure_indexes()` in `app/db/mongo.py` e chiamati nell'evento `startup` di FastAPI.

**Perché:** chiamare `create_index` ad ogni registrazione utente è costoso e non necessario — MongoDB non ricrea l'indice se esiste già, ma esegue comunque un round-trip ogni volta.

```python
# mongo.py
def ensure_indexes() -> None:
    users_col().create_index("username", unique=True)
    documents_col().create_index([("upload_date", DESCENDING)])
    # ...

# main.py
@app.on_event("startup")
def startup() -> None:
    ensure_indexes()
```

### 2.2 Definire indici su tutti i campi usati in query e sort

**Regola:** ogni campo usato come filtro (`type`, `uploaded_by`) o ordinamento (`upload_date`) deve avere un indice.

**Perché:** senza indice MongoDB fa full-collection scan — con migliaia di documenti diventa proibitivo.

Campi da indicizzare in questo progetto:
- `documents.upload_date` (sort)
- `documents.type` (filtro ricerca)
- `documents.uploaded_by` (filtro per utente)
- `audit_log.user_id + timestamp` (query log)

### 2.3 Usare TTL index per collection che crescono senza limite

**Regola:** la collection `audit_log` deve avere un TTL index su `timestamp`.

```python
audit_col().create_index("timestamp", expireAfterSeconds=365 * 24 * 3600)
```

**Perché:** senza pulizia automatica, i log crescono indefinitamente occupando spazio.

---

## 3. Apache Solr

### 3.1 Non usare `always_commit=True` con pysolr

**Regola:** creare il client con `always_commit=False`.

```python
# Sbagliato
pysolr.Solr(url, always_commit=True)

# Corretto
pysolr.Solr(url, always_commit=False)
```

**Perché:** `always_commit=True` esegue un hard commit ad ogni singolo documento — annulla il beneficio di `autoCommit` configurato in `solrconfig.xml` e degrada drasticamente le performance di scrittura.

### 3.2 Schema immutabile in produzione

**Regola:** in `solrconfig.xml`, impostare `<bool name="mutable">false</bool>` per ambienti non-development.

**Perché:** con `mutable=true` chiunque abbia accesso all'API Solr può modificare lo schema a runtime.

### 3.3 Non esporre `echoParams=all` nel ping handler

**Regola:** usare `echoParams=none` o `echoParams=explicit`.

**Perché:** `echoParams=all` include tutti i parametri interni nella risposta, esponendo dettagli di configurazione non necessari.

### 3.4 Configurare autowarm sulle cache

**Regola:** impostare `autowarmCount` > 0 su `filterCache` e `queryResultCache` (es. 128).

**Perché:** con `autowarmCount=0`, dopo ogni riavvio Solr le cache sono vuote e le prime richieste sono significativamente più lente.

---

## 4. Frontend

### 4.1 Verificare che le route esistano nel router prima di navigare

**Regola:** prima di usare `navigate("/percorso")`, verificare che `/percorso` sia definito in `App.tsx`.

**Perché:** `navigate("/documents")` dopo la cancellazione era un bug silenzioso — la route non esiste e React Router fa redirect alla dashboard in modo non intenzionale. La route corretta è `/dashboard`.

Route esistenti in questo progetto: `/login`, `/dashboard`, `/upload`, `/search`, `/documents/:id`.

### 4.2 Costanti condivise tra componenti in `src/constants.ts`

**Regola:** oggetti di stile o stringhe usati in più componenti devono stare in `src/constants.ts` e importati, non copiati.

```typescript
// src/constants.ts
export const TYPE_STYLE: Record<string, string> = { ... };
```

**Perché:** `TYPE_STYLE` era copiato identico in `DocumentCard.tsx` e `DocumentPage.tsx`. Una modifica richiederebbe aggiornamenti in più posti.

### 4.3 Utility `getErrorMessage` per gli errori Axios

**Regola:** non ripetere il cast di tipo per estrarre `response.data.detail`. Usare `getErrorMessage` da `src/utils/errors.ts`.

```typescript
// Sbagliato
(err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "fallback"

// Corretto
getErrorMessage(err, "fallback")
```

### 4.4 Token JWT: nota su localStorage

Il token JWT è attualmente in `localStorage` (`useAuth.ts`). Questa soluzione è vulnerabile a XSS. La soluzione sicura sarebbe usare cookie `httpOnly; Secure` gestiti dal backend. Per un progetto didattico la situazione attuale è accettabile; in produzione reale va cambiata.

---

## 5. Qualità del codice

### 5.1 Estrarre pattern ripetuti in funzioni helper

**Regola:** se lo stesso blocco di codice appare 3+ volte, estrarlo in una funzione privata.

**Esempio concreto:** la conversione `ObjectId` con gestione dell'eccezione appariva 5 volte in `document_service.py`. Ora è in `_parse_oid()`.

```python
def _parse_oid(doc_id: str) -> Optional[ObjectId]:
    try:
        return ObjectId(doc_id)
    except Exception:
        return None
```

### 5.2 L'health check deve verificare le dipendenze reali

**Regola:** `/health` deve pingare MongoDB e Solr e rispondere con HTTP 503 se uno dei due non risponde.

**Perché:** un health check che risponde sempre 200 è inutile in un sistema di monitoraggio o in Kubernetes — maschera i down reali.

### 5.3 Non inghiottire eccezioni silenziosamente

**Regola:** `except Exception: return None` è accettabile solo quando il fallback è intenzionale e documentato. Non usarlo per nascondere errori inaspettati — usare almeno `logger.error(...)`.

### 5.4 Commenti solo sul "perché", non sul "cosa"

Quando il codice fa qualcosa di non ovvio, commentare la motivazione:
```python
excerpt = text[:3000]  # limite Ollama: token budget del modello
```
Non commentare ciò che si capisce dal codice stesso.

---

## 6. Checklist per nuovi endpoint

Prima di fare merge di un nuovo endpoint, verificare:

- [ ] Richiede autenticazione? → `Depends(get_current_user)`
- [ ] Modifica una risorsa altrui? → `_check_ownership()` o `Depends(require_admin)`
- [ ] Usa parametri in query Solr? → validazione Pydantic con `pattern=` o enum
- [ ] Restituisce errori interni? → usare messaggi statici, non `str(exc)`
- [ ] Aggiunge una nuova collection MongoDB? → aggiungere indici in `ensure_indexes()`
- [ ] Frontend: la route di destinazione esiste in `App.tsx`?
