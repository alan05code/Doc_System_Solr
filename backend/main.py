from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, documents
from app.core.config import get_settings
from app.db.mongo import ensure_indexes

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(documents.router)


@app.on_event("startup")
def startup() -> None:
    ensure_indexes()


@app.get("/health")
def health() -> JSONResponse:
    from app.db.mongo import get_client
    from app.db.solr import get_solr

    try:
        get_client().admin.command("ping")
        mongo_ok = True
    except Exception:
        mongo_ok = False

    try:
        get_solr().ping()
        solr_ok = True
    except Exception:
        solr_ok = False

    status_code = 200 if (mongo_ok and solr_ok) else 503
    return JSONResponse(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "app": settings.app_name,
            "mongo": mongo_ok,
            "solr": solr_ok,
        },
        status_code=status_code,
    )
