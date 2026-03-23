# input:  [FastAPI request/response auth deps, JWT libs, SQLAlchemy session, env-backed runtime config, and crud module]
# output: [JWT helpers, secure auth-cookie plus CSRF-cookie helpers, host/origin helpers, DB-backed login-throttling helpers, and authenticated user dependency]
# pos:    [Authentication/auth-session utility layer for token issuance, logout revocation, cookie transport, CSRF enforcement for cookie-backed writes, login throttling, and current-user resolution]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from datetime import UTC, datetime, timedelta
import hashlib
import hmac
from typing import Optional
import os
import secrets
from urllib.parse import urlparse

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
AUTH_CSRF_COOKIE_NAME = os.getenv("AUTH_CSRF_COOKIE_NAME", "semestra_csrf")
AUTH_CSRF_HEADER_NAME = os.getenv("AUTH_CSRF_HEADER_NAME", "X-CSRF-Token")
_UNSAFE_HTTP_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SESSION_VERSION_CLAIM = "session_version"
LOGIN_RATE_LIMIT_IP_SCOPE = "login_ip"
LOGIN_RATE_LIMIT_ACCOUNT_SCOPE = "login_account"
GOOGLE_LOGIN_RATE_LIMIT_IP_SCOPE = "google_login_ip"


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


class AuthRateLimitExceededError(Exception):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Too many authentication attempts. Please retry later.")
        self.retry_after_seconds = retry_after_seconds


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        parsed = int(raw_value.strip())
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc
    if parsed <= 0:
        raise RuntimeError(f"{name} must be greater than 0.")
    return parsed


AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS = _get_int_env("AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS", 10)
AUTH_RATE_LIMIT_IP_WINDOW_SECONDS = _get_int_env("AUTH_RATE_LIMIT_IP_WINDOW_SECONDS", 300)
AUTH_RATE_LIMIT_IP_BLOCK_SECONDS = _get_int_env("AUTH_RATE_LIMIT_IP_BLOCK_SECONDS", 900)
AUTH_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS = _get_int_env("AUTH_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS", 5)
AUTH_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS = _get_int_env("AUTH_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS", 900)
AUTH_RATE_LIMIT_ACCOUNT_BLOCK_SECONDS = _get_int_env("AUTH_RATE_LIMIT_ACCOUNT_BLOCK_SECONDS", 1800)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _now_utc_iso() -> str:
    return _now_utc().isoformat()


def _parse_iso_datetime(value: str | None) -> datetime | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _rate_limit_key_hash(raw_value: str) -> str:
    return hmac.new(SECRET_KEY.encode("utf-8"), raw_value.encode("utf-8"), hashlib.sha256).hexdigest()


def get_allowed_browser_origins() -> list[str]:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()
    origins = [
        frontend_url,
        "https://semestra.jyleo.cc",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    return sorted({origin for origin in origins if origin})


def get_allowed_api_hosts() -> list[str]:
    configured = [item.strip() for item in os.getenv("ALLOWED_HOSTS", "").split(",") if item.strip()]
    if configured:
        return sorted(set(configured))
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise RuntimeError("ALLOWED_HOSTS must be set when ENVIRONMENT=production.")
    return ["localhost", "127.0.0.1", "testserver"]


def _normalize_origin(origin: str | None) -> str:
    raw_value = (origin or "").strip().rstrip("/")
    if not raw_value:
        return ""
    parsed = urlparse(raw_value)
    if not parsed.scheme or not parsed.netloc or not parsed.hostname:
        return ""
    port = parsed.port
    default_port = 443 if parsed.scheme == "https" else 80
    normalized_port = f":{port}" if port and port != default_port else ""
    return f"{parsed.scheme}://{parsed.hostname}{normalized_port}"


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def enforce_cookie_request_security(request: Request) -> None:
    if request.method.upper() not in _UNSAFE_HTTP_METHODS:
        return

    request_origin = _normalize_origin(request.headers.get("origin"))
    if request_origin:
        allowed_origins = {_normalize_origin(origin) for origin in get_allowed_browser_origins()}
        if request_origin not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid request origin for cookie-authenticated write request.",
            )

    csrf_cookie = request.cookies.get(AUTH_CSRF_COOKIE_NAME) or ""
    csrf_header = request.headers.get(AUTH_CSRF_HEADER_NAME) or ""
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing or invalid CSRF token.",
        )


