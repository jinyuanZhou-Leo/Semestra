# input:  [FastAPI router/dependencies, backend academic CRUD/domain services, LMS/resource helpers, and shared ownership validators]
# output: [semester and course route handlers for LMS course import/browse, ICS course upload, runtime payload reads, todo, resources, and gradebook operations]
# pos:    [backend API router for academic entities outside widget/layout routing, including semester/course reads and mutation flows, LMS-linked reads, resource uploads, and gradebook CRUD]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import date
import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

import auth
from api_common import (
    build_course_resource_list_response,
    build_semester_resource_list_response,
    error_detail,
    get_owned_course,
    get_owned_program,
    get_owned_semester,
    raise_gradebook_http_error,
    raise_lms_http_error,
    raise_todo_http_error,
    resolve_semester_date_bounds,
    validate_reading_week_or_422,
)
import course_resources
import crud
from database import get_db
import gradebook
import lms_service
import models
import runtime_payloads
from schedule_support import import_course_schedule_from_ics
import schemas
import todo
import utils

router = APIRouter()
BASE_DIR = Path(__file__).parent
logger = logging.getLogger(__name__)


def _get_default_course_credit(current_user: models.User) -> float:
    user_setting = crud.get_user_setting_dict(current_user)
    return float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))


def _build_program_summary_payload(db: Session, program: models.Program | None) -> dict | None:
    if program is None:
        return None
    return {
        "id": program.id,
        "name": program.name,
        "cgpa_scaled": program.cgpa_scaled or 0,
        "cgpa_percentage": program.cgpa_percentage or 0,
        "grad_requirement_credits": program.grad_requirement_credits or 0,
        "subject_color_map": program.subject_color_map,
        "lms_integration_id": program.lms_integration_id,
        "tab_settings": runtime_payloads.serialize_tab_settings_payloads(db, program_id=program.id),
    }


def _serialize_semester_detail_payload(db: Session, semester: models.Semester) -> dict:
    crud.ensure_semester_tabs_normalized(db, semester)
    runtime_payload = runtime_payloads.build_semester_runtime_payload(db, semester)
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
        "program": _build_program_summary_payload(db, semester.program),
        **runtime_payload,
    }


def _serialize_course_detail_payload(db: Session, course: models.Course) -> dict:
    crud.ensure_course_tabs_normalized(db, course)
    runtime_payload = runtime_payloads.build_course_runtime_payload(db, course)
    return {
        "id": course.id,
        "name": course.name,
        "alias": course.alias,
        "category": course.category,
        "color": course.color,
        "credits": course.credits,
        "grade_scaled": course.grade_scaled,
        "grade_percentage": course.grade_percentage,
        "program_id": course.program_id,
        "semester_id": course.semester_id,
        "include_in_gpa": course.include_in_gpa,
        "hide_gpa": course.hide_gpa,
        "has_gradebook": course.has_gradebook,
        "gradebook_revision": course.gradebook_revision,
        "has_lms_link": course.has_lms_link,
        "lms_link": course.lms_link,
        "widgets": course.widgets,
        "tabs": course.tabs,
        "program": _build_program_summary_payload(db, course.program),
        **runtime_payload,
    }


def _require_runtime_tab_setting_target(
    runtime_tabs: list[dict[str, Any]] | list[schemas.RuntimeTabDefinition],
    settings_key: str,
) -> None:
    if any(getattr(tab, "tab_type", tab.get("tab_type")) == settings_key for tab in runtime_tabs):
        return
    raise HTTPException(status_code=404, detail="Tab not found")


def _parse_ics_course_payloads(content: bytes, parsed_schedule: dict) -> list[dict]:
    parsed_courses = parsed_schedule.get("courses", [])
    if parsed_courses:
        return parsed_courses
    return [
        {"name": course_name, "category": utils.extract_category(course_name), "meetings": []}
        for course_name in utils.parse_ics(content)
    ]


def _import_courses_from_ics_payloads(
    db: Session,
    *,
    program_id: str,
    semester_id: str | None,
    parsed_courses: list[dict],
    default_course_credit: float,
) -> list[models.Course]:
    created_courses: list[models.Course] = []
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
            semester_id=semester_id,
            commit=False,
        )
        created_courses.append(created_course)

        meetings = parsed_course.get("meetings", [])
        if isinstance(meetings, list) and meetings:
            import_course_schedule_from_ics(db, created_course, meetings)
    return created_courses


