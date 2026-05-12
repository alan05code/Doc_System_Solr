from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

DOCUMENT_TYPES = ["contratto", "fattura", "ordine", "cv", "comunicazione", "altro"]


class DocumentMeta(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern="^(contratto|fattura|ordine|cv|comunicazione|altro)$")
    author: str = Field(..., min_length=1, max_length=100)
    tags: List[str] = Field(default_factory=list)


class DocumentOut(BaseModel):
    id: str
    title: str
    type: str
    author: str
    upload_date: datetime
    tags: List[str]
    summary: Optional[str]
    original_filename: str
    uploaded_by: str


class DocumentDetail(DocumentOut):
    text_content: str


class SearchResult(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[DocumentOut]


class SearchFilters(BaseModel):
    q: str = Field(default="*", description="Full-text query")
    type: Optional[str] = None
    author: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)
