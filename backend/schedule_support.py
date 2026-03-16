# input:  [SQLAlchemy sessions, backend models/schemas/crud services, shared API validators, and ics-derived meeting payloads]
# output: [Schedule/event helper functions for event types, sections, events, conflict detection, calendar export shaping, and ICS schedule import]
# pos:    [backend schedule support layer shared by course schedule routes, course import flows, and backup restore validation]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api_common import (
    BUILTIN_EVENT_TYPE_ABBREVIATIONS,
    BUILTIN_EVENT_TYPE_CODES,
    TIME_FORMAT,
    error_detail,
    get_event_type_or_404,
    get_owned_course,
    get_owned_semester,
    get_section_or_422,
    get_semester_max_week,
    normalize_week_pattern_input,
    touch_model_timestamp,
    validate_day_of_week,
    validate_program_timezone_or_422,
    validate_section_id,
    validate_time_range,
    validate_week_range,
)
import crud
import models
import schemas


def resolve_week_index(semester: models.Semester, timezone: str, requested_week: Optional[int]) -> int:
    max_week = get_semester_max_week(semester)
    if requested_week is not None:
        if requested_week < 1 or requested_week > max_week:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_WEEK_INDEX", f"week must be between 1 and {max_week}."),
            )
        return requested_week

    tzinfo = validate_program_timezone_or_422(timezone)
    today = datetime.now(tzinfo).date()
    if semester.start_date <= today <= semester.end_date:
        return ((today - semester.start_date).days // 7) + 1
    return 1


def matches_week_pattern(week_pattern: str, week: int, start_week: Optional[int] = 1) -> bool:
    if week_pattern == "EVERY":
        return True
    if week_pattern == "ALTERNATING":
        anchor_week = start_week or 1
        return (week - anchor_week) % 2 == 0
    return False


def parse_time_value(value: str) -> time:
    return datetime.strptime(value, TIME_FORMAT).time()


def week_date(semester_start: date, week: int, day_of_week: int) -> date:
    return semester_start + timedelta(days=((week - 1) * 7 + (day_of_week - 1)))


def dedupe_warnings(warnings: list[str]) -> list[str]:
    return list(dict.fromkeys(warnings))


def item_in_date_range(item: dict, semester_start: date, start_date: date, end_date: date) -> bool:
    occurrence_date = week_date(semester_start, item["week"], item["day_of_week"])
    return start_date <= occurrence_date < end_date


def detect_conflicts(items: list[dict]) -> list[dict]:
    active_indices: list[int] = []
    for index, item in enumerate(items):
        if item["enable"] and not item["skip"]:
            active_indices.append(index)

    parent = {idx: idx for idx in active_indices}

    def find_parent(x: int) -> int:
        if parent[x] != x:
            parent[x] = find_parent(parent[x])
        return parent[x]

    def union(a: int, b: int):
        root_a = find_parent(a)
        root_b = find_parent(b)
        if root_a != root_b:
            parent[root_b] = root_a

    for i in range(len(active_indices)):
        idx_a = active_indices[i]
        a = items[idx_a]
        for j in range(i + 1, len(active_indices)):
            idx_b = active_indices[j]
            b = items[idx_b]
            if a["course_id"] == b["course_id"]:
                continue
            if a["day_of_week"] != b["day_of_week"]:
                continue
            if a["start_time"] < b["end_time"] and b["start_time"] < a["end_time"]:
                union(idx_a, idx_b)

    groups: dict[int, list[int]] = {}
    for idx in active_indices:
        root = find_parent(idx)
        groups.setdefault(root, []).append(idx)

    conflict_counter = 1
    for members in groups.values():
        if len(members) <= 1:
            continue
        group_id = f"conflict-{conflict_counter}"
        conflict_counter += 1
        for member_index in members:
            items[member_index]["is_conflict"] = True
            items[member_index]["conflict_group_id"] = group_id
    return items


def serialize_schedule_item(item: dict, include_render_state: bool = False) -> dict:
    payload = {
        "eventId": item["event_id"],
        "courseId": item["course_id"],
        "courseName": item["course_name"],
        "eventTypeCode": item["event_type_code"],
        "sectionId": item["section_id"],
        "dayOfWeek": item["day_of_week"],
        "startTime": item["start_time"],
        "endTime": item["end_time"],
        "weekPattern": item.get("week_pattern", "EVERY"),
        "enable": item["enable"],
        "skip": item["skip"],
        "isConflict": item.get("is_conflict", False),
        "conflictGroupId": item.get("conflict_group_id"),
        "week": item["week"],
    }
    if item.get("title") is not None:
        payload["title"] = item["title"]
    if item.get("note") is not None:
        payload["note"] = item["note"]
    if include_render_state and item.get("render_state"):
        payload["renderState"] = item["render_state"]
    return payload


def event_to_week_item(
    event: models.CourseEvent,
    course_name: str,
    week: int,
    max_week: int,
    warnings: list[str],
) -> Optional[dict]:
    try:
        validate_time_range(event.start_time, event.end_time)
        validate_day_of_week(event.day_of_week)
    except HTTPException:
        warnings.append(f"Skipped invalid event '{event.id}' due to invalid time/day data.")
        return None

    effective_start_week = event.start_week or 1
    effective_end_week = event.end_week or max_week
    if effective_start_week > effective_end_week:
        warnings.append(f"Skipped invalid event '{event.id}' due to invalid week range.")
        return None
    if week < effective_start_week or week > effective_end_week:
        return None
    if not matches_week_pattern(event.week_pattern, week, effective_start_week):
        return None
    if not event.enable:
        return None

    return {
        "event_id": event.id,
        "course_id": event.course_id,
        "course_name": course_name,
        "event_type_code": event.event_type_code,
        "section_id": event.section_id,
        "day_of_week": event.day_of_week,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "week_pattern": event.week_pattern,
        "enable": event.enable,
        "skip": event.skip,
        "is_conflict": False,
        "conflict_group_id": None,
        "week": week,
        "title": event.title,
        "note": event.note,
    }


def collect_semester_week_items(
    db: Session,
    semester: models.Semester,
    week: int,
) -> tuple[list[dict], list[str]]:
    max_week = get_semester_max_week(semester)
    warnings: list[str] = []
    courses = db.query(models.Course).filter(models.Course.semester_id == semester.id).all()
    events = (
        db.query(models.CourseEvent)
        .join(models.Course, models.CourseEvent.course_id == models.Course.id)
        .filter(models.Course.semester_id == semester.id)
        .all()
    )
    course_name_map = {course.id: course.name for course in courses}

    items: list[dict] = []
    for event in events:
        item = event_to_week_item(
            event=event,
            course_name=course_name_map.get(event.course_id, "Unknown Course"),
            week=week,
            max_week=max_week,
            warnings=warnings,
        )
        if item is not None:
            items.append(item)
    return items, warnings


def collect_semester_range_items(
    db: Session,
    semester: models.Semester,
    start_date: date,
    end_date: date,
    with_conflicts: bool,
) -> tuple[list[dict], list[str]]:
    if start_date >= end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_DATE_RANGE", "start must be earlier than end."),
        )

    overlap_start = max(start_date, semester.start_date)
    overlap_end = min(end_date, semester.end_date + timedelta(days=1))
    if overlap_start >= overlap_end:
        return [], []

    start_week = max(1, ((overlap_start - semester.start_date).days // 7) + 1)
    end_week = min(get_semester_max_week(semester), ((overlap_end - timedelta(days=1) - semester.start_date).days // 7) + 1)

    items: list[dict] = []
    warnings: list[str] = []
    for week in range(start_week, end_week + 1):
        week_items, week_warnings = collect_semester_week_items(db, semester, week)
        items.extend(
            item for item in week_items
            if item_in_date_range(item, semester.start_date, overlap_start, overlap_end)
        )
        warnings.extend(week_warnings)

    if with_conflicts:
        items = detect_conflicts(items)

    return items, dedupe_warnings(warnings)


def collect_course_week_items(
    db: Session,
    course: models.Course,
    semester: models.Semester,
    week: int,
) -> tuple[list[dict], list[str]]:
    max_week = get_semester_max_week(semester)
    warnings: list[str] = []
    events = db.query(models.CourseEvent).filter(models.CourseEvent.course_id == course.id).all()
    items: list[dict] = []
    for event in events:
        item = event_to_week_item(
            event=event,
            course_name=course.name,
            week=week,
            max_week=max_week,
            warnings=warnings,
        )
        if item is not None:
            items.append(item)
    return items, warnings


def get_course_semester_and_timezone(
    db: Session,
    current_user: models.User,
    course_id: str,
) -> tuple[models.Course, models.Semester, str]:
    course = get_owned_course(db, current_user, course_id)
    if not course.semester_id:
        raise HTTPException(
            status_code=422,
            detail=error_detail("COURSE_NOT_IN_SEMESTER", "Course is not assigned to a semester."),
        )
    semester = get_owned_semester(db, current_user, course.semester_id)
    program = crud.get_program(db, course.program_id, current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    timezone = (program.program_timezone or "UTC").strip() or "UTC"
    return course, semester, timezone


def parse_export_weeks(
    export_range: schemas.ExportRange,
    provided_week: Optional[int],
    start_week: Optional[int],
    end_week: Optional[int],
    semester: models.Semester,
    timezone: str,
) -> list[int]:
    max_week = get_semester_max_week(semester)
    if export_range == schemas.ExportRange.TERM:
        return list(range(1, max_week + 1))
    if export_range == schemas.ExportRange.WEEK:
        resolved_week = resolve_week_index(semester, timezone, provided_week)
        return [resolved_week]

    validate_week_range(start_week, end_week, "EXPORT")
    if start_week is None or end_week is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_EXPORT_WEEK_RANGE", "startWeek and endWeek are required when range is weeks."),
        )
    if start_week > max_week or end_week > max_week:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_WEEK_INDEX", f"week must be between 1 and {max_week}."),
        )
    return list(range(start_week, end_week + 1))


def normalize_event_skip(db: Session, course_id: str, event_type_code: str, skip_value: bool) -> bool:
    event_type = get_event_type_or_404(db, course_id, event_type_code)
    if event_type.track_attendance:
        return False
    return skip_value


def derive_event_type_abbreviation(code: str) -> str:
    builtin = BUILTIN_EVENT_TYPE_ABBREVIATIONS.get(code.upper())
    if builtin:
        return builtin
    normalized = "".join(character for character in code.upper() if character.isalnum())
    return (normalized[:4] or "TYPE")


def resolve_unique_event_type_abbreviation(db: Session, course_id: str, event_type_code: str) -> str:
    preferred = derive_event_type_abbreviation(event_type_code)
    existing_abbreviations = {
        row[0]
        for row in (
            db.query(models.CourseEventType.abbreviation)
            .filter(models.CourseEventType.course_id == course_id)
            .all()
        )
        if row[0]
    }
    if preferred not in existing_abbreviations:
        return preferred

    normalized_code = "".join(character for character in event_type_code.upper() if character.isalnum()) or "TYPE"
    base = normalized_code[:3] if len(normalized_code) >= 3 else normalized_code
    sequence = 2
    while sequence < 1000:
        candidate = f"{base}{sequence}"
        if candidate not in existing_abbreviations:
            return candidate
        sequence += 1

    return f"{normalized_code}{int(datetime.now(UTC).timestamp())}"


def ensure_builtin_event_types_for_course(db: Session, course_id: str):
    existing_codes = {
        row[0]
        for row in (
            db.query(models.CourseEventType.code)
            .filter(models.CourseEventType.course_id == course_id)
            .all()
        )
    }
    missing_codes = sorted(BUILTIN_EVENT_TYPE_CODES - existing_codes)
    for code in missing_codes:
        ensure_course_event_type_exists(db, course_id, code)


def ensure_course_event_type_exists(db: Session, course_id: str, event_type_code: str) -> models.CourseEventType:
    event_type_code = event_type_code.strip()
    existing = (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
        .first()
    )
    if existing:
        return existing

    event_type = models.CourseEventType(
        course_id=course_id,
        code=event_type_code,
        abbreviation=resolve_unique_event_type_abbreviation(db, course_id, event_type_code),
        track_attendance=False,
        created_at="",
        updated_at="",
    )
    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        recovered = (
            db.query(models.CourseEventType)
            .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
            .first()
        )
        if recovered:
            return recovered
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "EVENT_TYPE_CREATE_CONFLICT",
                f"Failed to create eventTypeCode '{event_type_code}' due to a unique constraint conflict.",
            ),
        ) from exc
    return event_type


def validate_section_payload(course_id: str, payload: dict, db: Session):
    section_id = payload.get("section_id")
    if section_id is not None:
        validate_section_id(section_id)
    payload["event_type_code"] = payload["event_type_code"].strip()
    payload["week_pattern"] = normalize_week_pattern_input(payload["week_pattern"])
    validate_day_of_week(payload["day_of_week"])
    validate_time_range(payload["start_time"], payload["end_time"])
    validate_week_range(payload["start_week"], payload["end_week"], "SECTION")
    get_event_type_or_404(db, course_id, payload["event_type_code"])


def validate_event_payload(course_id: str, payload: dict, db: Session):
    payload["event_type_code"] = payload["event_type_code"].strip()
    payload["week_pattern"] = normalize_week_pattern_input(payload["week_pattern"])
    validate_day_of_week(payload["day_of_week"])
    validate_time_range(payload["start_time"], payload["end_time"])
    validate_week_range(payload.get("start_week"), payload.get("end_week"), "EVENT")
    get_event_type_or_404(db, course_id, payload["event_type_code"])

    section = get_section_or_422(db, course_id, payload.get("section_id"))
    if section and section.event_type_code != payload["event_type_code"]:
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_EVENT_TYPE_MISMATCH", "sectionId does not match eventTypeCode."),
        )

    payload["skip"] = normalize_event_skip(db, course_id, payload["event_type_code"], bool(payload.get("skip", False)))


