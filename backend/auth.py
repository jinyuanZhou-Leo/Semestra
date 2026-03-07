# input:  [FastAPI request/response auth deps, JWT libs, SQLAlchemy session, env-backed runtime config, crud module]
# output: [JWT helpers, secure auth-cookie helpers, and authenticated user dependency]
# pos:    [Authentication/auth-session utility layer for token issuance, cookie transport, and current-user resolution]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from datetime import datetime, timedelta
from typing import Optional
import os
import secrets

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import SessionLocal

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    if ENVIRONMENT == "production":
        raise RuntimeError("JWT_SECRET_KEY must be set when ENVIRONMENT=production.")
    # Development-only fallback so local boot works even before `.env` is filled in.
    SECRET_KEY = secrets.token_urlsafe(32)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "semestra_session")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None


def _get_bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


AUTH_COOKIE_SECURE = _get_bool_env("AUTH_COOKIE_SECURE", ENVIRONMENT != "development")
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower()
if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("AUTH_COOKIE_SAMESITE must be one of: lax, strict, none.")
if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
    raise RuntimeError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE=none.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def set_auth_cookie(response: Response, token: str, expires_delta: timedelta) -> None:
    max_age = max(1, int(expires_delta.total_seconds()))
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        max_age=max_age,
        domain=AUTH_COOKIE_DOMAIN,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        domain=AUTH_COOKIE_DOMAIN,
        path="/",
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
    )


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    resolved_token = token or request.cookies.get(AUTH_COOKIE_NAME)
    if not resolved_token:
        raise credentials_exception
    try:
        payload = jwt.decode(resolved_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=token_data.username)
    if user is None:
        raise credentials_exception
    return user
