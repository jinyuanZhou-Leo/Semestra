# input:  [FastAPI router/dependencies, backend account-deletion/auth/crud/models/schemas/LMS services, email-verification service, Google token verification, backup-transfer service, and shared API helpers]
# output: [Auth, account-deletion, email-code verification, current-user, LMS integration, and backup import/export route handlers plus exported backup wrapper functions]
# pos:    [backend API router for identity/session flows, irreversible account deletion, DB-backed login throttling, Resend-backed email-code verification, logout revocation, and account-scoped integration or backup endpoints]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import timedelta
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from api_common import (
    error_detail,
    now_utc_iso,
    normalize_week_pattern_input,
    raise_lms_http_error,
    touch_model_timestamp,
    validate_day_of_week,
    validate_reading_week_or_422,
    validate_section_id,
    validate_time_range,
    validate_week_range,
)
import account_deletion
from database import get_db
from schedule_support import validate_section_payload
import auth
import backup_transfer
import crud
import email_verification
import lms_service
import models
import schemas

router = APIRouter()
BASE_DIR = Path(__file__).parent
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


def verify_google_id_token(id_token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client ID is not configured")
    try:
        return google_id_token.verify_oauth2_token(id_token, google_requests.Request(), GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc


def _raise_email_verification_http_error(exc: Exception) -> None:
    if isinstance(exc, email_verification.EmailVerificationError):
        raise HTTPException(
            status_code=exc.status_code,
            detail=error_detail(exc.code, exc.message),
        ) from exc
    raise exc


def _build_send_code_response(purpose: schemas.AuthEmailCodePurpose) -> schemas.EmailCodeSendResponse:
    return schemas.EmailCodeSendResponse(
        expires_in_seconds=email_verification.VERIFICATION_CODE_TTL_SECONDS,
        resend_in_seconds=email_verification.VERIFICATION_CODE_RESEND_SECONDS,
        message=email_verification.build_send_code_response_message(purpose=purpose),
    )


@router.post("/auth/email/send-code", response_model=schemas.EmailCodeSendResponse)
def send_auth_email_code(
    payload: schemas.EmailCodeSendRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    db_user = crud.get_user_by_email(db, email=payload.email)
    if payload.purpose == "register":
        if db_user is not None:
            raise HTTPException(
                status_code=409,
                detail=error_detail("EMAIL_ALREADY_REGISTERED", "Email already registered."),
            )
        try:
            email_verification.send_email_code(
                db,
                request=request,
                email=payload.email,
                purpose=payload.purpose,
            )
        except Exception as exc:
            _raise_email_verification_http_error(exc)
        return _build_send_code_response(payload.purpose)

    if db_user is None:
        return _build_send_code_response(payload.purpose)

    try:
        email_verification.send_email_code(
            db,
            request=request,
            email=payload.email,
            purpose=payload.purpose,
        )
    except Exception as exc:
        _raise_email_verification_http_error(exc)
    return _build_send_code_response(payload.purpose)


@router.post("/auth/email/verify-code", response_model=schemas.EmailCodeVerifyResponse)
def verify_auth_email_code(
    payload: schemas.EmailCodeVerifyRequest,
    db: Session = Depends(get_db),
):
    try:
        verification_token = email_verification.verify_email_code(
            db,
            email=payload.email,
            purpose=payload.purpose,
            code=payload.code,
        )
    except Exception as exc:
        _raise_email_verification_http_error(exc)
    return schemas.EmailCodeVerifyResponse(verification_token=verification_token)


@router.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user, email_verified_at=now_utc_iso())


@router.post("/auth/register/complete", response_model=schemas.Token)
def complete_registration(
    payload: schemas.RegisterCompleteRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        challenge = email_verification.get_verified_challenge_from_token(
            db,
            verification_token=payload.verification_token,
            expected_purpose="register",
        )
    except Exception as exc:
        _raise_email_verification_http_error(exc)

    if crud.get_user_by_email(db, email=challenge.email):
        raise HTTPException(
            status_code=409,
            detail=error_detail("EMAIL_ALREADY_REGISTERED", "Email already registered."),
        )

    user = crud.create_user(
        db=db,
        user=schemas.UserCreate(
            email=challenge.email,
            nickname=payload.nickname,
            password=payload.password,
        ),
        email_verified_at=challenge.verified_at or now_utc_iso(),
    )
    email_verification.mark_challenge_used(db, challenge)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_user_access_token(user, access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/token", response_model=schemas.Token)
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
    db: Session = Depends(get_db),
):
    try:
        client_ip, account_key = auth.enforce_password_login_rate_limits(db, request, form_data.username)
    except auth.AuthRateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please retry later.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc

    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        auth.record_password_login_failure(db, client_ip=client_ip, account_key=account_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth.clear_password_login_failures(db, client_ip=client_ip, account_key=account_key)
    access_token_expires = timedelta(days=15) if remember_me else timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_user_access_token(user, access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/login/email", response_model=schemas.Token)
def login_with_email_code(
    payload: schemas.EmailCodeLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        challenge = email_verification.get_verified_challenge_from_token(
            db,
            verification_token=payload.verification_token,
            expected_purpose="login",
        )
    except Exception as exc:
        _raise_email_verification_http_error(exc)

    user = crud.get_user_by_email(db, email=challenge.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_VERIFICATION_TOKEN", "The verification session is invalid or expired."),
        )

    email_verification.mark_challenge_used(db, challenge)
    access_token_expires = timedelta(days=15) if payload.remember_me else timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_user_access_token(user, access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/google", response_model=schemas.Token)
def login_with_google(
    request: Request,
    payload: schemas.GoogleAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        client_ip = auth.enforce_google_login_rate_limit(db, request)
    except auth.AuthRateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please retry later.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc

    try:
        google_payload = verify_google_id_token(payload.id_token)
    except HTTPException:
        auth.record_google_login_failure(db, client_ip=client_ip)
        raise
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        auth.record_google_login_failure(db, client_ip=client_ip)
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        auth.record_google_login_failure(db, client_ip=client_ip)
        raise HTTPException(status_code=400, detail="Google token missing email or subject")

    user = crud.get_user_by_google_sub(db, google_sub=sub)
    if user is None:
        user = crud.get_user_by_email(db, email=email)
        if user:
            if user.google_sub and user.google_sub != sub:
                raise HTTPException(status_code=409, detail="Google account already linked to another user")
            user.google_sub = sub
            if not user.email_verified_at:
                user.email_verified_at = now_utc_iso()
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user = crud.create_user_from_google(
                db,
                email=email,
                google_sub=sub,
                email_verified_at=now_utc_iso(),
            )

    auth.clear_google_login_failures(db, client_ip=client_ip)
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_user_access_token(user, access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if request.cookies.get(auth.AUTH_COOKIE_NAME):
        auth.enforce_cookie_request_security(request)
    auth.revoke_user_sessions(db, current_user)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    auth.clear_auth_cookie(response)
    return response


@router.post("/auth/google/link")
def link_google_account(
    payload: schemas.GoogleAuthRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    google_payload = verify_google_id_token(payload.id_token)
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Google token missing email or subject")
    if current_user.email.lower() != email.lower():
        raise HTTPException(status_code=400, detail="Google email does not match current user")

    existing = crud.get_user_by_google_sub(db, google_sub=sub)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="Google account already linked to another user")
    if current_user.google_sub and current_user.google_sub != sub:
        raise HTTPException(status_code=409, detail="Current user already linked to a different Google account")

    current_user.google_sub = sub
    if not current_user.email_verified_at:
        current_user.email_verified_at = now_utc_iso()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"ok": True}


@router.post("/auth/password-reset/complete", response_model=schemas.Token)
def complete_password_reset(
    payload: schemas.PasswordResetCompleteRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        challenge = email_verification.get_verified_challenge_from_token(
            db,
            verification_token=payload.verification_token,
            expected_purpose="reset_password",
        )
    except Exception as exc:
        _raise_email_verification_http_error(exc)

    user = crud.get_user_by_email(db, email=challenge.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_detail("INVALID_VERIFICATION_TOKEN", "The verification session is invalid or expired."),
        )

    crud.update_user_password(db, user, payload.new_password)
    user = auth.revoke_user_sessions(db, user)
    if not user.email_verified_at:
        user.email_verified_at = challenge.verified_at or now_utc_iso()
        db.add(user)
        db.commit()
        db.refresh(user)
    email_verification.mark_challenge_used(db, challenge)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_user_access_token(user, access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.put("/users/me", response_model=schemas.User)
async def update_user_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.update_user(db, current_user.id, user_update)


@router.post("/users/me/delete-account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(
    payload: schemas.DeleteAccountRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if request.cookies.get(auth.AUTH_COOKIE_NAME):
        auth.enforce_cookie_request_security(request)
    account_deletion.delete_user_account(db, base_dir=BASE_DIR, user=current_user)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    auth.clear_auth_cookie(response)
    return response


@router.get("/users/me/lms-integrations", response_model=list[schemas.LmsIntegrationResponse])
async def list_user_lms_integrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return lms_service.list_integrations(db, current_user.id)


@router.post("/users/me/lms-integrations", response_model=schemas.LmsIntegrationResponse)
async def create_user_lms_integration(
    payload: schemas.LmsIntegrationCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.create_integration(db, current_user.id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.post("/users/me/lms-integrations/validate", response_model=schemas.LmsIntegrationValidationResponse)
async def validate_user_lms_integration_draft(payload: schemas.LmsIntegrationValidationRequest):
    try:
        return lms_service.validate_integration_draft(payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/users/me/lms-integrations/{integration_id}", response_model=schemas.LmsIntegrationResponse)
async def get_user_lms_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_integration(db, current_user.id, integration_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.patch("/users/me/lms-integrations/{integration_id}", response_model=schemas.LmsIntegrationResponse)
async def update_user_lms_integration(
    integration_id: str,
    payload: schemas.LmsIntegrationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.update_integration(db, current_user.id, integration_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.post("/users/me/lms-integrations/{integration_id}/validate", response_model=schemas.LmsIntegrationValidationResponse)
async def validate_user_lms_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.validate_integration(db, current_user.id, integration_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/users/me/lms-integrations/{integration_id}/courses", response_model=schemas.LmsCourseListResponse)
async def list_user_lms_courses(
    integration_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    workflow_state: Optional[str] = Query(default=None),
    enrollment_state: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_courses_for_integration(
            db,
            current_user.id,
            integration_id,
            page=page,
            page_size=page_size,
            workflow_state=workflow_state,
            enrollment_state=enrollment_state,
        )
    except Exception as exc:
        raise_lms_http_error(exc)


@router.delete("/users/me/lms-integrations/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_lms_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        lms_service.delete_integration(db, current_user.id, integration_id)
    except Exception as exc:
        raise_lms_http_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _build_backup_runtime_callbacks() -> backup_transfer.BackupRuntimeCallbacks:
    return backup_transfer.BackupRuntimeCallbacks(
        error_detail=error_detail,
        now_utc_iso=now_utc_iso,
        touch_model_timestamp=touch_model_timestamp,
        validate_day_of_week=validate_day_of_week,
        validate_time_range=validate_time_range,
        validate_week_range=validate_week_range,
        validate_section_id=validate_section_id,
        normalize_week_pattern_input=normalize_week_pattern_input,
        validate_section_payload=validate_section_payload,
        validate_reading_week_or_422=validate_reading_week_or_422,
    )


@router.get("/users/me/export", response_model=schemas.UserDataExport)
async def export_user_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return backup_transfer.export_user_data(
        db,
        current_user,
        base_dir=BASE_DIR,
        error_detail=error_detail,
    )


@router.post("/users/me/import")
async def import_user_data(
    data: schemas.UserDataImport,
    conflict_mode: str = "skip",
    include_settings: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return backup_transfer.import_user_data(
        db,
        current_user,
        data,
        conflict_mode=conflict_mode,
        include_settings=include_settings,
        base_dir=BASE_DIR,
        runtime=_build_backup_runtime_callbacks(),
    )
