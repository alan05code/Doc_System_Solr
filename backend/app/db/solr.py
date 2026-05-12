from functools import lru_cache
import pysolr

from app.core.config import get_settings


@lru_cache
def get_solr() -> pysolr.Solr:
    settings = get_settings()
    return pysolr.Solr(settings.solr_url, always_commit=True, timeout=10)


def index_document(doc: dict) -> None:
    get_solr().add([doc])


def delete_document(doc_id: str) -> None:
    get_solr().delete(id=doc_id)


def search(query: str, **kwargs) -> pysolr.Results:
    return get_solr().search(query, **kwargs)
