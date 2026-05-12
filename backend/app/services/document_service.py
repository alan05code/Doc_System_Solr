import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId

from app.core.config import get_settings
from app.db.mongo import documents_col
from app.db.solr import index_document, delete_document
from app.models.document import DocumentMeta, DocumentOut, DocumentDetail
from app.services.extractors import extract_text
from app.services.ai_service import generate_summary

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}


def _serialize(doc: dict) -> DocumentOut:
    return DocumentOut(
        id=str(doc["_id"]),
        title=doc["title"],
        type=doc["type"],
        author=doc["author"],
        upload_date=doc["upload_date"],
        tags=doc.get("tags", []),
        summary=doc.get("summary"),
        original_filename=doc["original_filename"],
        uploaded_by=str(doc["uploaded_by"]),
    )


def upload_document(filename: str, content: bytes, meta: DocumentMeta, user_id: str) -> DocumentOut:
    settings = get_settings()
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Formato non supportato: {ext}. Usa PDF, DOCX o TXT.")

    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(f"File troppo grande (max {settings.max_file_size_mb} MB)")

    text_content = extract_text(filename, content)

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = upload_dir / stored_name
    file_path.write_bytes(content)

    summary = generate_summary(text_content)

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
    result = documents_col().insert_one(doc)
    doc["_id"] = result.inserted_id

    _index_in_solr(doc)
    return _serialize(doc)


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


def get_document(doc_id: str) -> Optional[DocumentDetail]:
    try:
        doc = documents_col().find_one({"_id": ObjectId(doc_id)})
    except Exception:
        return None
    if not doc:
        return None
    out = _serialize(doc)
    return DocumentDetail(**out.model_dump(), text_content=doc.get("text_content", ""))


def get_file_path(doc_id: str) -> Optional[Path]:
    try:
        doc = documents_col().find_one({"_id": ObjectId(doc_id)}, {"file_path": 1})
    except Exception:
        return None
    if not doc:
        return None
    return Path(doc["file_path"])


def list_documents(page: int = 1, page_size: int = 10) -> tuple[list[DocumentOut], int]:
    col = documents_col()
    skip = (page - 1) * page_size
    total = col.count_documents({})
    docs = col.find({}, {"text_content": 0}).sort("upload_date", -1).skip(skip).limit(page_size)
    return [_serialize(d) for d in docs], total
