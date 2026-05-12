import io
import logging

logger = logging.getLogger(__name__)


def extract_text(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return _from_pdf(content)
    if ext in ("docx", "doc"):
        return _from_docx(content)
    if ext == "txt":
        return _from_txt(content)
    raise ValueError(f"Formato non supportato: {ext}")


def _from_pdf(content: bytes) -> str:
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=content, filetype="pdf")
        pages = [page.get_text("text") for page in doc]
        doc.close()
        return "\n".join(pages).strip()
    except Exception as exc:
        logger.error("PDF extraction error: %s", exc)
        raise


def _from_docx(content: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text).strip()
    except Exception as exc:
        logger.error("DOCX extraction error: %s", exc)
        raise


def _from_txt(content: bytes) -> str:
    try:
        return content.decode("utf-8", errors="replace").strip()
    except Exception as exc:
        logger.error("TXT decode error: %s", exc)
        raise
