from functools import lru_cache
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.collection import Collection

from app.core.config import get_settings


@lru_cache
def get_client() -> MongoClient:
    return MongoClient(get_settings().mongo_url)


def get_db() -> Database:
    return get_client()[get_settings().mongo_db]


def documents_col() -> Collection:
    return get_db()["documents"]


def users_col() -> Collection:
    return get_db()["users"]


def audit_col() -> Collection:
    return get_db()["audit_log"]


def ensure_indexes() -> None:
    users_col().create_index("username", unique=True)
    documents_col().create_index([("upload_date", DESCENDING)])
    documents_col().create_index("type")
    documents_col().create_index("uploaded_by")
    audit_col().create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
    # TTL: cancella log di audit dopo 1 anno
    audit_col().create_index("timestamp", expireAfterSeconds=365 * 24 * 3600)
