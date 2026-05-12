from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.models.document import (
    DocumentAnalysis, DocumentDetail, DocumentMeta,
    DocumentOut, DocumentUpdate, SearchFilters, SearchResult,
)
from app.models.user import UserOut
from app.services.auth_service import log_action
from app.services.document_service import (
    analyze_document,
    delete_document,
    get_document,
    get_file_path,
    list_documents,
    update_document,
    upload_document,
)
from app.services.search_service import full_text_search

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/analyze", response_model=DocumentAnalysis)
async def analyze(
    file: UploadFile = File(...),
    current_user: UserOut = Depends(get_current_user),
):
    content = await file.read()
    try:
        return analyze_document(file.filename or "document", content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    type: str = Form(...),
    author: str = Form(...),
    tags: str = Form(default=""),
    current_user: UserOut = Depends(get_current_user),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    meta = DocumentMeta(title=title, type=type, author=author, tags=tag_list)
    content = await file.read()
    try:
        doc = upload_document(file.filename or "document", content, meta, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    log_action(current_user.id, "upload", doc.id, {"filename": file.filename})
    return doc


@router.get("/search", response_model=SearchResult)
def search(
    q: str = "*",
    type: Optional[str] = None,
    author: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 10,
    current_user: UserOut = Depends(get_current_user),
):
    filters = SearchFilters(
        q=q, type=type, author=author,
        date_from=date_from, date_to=date_to,
        page=page, page_size=page_size,
    )
    log_action(current_user.id, "search", details={"q": q, "type": type, "author": author})
    return full_text_search(filters)


@router.get("/", response_model=SearchResult)
def list_all(
    page: int = 1,
    page_size: int = 10,
    current_user: UserOut = Depends(get_current_user),
):
    items, total = list_documents(page, page_size)
    return SearchResult(total=total, page=page, page_size=page_size, items=items)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doc(doc_id: str, current_user: UserOut = Depends(get_current_user)):
    if not delete_document(doc_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento non trovato")
    log_action(current_user.id, "delete", doc_id)


@router.patch("/{doc_id}", response_model=DocumentOut)
def update_doc(
    doc_id: str,
    data: DocumentUpdate,
    current_user: UserOut = Depends(get_current_user),
):
    fields = data.model_dump(exclude_none=True)
    doc = update_document(doc_id, fields)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento non trovato")
    log_action(current_user.id, "edit", doc_id, fields)
    return doc


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_doc(doc_id: str, current_user: UserOut = Depends(get_current_user)):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento non trovato")
    log_action(current_user.id, "view", doc_id)
    return doc


@router.get("/{doc_id}/download")
def download(doc_id: str, current_user: UserOut = Depends(get_current_user)):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento non trovato")
    path = get_file_path(doc_id)
    if not path or not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File non trovato su disco")
    log_action(current_user.id, "download", doc_id)
    return FileResponse(path=str(path), filename=doc.original_filename, media_type="application/octet-stream")