def import_course_schedule_from_ics(
    db: Session,
    course: models.Course,
    meetings: list[dict[str, Any]],
):
    for meeting in meetings:
        event_type_code = str(meeting.get("eventTypeCode", "")).strip() or "LECTURE"
        ensure_course_event_type_exists(db, course.id, event_type_code)

        day_of_week = int(meeting.get("dayOfWeek", 1))
        start_time = str(meeting.get("startTime", "09:00")).strip()
        end_time = str(meeting.get("endTime", "10:00")).strip()
        week_pattern = normalize_week_pattern_input(meeting.get("weekPattern", "EVERY"))
        start_week = int(meeting.get("startWeek", 1))
        end_week = int(meeting.get("endWeek", start_week))

        validate_day_of_week(day_of_week)
        validate_time_range(start_time, end_time)
        validate_week_range(start_week, end_week, "EVENT")

        section_id_raw = meeting.get("sectionId")
        section_id = str(section_id_raw).strip() if section_id_raw else None
        linked_section_id: str | None = None

        if section_id:
            validate_section_id(section_id)
            existing_section = (
                db.query(models.CourseSection)
                .filter(models.CourseSection.course_id == course.id, models.CourseSection.section_id == section_id)
                .first()
            )
            if existing_section is None:
                section_payload = {
                    "section_id": section_id,
                    "event_type_code": event_type_code,
                    "title": meeting.get("title"),
                    "instructor": meeting.get("instructor"),
                    "location": meeting.get("location"),
                    "day_of_week": day_of_week,
                    "start_time": start_time,
                    "end_time": end_time,
                    "week_pattern": week_pattern,
                    "start_week": start_week,
                    "end_week": end_week,
                }
                validate_section_payload(course.id, section_payload, db)
                db_section = models.CourseSection(course_id=course.id, **section_payload)
                touch_model_timestamp(db_section)
                db.add(db_section)
                linked_section_id = section_id
            elif existing_section.event_type_code == event_type_code:
                linked_section_id = section_id

        db_event = models.CourseEvent(
            course_id=course.id,
            event_type_code=event_type_code,
            section_id=linked_section_id,
            title=meeting.get("title"),
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            week_pattern=week_pattern,
            start_week=start_week,
            end_week=end_week,
            enable=True,
            skip=False,
            note=meeting.get("note"),
        )
        touch_model_timestamp(db_event)
        db.add(db_event)
