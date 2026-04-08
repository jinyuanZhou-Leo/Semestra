# input:  [FastAPI framework, modular API routers, backend schemas/models/crud/runtime helpers, auth dependencies, and runtime schema checks]
# output: [FastAPI app bootstrap plus Program/plugin-system route registration and compatibility re-exports for academic route handlers moved into dedicated routers]
# pos:    [backend entry point that wires middleware, startup schema guards, modular routers, Program governance routes, plugin-system/draft routes, and selected re-exported academic handlers used elsewhere in the backend tests]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import os
from pathlib import Path

from dotenv import load_dotenv

import auth
import api_academics as academics_api
from api_academics import (
    router as academics_router,
    download_course_lms_module_item_file,
    read_course,
    read_course_lms_announcements,
    read_course_lms_grades,
    read_course_lms_module_item_file,
    read_course_lms_module_items,
    read_course_lms_modules,
    read_course_lms_navigation,
    read_course_lms_page,
    read_course_lms_pages,
    read_course_lms_quizzes,
    read_course_lms_syllabus,
    read_semester,
    upsert_course_tab_setting,
    upsert_semester_tab_setting,
)
from api_auth import export_user_data, import_user_data, router as auth_router
from api_common import error_detail, get_owned_course, get_owned_program, get_owned_semester
from api_course_schedule import router as course_schedule_router
from api_layout import router as layout_router
import crud
from database import assert_runtime_schema_compatible, engine, get_db
import models
import runtime_payloads
import schemas

course_resources = academics_api.course_resources
logger = academics_api.logger
utils = academics_api.utils
import_course_schedule_from_ics = academics_api.import_course_schedule_from_ics

BASE_DIR = Path(__file__).parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load .env only for local development. Production should use platform env vars.
if ENVIRONMENT == "development":
    env_local_path = BASE_DIR / ".env"
    if env_local_path.exists():
        load_dotenv(env_local_path)

models.Base.metadata.create_all(bind=engine)
assert_runtime_schema_compatible(engine)


def _build_fastapi_kwargs() -> dict[str, object]:
    if os.getenv("ENVIRONMENT", "development") == "production":
        return {
            "docs_url": None,
            "redoc_url": None,
            "openapi_url": None,
        }
    return {}


def _configure_middlewares(app_instance: FastAPI) -> None:
    app_instance.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=auth.get_allowed_api_hosts(),
    )
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app = FastAPI(**_build_fastapi_kwargs())

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = auth.get_allowed_browser_origins()
_configure_middlewares(app)

app.include_router(auth_router)
app.include_router(course_schedule_router)
app.include_router(layout_router)
app.include_router(academics_router)


def _sync_academics_compat_globals() -> None:
    academics_api.course_resources = course_resources
    academics_api.get_owned_course = get_owned_course
    academics_api.get_owned_program = get_owned_program
    academics_api.get_owned_semester = get_owned_semester
    academics_api.import_course_schedule_from_ics = import_course_schedule_from_ics
    academics_api.logger = logger
    academics_api.utils = utils


def _raise_plugin_registry_http_error(exc: crud.PluginRegistryError) -> None:
    code_to_status = {
        "PROGRAM_NOT_FOUND": 404,
        "SEMESTER_NOT_FOUND": 404,
        "COURSE_NOT_FOUND": 404,
        "PLUGIN_NOT_INSTALLED": 404,
        "PLUGIN_LOCKED": 409,
        "SEMESTER_DRAFT_EXISTS": 409,
        "SEMESTER_NOT_DRAFT": 409,
        "COURSE_NOT_UNASSIGNED": 409,
        "PLUGIN_NOT_AVAILABLE": 422,
        "PLUGIN_AUTH_STATE_INVALID": 422,
        "PLUGIN_IDS_REQUIRED": 422,
        "PROGRAM_PLUGIN_SETTINGS_INVALID": 422,
        "SEMESTER_PLUGIN_OVERRIDES_INVALID": 422,
        "SEMESTER_PLUGIN_SETUP_INVALID": 422,
        "SEMESTER_DRAFT_REVIEW_FAILED": 422,
    }
    raise HTTPException(
        status_code=code_to_status.get(exc.code, 422),
        detail=error_detail(exc.code, exc.message),
    )


