import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.config import get_settings
from app.db.mongo import documents_col
from app.db.solr import index_document, delete_document as solr_delete
from app.models.document import DocumentMeta, DocumentOut, DocumentDetail, DocumentAnalysis
from app.services.extractors import extract_text
from app.services.ai_service import generate_summary, extract_metadata

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}


def _parse_oid(doc_id: str) -> Optional[ObjectId]:
    try:
        return ObjectId(doc_id)
    except Exception:
        return None


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


def _validate_file(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Formato non supportato: {ext}. Usa PDF, DOCX o TXT.")
    max_bytes = get_settings().max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise ValueError(f"File troppo grande (max {get_settings().max_file_size_mb} MB)")
    return ext


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


def analyze_document(filename: str, content: bytes) -> DocumentAnalysis:
    """Extract text + AI metadata + summary without saving to DB."""
    _validate_file(filename, content)
    text = extract_text(filename, content)
    meta = extract_metadata(text)
    summary = generate_summary(text)
    return DocumentAnalysis(**meta, summary=summary)


def upload_document(
    filename: str, content: bytes, meta: DocumentMeta, user_id: str,
    pregenerated_summary: Optional[str] = None,
) -> DocumentOut:
    _validate_file(filename, content)
    text_content = extract_text(filename, content)

    upload_dir = Path(get_settings().upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = upload_dir / stored_name
    file_path.write_bytes(content)

    summary = pregenerated_summary if pregenerated_summary is not None else generate_summary(text_content)

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


def update_document(doc_id: str, fields: dict) -> Optional[DocumentOut]:
    """Update mutable metadata fields and re-index in Solr."""
    oid = _parse_oid(doc_id)
    if oid is None:
        return None
    if not fields:
        return get_document(doc_id)

    doc = documents_col().find_one_and_update(
        {"_id": oid},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        return None
    _index_in_solr(doc)
    return _serialize(doc)


def regenerate_summary(doc_id: str) -> Optional[DocumentOut]:
    oid = _parse_oid(doc_id)
    if oid is None:
        return None
    doc = documents_col().find_one({"_id": oid}, {"text_content": 1})
    if not doc:
        return None
    summary = generate_summary(doc.get("text_content", ""))
    updated = documents_col().find_one_and_update(
        {"_id": oid},
        {"$set": {"summary": summary}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return None
    _index_in_solr(updated)
    return _serialize(updated)


def delete_document(doc_id: str) -> bool:
    oid = _parse_oid(doc_id)
    if oid is None:
        return False
    doc = documents_col().find_one({"_id": oid}, {"file_path": 1})
    if not doc:
        return False
    file_path = Path(doc.get("file_path", ""))
    if file_path.exists():
        file_path.unlink(missing_ok=True)
    documents_col().delete_one({"_id": oid})
    try:
        solr_delete(doc_id)
    except Exception as exc:
        logger.error("Solr delete failed for %s: %s", doc_id, exc)
    return True


def get_document(doc_id: str) -> Optional[DocumentDetail]:
    oid = _parse_oid(doc_id)
    if oid is None:
        return None
    try:
        doc = documents_col().find_one({"_id": oid})
    except Exception:
        return None
    if not doc:
        return None
    out = _serialize(doc)
    return DocumentDetail(**out.model_dump(), text_content=doc.get("text_content", ""))


def get_file_path(doc_id: str) -> Optional[Path]:
    oid = _parse_oid(doc_id)
    if oid is None:
        return None
    try:
        doc = documents_col().find_one({"_id": oid}, {"file_path": 1})
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
