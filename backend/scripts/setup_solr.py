"""Verifica che il core Solr 'documents' sia attivo e raggiungibile."""
import sys
import httpx

from app.core.config import get_settings


def main():
    settings = get_settings()
    url = f"{settings.solr_url}/admin/ping"
    print(f"Ping Solr: {url}")
    try:
        r = httpx.get(url, timeout=10)
        r.raise_for_status()
        print("Solr OK:", r.json().get("status"))
    except Exception as exc:
        print(f"ERRORE Solr: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
