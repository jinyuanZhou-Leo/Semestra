# input:  [FastAPI requests, SQLAlchemy session, Resend email API config plus auth-template aliases, auth JWT/rate-limit helpers, and email-verification ORM models]
# output: [Email-code challenge creation, typed verification-token issuance/consumption, and Resend delivery helpers for auth flows]
# pos:    [Backend email-verification service layer that owns one-time code generation, hashing, cooldown/rate-limit enforcement, typed verification-token issuance, and transactional Resend template delivery for auth emails]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import os
import re
import secrets
from typing import Literal

from fastapi import Request
from jose import JWTError, jwt
import requests
from sqlalchemy.orm import Session

import auth
import models

VerificationPurpose = Literal["register", "login", "reset_password"]
CONTINUE_PURPOSES: tuple[VerificationPurpose, VerificationPurpose] = ("register", "login")

EMAIL_VERIFICATION_PURPOSE_CLAIM = "verification_purpose"
EMAIL_VERIFICATION_CHALLENGE_ID_CLAIM = "verification_challenge_id"
EMAIL_VERIFICATION_NONCE_CLAIM = "verification_nonce"
RESEND_EMAILS_API_URL = "https://api.resend.com/emails"
EMAIL_SEND_IP_SCOPE = "email_send_ip"
EMAIL_SEND_EMAIL_SCOPE = "email_send_email"

