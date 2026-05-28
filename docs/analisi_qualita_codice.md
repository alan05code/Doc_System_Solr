# Analisi qualità del codice — Sistema Documentale

Questo documento raccoglie tutti i problemi trovati nel progetto, divisi per area e categoria.
Ogni problema ha una spiegazione semplice e, dove possibile, un esempio del codice che lo causa.

---

## Indice

1. [Backend](#1-backend)
2. [Frontend](#2-frontend)
3. [MongoDB](#3-mongodb)
4. [Solr](#4-solr)
5. [Generale (tutto il progetto)](#5-generale)
6. [Possibili miglioramenti](#6-Possibili-miglioramenti-implementabili)

---

## 1. Backend

### Sicurezza

---

**Qualsiasi utente può cancellare o modificare documenti di altri**

Nel file `backend/app/api/documents.py`, le operazioni di cancellazione e modifica non controllano se il documento appartiene all'utente che fa la richiesta. Un utente normale (non admin) può cancellare i documenti caricati da chiunque altro semplicemente conoscendo l'ID del documento.

```python
# documents.py — non c'è nessun controllo "chi ha caricato questo documento?"
@router.delete("/{doc_id}", ...)
def delete_doc(doc_id: str, current_user: UserOut = Depends(get_current_user)):
    if not delete_document(doc_id):
        raise HTTPException(...)
    log_action(current_user.id, "delete", doc_id)
```

Manca il confronto tra `current_user.id` e `doc.uploaded_by` prima di procedere o una verifica admin.

---

**Nessuna protezione contro i tentativi di indovinare la password (brute force)**

L'endpoint `/auth/login` non ha nessun limite sul numero di tentativi. Un attaccante può provare migliaia di password al secondo senza essere bloccato.

---

**Il nome del file caricato non viene controllato**

In `backend/app/services/document_service.py`, il nome del file originale viene salvato così com'è senza nessuna pulizia. Un nome come `../../../etc/passwd` potrebbe essere pericoloso se usato in operazioni sul filesystem.

```python
stored_name = f"{uuid.uuid4().hex}_{filename}"  # filename non viene sanificato
```

---

**Il campo `type` nella ricerca non viene validato**

In `backend/app/models/document.py`, il modello `DocumentMeta` (usato per l'upload) ha una validazione sul campo `type` che accetta solo valori come `fattura`, `contratto`, ecc. Ma il modello `SearchFilters` (usato per la ricerca) non ha questa stessa validazione:

```python
class SearchFilters(BaseModel):
    type: Optional[str] = None  # accetta qualsiasi stringa, anche quella malformata
```

Questo valore finisce direttamente nella query Solr senza nessuna protezione:

```python
fq.append(f"type:{filters.type}")  # injection possibile
```

---

**La funzione `require_admin` esiste ma non viene mai usata**

In `backend/app/api/deps.py` c'è una funzione che blocca l'accesso agli utenti non admin, ma non viene collegata a nessun endpoint. Tutti i documenti (inclusa la lista completa) sono accessibili a qualsiasi utente autenticato.
Si potrebbe valutare una ACL con permessi per gruppo (admin, user).

---

**Swagger UI (la documentazione delle API) è sempre visibile**

In `backend/main.py`, l'app FastAPI è configurata con `docs_url="/docs"`. Questo significa che chiunque raggiunga il server può vedere tutta la documentazione delle API e provarle interattivamente, anche in produzione.
Da disattivare in produzione.

---

**Errori interni passati direttamente al client**

In `backend/app/api/auth.py`, il messaggio di errore dell'eccezione Python viene mandato direttamente nella risposta HTTP:

```python
raise HTTPException(status_code=409, detail=str(exc))
```

Se in futuro un errore interno contiene informazioni sensibili (percorsi di file, query SQL, ecc.), queste arriverebbero all'utente.

---

### Performance

---

**Il database MongoDB viene usato in modo bloccante in un'applicazione asincrona**

FastAPI è un framework costruito per gestire molte richieste contemporaneamente in modo efficiente (asincrono). Ma tutte le chiamate al database usano la libreria `pymongo`, che è sincrona: blocca l'intera applicazione mentre aspetta la risposta dal database. Sotto carico, questo causa colli di bottiglia seri. La soluzione sarebbe usare `motor`, la versione asincrona di pymongo.

---

**File caricati interamente in memoria**

In `backend/app/api/documents.py`, quando un utente carica un file, viene letto tutto in memoria con `await file.read()`. Con un limite di 50 MB per file e molti utenti contemporanei, questo può esaurire la RAM del server.

---

**Conteggio documenti lento senza indice**

In `backend/app/services/document_service.py`, per calcolare il totale dei documenti viene eseguita questa operazione ad ogni richiesta di lista:

```python
total = col.count_documents({})  # scorre tutti i documenti ogni volta
```

Con migliaia di documenti, questa operazione diventa sempre più lenta.

---

**L'indice del database viene creato ad ogni registrazione**

In `backend/app/services/auth_service.py`, ogni volta che un utente si registra viene eseguito:

```python
col.create_index("username", unique=True)
```

Questo dovrebbe essere eseguito una sola volta all'avvio dell'applicazione, non ad ogni registrazione.

---

### Qualità del codice

---

**Pattern ripetuto 5 volte identico**

In `backend/app/services/document_service.py`, la stessa sequenza di codice per convertire un ID stringa in ObjectId appare 5 volte:

```python
try:
    oid = ObjectId(doc_id)
except Exception:
    return None
```

Potrebbe essere estratto in una funzione helper riusabile.

---

**Errori inghiottiti silenziosamente**

In più punti del backend, gli errori vengono catturati con `except Exception` generico e l'esecuzione continua come se niente fosse, restituendo `None`. Questo nasconde problemi reali e rende il debugging molto difficile.

---

**Nessun test**

Non esiste nessun file di test in tutto il progetto. Nessun test unitario (che verifica singole funzioni), nessun test di integrazione (che verifica che i componenti funzionino insieme). Qualsiasi modifica al codice potrebbe rompere funzionalità esistenti senza che nessuno se ne accorga.

---

**Commenti assenti in quasi tutti i file**

I file `security.py`, `auth.py`, `deps.py`, `auth_service.py`, `search_service.py`, `mongo.py`, `solr.py`, `extractors.py` e `main.py` non hanno nessun commento. Manca la spiegazione del *perché* vengono fatte alcune scelte non ovvie, come ad esempio:
- Perché `text[:3000]` in `ai_service.py`? (limite per non sovraccaricare l'AI)
- Perché `errors="replace"` nel decoder TXT?
- Perché si usa `escape` solo sull'autore e non sugli altri campi nella ricerca Solr?

---

### Monitoraggio

---

**L'health check non verifica davvero che l'app funzioni**

L'endpoint `/health` risponde sempre con `{"status": "ok"}` senza controllare se MongoDB e Solr sono raggiungibili e funzionanti. Se il database è down, l'health check risponde comunque con successo.

---

**Log non strutturati**

I log vengono scritti con messaggi in formato testo libero. In produzione, i log strutturati (formato JSON con campi fissi come `timestamp`, `user_id`, `action`) sono molto più utili per ricercare problemi.

---

## 2. Frontend

### Sicurezza

---

**Il token di autenticazione è salvato in localStorage**

In `frontend/src/hooks/useAuth.ts`, il token JWT viene salvato in `localStorage`:

```typescript
localStorage.setItem("token", token);
```

Il `localStorage` è accessibile da qualsiasi script JavaScript che gira sulla pagina. Se il sito avesse una vulnerabilità XSS (un attaccante riesce a iniettare codice JS), il token verrebbe rubato. La soluzione sicura è usare cookie `httpOnly`, che non sono accessibili dal JavaScript.

La soluzione piu sicura di solito è salvare il Token in un cookie Secure e httponly.

---

### Performance

---

**`TYPE_STYLE` e `INPUT_CLS` duplicati in più file**

L'oggetto dei colori per tipo documento (`TYPE_STYLE`) è copiato identico in `DocumentCard.tsx` e `DocumentPage.tsx`. La stringa delle classi CSS degli input (`INPUT_CLS`) è copiata identica in `UploadPage.tsx`, `SearchPage.tsx` e `DocumentPage.tsx`. Se si vuole cambiare lo stile, va aggiornato in più punti.

---

**Nessun limite al numero di file analizzati in parallelo**

In `frontend/src/pages/UploadPage.tsx`, se un utente trascina 20 file contemporaneamente, vengono avviate 20 chiamate API in parallelo verso il backend per l'analisi AI. Questo può sovraccaricare il server o causare timeout. Manca un meccanismo di coda o un limite massimo di richieste parallele.
Attualemente c'è un coda ma puo creare problemi con molte richieste simultanee.

---

### Qualità del codice

---

**Gestione degli errori Axios ripetuta manualmente**

In `LoginPage.tsx` e `UploadPage.tsx` lo stesso cast di tipo per estrarre il messaggio di errore viene scritto a mano due volte:

```typescript
(err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
```

Dovrebbe essere una funzione condivisa tipo `getErrorMessage(err)`.

---

**Navigazione verso una rotta che non esiste dopo la cancellazione**

In `frontend/src/pages/DocumentPage.tsx`, dopo aver eliminato un documento, l'utente viene reindirizzato a `/documents`, ma questa rotta non esiste nel router. React Router reindirizza automaticamente alla dashboard, ma in modo indiretto e non intenzionale.

---

**Nessun commento nel codice frontend**

Come nel backend, nessun file frontend contiene commenti che spieghino il *perché* di alcune scelte. Ad esempio:
- Perché si usa `IntersectionObserver` nel `DocumentPage`? (per caricare testo lungo a pezzi man mano che si scrolla)
- Perché si separano `submitted` e `draft` nella `SearchPage`? (per non inviare una ricerca ad ogni carattere digitato)

---

## 3. MongoDB

### Sicurezza

---

**L'applicazione si connette con l'utente root del database**

In `backend/app/core/config.py`, la stringa di connessione di default usa le credenziali dell'utente amministratore di MongoDB:

```python
mongo_url: str = "mongodb://admin:secret@localhost:27017"
```

Se l'applicazione venisse compromessa, un attaccante avrebbe accesso completo a tutto MongoDB, non solo al database del progetto. La best practice è creare un utente dedicato con accesso limitato al solo database `docmanager`.

---

### Performance

---

**Nessun indice su campi usati nelle query frequenti**

MongoDB, come tutti i database, usa gli indici per trovare dati velocemente (come l'indice di un libro). Senza indici, deve leggere tutti i documenti ogni volta. Nel progetto mancano indici su:

| Campo | Motivo per cui serve l'indice |
|-------|-------------------------------|
| `documents.upload_date` | usato per ordinare i documenti nella lista |
| `documents.type` | usato spesso come filtro nella ricerca |
| `documents.uploaded_by` | necessario per future query "i miei documenti" |
| `audit_log.user_id + timestamp` | necessario per consultare i log di un utente |

Il resto degli indici secondo me necessari sono gia inseriti.

---

**I log di audit crescono senza limite**

La collection `audit_log` registra ogni azione (visualizzazione, download, ricerca, ecc.) ma non ha nessun meccanismo di pulizia automatica. Nel tempo occuperà sempre più spazio. MongoDB supporta gli indici TTL (Time-To-Live): un indice che cancella automaticamente i documenti dopo un certo numero di giorni.

---

## 4. Solr

### Sicurezza

---

**Solr è accessibile senza nessuna autenticazione**

In `docker-compose.yml`, la porta 8983 di Solr è esposta senza protezione. Chiunque raggiunga quella porta (anche dall'esterno, se il firewall non è configurato correttamente) può leggere tutti i documenti indicizzati, modificarli o cancellarli direttamente, senza bisogno di credenziali.

Solr ha un sistema di autenticazione integrato (BasicAuthPlugin) che non è stato configurato.

---

**Lo schema può essere modificato in produzione via API**

In `solr/conf/solrconfig.xml`, lo schema è configurato come modificabile a runtime:

```xml
<bool name="mutable">true</bool>
```

Questo è comodo in sviluppo, ma in produzione significa che chiunque abbia accesso all'API di Solr può cambiare la struttura dei dati. Va impostato a `false`.

---

**Il ping handler di Solr mostra tutti i parametri nella risposta**

In `solrconfig.xml`, il handler per il ping è configurato con `echoParams=all`, il che fa sì che Solr risponda includendo tutti i parametri della richiesta. Questo può esporre informazioni interne.

---

### Performance

---

**Ogni inserimento di documento forza un commit immediato**

In `backend/app/db/solr.py`, il client Solr viene creato con `always_commit=True`:

```python
return pysolr.Solr(settings.solr_url, always_commit=True, timeout=10)
```

Un "commit" in Solr rende i dati visibili nelle ricerche, ma è un'operazione costosa. Con `always_commit=True`, ogni inserimento esegue un commit immediato, anche se Solr è già configurato in `solrconfig.xml` per fare commit automatici ogni 15 secondi. Questo elimina completamente il beneficio dell'autoCommit e degrada le performance di scrittura in modo significativo.

---

**Le cache di Solr non vengono pre-riscaldate dopo un riavvio**

In `solrconfig.xml`, le cache (filterCache, queryResultCache, documentCache) hanno `autowarmCount="0"`. Questo significa che dopo ogni riavvio di Solr le cache sono vuote e le prime richieste sono più lente del normale. Impostare un valore maggiore di 0 fa sì che Solr pre-carichi parte dei dati precedenti nelle cache all'avvio.

---

## 5. Generale

### Sicurezza

---

**CORS troppo permissivo**

In `backend/main.py`, la configurazione CORS (Cross-Origin Resource Sharing — il meccanismo che controlla quali siti web possono chiamare le API) è troppo aperta:

```python
allow_methods=["*"],   # accetta qualsiasi metodo HTTP
allow_headers=["*"],   # accetta qualsiasi header
```

In produzione, si dovrebbe limitare ai soli metodi e header effettivamente usati dall'applicazione.

---

**Dipendenze non verificate**

Non è visibile nessun file `requirements.txt` o `pyproject.toml` nella root del progetto. Senza un file che elenchi le dipendenze con le versioni esatte (lock file), non c'è modo di sapere se vengono usate librerie con vulnerabilità note. Strumenti come Dependabot o Snyk possono controllare automaticamente.

---

### Performance

---

**Ricerche, liste e accessi avvengono tutti nello stesso thread**

Il backend gestisce ogni richiesta in modo sequenziale per le operazioni su database. Sotto carico (es. 50 utenti che caricano file contemporaneamente), le operazioni si accodano invece di essere gestite in parallelo.

---

### Qualità del codice

---

**Nessun test in tutto il progetto**

Non esiste nessuna cartella `tests/`. Non ci sono test per nessuna delle funzioni del backend, nessun test per i componenti frontend. Questo è il problema più importante dal punto di vista della qualità: senza test non c'è modo di sapere se una modifica rompe qualcosa che già funzionava.

---

**Nessun linter o formatter configurato**

Non c'è nessuna configurazione per strumenti come `black` (formattazione automatica Python), `flake8` o `ruff` (controllo stile Python), o `eslint` (controllo stile TypeScript/React). Senza questi strumenti, la qualità del codice dipende interamente dalla disciplina manuale degli sviluppatori.

---

**Nessuna pipeline CI/CD**

Non ci sono file di configurazione per GitHub Actions o sistemi simili. Questo significa che nessun controllo automatico (test, linting, build) viene eseguito quando si fa un commit o una pull request.

---

## 6. Possibili miglioramenti implementabili

Questa sezione raccoglie idee per migliorare il sistema sull'usabilità, sulla robustezza e sulla qualità delle risposte AI.

---

### 6.1 — Separare l'analisi AI dal flusso di upload (coda asincrona)

**Il problema attuale:** Quando un utente carica un documento, il server chiama Ollama, aspetta la risposta (fino a 30 secondi), e solo allora risponde al browser. Se Ollama è lento o offline, la richiesta va in timeout e il caricamento fallisce. Tutto gira in modo sequenziale.

**L'idea:** Usare una coda di task asincrona. Il flusso diventerebbe:
1. L'utente carica il file → il backend lo salva su disco e su MongoDB → risponde subito con `{"status": "processing"}`
2. In background, un worker separato prende il task dalla coda, chiama Ollama, aggiorna il documento con il sommario

Strumento consigliato: **ARQ** (non Celery). ARQ è scritto in Python asincrono nativo, funziona bene con FastAPI, e usa Redis come broker (che ci serve comunque per il rate limiting, vedi punto 6.3). 
Il frontend potrebbe fare polling su `/documents/{id}` oppure ascoltare tramite WebSocket (vedi punto 6.5) per sapere quando l'analisi è finita.

Questa implementazione risolve contemporaneamente tre problemi: timeout del browser, blocco del server durante l'AI, e la possibilità di riprovare automaticamente se Ollama è offline.

---

### 6.2 — Solr già supporta la ricerca semantica: aggiungerla senza cambiare servizi

**Il problema attuale:** La ricerca funziona solo per corrispondenza esatta delle parole. Se cerco "accordo commerciale" non trovo un documento che parla di "contratto di fornitura" anche se il significato è lo stesso.

**L'idea:** Solr 9 ha il supporto nativo per i vettori densi (`DenseVectorField`). Significa che si può aggiungere la ricerca semantica senza aggiungere nessun nuovo servizio.

Il flusso sarebbe:
1. Al momento dell'upload, generare un vettore di embedding del testo del documento (usando Ollama con un modello di embedding come `nomic-embed-text`)
2. Salvare il vettore in un campo `DenseVectorField` nello schema Solr
3. Quando l'utente fa una ricerca, generare il vettore anche della query e cercare per similarità

La potenza vera sta nel **hybrid search**: combinare il risultato della ricerca per parole chiave (già funzionante) con il risultato della ricerca semantica. I due si complementano: le parole chiave sono precise sui nomi propri e numeri, il semantico trova concetti anche con parole diverse.

```xml
<!-- Da aggiungere a managed-schema -->
<field name="content_vector" type="knn_vector" indexed="true" stored="false"/>
<fieldType name="knn_vector" class="solr.DenseVectorField" vectorDimension="768" similarityFunction="cosine"/>
```

La maggior parte dei tutorial online consiglia di aggiungere un database vettoriale separato (Qdrant, Chroma, Pinecone). Ma Solr 9 lo fa già internamente

---

### 6.3 — Rate limiting con sliding window su Redis (già presente con ARQ)

**Il problema attuale:** L'endpoint di login non ha nessun limite di tentativi. Qualcuno può provare milioni di password al secondo.

**L'idea:** Se si aggiunge Redis per ARQ (punto 6.1), Redis è già disponibile. Si può usare lo stesso Redis per il rate limiting senza aggiungere nessun altro servizio.

L'algoritmo migliore per questo caso è la **sliding window**: invece di bloccare esattamente dopo X tentativi nell'ora, tiene traccia di quanti tentativi ci sono stati negli ultimi 60 secondi con una finestra che scorre nel tempo. È più preciso del contatore fisso (che può essere aggirato aspettando il reset).

```python
# Middleware FastAPI con Redis sliding window
async def rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    now = time.time()
    async with redis.pipeline() as pipe:
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
    return results[2] <= limit
```

Si può applicare in modo diverso a endpoint diversi:
- `/auth/login` → 5 tentativi per IP ogni 60 secondi
- `/documents/upload` → 10 upload per utente ogni 5 minuti
- `/documents/analyze` → 3 analisi AI parallele per utente

---

### 6.4 — OCR per i PDF scansionati (problema silenzioso e frequente)

**Il problema attuale:** In `extractors.py`, la funzione `_from_pdf` usa PyMuPDF per estrarre il testo. Questo funziona perfettamente per i PDF generati da Word o da software. Ma i PDF scansionati (una foto di un foglio di carta convertita in PDF) non contengono testo: contengono solo un'immagine. Il risultato è che il sommario AI è vuoto, la ricerca full-text non trova nulla, e l'utente non capisce perché.

Dalle discussioni su Reddit e nei blog tecnici del 2025, questo è uno dei problemi più comuni e meno attesi nei sistemi di gestione documentale con documenti reali d'ufficio (fatture scansite, contratti firmati a mano, ecc.).

**L'idea:** Rilevare automaticamente se un PDF è scansionato (il testo estratto è vuoto o quasi), e in quel caso passarlo a un motore OCR come **Tesseract** (open source, gratuito).

```python
def _from_pdf(content: bytes) -> str:
    doc = fitz.open(stream=content, filetype="pdf")
    pages = [page.get_text("text") for page in doc]
    text = "\n".join(pages).strip()

    # Se il testo è troppo corto, il PDF è probabilmente scansionato
    if len(text) < 50:
        text = _ocr_pdf(content)  # fallback OCR

    return text

def _ocr_pdf(content: bytes) -> str:
    import pytesseract
    from pdf2image import convert_from_bytes
    images = convert_from_bytes(content)
    return "\n".join(pytesseract.image_to_string(img, lang="ita") for img in images)
```

Attualmente essitono molte soluzioni come OCR e da poco è uscito glm-ocr che pesa poco e ha ottime performance.

---

### 6.5 — Chunking semantico per migliorare la qualità del sommario AI

**Il problema attuale:** In `ai_service.py`, il testo passato a Ollama è semplicemente `text[:3000]` — i primi 3000 caratteri del documento. Per un contratto di 30 pagine, questo significa che Ollama vede solo la prima pagina e mezza, spesso composta da intestazioni, date e dati anagrafici. Il sommario generato è quasi sempre di scarsa qualità.

**L'idea:** Invece di prendere i primi N caratteri, dividere il documento in chunk semantici (rispettando i confini di paragrafo e frase), prendere un campione distribuito su tutto il documento, e usare quello come input per il sommario.

```python
def _smart_excerpt(text: str, max_chars: int = 3000) -> str:
    # Divide per paragrafi, non per caratteri
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 50]
    if not paragraphs:
        return text[:max_chars]

    # Prende paragrafi distribuiti: inizio, metà, fine
    indices = [0, len(paragraphs) // 4, len(paragraphs) // 2, -1]
    selected = [paragraphs[i] for i in indices if i < len(paragraphs)]
    excerpt = "\n\n".join(selected)
    return excerpt[:max_chars]
```

---

### 6.6 — Snippet e highlighting nei risultati di ricerca

**Il problema attuale:** I risultati di ricerca mostrano titolo, autore e tag. Non si vede dove nel documento è stata trovata la corrispondenza con la parola cercata. L'utente deve aprire il documento per capire se è quello giusto.

**L'idea:** Solr ha una funzionalità chiamata **highlighting** già integrata: restituisce brevi estratti del testo del documento con il termine cercato evidenziato, simile ai risultati di Google.

Si aggiunge con pochissimo codice nel backend:

```python
# In search_service.py
params = {
    "hl": "true",                    # attiva highlighting
    "hl.fl": "text_content,summary", # campi su cui evidenziare
    "hl.snippets": 2,                # max 2 estratti per documento
    "hl.fragsize": 150,              # lunghezza di ogni estratto in caratteri
    "hl.simple.pre": "<mark>",       # tag HTML di apertura
    "hl.simple.post": "</mark>",     # tag HTML di chiusura
    # ... resto dei params esistenti
}
```

La risposta di Solr include un oggetto `highlighting` con gli estratti per ogni documento. Il frontend può mostrarli sotto il titolo nella card di ricerca.

---

### 6.7 — Rilevamento duplicati prima dell'upload

**Il problema attuale:** Non esiste nessun controllo se un documento è già stato caricato. Un utente può caricare lo stesso file 10 volte, creando 10 copie identiche nel sistema.

**L'idea:** Calcolare un hash SHA-256 del contenuto del file al momento dell'upload e salvarlo in MongoDB. Prima di procedere con l'inserimento, controllare se esiste già un documento con lo stesso hash.

```python
import hashlib

def upload_document(filename, content, meta, user_id, ...):
    content_hash = hashlib.sha256(content).hexdigest()

    # Controlla duplicato
    existing = documents_col().find_one({"content_hash": content_hash})
    if existing:
        raise ValueError(f"Documento già presente: {existing['title']}")

    # Prosegue con l'upload normale...
    doc = {"content_hash": content_hash, ...}
```

Si aggiunge anche un indice unico su `content_hash` in MongoDB per rendere il controllo veloce.

Una variante più permissiva: invece di bloccare l'upload, avvisare l'utente che esiste già un documento con lo stesso contenuto e lasciare scegliere se procedere comunque (utile per versioni aggiornate dello stesso documento).

---

### 6.8 — API per consultare il log di audit (già registrato, mai esposto)

**Il problema attuale:** Il sistema registra già ogni azione (upload, download, visualizzazione, modifica, cancellazione) nella collection `audit_log` di MongoDB. Ma non esiste nessun endpoint per consultarla. Il log è scritto e mai letto — serve a nulla nella pratica.

**L'idea:** Aggiungere un endpoint admin-only per consultare il log di audit con filtri:

```python
# GET /admin/audit?user_id=...&action=delete&from=2025-01-01
@router.get("/admin/audit", dependencies=[Depends(require_admin)])
def get_audit_log(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[datetime] = None,
    page: int = 1,
):
    ...
```

Dato che `require_admin` è già implementata in `deps.py` ma non usata da nessuna parte, questo sarebbe anche il primo caso d'uso reale di quella funzione.