async def _read_ics_import_context(file: UploadFile) -> tuple[bytes, dict, list[dict]]:
    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = _parse_ics_course_payloads(content, parsed_schedule)
    return content, parsed_schedule, parsed_courses


async def _store_course_resource_uploads(
    db: Session,
    *,
    course_id: str,
    current_user: models.User,
    files: list[UploadFile],
) -> schemas.CourseResourceUploadResponse:
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
            logger.warning("Failed to upload course resource '%s': %s", filename, error)
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


@router.get("/programs/{program_id}/lms/courses", response_model=schemas.LmsCourseListResponse)
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


@router.post("/programs/{program_id}/lms/courses/import", response_model=schemas.LmsCourseImportResponse)
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


@router.post("/programs/{program_id}/semesters/", response_model=schemas.Semester)
def create_semester_for_program(
    program_id: str,
    semester: schemas.SemesterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
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


@router.post("/programs/{program_id}/courses/upload", response_model=list[schemas.Course])
async def create_courses_from_ics(
    program_id: str,
    file: UploadFile = File(...),
    semester_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)

    target_semester_id: str | None = None
    if semester_id:
        semester = get_owned_semester(db, current_user, semester_id)
        if semester.program_id != program_id:
            raise HTTPException(status_code=404, detail="Semester not found")
        target_semester_id = semester.id

    default_course_credit = _get_default_course_credit(current_user)
    _, _, parsed_courses = await _read_ics_import_context(file)

    try:
        created_courses = _import_courses_from_ics_payloads(
            db,
            program_id=program_id,
            semester_id=target_semester_id,
            parsed_courses=parsed_courses,
            default_course_credit=default_course_credit,
        )
        db.commit()
        for course in created_courses:
            db.refresh(course)
    except Exception:
        db.rollback()
        raise

    return created_courses


@router.get("/semesters/{semester_id}", response_model=schemas.SemesterWithDetails)
def read_semester(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    return _serialize_semester_detail_payload(db, semester)


@router.get("/semesters/{semester_id}/gradebook", response_model=schemas.SemesterGradebook)
def read_semester_gradebook(
    semester_id: str,
    due_start: Optional[date] = Query(default=None),
    due_end: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    try:
        return gradebook.get_semester_gradebook_payload(
            db,
            semester_id,
            due_start=due_start,
            due_end=due_end,
        )
    except Exception as exc:
        raise_gradebook_http_error(exc)


@router.get("/semesters/{semester_id}/resources", response_model=schemas.SemesterResourcesResponse)
def read_semester_resources(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    return build_semester_resource_list_response(db, current_user, semester_id)


@router.get("/semesters/{semester_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_semester_lms_assignments(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_semester_assignments(db, current_user.id, semester_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/semesters/{semester_id}/lms/calendar-events", response_model=schemas.LmsCalendarEventListResponse)
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


@router.get("/semesters/{semester_id}/tab-settings", response_model=list[schemas.TabSetting])
def read_semester_tab_settings(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    return runtime_payloads.serialize_tab_settings_payloads(db, program_id=semester.program_id, semester_id=semester_id)


@router.get("/semesters/{semester_id}/plugin-activations", response_model=list[schemas.SemesterPluginActivation])
def read_semester_plugin_activations(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    return crud.get_semester_plugin_activations(db, semester_id)


@router.put("/semesters/{semester_id}/plugin-activations/{plugin_id}", response_model=schemas.SemesterPluginActivation)
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


@router.put("/semesters/{semester_id}/plugin-activations:bulk", response_model=schemas.SemesterDraft)
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


@router.delete("/semesters/{semester_id}/plugin-activations/{plugin_id}")
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


@router.put("/semesters/{semester_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_semester_tab_setting(
    semester_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    semester_runtime_tabs = runtime_payloads.build_semester_runtime_payload(db, semester)["runtime_tabs"]
    _require_runtime_tab_setting_target(semester_runtime_tabs, settings_key)
    row = crud.upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=settings_key, settings=tab_setting.settings),
        semester_id=semester_id,
    )
    return runtime_payloads.serialize_tab_setting_payload(
        db,
        row,
        program_id=semester.program_id,
        semester_id=semester_id,
    )


@router.post("/semesters/{semester_id}/runtime-tabs", response_model=list[schemas.RuntimeTabDefinition])
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


@router.delete("/semesters/{semester_id}/runtime-tabs/{tab_type}", response_model=list[schemas.RuntimeTabDefinition])
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


@router.put("/semesters/{semester_id}/runtime-tabs/order", response_model=list[schemas.RuntimeTabDefinition])
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


@router.put("/semesters/{semester_id}")
def update_semester(
    semester_id: str,
    semester: schemas.SemesterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_semester = get_owned_semester(db, current_user, semester_id)
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
    updated_semester = crud.update_semester(db, semester_id=semester_id, semester_update=semester)
    return _serialize_semester_detail_payload(db, updated_semester)


@router.delete("/semesters/{semester_id}")
def delete_semester(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    crud.delete_semester(db, semester_id=semester_id)
    return {"ok": True}


@router.get("/semesters/{semester_id}/todo", response_model=schemas.TodoSemesterState)
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


@router.post("/semesters/{semester_id}/todo/sections", response_model=schemas.TodoSemesterState)
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


@router.patch("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
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


@router.delete("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
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


@router.post("/semesters/{semester_id}/todo/tasks", response_model=schemas.TodoSemesterState)
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


@router.patch("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
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


@router.delete("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
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


@router.delete("/semesters/{semester_id}/todo/tasks/completed", response_model=schemas.TodoSemesterState)
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


@router.post("/semesters/{semester_id}/courses/", response_model=schemas.Course)
def create_course_for_semester(
    semester_id: str,
    course: schemas.CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    return crud.create_course(db=db, course=course, program_id=semester.program_id, semester_id=semester_id)


@router.post("/programs/{program_id}/courses/", response_model=schemas.Course)
def create_course_for_program(
    program_id: str,
    course: schemas.CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    return crud.create_course(db=db, course=course, program_id=program_id, semester_id=None)


@router.get("/programs/{program_id}/courses/", response_model=list[schemas.Course])
def read_courses_for_program(
    program_id: str,
    semester_id: str = None,
    unassigned: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_program(db, current_user, program_id)
    return crud.get_courses(db, program_id=program_id, semester_id=semester_id, unassigned=unassigned)


@router.get("/courses/{course_id}", response_model=schemas.CourseWithWidgets)
def read_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_course = get_owned_course(db, current_user, course_id)
    return _serialize_course_detail_payload(db, db_course)


@router.get("/courses/{course_id}/plugin-activations", response_model=list[schemas.CoursePluginActivation])
def read_course_plugin_activations(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return crud.get_course_plugin_activations(db, course_id)


@router.put("/courses/{course_id}/plugin-activations/{plugin_id}", response_model=schemas.CoursePluginActivation)
def upsert_course_plugin_activation(
    course_id: str,
    plugin_id: str,
    payload: schemas.CoursePluginActivationUpsertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    try:
        return crud.upsert_course_plugin_activation(db, course_id, plugin_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@router.put("/courses/{course_id}/plugin-activations:bulk", response_model=list[schemas.CoursePluginActivation])
def bulk_update_course_plugin_activations(
    course_id: str,
    payload: schemas.CoursePluginActivationBulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    try:
        return crud.bulk_update_course_plugin_activations(db, course_id, payload)
    except crud.PluginRegistryError as exc:
        _raise_plugin_registry_http_error(exc)


@router.get("/courses/{course_id}/lms-link", response_model=Optional[schemas.LmsCourseLinkSummary])
def read_course_lms_link(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_link(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.put("/courses/{course_id}/lms-link", response_model=schemas.LmsCourseLinkSummary)
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


@router.post("/courses/{course_id}/lms-link/sync", response_model=schemas.LmsCourseLinkSummary)
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


@router.delete("/courses/{course_id}/lms-link", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/courses/{course_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_course_lms_assignments(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_assignments(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/grades", response_model=schemas.LmsGradeListResponse)
def read_course_lms_grades(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_grades(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/navigation", response_model=schemas.LmsCourseNavigationResponse)
def read_course_lms_navigation(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_navigation(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/announcements", response_model=schemas.LmsAnnouncementListResponse)
def read_course_lms_announcements(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_announcements(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/modules", response_model=schemas.LmsModuleListResponse)
def read_course_lms_modules(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_modules(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/modules/{module_id}/items", response_model=schemas.LmsModuleItemListResponse)
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


@router.get("/courses/{course_id}/lms/modules/{module_id}/items/{module_item_id}/file", response_model=schemas.LmsModuleFile)
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


@router.get("/courses/{course_id}/lms/modules/{module_id}/items/{module_item_id}/file/download")
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
            headers={"Content-Disposition": f'inline; filename="{safe_filename}"'},
        )
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/quizzes", response_model=schemas.LmsQuizListResponse)
def read_course_lms_quizzes(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_quizzes(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/pages", response_model=schemas.LmsPageListResponse)
def read_course_lms_pages(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_pages(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/lms/pages/{page_ref}", response_model=schemas.LmsPageDetail)
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


@router.get("/courses/{course_id}/lms/syllabus", response_model=schemas.LmsCourseSyllabusResponse)
def read_course_lms_syllabus(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_syllabus(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@router.get("/courses/{course_id}/tab-settings", response_model=list[schemas.TabSetting])
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


@router.put("/courses/{course_id}/tab-settings/{settings_key}", response_model=schemas.TabSetting)
def upsert_course_tab_setting(
    course_id: str,
    settings_key: str,
    tab_setting: schemas.TabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    course_runtime_tabs = runtime_payloads.build_course_runtime_payload(db, course)["runtime_tabs"]
    _require_runtime_tab_setting_target(course_runtime_tabs, settings_key)
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


@router.post("/courses/{course_id}/runtime-tabs", response_model=list[schemas.RuntimeTabDefinition])
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


@router.delete("/courses/{course_id}/runtime-tabs/{tab_type}", response_model=list[schemas.RuntimeTabDefinition])
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


@router.put("/courses/{course_id}/runtime-tabs/order", response_model=list[schemas.RuntimeTabDefinition])
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


@router.get("/courses/{course_id}/resources", response_model=schemas.CourseResourceListResponse)
def read_course_resources(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return build_course_resource_list_response(db, current_user, course_id)


@router.post("/courses/{course_id}/resources/upload", response_model=schemas.CourseResourceUploadResponse)
async def upload_course_resources(
    course_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return await _store_course_resource_uploads(
        db,
        course_id=course_id,
        current_user=current_user,
        files=files,
    )


@router.post("/courses/{course_id}/resources/links", response_model=schemas.CourseResourceFile)
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


@router.patch("/courses/{course_id}/resources/{resource_id}", response_model=schemas.CourseResourceFile)
def update_course_resource(
    course_id: str,
    resource_id: str,
    payload: schemas.CourseResourceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    if payload.filename_display is None and payload.url is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_RESOURCE_UPDATE", "At least one resource field must be provided."),
        )
    try:
        return course_resources.update_course_resource(
            db,
            resource,
            filename_display=payload.filename_display,
            external_url=payload.url,
        )
    except course_resources.CourseResourceStorageError as error:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_RESOURCE_UPDATE", str(error)),
        ) from error


@router.delete("/courses/{course_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/courses/{course_id}/resources/{resource_id}/download")
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


@router.put("/courses/{course_id}")
def update_course(
    course_id: str,
    course: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    try:
        updated_course = crud.update_course(db=db, course_id=course_id, course_update=course)
        return _serialize_course_detail_payload(db, updated_course)
    except crud.CourseSemesterAssignmentError as exc:
        if str(exc) == "SEMESTER_NOT_FOUND":
            raise HTTPException(status_code=404, detail=error_detail("SEMESTER_NOT_FOUND", "Semester not found."))
        raise HTTPException(
            status_code=422,
            detail=error_detail("SEMESTER_PROGRAM_MISMATCH", "Semester does not belong to this course's Program."),
        )


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    crud.delete_course(db, course_id)
    return {"ok": True}


@router.get("/courses/{course_id}/gradebook", response_model=schemas.CourseGradebook)
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


@router.patch("/courses/{course_id}/gradebook/preferences", response_model=schemas.CourseGradebook)
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


@router.post("/courses/{course_id}/gradebook/categories", response_model=schemas.CourseGradebook)
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


@router.patch("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
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


@router.delete("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
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


@router.post("/courses/{course_id}/gradebook/assessments", response_model=schemas.CourseGradebook)
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


@router.patch("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
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


@router.delete("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
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


@router.put("/courses/{course_id}/gradebook/assessments/reorder", response_model=schemas.CourseGradebook)
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