@app.post("/programs/", response_model=schemas.Program)
def create_program(
    program: schemas.ProgramCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return crud.create_program(db=db, program=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )
    except crud.ProgramLmsDependencyError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("PROGRAM_LMS_INTEGRATION_NOT_FOUND", "Selected LMS integration was not found."),
        )


@app.get("/programs/", response_model=list[schemas.Program])
def read_programs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return crud.get_programs(db, user_id=current_user.id, skip=skip, limit=limit)


@app.get("/programs/{program_id}", response_model=schemas.ProgramWithSemesters)
def read_program(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    payload = schemas.Program.model_validate(program).model_dump()
    payload["tab_settings"] = runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id)
    payload["semesters"] = []
    payload["plugin_installations"] = crud.get_program_plugin_installations(db, program_id)
    for semester in program.semesters:
        if semester.lifecycle_state == "draft":
            continue
        semester_payload = schemas.Semester.model_validate(semester).model_dump()
        semester_payload["courses"] = [schemas.Course.model_validate(course).model_dump() for course in semester.courses]
        semester_payload["widgets"] = [schemas.Widget.model_validate(widget).model_dump() for widget in semester.widgets]
        semester_payload["tabs"] = [schemas.Tab.model_validate(tab).model_dump() for tab in semester.tabs]
        payload["semesters"].append(semester_payload)
    return payload


@app.get("/programs/{program_id}/tab-settings", response_model=list[schemas.TabSetting])
def read_program_tab_settings(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = get_owned_program(db, current_user, program_id)
    return runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id)


@app.put("/programs/{program_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_program_tab_setting(
    program_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = get_owned_program(db, current_user, program_id)
    row = crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=settings_key, settings=tab_setting.settings),
        program_id=program.id,
    )
    return runtime_payloads.serialize_tab_setting_payload(db, row, program_id=program.id)