def _get_client_ip(request: Request) -> str:
    client_host = request.client.host if request.client is not None and request.client.host else ""
    return client_host or "unknown"


def _get_session_version(user: models.User) -> int:
    return int(getattr(user, "session_version", 0) or 0)


def create_user_access_token(user: models.User, expires_delta: timedelta) -> str:
    return create_access_token(
        data={"sub": user.email, SESSION_VERSION_CLAIM: _get_session_version(user)},
        expires_delta=expires_delta,
    )


def revoke_user_sessions(db: Session, user: models.User) -> models.User:
    user.session_version = _get_session_version(user) + 1
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _get_rate_limit_record(db: Session, scope: str, raw_key: str) -> models.AuthRateLimit | None:
    return (
        db.query(models.AuthRateLimit)
        .filter(
            models.AuthRateLimit.scope == scope,
            models.AuthRateLimit.key_hash == _rate_limit_key_hash(raw_key),
        )
        .first()
    )


def _ensure_rate_limit_record(db: Session, scope: str, raw_key: str) -> models.AuthRateLimit:
    record = _get_rate_limit_record(db, scope, raw_key)
    if record is not None:
        return record
    timestamp = _now_utc_iso()
    record = models.AuthRateLimit(
        scope=scope,
        key_hash=_rate_limit_key_hash(raw_key),
        attempts=0,
        window_started_at=timestamp,
        blocked_until=None,
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _normalize_rate_limit_record(
    db: Session,
    record: models.AuthRateLimit,
    *,
    window_seconds: int,
    now: datetime,
) -> models.AuthRateLimit:
    record_changed = False
    blocked_until = _parse_iso_datetime(record.blocked_until)
    if blocked_until is not None and blocked_until <= now:
        record.blocked_until = None
        record.attempts = 0
        record.window_started_at = now.isoformat()
        record_changed = True

    window_started_at = _parse_iso_datetime(record.window_started_at)
    if window_started_at is None or window_started_at + timedelta(seconds=window_seconds) <= now:
        record.attempts = 0
        record.window_started_at = now.isoformat()
        record.blocked_until = None
        record_changed = True

    if record_changed:
        record.updated_at = now.isoformat()
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


def enforce_rate_limit(
    db: Session,
    *,
    scope: str,
    raw_key: str,
    window_seconds: int,
) -> None:
    record = _get_rate_limit_record(db, scope, raw_key)
    if record is None:
        return
    now = _now_utc()
    record = _normalize_rate_limit_record(db, record, window_seconds=window_seconds, now=now)
    blocked_until = _parse_iso_datetime(record.blocked_until)
    if blocked_until is None or blocked_until <= now:
        return
    retry_after_seconds = max(1, int((blocked_until - now).total_seconds()))
    raise AuthRateLimitExceededError(retry_after_seconds)


def register_rate_limit_failure(
    db: Session,
    *,
    scope: str,
    raw_key: str,
    max_attempts: int,
    window_seconds: int,
    block_seconds: int,
) -> None:
    now = _now_utc()
    record = _ensure_rate_limit_record(db, scope, raw_key)
    record = _normalize_rate_limit_record(db, record, window_seconds=window_seconds, now=now)
    record.attempts = int(record.attempts or 0) + 1
    if record.attempts >= max_attempts:
        record.blocked_until = (now + timedelta(seconds=block_seconds)).isoformat()
    record.updated_at = now.isoformat()
    db.add(record)
    db.commit()
    db.refresh(record)


def clear_rate_limit(db: Session, *, scope: str, raw_key: str) -> None:
    record = _get_rate_limit_record(db, scope, raw_key)
    if record is None:
        return
    db.delete(record)
    db.commit()


def enforce_password_login_rate_limits(db: Session, request: Request, username: str) -> tuple[str, str]:
    client_ip = _get_client_ip(request)
    normalized_username = username.strip().lower()
    account_key = normalized_username or "__missing__"
    enforce_rate_limit(
        db,
        scope=LOGIN_RATE_LIMIT_IP_SCOPE,
        raw_key=client_ip,
        window_seconds=AUTH_RATE_LIMIT_IP_WINDOW_SECONDS,
    )
    enforce_rate_limit(
        db,
        scope=LOGIN_RATE_LIMIT_ACCOUNT_SCOPE,
        raw_key=account_key,
        window_seconds=AUTH_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS,
    )
    return client_ip, account_key


def record_password_login_failure(db: Session, *, client_ip: str, account_key: str) -> None:
    register_rate_limit_failure(
        db,
        scope=LOGIN_RATE_LIMIT_IP_SCOPE,
        raw_key=client_ip,
        max_attempts=AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS,
        window_seconds=AUTH_RATE_LIMIT_IP_WINDOW_SECONDS,
        block_seconds=AUTH_RATE_LIMIT_IP_BLOCK_SECONDS,
    )
    register_rate_limit_failure(
        db,
        scope=LOGIN_RATE_LIMIT_ACCOUNT_SCOPE,
        raw_key=account_key,
        max_attempts=AUTH_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS,
        window_seconds=AUTH_RATE_LIMIT_ACCOUNT_WINDOW_SECONDS,
        block_seconds=AUTH_RATE_LIMIT_ACCOUNT_BLOCK_SECONDS,
    )


def clear_password_login_failures(db: Session, *, client_ip: str, account_key: str) -> None:
    clear_rate_limit(db, scope=LOGIN_RATE_LIMIT_IP_SCOPE, raw_key=client_ip)
    clear_rate_limit(db, scope=LOGIN_RATE_LIMIT_ACCOUNT_SCOPE, raw_key=account_key)


def enforce_google_login_rate_limit(db: Session, request: Request) -> str:
    client_ip = _get_client_ip(request)
    enforce_rate_limit(
        db,
        scope=GOOGLE_LOGIN_RATE_LIMIT_IP_SCOPE,
        raw_key=client_ip,
        window_seconds=AUTH_RATE_LIMIT_IP_WINDOW_SECONDS,
    )
    return client_ip


def record_google_login_failure(db: Session, *, client_ip: str) -> None:
    register_rate_limit_failure(
        db,
        scope=GOOGLE_LOGIN_RATE_LIMIT_IP_SCOPE,
        raw_key=client_ip,
        max_attempts=AUTH_RATE_LIMIT_IP_MAX_ATTEMPTS,
        window_seconds=AUTH_RATE_LIMIT_IP_WINDOW_SECONDS,
        block_seconds=AUTH_RATE_LIMIT_IP_BLOCK_SECONDS,
    )


def clear_google_login_failures(db: Session, *, client_ip: str) -> None:
    clear_rate_limit(db, scope=GOOGLE_LOGIN_RATE_LIMIT_IP_SCOPE, raw_key=client_ip)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = _now_utc() + expires_delta
    else:
        expire = _now_utc() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def set_auth_cookie(response: Response, token: str, expires_delta: timedelta) -> None:
    max_age = max(1, int(expires_delta.total_seconds()))
    csrf_token = issue_csrf_token()
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
    response.set_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
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
    response.delete_cookie(
        key=AUTH_CSRF_COOKIE_NAME,
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
    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    uses_cookie_auth = not token and bool(cookie_token)
    if uses_cookie_auth:
        enforce_cookie_request_security(request)

    resolved_token = token or cookie_token
    if not resolved_token:
        raise credentials_exception
    try:
        payload = jwt.decode(resolved_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
        session_version = int(payload.get(SESSION_VERSION_CLAIM, 0) or 0)
    except (JWTError, TypeError, ValueError):
        raise credentials_exception
    user = crud.get_user_by_email(db, email=token_data.username)
    if user is None:
        raise credentials_exception
    if session_version != _get_session_version(user):
        raise credentials_exception
    return user
