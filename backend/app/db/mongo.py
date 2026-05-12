from functools import lru_cache
from pymongo import MongoClient
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