@app.put("/programs/{program_id}", response_model=schemas.Program)
def update_program(
    program_id: str,
    program: schemas.ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        db_program = crud.update_program(db, program_id=program_id, program_update=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )
    except crud.ProgramLmsDependencyError as exc:
        if str(exc) == "PROGRAM_LMS_DEPENDENCIES_EXIST":
            raise HTTPException(
                status_code=409,
                detail=error_detail("PROGRAM_LMS_DEPENDENCIES_EXIST", "Program LMS cannot be changed while linked LMS courses still exist."),
            )
        raise HTTPException(
            status_code=422,
            detail=error_detail("PROGRAM_LMS_INTEGRATION_NOT_FOUND", "Selected LMS integration was not found."),
        )
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return db_program


@app.delete("/programs/{program_id}")
def delete_program(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_program = crud.delete_program(db, program_id=program_id, user_id=current_user.id)
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"ok": True}


@app.get("/programs/{program_id}/plugins/catalog", response_model=list[schemas.ProgramPluginCatalogItem])
def read_program_plugin_catalog(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    return crud.get_program_plugin_catalog(db, program_id)


@app.get("/programs/{program_id}/plugins/installations", response_model=list[schemas.ProgramPluginInstallation])
def read_program_plugin_installations(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    return crud.get_program_plugin_installations(db, program_id)


@app.put("/programs/{program_id}/plugins/{plugin_id}", response_model=schemas.ProgramPluginInstallation)
def upsert_program_plugin_installation(
    program_id: str,
    plugin_id: str,
    payload: schemas.ProgramPluginInstallationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    try:
        return crud.upsert_program_plugin_installation(db, program_id, plugin_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.put("/programs/{program_id}/plugins:bulk", response_model=list[schemas.ProgramPluginInstallation])
def bulk_update_program_plugin_installations(
    program_id: str,
    payload: schemas.ProgramPluginInstallationBulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    try:
        return crud.bulk_update_program_plugin_installations(db, program_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.delete("/programs/{program_id}/plugins/{plugin_id}")
def delete_program_plugin_installation(
    program_id: str,
    plugin_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    try:
        installation = crud.delete_program_plugin_installation(db, program_id, plugin_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)
    if installation is None:
        raise HTTPException(status_code=404, detail=error_detail("PLUGIN_NOT_INSTALLED", "Plugin is not installed for this Program."))
    return {"ok": True}


@app.get("/programs/{program_id}/semester-draft", response_model=Optional[schemas.SemesterDraft])
def read_current_semester_draft(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    draft = crud.get_current_semester_draft(db, program_id)
    if draft is None:
        return None
    return crud._serialize_semester_draft(draft)


@app.post("/programs/{program_id}/semester-draft", response_model=schemas.SemesterDraft)
def create_current_semester_draft(
    program_id: str,
    payload: schemas.SemesterDraftCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    try:
        return crud.create_semester_draft(db, program_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.put("/semesters/{semester_id}/draft", response_model=schemas.SemesterDraft)
def update_current_semester_draft(
    semester_id: str,
    payload: schemas.SemesterDraftUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        return crud.update_semester_draft(db, semester_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.post("/semesters/{semester_id}/draft/finalize", response_model=schemas.SemesterDraft)
def finalize_current_semester_draft(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        return crud.finalize_semester_draft(db, semester_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.post("/semesters/{semester_id}/draft/review", response_model=schemas.SemesterDraft)
def review_current_semester_draft(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    draft = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if draft is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    if draft.lifecycle_state != "draft":
        raise HTTPException(
            status_code=409,
            detail=error_detail("SEMESTER_NOT_DRAFT", "Only draft Semesters can be reviewed."),
        )
    return crud._serialize_semester_draft(draft)


@app.get("/plugin-system/plugins/{plugin_id}/setup-definition", response_model=schemas.PluginSystemSetupDefinitionResponse)
def read_plugin_system_setup_definition(
    plugin_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    del db, current_user
    try:
        return crud.get_plugin_system_setup_definition(plugin_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.get("/plugin-system/semesters/{semester_id}/setup", response_model=schemas.PluginSystemSemesterSetupResponse)
def read_semester_plugin_system_setup(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    draft = get_owned_semester(db, current_user, semester_id)
    if draft.lifecycle_state != "draft":
        raise HTTPException(
            status_code=409,
            detail=error_detail("SEMESTER_NOT_DRAFT", "Only draft Semesters expose plugin setup state."),
        )
    try:
        return crud.get_semester_plugin_system_setup(db, semester_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.put(
    "/plugin-system/semesters/{semester_id}/plugins/{plugin_id}/setup",
    response_model=schemas.PluginSystemSemesterSetupUpdateResponse,
)
def update_semester_plugin_system_setup(
    semester_id: str,
    plugin_id: str,
    payload: schemas.PluginSystemSemesterSetupUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    draft = get_owned_semester(db, current_user, semester_id)
    if draft.lifecycle_state != "draft":
        raise HTTPException(
            status_code=409,
            detail=error_detail("SEMESTER_NOT_DRAFT", "Only draft Semesters can update plugin setup."),
        )
    try:
        return crud.update_semester_plugin_system_setup(db, semester_id, plugin_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.post("/plugin-system/semesters/{semester_id}/review", response_model=schemas.PluginSystemReviewResponse)
def review_semester_plugin_system(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    draft = get_owned_semester(db, current_user, semester_id)
    if draft.lifecycle_state != "draft":
        raise HTTPException(
            status_code=409,
            detail=error_detail("SEMESTER_NOT_DRAFT", "Only draft Semesters can be reviewed."),
        )
    try:
        return crud.review_semester_plugin_system(db, semester_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.delete("/semesters/{semester_id}/draft")
def discard_current_semester_draft(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        draft = crud.discard_semester_draft(db, semester_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)
    if draft is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return {"ok": True}


async def create_courses_from_ics(*args, **kwargs):
    _sync_academics_compat_globals()
    return await academics_api.create_courses_from_ics(*args, **kwargs)


async def upload_course_resources(*args, **kwargs):
    _sync_academics_compat_globals()
    return await academics_api.upload_course_resources(*args, **kwargs)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Academic Tracker API"}
