# input:  [FastAPI framework, domain route modules, backend schemas/models/crud/utils/auth/lms/resource services, runtime payload helpers, env-backed runtime settings, widget delete query flags, and backend schema compatibility checks]
# output: [FastAPI app instance, router registration, production-safe docs configuration, startup schema guard, remaining Program/Semester/Course route handlers, Program/Semester/unassigned-Course plugin-governance APIs, plugin-system + draft wizard routes, guarded runtime-tab setting routes, legacy semester-tab normalization reads, and Canvas module-file metadata/download routes]
# pos:    [Backend entry point that boots the FastAPI app, wires middleware and modular routers, disables public docs in production, fails fast on schema drift, and keeps the remaining program/semester/course orchestration endpoints plus Program governance, explicit plugin-system setup APIs, Semester draft wizard persistence, unassigned-Course plugin activation APIs, route-level runtime tab mutations delegated to shared payload helpers, legacy Semester/Course tab normalization on read, and course LMS navigation, announcement, assignment, grade, module-summary, module-item, page, quiz, syllabus, and file proxy/download reads]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from fastapi import Body, FastAPI, Depends, HTTPException, Form, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from datetime import UTC, date, datetime, timedelta
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv

import models
import schemas
from api_auth import export_user_data, import_user_data, router as auth_router
from api_common import (
    build_course_resource_list_response,
    error_detail,
    get_owned_course,
    get_owned_semester,
    raise_gradebook_http_error,
    raise_lms_http_error,
    raise_todo_http_error,
    resolve_semester_date_bounds,
    validate_reading_week_or_422,
)
from api_course_schedule import router as course_schedule_router
from api_layout import router as layout_router
import crud
import gradebook
import todo
import course_resources
import auth
import lms_service
from database import assert_runtime_schema_compatible, engine, get_db
import runtime_payloads
from schedule_support import import_course_schedule_from_ics

BASE_DIR = Path(__file__).parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load .env only for local development. Production should use platform env vars.
if ENVIRONMENT == "development":
    env_local_path = BASE_DIR / ".env"
    if env_local_path.exists():
        load_dotenv(env_local_path)

models.Base.metadata.create_all(bind=engine)
assert_runtime_schema_compatible(engine)

from fastapi import UploadFile, File
import utils

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

# CORS configuration
origins = auth.get_allowed_browser_origins()
_configure_middlewares(app)

app.include_router(auth_router)
app.include_router(course_schedule_router)
app.include_router(layout_router)


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


# --- Programs ---
@app.post("/programs/", response_model=schemas.Program)
def create_program(program: schemas.ProgramCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
def read_programs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_programs(db, user_id=current_user.id, skip=skip, limit=limit)

@app.get("/programs/{program_id}", response_model=schemas.ProgramWithSemesters)
def read_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id)


@app.put("/programs/{program_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_program_tab_setting(
    program_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    row = crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=settings_key, settings=tab_setting.settings),
        program_id=program.id,
    )
    return runtime_payloads.serialize_tab_setting_payload(db, row, program_id=program.id)

