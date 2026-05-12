import json
import logging
import re

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_VALID_TYPES = {"contratto", "fattura", "ordine", "cv", "comunicazione", "altro"}

_SUMMARY_PROMPT = (
    "Sei un assistente aziendale. "
    "Genera un sommario di massimo 3 frasi in italiano del seguente documento.\n"
    "Rispondi SOLO con il sommario, senza prefissi o spiegazioni.\n\n"
    "Documento:\n{text}"
)

_METADATA_PROMPT = (
    "Sei un assistente aziendale. Analizza il documento e rispondi SOLO con un oggetto JSON valido.\n"
    "Campi richiesti:\n"
    '  "title": titolo del documento (stringa, max 100 caratteri)\n'
    '  "type": uno SOLO tra: contratto, fattura, ordine, cv, comunicazione, altro\n'
    '  "author": autore o ente redattore (stringa, scrivi "Sconosciuto" se non trovato)\n'
    '  "tags": lista di 2-5 parole chiave pertinenti (array di stringhe)\n\n'
    "Documento:\n{text}\n\n"
    "Rispondi SOLO con il JSON. Nessun testo prima o dopo."
)


def _call_ollama(prompt: str) -> str | None:
    settings = get_settings()
    payload = {"model": settings.ollama_model, "prompt": prompt, "stream": False}
    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json=payload,
            timeout=settings.ollama_timeout,
        )
        response.raise_for_status()
        return response.json().get("response", "").strip() or None
    except httpx.TimeoutException:
        logger.warning("Ollama timeout")
        return None
    except Exception as exc:
        logger.warning("Ollama error: %s", exc)
        return None


def generate_summary(text: str) -> str | None:
    excerpt = text[:3000].strip()
    if not excerpt:
        return None
    return _call_ollama(_SUMMARY_PROMPT.format(text=excerpt))


def extract_metadata(text: str) -> dict:
    excerpt = text[:2000].strip()
    if not excerpt:
        return {"title": "", "type": "altro", "author": "", "tags": []}

    raw = _call_ollama(_METADATA_PROMPT.format(text=excerpt))
    if not raw:
        return {"title": "", "type": "altro", "author": "", "tags": []}

    try:
        # Model may wrap JSON in markdown code fences
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError("No JSON object in response")
        data = json.loads(match.group())
        doc_type = data.get("type", "altro")
        return {
            "title": str(data.get("title", ""))[:200].strip(),
            "type": doc_type if doc_type in _VALID_TYPES else "altro",
            "author": str(data.get("author", "Sconosciuto"))[:100].strip(),
            "tags": [str(t).strip() for t in data.get("tags", []) if isinstance(t, str)][:10],
        }
    except Exception as exc:
        logger.warning("Metadata parse error: %s | raw: %.200s", exc, raw)
        return {"title": "", "type": "altro", "author": "", "tags": []}
