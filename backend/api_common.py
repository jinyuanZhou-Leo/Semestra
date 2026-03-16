# input:  [FastAPI exceptions/uploads, SQLAlchemy session access, backend models/schemas/crud/resource/todo/gradebook/lms services, and timezone/date helpers]
# output: [Shared API-layer validation helpers, ownership checks, error translators, timestamp helpers, and small route-support utilities]
# pos:    [backend API support module reused by route files so the FastAPI entrypoint stays thin and domain checks remain centralized]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Optional
import math
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

import course_resources
import crud
import gradebook
import lms_service
import models
import schemas
import todo

TIME_FORMAT = "%H:%M"
BUILTIN_EVENT_TYPE_CODES = {"LECTURE", "TUTORIAL", "PRACTICAL"}
BUILTIN_EVENT_TYPE_ABBREVIATIONS = {
    "LECTURE": "LEC",
    "TUTORIAL": "TUT",
    "PRACTICAL": "PRA",
}


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat()


def error_detail(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def raise_gradebook_http_error(exc: Exception) -> None:
    if isinstance(exc, gradebook.GradebookNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, gradebook.GradebookConflictError):
        raise HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, gradebook.GradebookValidationError):
        raise HTTPException(status_code=422, detail=str(exc))
    raise exc


def raise_todo_http_error(exc: Exception) -> None:
    if isinstance(exc, todo.TodoNotFoundError):
        raise HTTPException(status_code=404, detail=error_detail("TODO_NOT_FOUND", f"{exc.resource} not found."))
    if isinstance(exc, todo.TodoValidationError):
        raise HTTPException(status_code=422, detail=error_detail(exc.code, exc.message))
    raise exc


def raise_lms_http_error(exc: Exception) -> None:
    if isinstance(exc, lms_service.LmsServiceError):
        raise HTTPException(status_code=exc.status_code, detail=error_detail(exc.code, exc.message))
    raise exc


def validate_time_range(start_time: str, end_time: str):
    try:
        datetime.strptime(start_time, TIME_FORMAT)
        datetime.strptime(end_time, TIME_FORMAT)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIME_FORMAT", "Time must use HH:mm format."),
        ) from exc

    if start_time >= end_time:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_TIME_RANGE_CROSS_DAY_NOT_SUPPORTED",
                "startTime must be earlier than endTime",
            ),
        )


def validate_week_range(start_week: Optional[int], end_week: Optional[int], code_prefix: str):
    if start_week is not None and start_week < 1:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_START_WEEK", "startWeek must be greater than or equal to 1."),
        )
    if end_week is not None and end_week < 1:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_END_WEEK", "endWeek must be greater than or equal to 1."),
        )
    if start_week is not None and end_week is not None and start_week > end_week:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_WEEK_RANGE", "startWeek must be less than or equal to endWeek."),
        )


def validate_day_of_week(day_of_week: int):
    if day_of_week < 1 or day_of_week > 7:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_DAY_OF_WEEK", "dayOfWeek must be in range 1..7."),
        )


def validate_section_id(section_id: str):
    if not section_id.isdigit():
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SECTION_ID_FORMAT", "sectionId must contain digits only."),
        )


def normalize_week_pattern(value: str) -> str:
    normalized = value.upper()
    if normalized not in {"EVERY", "ALTERNATING"}:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_WEEK_PATTERN", "weekPattern must be EVERY or ALTERNATING."),
        )
    return normalized


def normalize_week_pattern_input(value: Any) -> str:
    if hasattr(value, "value"):
        value = value.value
    return normalize_week_pattern(str(value))


def get_owned_course(db: Session, current_user: models.User, course_id: str) -> models.Course:
    course = (
        db.query(models.Course)
        .join(models.Program, models.Course.program_id == models.Program.id)
        .filter(models.Course.id == course_id, models.Program.owner_id == current_user.id)
        .first()
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def get_owned_semester(db: Session, current_user: models.User, semester_id: str) -> models.Semester:
    semester = (
        db.query(models.Semester)
        .join(models.Program, models.Semester.program_id == models.Program.id)
        .filter(models.Semester.id == semester_id, models.Program.owner_id == current_user.id)
        .first()
    )
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester


def build_course_resource_list_response(db: Session, current_user: models.User, course_id: str) -> schemas.CourseResourceListResponse:
    quota = course_resources.get_user_quota_snapshot(db, current_user.id)
    files = course_resources.list_course_resources(db, course_id)
    return schemas.CourseResourceListResponse(
        files=files,
        total_bytes_used=quota.total_bytes_used,
        total_bytes_limit=quota.total_bytes_limit,
        remaining_bytes=quota.remaining_bytes,
    )


def get_event_type_or_404(db: Session, course_id: str, event_type_code: str) -> models.CourseEventType:
    event_type = (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
        .first()
    )
    if event_type is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_NOT_FOUND", f"eventTypeCode '{event_type_code}' does not exist for this course."),
        )
    return event_type


def get_section_or_422(db: Session, course_id: str, section_id: Optional[str]) -> Optional[models.CourseSection]:
    if section_id is None:
        return None
    section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if section is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_NOT_FOUND", f"sectionId '{section_id}' does not exist for this course."),
        )
    return section


def validate_program_timezone_or_422(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        ) from exc


def get_semester_max_week(semester: models.Semester) -> int:
    total_days = (semester.end_date - semester.start_date).days + 1
    return max(1, math.ceil(total_days / 7))


def resolve_semester_date_bounds(
    start_date: Optional[date],
    end_date: Optional[date],
) -> tuple[date, date]:
    default_start, default_end = crud.get_default_semester_dates()
    resolved_start = start_date or default_start
    resolved_end = end_date or default_end
    return resolved_start, resolved_end


def validate_reading_week_or_422(
    semester_start: date,
    semester_end: date,
    reading_week_start: Optional[date],
    reading_week_end: Optional[date],
) -> None:
    if reading_week_start is None and reading_week_end is None:
        return

    if reading_week_start is None or reading_week_end is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_READING_WEEK_RANGE",
                "reading_week_start and reading_week_end must both be provided.",
            ),
        )

    if reading_week_start > reading_week_end:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_READING_WEEK_RANGE",
                "reading_week_start must be earlier than or equal to reading_week_end.",
            ),
        )

    if (reading_week_end - reading_week_start).days != 6:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_READING_WEEK_SPAN",
                "Reading Week must span exactly 7 days.",
            ),
        )

    if reading_week_start.isoweekday() != 1 or reading_week_end.isoweekday() != 7:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_READING_WEEK_ALIGNMENT",
                "Reading Week must start on Monday and end on Sunday.",
            ),
        )

    if reading_week_start < semester_start or reading_week_end > semester_end:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_READING_WEEK_RANGE",
                "Reading Week must fall within the semester date range.",
            ),
        )


def touch_model_timestamp(model_instance):
    model_instance.updated_at = now_utc_iso()
    if getattr(model_instance, "created_at", None) in (None, ""):
        model_instance.created_at = model_instance.updated_at