@app.put("/programs/{program_id}", response_model=schemas.Program)
def update_program(program_id: str, program: schemas.ProgramUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
def delete_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.get_program_plugin_catalog(db, program_id)


@app.get("/programs/{program_id}/plugins/installations", response_model=list[schemas.ProgramPluginInstallation])
def read_program_plugin_installations(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.get_program_plugin_installations(db, program_id)


@app.put("/programs/{program_id}/plugins/{plugin_id}", response_model=schemas.ProgramPluginInstallation)
def upsert_program_plugin_installation(
    program_id: str,
    plugin_id: str,
    payload: schemas.ProgramPluginInstallationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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


@app.get("/programs/{program_id}/lms/courses", response_model=schemas.LmsCourseListResponse)
def list_program_lms_courses(
    program_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    workflow_state: Optional[str] = Query(default=None),
    enrollment_state: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_program_courses(
            db,
            current_user.id,
            program_id,
            page=page,
            page_size=page_size,
            workflow_state=workflow_state,
            enrollment_state=enrollment_state,
        )
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/programs/{program_id}/lms/courses/import", response_model=schemas.LmsCourseImportResponse)
def import_program_lms_courses(
    program_id: str,
    payload: schemas.LmsCourseImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.import_program_courses(db, current_user.id, program_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/programs/{program_id}/lms/semesters/import", response_model=schemas.LmsSemesterImportResponse)
def import_program_lms_semester(
    program_id: str,
    payload: schemas.LmsSemesterImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        semester, import_response = lms_service.import_semester_with_courses(db, current_user.id, program_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)
    return {
        "semester": semester,
        "courses": import_response,
    }

# --- Semesters ---
@app.post("/programs/{program_id}/semesters/", response_model=schemas.Semester)
def create_semester_for_program(
    program_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    resolved_start_date, resolved_end_date = resolve_semester_date_bounds(semester.start_date, semester.end_date)
    if resolved_start_date > resolved_end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    validate_reading_week_or_422(
        resolved_start_date,
        resolved_end_date,
        semester.reading_week_start,
        semester.reading_week_end,
    )
    return crud.create_semester(db=db, semester=semester, program_id=program_id)

@app.post("/programs/{program_id}/semesters/upload", response_model=schemas.Semester)
async def create_semester_from_ics(
    program_id: str, 
    file: UploadFile = File(...), 
    name: str = Form(None), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = parsed_schedule.get("courses", [])
    
    if not name:
        name = file.filename.replace(".ics", "")

    start_date = parsed_schedule.get("semesterStartDate") or datetime.now(UTC).date()
    end_date = parsed_schedule.get("semesterEndDate") or (start_date + timedelta(days=111))
    if end_date < start_date:
        end_date = start_date

    semester_create = schemas.SemesterCreate(name=name, start_date=start_date, end_date=end_date)
    try:
        semester = crud.create_semester(
            db=db,
            semester=semester_create,
            program_id=program_id,
            commit=False,
        )

        # Create courses and import structured schedule data from ICS.
        user_setting = crud.get_user_setting_dict(current_user)
        default_course_credit = float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
        if not parsed_courses:
            parsed_courses = [{"name": course_name, "category": utils.extract_category(course_name), "meetings": []} for course_name in utils.parse_ics(content)]

        for parsed_course in parsed_courses:
            course_name = str(parsed_course.get("name", "")).strip()
            if not course_name:
                continue
            category = parsed_course.get("category") or utils.extract_category(course_name)
            course_create = schemas.CourseCreate(name=course_name, credits=default_course_credit, category=category)
            created_course = crud.create_course(
                db=db,
                course=course_create,
                program_id=program_id,
                semester_id=semester.id,
                commit=False,
            )

            meetings = parsed_course.get("meetings", [])
            if not isinstance(meetings, list) or len(meetings) == 0:
                continue

            import_course_schedule_from_ics(db, created_course, meetings)

        db.commit()
        db.refresh(semester)
    except Exception:
        db.rollback()
        raise

    return semester

@app.post("/programs/{program_id}/courses/upload", response_model=list[schemas.Course])
async def create_courses_from_ics(
    program_id: str,
    file: UploadFile = File(...),
    semester_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    target_semester_id: str | None = None
    if semester_id:
        semester = db.query(models.Semester).join(models.Program).filter(
            models.Semester.id == semester_id,
            models.Semester.program_id == program_id,
            models.Program.owner_id == current_user.id,
        ).first()
        if semester is None:
            raise HTTPException(status_code=404, detail="Semester not found")
        target_semester_id = semester.id

    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = parsed_schedule.get("courses", [])

    user_setting = crud.get_user_setting_dict(current_user)
    default_course_credit = float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
    if not parsed_courses:
        parsed_courses = [{"name": course_name, "category": utils.extract_category(course_name), "meetings": []} for course_name in utils.parse_ics(content)]

    created_courses: list[models.Course] = []
    try:
        for parsed_course in parsed_courses:
            course_name = str(parsed_course.get("name", "")).strip()
            if not course_name:
                continue

            category = parsed_course.get("category") or utils.extract_category(course_name)
            course_create = schemas.CourseCreate(name=course_name, credits=default_course_credit, category=category)
            created_course = crud.create_course(
                db=db,
                course=course_create,
                program_id=program_id,
                semester_id=target_semester_id,
                commit=False,
            )
            created_courses.append(created_course)

            meetings = parsed_course.get("meetings", [])
            if not isinstance(meetings, list) or len(meetings) == 0:
                continue

            import_course_schedule_from_ics(db, created_course, meetings)

        db.commit()
        for course in created_courses:
            db.refresh(course)
    except Exception:
        db.rollback()
        raise

    return created_courses

@app.get("/semesters/{semester_id}", response_model=schemas.SemesterWithDetails)
def read_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Need to verify ownership via program -> user
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    crud.ensure_semester_tabs_normalized(db, semester)
    runtime_payload = runtime_payloads.build_semester_runtime_payload(db, semester)
    program = semester.program
    program_summary = {
        "id": program.id,
        "name": program.name,
        "cgpa_scaled": program.cgpa_scaled or 0,
        "cgpa_percentage": program.cgpa_percentage or 0,
        "grad_requirement_credits": program.grad_requirement_credits or 0,
        "subject_color_map": program.subject_color_map,
        "lms_integration_id": program.lms_integration_id,
        "tab_settings": runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id),
    } if program is not None else None
    return {
        "id": semester.id,
        "name": semester.name,
        "average_percentage": semester.average_percentage,
        "average_scaled": semester.average_scaled,
        "start_date": semester.start_date,
        "end_date": semester.end_date,
        "reading_week_start": semester.reading_week_start,
        "reading_week_end": semester.reading_week_end,
        "program_id": semester.program_id,
        "lifecycle_state": semester.lifecycle_state,
        "creation_step": semester.creation_step,
        "draft_updated_at": semester.draft_updated_at,
        "review_ready": semester.review_ready,
        "courses": semester.courses,
        "widgets": semester.widgets,
        "tabs": semester.tabs,
        "program": program_summary,
        **runtime_payload,
    }


@app.get("/semesters/{semester_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_semester_lms_assignments(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_semester_assignments(db, current_user.id, semester_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/semesters/{semester_id}/lms/calendar-events", response_model=schemas.LmsCalendarEventListResponse)
def read_semester_lms_calendar_events(
    semester_id: str,
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_semester_calendar_events(
            db,
            current_user.id,
            semester_id,
            start_date=start,
            end_date=end,
        )
    except Exception as exc:
        raise_lms_http_error(exc)

@app.get("/semesters/{semester_id}/tab-settings", response_model=list[schemas.TabSetting])
def read_semester_tab_settings(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    return runtime_payloads.serialize_tab_settings_payloads(db, program_id=semester.program_id, semester_id=semester_id)


@app.get("/semesters/{semester_id}/plugin-activations", response_model=list[schemas.SemesterPluginActivation])
def read_semester_plugin_activations(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    return crud.get_semester_plugin_activations(db, semester_id)


@app.put("/semesters/{semester_id}/plugin-activations/{plugin_id}", response_model=schemas.SemesterPluginActivation)
def upsert_semester_plugin_activation(
    semester_id: str,
    plugin_id: str,
    payload: schemas.SemesterPluginActivationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        return crud.upsert_semester_plugin_activation(db, semester_id, plugin_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.put("/semesters/{semester_id}/plugin-activations:bulk", response_model=schemas.SemesterDraft)
def bulk_update_semester_plugin_activations(
    semester_id: str,
    payload: schemas.SemesterPluginActivationBulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        return crud.bulk_update_semester_plugin_activations(db, semester_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.delete("/semesters/{semester_id}/plugin-activations/{plugin_id}")
def delete_semester_plugin_activation(
    semester_id: str,
    plugin_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        activation = crud.delete_semester_plugin_activation(db, semester_id, plugin_id)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)
    if activation is None:
        raise HTTPException(status_code=404, detail=error_detail("PLUGIN_NOT_ENABLED", "Plugin is not enabled for this Semester."))
    return {"ok": True}

@app.put("/semesters/{semester_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_semester_tab_setting(
    semester_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    row = crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=settings_key, settings=tab_setting.settings),
        semester_id=semester_id,
    )
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return runtime_payloads.serialize_tab_setting_payload(
        db,
        row,
        program_id=semester.program_id,
        semester_id=semester_id,
    )


@app.post("/semesters/{semester_id}/runtime-tabs", response_model=list[schemas.RuntimeTabDefinition])
def add_semester_runtime_tab(
    semester_id: str,
    payload: schemas.RuntimeTabSelectionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    crud.add_workspace_tab_selection(
        db,
        crud.SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
        payload.tab_type,
        semester_id=semester.id,
    )
    return runtime_payloads.build_semester_runtime_payload(db, semester)["runtime_tabs"]


@app.delete("/semesters/{semester_id}/runtime-tabs/{tab_type}", response_model=list[schemas.RuntimeTabDefinition])
def delete_semester_runtime_tab(
    semester_id: str,
    tab_type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    crud.remove_workspace_tab_selection(
        db,
        crud.SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
        tab_type,
        semester_id=semester.id,
    )
    return runtime_payloads.build_semester_runtime_payload(db, semester)["runtime_tabs"]


@app.put("/semesters/{semester_id}/runtime-tabs/order", response_model=list[schemas.RuntimeTabDefinition])
def reorder_semester_runtime_tabs(
    semester_id: str,
    payload: schemas.RuntimeTabOrderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    crud.set_workspace_tab_order(
        db,
        crud.SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
        payload.tab_types,
        semester_id=semester.id,
    )
    return runtime_payloads.build_semester_runtime_payload(db, semester)["runtime_tabs"]


@app.put("/semesters/{semester_id}/runtime-tabs/{tab_type}/settings", response_model=schemas.RuntimeTabDefinition)
def update_semester_runtime_tab_settings(
    semester_id: str,
    tab_type: str,
    payload: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    runtime_payload = runtime_payloads.build_semester_runtime_payload(db, semester)
    runtime_tab = runtime_payloads.find_runtime_tab(runtime_payload, tab_type)
    if runtime_tab is None:
        raise HTTPException(status_code=404, detail="Runtime tab not found")
    crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=tab_type, settings=payload.settings),
        semester_id=semester.id,
    )
    updated_runtime_payload = runtime_payloads.build_semester_runtime_payload(db, semester)
    updated_runtime_tab = runtime_payloads.find_runtime_tab(updated_runtime_payload, tab_type)
    if updated_runtime_tab is None:
        raise HTTPException(status_code=404, detail="Runtime tab not found")
    return updated_runtime_tab

@app.put("/semesters/{semester_id}", response_model=schemas.Semester)
def update_semester(semester_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    resolved_start_date, resolved_end_date = resolve_semester_date_bounds(
        semester.start_date or db_semester.start_date,
        semester.end_date or db_semester.end_date,
    )
    if resolved_start_date > resolved_end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    validate_reading_week_or_422(
        resolved_start_date,
        resolved_end_date,
        semester.reading_week_start,
        semester.reading_week_end,
    )
    return crud.update_semester(db, semester_id=semester_id, semester_update=semester)

@app.delete("/semesters/{semester_id}")
def delete_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    crud.delete_semester(db, semester_id=semester_id)
    return {"ok": True}

@app.get("/semesters/{semester_id}/todo", response_model=schemas.TodoSemesterState)
def read_semester_todo(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.get_semester_state(db, semester)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.post("/semesters/{semester_id}/todo/sections", response_model=schemas.TodoSemesterState)
def create_semester_todo_section(
    semester_id: str,
    payload: schemas.TodoSectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.create_section(db, semester, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.patch("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
def update_semester_todo_section(
    semester_id: str,
    section_id: str,
    payload: schemas.TodoSectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.update_section(db, semester, section_id, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
def delete_semester_todo_section(
    semester_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.delete_section(db, semester, section_id)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.post("/semesters/{semester_id}/todo/tasks", response_model=schemas.TodoSemesterState)
def create_semester_todo_task(
    semester_id: str,
    payload: schemas.TodoTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.create_task(db, semester, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.patch("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
def update_semester_todo_task(
    semester_id: str,
    task_id: str,
    payload: schemas.TodoTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.update_task(db, semester, task_id, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
def delete_semester_todo_task(
    semester_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.delete_task(db, semester, task_id)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/tasks/completed", response_model=schemas.TodoSemesterState)
def clear_completed_semester_todo_tasks(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.clear_completed_tasks(db, semester)
    except Exception as exc:
        raise_todo_http_error(exc)

# --- Courses ---
@app.post("/semesters/{semester_id}/courses/", response_model=schemas.Course)
def create_course_for_semester(
    semester_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify semester ownership
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_course(db=db, course=course, program_id=semester.program_id, semester_id=semester_id)

@app.post("/programs/{program_id}/courses/", response_model=schemas.Course)
def create_course_for_program(
    program_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.create_course(db=db, course=course, program_id=program_id, semester_id=None)

@app.get("/programs/{program_id}/courses/", response_model=list[schemas.Course])
def read_courses_for_program(
    program_id: str, 
    semester_id: str = None, 
    unassigned: bool = False, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.get_courses(db, program_id=program_id, semester_id=semester_id, unassigned=unassigned)

@app.get("/courses/{course_id}", response_model=schemas.CourseWithWidgets)
def read_course(course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership via program -> user
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    crud.ensure_course_tabs_normalized(db, db_course)
    runtime_payload = runtime_payloads.build_course_runtime_payload(db, db_course)
    program = db_course.program
    program_summary = {
        "id": program.id,
        "name": program.name,
        "cgpa_scaled": program.cgpa_scaled or 0,
        "cgpa_percentage": program.cgpa_percentage or 0,
        "grad_requirement_credits": program.grad_requirement_credits or 0,
        "subject_color_map": program.subject_color_map,
        "lms_integration_id": program.lms_integration_id,
        "tab_settings": runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id),
    } if program is not None else None
    return {
        "id": db_course.id,
        "name": db_course.name,
        "alias": db_course.alias,
        "category": db_course.category,
        "color": db_course.color,
        "credits": db_course.credits,
        "grade_scaled": db_course.grade_scaled,
        "grade_percentage": db_course.grade_percentage,
        "program_id": db_course.program_id,
        "semester_id": db_course.semester_id,
        "include_in_gpa": db_course.include_in_gpa,
        "hide_gpa": db_course.hide_gpa,
        "has_gradebook": db_course.has_gradebook,
        "gradebook_revision": db_course.gradebook_revision,
        "has_lms_link": db_course.has_lms_link,
        "lms_link": db_course.lms_link,
        "widgets": db_course.widgets,
        "tabs": db_course.tabs,
        "program": program_summary,
        **runtime_payload,
    }


@app.get("/courses/{course_id}/plugin-activations", response_model=list[schemas.CoursePluginActivation])
def read_course_plugin_activations(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.get_course_plugin_activations(db, course_id)


@app.put("/courses/{course_id}/plugin-activations/{plugin_id}", response_model=schemas.CoursePluginActivation)
def upsert_course_plugin_activation(
    course_id: str,
    plugin_id: str,
    payload: schemas.CoursePluginActivationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    try:
        return crud.upsert_course_plugin_activation(db, course_id, plugin_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.put("/courses/{course_id}/plugin-activations:bulk", response_model=list[schemas.CoursePluginActivation])
def bulk_update_course_plugin_activations(
    course_id: str,
    payload: schemas.CoursePluginActivationBulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    try:
        return crud.bulk_update_course_plugin_activations(db, course_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@app.get("/courses/{course_id}/lms-link", response_model=Optional[schemas.LmsCourseLinkSummary])
def read_course_lms_link(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_link(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.put("/courses/{course_id}/lms-link", response_model=schemas.LmsCourseLinkSummary)
def upsert_course_lms_link(
    course_id: str,
    payload: schemas.LmsCourseLinkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.upsert_course_link(db, current_user.id, course_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/courses/{course_id}/lms-link/sync", response_model=schemas.LmsCourseLinkSummary)
def sync_course_lms_link(
    course_id: str,
    payload: Optional[schemas.LmsCourseLinkSyncRequest] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.sync_course_link(db, current_user.id, course_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.delete("/courses/{course_id}/lms-link", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_lms_link(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        lms_service.delete_course_link(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/courses/{course_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_course_lms_assignments(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_assignments(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/grades", response_model=schemas.LmsGradeListResponse)
def read_course_lms_grades(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_grades(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/navigation", response_model=schemas.LmsCourseNavigationResponse)
def read_course_lms_navigation(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_navigation(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/announcements", response_model=schemas.LmsAnnouncementListResponse)
def read_course_lms_announcements(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_announcements(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/modules", response_model=schemas.LmsModuleListResponse)
def read_course_lms_modules(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_modules(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/modules/{module_id}/items", response_model=schemas.LmsModuleItemListResponse)
def read_course_lms_module_items(
    course_id: str,
    module_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_module_items(db, current_user.id, course_id, module_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/modules/{module_id}/items/{module_item_id}/file", response_model=schemas.LmsModuleFile)
def read_course_lms_module_item_file(
    course_id: str,
    module_id: str,
    module_item_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_module_file(db, current_user.id, course_id, module_id, module_item_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/modules/{module_id}/items/{module_item_id}/file/download")
def download_course_lms_module_item_file(
    course_id: str,
    module_id: str,
    module_item_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        file_metadata, content = lms_service.open_course_module_file(db, current_user.id, course_id, module_id, module_item_id)
        safe_filename = file_metadata.display_name.replace("\n", " ").replace("\r", " ").replace('"', "'")
        return StreamingResponse(
            content,
            media_type=file_metadata.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'inline; filename="{safe_filename}"',
            },
        )
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/quizzes", response_model=schemas.LmsQuizListResponse)
def read_course_lms_quizzes(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_quizzes(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/pages", response_model=schemas.LmsPageListResponse)
def read_course_lms_pages(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_pages(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/pages/{page_ref}", response_model=schemas.LmsPageDetail)
def read_course_lms_page(
    course_id: str,
    page_ref: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_page(db, current_user.id, course_id, page_ref)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/syllabus", response_model=schemas.LmsCourseSyllabusResponse)
def read_course_lms_syllabus(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_syllabus(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/tab-settings", response_model=list[schemas.TabSetting])
def read_course_tab_settings(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    return runtime_payloads.serialize_tab_settings_payloads(
        db,
        program_id=course.program_id,
        semester_id=course.semester_id,
        course_id=course_id,
    )

@app.put("/courses/{course_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_course_tab_setting(
    course_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    row = crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=settings_key, settings=tab_setting.settings),
        course_id=course.id,
    )
    return runtime_payloads.serialize_tab_setting_payload(
        db,
        row,
        program_id=course.program_id,
        semester_id=course.semester_id,
        course_id=course.id,
    )


@app.post("/courses/{course_id}/runtime-tabs", response_model=list[schemas.RuntimeTabDefinition])
def add_course_runtime_tab(
    course_id: str,
    payload: schemas.RuntimeTabSelectionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    bucket_type, bucket_context = crud.get_tab_order_bucket_for_course(course)
    crud.add_workspace_tab_selection(
        db,
        bucket_type,
        payload.tab_type,
        semester_id=bucket_context.get("semester_id"),
        course_id=bucket_context.get("course_id"),
    )
    return runtime_payloads.build_course_runtime_payload(db, course)["runtime_tabs"]


@app.delete("/courses/{course_id}/runtime-tabs/{tab_type}", response_model=list[schemas.RuntimeTabDefinition])
def delete_course_runtime_tab(
    course_id: str,
    tab_type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    bucket_type, bucket_context = crud.get_tab_order_bucket_for_course(course)
    crud.remove_workspace_tab_selection(
        db,
        bucket_type,
        tab_type,
        semester_id=bucket_context.get("semester_id"),
        course_id=bucket_context.get("course_id"),
    )
    return runtime_payloads.build_course_runtime_payload(db, course)["runtime_tabs"]


@app.put("/courses/{course_id}/runtime-tabs/order", response_model=list[schemas.RuntimeTabDefinition])
def reorder_course_runtime_tabs(
    course_id: str,
    payload: schemas.RuntimeTabOrderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    bucket_type, bucket_context = crud.get_tab_order_bucket_for_course(course)
    crud.set_workspace_tab_order(
        db,
        bucket_type,
        payload.tab_types,
        semester_id=bucket_context.get("semester_id"),
        course_id=bucket_context.get("course_id"),
    )
    return runtime_payloads.build_course_runtime_payload(db, course)["runtime_tabs"]


@app.put("/courses/{course_id}/runtime-tabs/{tab_type}/settings", response_model=schemas.RuntimeTabDefinition)
def update_course_runtime_tab_settings(
    course_id: str,
    tab_type: str,
    payload: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    runtime_payload = runtime_payloads.build_course_runtime_payload(db, course)
    runtime_tab = runtime_payloads.find_runtime_tab(runtime_payload, tab_type)
    if runtime_tab is None:
        raise HTTPException(status_code=404, detail="Runtime tab not found")
    crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=tab_type, settings=payload.settings),
        course_id=course.id,
    )
    updated_runtime_payload = runtime_payloads.build_course_runtime_payload(db, course)
    updated_runtime_tab = runtime_payloads.find_runtime_tab(updated_runtime_payload, tab_type)
    if updated_runtime_tab is None:
        raise HTTPException(status_code=404, detail="Runtime tab not found")
    return updated_runtime_tab

@app.get("/courses/{course_id}/resources", response_model=schemas.CourseResourceListResponse)
def read_course_resources(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return build_course_resource_list_response(db, current_user, course_id)

@app.post("/courses/{course_id}/resources/upload", response_model=schemas.CourseResourceUploadResponse)
async def upload_course_resources(
    course_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    quota = course_resources.get_user_quota_snapshot(db, current_user.id)
    max_upload_bytes = course_resources.get_max_upload_bytes()
    running_total = quota.total_bytes_used
    uploaded_files: list[models.CourseResourceFile] = []
    failed_files: list[schemas.CourseResourceUploadFailure] = []

    for file in files:
        filename = (file.filename or "").strip() or "untitled"
        try:
            course_resources.validate_upload_filename(filename)
            content = await course_resources.read_upload_content(file, max_bytes=max_upload_bytes)
            projected_total = running_total + len(content)
            if projected_total > quota.total_bytes_limit:
                failed_files.append(schemas.CourseResourceUploadFailure(
                    filename=filename,
                    code="ACCOUNT_STORAGE_LIMIT_EXCEEDED",
                    message="Uploading this file would exceed the 50MB account resource limit.",
                ))
                continue

            uploaded = course_resources.create_course_resource(
                db,
                base_dir=BASE_DIR,
                user_id=current_user.id,
                course_id=course_id,
                filename_original=filename,
                filename_display=filename,
                mime_type=file.content_type,
                content=content,
            )
            uploaded_files.append(uploaded)
            running_total += uploaded.size_bytes
        except course_resources.CourseResourceFileTooLargeError as error:
            failed_files.append(schemas.CourseResourceUploadFailure(
                filename=filename,
                code="FILE_TOO_LARGE",
                message=str(error),
            ))
        except course_resources.CourseResourceStorageError as error:
            failed_files.append(schemas.CourseResourceUploadFailure(
                filename=filename,
                code="INVALID_FILE_NAME",
                message=str(error),
            ))
        except Exception as error:
            print(f"Failed to upload course resource '{filename}': {error}")
            failed_files.append(schemas.CourseResourceUploadFailure(
                filename=filename,
                code="UPLOAD_FAILED",
                message="Failed to store this file.",
            ))

    return schemas.CourseResourceUploadResponse(
        uploaded_files=uploaded_files,
        failed_files=failed_files,
        total_bytes_used=running_total,
        total_bytes_limit=quota.total_bytes_limit,
        remaining_bytes=max(0, quota.total_bytes_limit - running_total),
    )

@app.post("/courses/{course_id}/resources/links", response_model=schemas.CourseResourceFile)
def create_course_resource_link(
    course_id: str,
    payload: schemas.CourseResourceLinkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return course_resources.create_external_course_resource(
        db,
        course_id=course_id,
        external_url=payload.url,
        filename_display=payload.filename_display,
    )

@app.patch("/courses/{course_id}/resources/{resource_id}", response_model=schemas.CourseResourceFile)
def rename_course_resource(
    course_id: str,
    resource_id: str,
    payload: schemas.CourseResourceRenameRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    try:
        return course_resources.rename_course_resource(db, resource, payload.filename_display)
    except course_resources.CourseResourceStorageError as error:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_RESOURCE_FILENAME", str(error)),
        ) from error

@app.delete("/courses/{course_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_resource(
    course_id: str,
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    course_resources.delete_course_resource(db, base_dir=BASE_DIR, resource=resource)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/courses/{course_id}/resources/{resource_id}/download")
def download_course_resource(
    course_id: str,
    resource_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    if resource.resource_kind == "link" and resource.external_url:
        return Response(status_code=status.HTTP_302_FOUND, headers={"Location": resource.external_url})
    absolute_path = course_resources.resolve_absolute_path(BASE_DIR, resource)
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(
        path=absolute_path,
        media_type=resource.mime_type,
        filename=resource.filename_display,
        content_disposition_type=(
            "attachment"
            if download
            else ("inline" if course_resources.should_open_inline(resource.mime_type) else "attachment")
        ),
    )

@app.put("/courses/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: str, course: schemas.CourseUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership (via program -> user)
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    try:
        return crud.update_course(db=db, course_id=course_id, course_update=course)
    except crud.CourseSemesterAssignmentError as exc:
        if str(exc) == "SEMESTER_NOT_FOUND":
            raise HTTPException(status_code=404, detail=error_detail("SEMESTER_NOT_FOUND", "Semester not found."))
        raise HTTPException(
            status_code=422,
            detail=error_detail("SEMESTER_PROGRAM_MISMATCH", "Semester does not belong to this course's Program."),
        )

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    crud.delete_course(db, course_id)
    return {"ok": True}


@app.get("/courses/{course_id}/gradebook", response_model=schemas.CourseGradebook)
def read_course_gradebook(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.get_course_gradebook_payload(db, course.id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/preferences", response_model=schemas.CourseGradebook)
def update_course_gradebook_preferences(
    course_id: str,
    payload: schemas.GradebookPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_preferences(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.post("/courses/{course_id}/gradebook/categories", response_model=schemas.CourseGradebook)
def create_course_gradebook_category(
    course_id: str,
    payload: schemas.GradebookCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.create_category(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
def update_course_gradebook_category(
    course_id: str,
    category_id: str,
    payload: schemas.GradebookCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_category(db, course.id, category_id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.delete("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
def delete_course_gradebook_category(
    course_id: str,
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.delete_category(db, course.id, category_id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.post("/courses/{course_id}/gradebook/assessments", response_model=schemas.CourseGradebook)
def create_course_gradebook_assessment(
    course_id: str,
    payload: schemas.GradebookAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.create_assessment(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
def update_course_gradebook_assessment(
    course_id: str,
    assessment_id: str,
    payload: schemas.GradebookAssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_assessment(db, course.id, assessment_id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.delete("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
def delete_course_gradebook_assessment(
    course_id: str,
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.delete_assessment(db, course.id, assessment_id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.put("/courses/{course_id}/gradebook/assessments/reorder", response_model=schemas.CourseGradebook)
def reorder_course_gradebook_assessments(
    course_id: str,
    payload: schemas.GradebookAssessmentReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.reorder_assessments(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.get("/")
def read_root():
    return {"message": "Semestra API Running"}
