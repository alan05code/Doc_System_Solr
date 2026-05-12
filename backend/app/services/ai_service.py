import logging
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_SUMMARY_PROMPT = (
    "Sei un assistente aziendale. "
    "Genera un sommario di massimo 3 frasi in italiano del seguente documento.\n"
    "Rispondi SOLO con il sommario, senza prefissi o spiegazioni.\n\n"
    "Documento:\n{text}"
)


def generate_summary(text: str) -> str | None:
    settings = get_settings()
    excerpt = text[:3000].strip()
    if not excerpt:
        return None

    payload = {
        "model": settings.ollama_model,
        "prompt": _SUMMARY_PROMPT.format(text=excerpt),
        "stream": False,
    }

    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json=payload,
            timeout=settings.ollama_timeout,
        )
        response.raise_for_status()
        return response.json().get("response", "").strip() or None
    except httpx.TimeoutException:
        logger.warning("Ollama timeout: sommario non generato")
        return None
    except Exception as exc:
        logger.warning("Ollama error: %s", exc)
        return None
