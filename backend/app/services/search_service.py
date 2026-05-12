import logging
from typing import Optional
from datetime import datetime

from app.db.solr import search
from app.models.document import SearchResult, DocumentOut, SearchFilters

logger = logging.getLogger(__name__)


def _build_fq(filters: SearchFilters) -> list[str]:
    fq = []
    if filters.type:
        fq.append(f"type:{filters.type}")
    if filters.author:
        safe = filters.author.replace('"', '\\"')
        fq.append(f'author:"{safe}"')
    if filters.date_from or filters.date_to:
        dfrom = filters.date_from.strftime("%Y-%m-%dT%H:%M:%SZ") if filters.date_from else "*"
        dto = filters.date_to.strftime("%Y-%m-%dT%H:%M:%SZ") if filters.date_to else "*"
        fq.append(f"upload_date:[{dfrom} TO {dto}]")
    return fq


def full_text_search(filters: SearchFilters) -> SearchResult:
    query = filters.q.strip() or "*:*"
    fq = _build_fq(filters)
    start = (filters.page - 1) * filters.page_size

    params = {
        "rows": filters.page_size,
        "start": start,
        "fl": "id,title,type,author,upload_date,tags,summary,original_filename,uploaded_by",
        "defType": "edismax",
        "qf": "title^3 text_content summary tags",
    }
    if fq:
        params["fq"] = fq

    try:
        results = search(query, **params)
        total = results.hits
        items = [_solr_to_doc(r) for r in results]
    except Exception as exc:
        logger.error("Solr search error: %s", exc)
        return SearchResult(total=0, page=filters.page, page_size=filters.page_size, items=[])

    return SearchResult(total=total, page=filters.page, page_size=filters.page_size, items=items)


def _solr_to_doc(r: dict) -> DocumentOut:
    upload_date = r.get("upload_date")
    if isinstance(upload_date, str):
        upload_date = datetime.fromisoformat(upload_date.replace("Z", "+00:00"))

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
