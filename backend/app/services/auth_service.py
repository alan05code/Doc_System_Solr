from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.security import hash_password, verify_password, create_access_token
from app.db.mongo import users_col, audit_col
from app.models.user import UserRegister, UserOut, Token


def _serialize_user(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        username=doc["username"],
        role=doc["role"],
        created_at=doc["created_at"],
    )


def register_user(data: UserRegister) -> UserOut:
    col = users_col()
    now = datetime.now(timezone.utc)
    doc = {
        "username": data.username,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "created_at": now,
    }
    try:
        result = col.insert_one(doc)
    except DuplicateKeyError:
        raise ValueError("Username già in uso")

    doc["_id"] = result.inserted_id
    return _serialize_user(doc)


def login_user(username: str, password: str) -> Token:
    user_doc = users_col().find_one({"username": username})
    if not user_doc or not verify_password(password, user_doc["password_hash"]):
        raise ValueError("Credenziali non valide")

    user = _serialize_user(user_doc)
    token = create_access_token({"sub": user.id, "role": user.role})
    return Token(access_token=token, user=user)


def get_user_by_id(user_id: str) -> Optional[UserOut]:
    try:
        doc = users_col().find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None
    return _serialize_user(doc) if doc else None


def log_action(user_id: str, action: str, document_id: Optional[str] = None, details: dict = None) -> None:
    audit_col().insert_one({
        "user_id": ObjectId(user_id),
        "action": action,
        "document_id": ObjectId(document_id) if document_id else None,
        "timestamp": datetime.now(timezone.utc),
        "details": details or {},
    })
