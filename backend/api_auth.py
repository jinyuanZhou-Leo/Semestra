# input:  [FastAPI router/dependencies, backend auth/crud/models/schemas/LMS services, Google token verification, backup-transfer service, and shared API helpers]
# output: [Auth, current-user, LMS integration, and backup import/export route handlers plus exported backup wrapper functions]
# pos:    [backend API router for identity/session flows and account-scoped integration or backup endpoints]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import timedelta
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response, status
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
from database import get_db
from schedule_support import validate_section_payload
import auth
import backup_transfer
import crud
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


@router.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


@router.post("/auth/token", response_model=schemas.Token)
async def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(days=15) if remember_me else timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/google", response_model=schemas.Token)
def login_with_google(
    payload: schemas.GoogleAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
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

    user = crud.get_user_by_google_sub(db, google_sub=sub)
    if user is None:
        user = crud.get_user_by_email(db, email=email)
        if user:
            if user.google_sub and user.google_sub != sub:
                raise HTTPException(status_code=409, detail="Google account already linked to another user")
            user.google_sub = sub
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user = crud.create_user_from_google(db, email=email, google_sub=sub)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    auth.set_auth_cookie(response, access_token, access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
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
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"ok": True}


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