VERIFICATION_CODE_TTL_SECONDS = int(os.getenv("AUTH_EMAIL_CODE_TTL_SECONDS", "600"))
VERIFICATION_CODE_RESEND_SECONDS = int(os.getenv("AUTH_EMAIL_CODE_RESEND_SECONDS", "60"))
VERIFICATION_CODE_MAX_ATTEMPTS = int(os.getenv("AUTH_EMAIL_CODE_MAX_ATTEMPTS", "5"))
VERIFICATION_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_EMAIL_VERIFICATION_TOKEN_TTL_SECONDS", "600"))
EMAIL_RATE_LIMIT_PER_HOUR = int(os.getenv("AUTH_EMAIL_RATE_LIMIT_PER_HOUR", "5"))
EMAIL_IP_RATE_LIMIT_PER_HOUR = int(os.getenv("AUTH_EMAIL_IP_RATE_LIMIT_PER_HOUR", "20"))
AUTH_EMAIL_CODE_SECRET = os.getenv("AUTH_EMAIL_CODE_SECRET") or auth.SECRET_KEY
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
AUTH_EMAIL_FROM = os.getenv("AUTH_EMAIL_FROM", "").strip()
AUTH_EMAIL_REPLY_TO = os.getenv("AUTH_EMAIL_REPLY_TO", "").strip()
AUTH_EMAIL_TEMPLATE_REGISTER = os.getenv("AUTH_EMAIL_TEMPLATE_REGISTER", "semestra-create-account").strip()
AUTH_EMAIL_TEMPLATE_LOGIN = os.getenv("AUTH_EMAIL_TEMPLATE_LOGIN", "semestra-login").strip()
AUTH_EMAIL_TEMPLATE_RESET_PASSWORD = os.getenv("AUTH_EMAIL_TEMPLATE_RESET_PASSWORD", "semestra-pw-reset").strip()

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailVerificationError(Exception):
    def __init__(self, code: str, message: str, *, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


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


def normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized or not EMAIL_PATTERN.match(normalized):
        raise EmailVerificationError(
            "INVALID_EMAIL",
            "Enter a valid email address.",
            status_code=422,
        )
    return normalized


def _get_client_ip(request: Request) -> str:
    return request.client.host if request.client is not None and request.client.host else "unknown"


def _build_code_hash(email: str, purpose: VerificationPurpose, code: str) -> str:
    payload = f"{email}:{purpose}:{code}".encode("utf-8")
    return hmac.new(AUTH_EMAIL_CODE_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _generate_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _get_latest_challenge(db: Session, *, email: str, purpose: VerificationPurpose) -> models.EmailVerificationChallenge | None:
    return (
        db.query(models.EmailVerificationChallenge)
        .filter(
            models.EmailVerificationChallenge.email == email,
            models.EmailVerificationChallenge.purpose == purpose,
        )
        .order_by(models.EmailVerificationChallenge.created_at.desc(), models.EmailVerificationChallenge.id.desc())
        .first()
    )


def _get_active_challenge(db: Session, *, email: str, purpose: VerificationPurpose) -> models.EmailVerificationChallenge | None:
    challenge = _get_latest_challenge(db, email=email, purpose=purpose)
    if challenge is None:
        return None
    if challenge.used_at or challenge.invalidated_at:
        return None
    expires_at = _parse_iso_datetime(challenge.expires_at)
    if expires_at is not None and expires_at <= _now_utc():
        return None
    return challenge


def _get_active_continue_challenge(db: Session, *, email: str) -> models.EmailVerificationChallenge | None:
    candidates = [
        challenge
        for purpose in CONTINUE_PURPOSES
        for challenge in [_get_active_challenge(db, email=email, purpose=purpose)]
        if challenge is not None
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda challenge: (challenge.created_at, challenge.id))


def _invalidate_active_challenges(db: Session, *, email: str, purpose: VerificationPurpose) -> None:
    active_rows = (
        db.query(models.EmailVerificationChallenge)
        .filter(
            models.EmailVerificationChallenge.email == email,
            models.EmailVerificationChallenge.purpose == purpose,
            models.EmailVerificationChallenge.used_at.is_(None),
            models.EmailVerificationChallenge.invalidated_at.is_(None),
        )
        .all()
    )
    if not active_rows:
        return
    now = _now_utc_iso()
    for row in active_rows:
        row.invalidated_at = now
        row.updated_at = now
        db.add(row)
    db.commit()


def _invalidate_active_continue_challenges(db: Session, *, email: str) -> None:
    for purpose in CONTINUE_PURPOSES:
        _invalidate_active_challenges(db, email=email, purpose=purpose)


def _ensure_send_not_cooling_down(db: Session, *, email: str, purpose: VerificationPurpose) -> None:
    latest = _get_latest_challenge(db, email=email, purpose=purpose)
    if latest is None or not latest.last_sent_at:
        return
    last_sent_at = _parse_iso_datetime(latest.last_sent_at)
    if last_sent_at is None:
        return
    retry_after = VERIFICATION_CODE_RESEND_SECONDS - int((_now_utc() - last_sent_at).total_seconds())
    if retry_after > 0:
        raise EmailVerificationError(
            "EMAIL_CODE_COOLDOWN",
            "Please wait before requesting another verification code.",
            status_code=429,
        )


def _ensure_continue_send_not_cooling_down(db: Session, *, email: str) -> None:
    latest_candidates = [
        challenge
        for purpose in CONTINUE_PURPOSES
        for challenge in [_get_latest_challenge(db, email=email, purpose=purpose)]
        if challenge is not None and challenge.last_sent_at
    ]
    if not latest_candidates:
        return
    latest = max(latest_candidates, key=lambda challenge: (challenge.last_sent_at or "", challenge.id))
    last_sent_at = _parse_iso_datetime(latest.last_sent_at)
    if last_sent_at is None:
        return
    retry_after = VERIFICATION_CODE_RESEND_SECONDS - int((_now_utc() - last_sent_at).total_seconds())
    if retry_after > 0:
        raise EmailVerificationError(
            "EMAIL_CODE_COOLDOWN",
            "Please wait before requesting another verification code.",
            status_code=429,
        )


def _enforce_send_rate_limits(db: Session, *, request: Request, email: str) -> None:
    client_ip = _get_client_ip(request)
    try:
        auth.enforce_rate_limit(
            db,
            scope=EMAIL_SEND_IP_SCOPE,
            raw_key=client_ip,
            window_seconds=3600,
        )
        auth.enforce_rate_limit(
            db,
            scope=EMAIL_SEND_EMAIL_SCOPE,
            raw_key=email,
            window_seconds=3600,
        )
    except auth.AuthRateLimitExceededError as exc:
        raise EmailVerificationError(
            "EMAIL_CODE_RATE_LIMITED",
            "Too many verification emails requested. Please retry later.",
            status_code=429,
        ) from exc


def _record_send_success(db: Session, *, request: Request, email: str) -> None:
    client_ip = _get_client_ip(request)
    auth.register_rate_limit_failure(
        db,
        scope=EMAIL_SEND_IP_SCOPE,
        raw_key=client_ip,
        max_attempts=EMAIL_IP_RATE_LIMIT_PER_HOUR,
        window_seconds=3600,
        block_seconds=3600,
    )
    auth.register_rate_limit_failure(
        db,
        scope=EMAIL_SEND_EMAIL_SCOPE,
        raw_key=email,
        max_attempts=EMAIL_RATE_LIMIT_PER_HOUR,
        window_seconds=3600,
        block_seconds=3600,
    )


def _subject_for_purpose(purpose: VerificationPurpose) -> str:
    if purpose == "login":
        return "Your Semestra sign-in code"
    if purpose == "reset_password":
        return "Your Semestra password reset code"
    return "Your Semestra verification code"


def _preview_line_for_purpose(purpose: VerificationPurpose) -> str:
    if purpose == "login":
        return "Use this code to sign in to your Semestra account."
    if purpose == "reset_password":
        return "Use this code to reset your Semestra password."
    return "Use this code to finish creating your Semestra account."


def _expires_in_label() -> str:
    minutes = VERIFICATION_CODE_TTL_SECONDS // 60
    if minutes <= 1:
        return "1 minute"
    return f"{minutes} minutes"


def _template_id_for_purpose(purpose: VerificationPurpose) -> str | None:
    if purpose == "register":
        return AUTH_EMAIL_TEMPLATE_REGISTER or None
    if purpose == "login":
        return AUTH_EMAIL_TEMPLATE_LOGIN or None
    if purpose == "reset_password":
        return AUTH_EMAIL_TEMPLATE_RESET_PASSWORD or None
    return None


def _template_variables(*, code: str) -> dict[str, str]:
    return {
        "APP_NAME": "Semestra",
        "OTP_CODE": code,
        "EXPIRES_IN": _expires_in_label(),
        "YEAR": str(_now_utc().year),
    }


def _build_email_payload(*, to_email: str, code: str, purpose: VerificationPurpose, idempotency_key: str) -> tuple[dict, dict]:
    if not RESEND_API_KEY:
        raise EmailVerificationError(
            "EMAIL_DELIVERY_NOT_CONFIGURED",
            "RESEND_API_KEY is not configured.",
            status_code=500,
        )
    if not AUTH_EMAIL_FROM:
        raise EmailVerificationError(
            "EMAIL_DELIVERY_NOT_CONFIGURED",
            "AUTH_EMAIL_FROM is not configured.",
            status_code=500,
        )
    preview_line = _preview_line_for_purpose(purpose)
    template_id = _template_id_for_purpose(purpose)
    payload: dict[str, object] = {
        "from": AUTH_EMAIL_FROM,
        "to": [to_email],
        "subject": _subject_for_purpose(purpose),
        "tags": [
            {"name": "category", "value": "auth_verification"},
            {"name": "purpose", "value": purpose},
        ],
    }
    if template_id is not None:
        payload["template"] = {
            "id": template_id,
            "variables": _template_variables(code=code),
        }
    if AUTH_EMAIL_REPLY_TO:
        payload["reply_to"] = AUTH_EMAIL_REPLY_TO
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key,
    }
    return payload, headers


def _deliver_email_code(*, challenge: models.EmailVerificationChallenge, code: str) -> str | None:
    payload, headers = _build_email_payload(
        to_email=challenge.email,
        code=code,
        purpose=challenge.purpose,
        idempotency_key=challenge.id,
    )
    response = requests.post(
        RESEND_EMAILS_API_URL,
        headers=headers,
        json=payload,
        timeout=10,
    )
    if response.status_code >= 400:
        raise EmailVerificationError(
            "EMAIL_DELIVERY_FAILED",
            "Failed to deliver the verification email.",
            status_code=502,
        )
    data = response.json() if response.content else {}
    return data.get("id") if isinstance(data, dict) else None


def send_email_code(
    db: Session,
    *,
    request: Request,
    email: str,
    purpose: VerificationPurpose,
) -> None:
    normalized_email = normalize_email(email)
    _ensure_send_not_cooling_down(db, email=normalized_email, purpose=purpose)
    _enforce_send_rate_limits(db, request=request, email=normalized_email)
    _invalidate_active_challenges(db, email=normalized_email, purpose=purpose)

    code = _generate_verification_code()
    now = _now_utc()
    challenge = models.EmailVerificationChallenge(
        email=normalized_email,
        purpose=purpose,
        code_hash=_build_code_hash(normalized_email, purpose, code),
        verification_nonce=None,
        attempt_count=0,
        max_attempts=VERIFICATION_CODE_MAX_ATTEMPTS,
        expires_at=(now + timedelta(seconds=VERIFICATION_CODE_TTL_SECONDS)).isoformat(),
        last_sent_at=None,
        verified_at=None,
        used_at=None,
        invalidated_at=None,
        resend_email_id=None,
        request_ip=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    try:
        resend_email_id = _deliver_email_code(challenge=challenge, code=code)
    except Exception:
        db.delete(challenge)
        db.commit()
        raise

    send_timestamp = _now_utc_iso()
    challenge.last_sent_at = send_timestamp
    challenge.resend_email_id = resend_email_id
    challenge.updated_at = send_timestamp
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    _record_send_success(db, request=request, email=normalized_email)


def send_continue_email_code(
    db: Session,
    *,
    request: Request,
    email: str,
    actual_purpose: VerificationPurpose,
) -> None:
    normalized_email = normalize_email(email)
    _ensure_continue_send_not_cooling_down(db, email=normalized_email)
    _enforce_send_rate_limits(db, request=request, email=normalized_email)
    _invalidate_active_continue_challenges(db, email=normalized_email)

    code = _generate_verification_code()
    now = _now_utc()
    challenge = models.EmailVerificationChallenge(
        email=normalized_email,
        purpose=actual_purpose,
        code_hash=_build_code_hash(normalized_email, actual_purpose, code),
        verification_nonce=None,
        attempt_count=0,
        max_attempts=VERIFICATION_CODE_MAX_ATTEMPTS,
        expires_at=(now + timedelta(seconds=VERIFICATION_CODE_TTL_SECONDS)).isoformat(),
        last_sent_at=None,
        verified_at=None,
        used_at=None,
        invalidated_at=None,
        resend_email_id=None,
        request_ip=_get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    try:
        resend_email_id = _deliver_email_code(challenge=challenge, code=code)
    except Exception:
        db.delete(challenge)
        db.commit()
        raise

    send_timestamp = _now_utc_iso()
    challenge.last_sent_at = send_timestamp
    challenge.resend_email_id = resend_email_id
    challenge.updated_at = send_timestamp
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    _record_send_success(db, request=request, email=normalized_email)


def build_send_code_response_message(*, purpose: str) -> str:
    if purpose == "continue":
        return "If this email can continue, a verification code has been sent."
    if purpose == "register":
        return "If this email can create an account, a verification code has been sent."
    if purpose == "login":
        return "If this email can sign in, a verification code has been sent."
    if purpose == "reset_password":
        return "If this email can reset a password, a verification code has been sent."
    return "If this email can use this flow, a verification code has been sent."


def verify_email_code(db: Session, *, email: str, purpose: VerificationPurpose, code: str) -> str:
    normalized_email = normalize_email(email)
    challenge = _get_active_challenge(db, email=normalized_email, purpose=purpose)
    if challenge is None or not challenge.last_sent_at:
        raise EmailVerificationError(
            "INVALID_VERIFICATION_CODE",
            "The verification code is invalid or expired.",
            status_code=400,
        )
    if int(challenge.attempt_count or 0) >= int(challenge.max_attempts or VERIFICATION_CODE_MAX_ATTEMPTS):
        raise EmailVerificationError(
            "VERIFICATION_CODE_ATTEMPTS_EXCEEDED",
            "Too many invalid verification attempts. Request a new code.",
            status_code=429,
        )

    expected_hash = _build_code_hash(normalized_email, purpose, code)
    if not hmac.compare_digest(challenge.code_hash, expected_hash):
        challenge.attempt_count = int(challenge.attempt_count or 0) + 1
        challenge.updated_at = _now_utc_iso()
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
        if int(challenge.attempt_count or 0) >= int(challenge.max_attempts or VERIFICATION_CODE_MAX_ATTEMPTS):
            raise EmailVerificationError(
                "VERIFICATION_CODE_ATTEMPTS_EXCEEDED",
                "Too many invalid verification attempts. Request a new code.",
                status_code=429,
            )
        raise EmailVerificationError(
            "INVALID_VERIFICATION_CODE",
            "The verification code is invalid or expired.",
            status_code=400,
        )

    challenge.verified_at = _now_utc_iso()
    challenge.verification_nonce = secrets.token_urlsafe(16)
    challenge.updated_at = challenge.verified_at
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return auth.create_access_token(
        data={
            "sub": challenge.email,
            EMAIL_VERIFICATION_PURPOSE_CLAIM: challenge.purpose,
            EMAIL_VERIFICATION_CHALLENGE_ID_CLAIM: challenge.id,
            EMAIL_VERIFICATION_NONCE_CLAIM: challenge.verification_nonce,
        },
        expires_delta=timedelta(seconds=VERIFICATION_TOKEN_TTL_SECONDS),
        token_type=auth.EMAIL_VERIFICATION_TOKEN_TYPE,
    )


def verify_continue_email_code(db: Session, *, email: str, code: str) -> tuple[str, VerificationPurpose]:
    normalized_email = normalize_email(email)
    challenge = _get_active_continue_challenge(db, email=normalized_email)
    if challenge is None:
        raise EmailVerificationError(
            "INVALID_VERIFICATION_CODE",
            "The verification code is invalid or expired.",
            status_code=400,
        )
    verification_token = verify_email_code(db, email=normalized_email, purpose=challenge.purpose, code=code)
    return verification_token, challenge.purpose


def get_verified_challenge_from_token(
    db: Session,
    *,
    verification_token: str,
    expected_purpose: VerificationPurpose,
) -> models.EmailVerificationChallenge:
    try:
        payload = jwt.decode(verification_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        challenge_id = str(payload.get(EMAIL_VERIFICATION_CHALLENGE_ID_CLAIM) or "")
        purpose = str(payload.get(EMAIL_VERIFICATION_PURPOSE_CLAIM) or "")
        email = str(payload.get("sub") or "").strip().lower()
        nonce = str(payload.get(EMAIL_VERIFICATION_NONCE_CLAIM) or "")
    except (JWTError, TypeError, ValueError) as exc:
        raise EmailVerificationError(
            "INVALID_VERIFICATION_TOKEN",
            "The verification session is invalid or expired.",
            status_code=401,
        ) from exc
    if purpose != expected_purpose or not challenge_id or not email or not nonce:
        raise EmailVerificationError(
            "INVALID_VERIFICATION_TOKEN",
            "The verification session is invalid or expired.",
            status_code=401,
        )
    challenge = (
        db.query(models.EmailVerificationChallenge)
        .filter(models.EmailVerificationChallenge.id == challenge_id)
        .first()
    )
    if challenge is None:
        raise EmailVerificationError(
            "INVALID_VERIFICATION_TOKEN",
            "The verification session is invalid or expired.",
            status_code=401,
        )
    if (
        challenge.email != email
        or challenge.purpose != expected_purpose
        or challenge.verification_nonce != nonce
        or not challenge.verified_at
        or challenge.used_at
        or challenge.invalidated_at
    ):
        raise EmailVerificationError(
            "INVALID_VERIFICATION_TOKEN",
            "The verification session is invalid or expired.",
            status_code=401,
        )
    return challenge


def mark_challenge_used(db: Session, challenge: models.EmailVerificationChallenge) -> models.EmailVerificationChallenge:
    challenge.used_at = _now_utc_iso()
    challenge.updated_at = challenge.used_at
    challenge.verification_nonce = None
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge
