# input:  [SQLAlchemy session, course/semester ORM models, shared JSON helpers, tab-settings persistence helpers, and course event-type schemas]
# output: [builtin-event-core settings helpers for default event types, scope-aware resolution, and course/semester settings writes]
# pos:    [Backend helper layer that treats builtin-event-core settings as generic settings-bucket data instead of course_event_types table rows]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

import models
import schemas
from crud_layout import get_tab_setting, resolve_tab_settings_metadata, upsert_tab_setting
from crud_shared import _parse_json_object, _serialize_json_object


EVENT_CORE_SETTINGS_KEY = "builtin-event-core"
EVENT_CORE_EVENT_TYPES_FIELD = "eventTypes"
DEFAULT_EVENT_TYPES: list[dict[str, object]] = [
    {
        "id": "builtin-lecture",
        "code": "LECTURE",
        "abbreviation": "LEC",
        "track_attendance": False,
        "color": None,
        "icon": None,
    },
    {
        "id": "builtin-practical",
        "code": "PRACTICAL",
        "abbreviation": "PRA",
        "track_attendance": False,
        "color": None,
        "icon": None,
    },
    {
        "id": "builtin-tutorial",
        "code": "TUTORIAL",
        "abbreviation": "TUT",
        "track_attendance": False,
        "color": None,
        "icon": None,
    },
]


def _is_record(value: object) -> bool:
    return isinstance(value, dict)


def _normalize_event_type_items(value: object) -> list[schemas.CourseEventType]:
    if not isinstance(value, list):
        value = DEFAULT_EVENT_TYPES

    normalized_items: list[schemas.CourseEventType] = []
    seen_codes: set[str] = set()
    seen_abbreviations: set[str] = set()

    for index, item in enumerate(value):
        if not _is_record(item):
            continue
        code = str(item.get("code") or "").strip().upper()
        abbreviation = str(item.get("abbreviation") or "").strip().upper()
        if not code or not abbreviation or code in seen_codes or abbreviation in seen_abbreviations:
            continue
        seen_codes.add(code)
        seen_abbreviations.add(abbreviation)
        normalized_items.append(
            schemas.CourseEventType(
                id=str(item.get("id") or f"{code}-{index}"),
                code=code,
                abbreviation=abbreviation,
                track_attendance=bool(item.get("track_attendance")),
                color=str(item.get("color")) if isinstance(item.get("color"), str) else None,
                icon=str(item.get("icon")) if isinstance(item.get("icon"), str) else None,
            )
        )

    if normalized_items:
        return normalized_items

    return [
        schemas.CourseEventType.model_validate(item)
        for item in DEFAULT_EVENT_TYPES
    ]


def _serialize_event_type_items(items: list[schemas.CourseEventType]) -> list[dict[str, object]]:
    return [
        {
            "id": item.id,
            "code": item.code,
            "abbreviation": item.abbreviation,
            "track_attendance": item.track_attendance,
            "color": item.color,
            "icon": item.icon,
        }
        for item in items
    ]


def resolve_course_event_types_metadata(
    db: Session,
    course: models.Course,
) -> dict[str, object]:
    resolved = resolve_tab_settings_metadata(
        db,
        EVENT_CORE_SETTINGS_KEY,
        program_id=course.program_id,
        semester_id=course.semester_id,
        course_id=course.id,
    )
    resolved_settings = dict(resolved.get("resolved_settings") or {})
    resolved_settings[EVENT_CORE_EVENT_TYPES_FIELD] = _serialize_event_type_items(
        _normalize_event_type_items(resolved_settings.get(EVENT_CORE_EVENT_TYPES_FIELD))
    )
    resolved["resolved_settings"] = resolved_settings
    return resolved


def resolve_course_event_types(
    db: Session,
    course: models.Course,
) -> list[schemas.CourseEventType]:
    resolved = resolve_course_event_types_metadata(db, course)
    return _normalize_event_type_items((resolved.get("resolved_settings") or {}).get(EVENT_CORE_EVENT_TYPES_FIELD))


def resolve_semester_event_types_metadata(
    db: Session,
    semester: models.Semester,
) -> dict[str, object]:
    resolved = resolve_tab_settings_metadata(
        db,
        EVENT_CORE_SETTINGS_KEY,
        program_id=semester.program_id,
        semester_id=semester.id,
    )
    resolved_settings = dict(resolved.get("resolved_settings") or {})
    resolved_settings[EVENT_CORE_EVENT_TYPES_FIELD] = _serialize_event_type_items(
        _normalize_event_type_items(resolved_settings.get(EVENT_CORE_EVENT_TYPES_FIELD))
    )
    resolved["resolved_settings"] = resolved_settings
    return resolved


def resolve_semester_event_types(
    db: Session,
    semester: models.Semester,
) -> list[schemas.CourseEventType]:
    resolved = resolve_semester_event_types_metadata(db, semester)
    return _normalize_event_type_items((resolved.get("resolved_settings") or {}).get(EVENT_CORE_EVENT_TYPES_FIELD))


def upsert_course_event_types_settings(
    db: Session,
    course: models.Course,
    event_types: list[schemas.CourseEventType],
) -> models.TabSetting:
    existing = get_tab_setting(db, EVENT_CORE_SETTINGS_KEY, course_id=course.id)
    current_settings = _parse_json_object(existing.settings if existing is not None else None)
    next_settings = dict(current_settings)
    next_settings[EVENT_CORE_EVENT_TYPES_FIELD] = _serialize_event_type_items(event_types)
    return upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=EVENT_CORE_SETTINGS_KEY, settings=_serialize_json_object(next_settings)),
        course_id=course.id,
    )


def upsert_semester_event_types_settings(
    db: Session,
    semester: models.Semester,
    event_types: list[schemas.CourseEventType],
) -> models.TabSetting:
    existing = get_tab_setting(db, EVENT_CORE_SETTINGS_KEY, semester_id=semester.id)
    current_settings = _parse_json_object(existing.settings if existing is not None else None)
    next_settings = dict(current_settings)
    next_settings[EVENT_CORE_EVENT_TYPES_FIELD] = _serialize_event_type_items(event_types)
    return upsert_tab_setting(
        db,
        schemas.TabSettingCreate(settings_key=EVENT_CORE_SETTINGS_KEY, settings=_serialize_json_object(next_settings)),
        semester_id=semester.id,
    )


def get_course_event_type_by_code(
    db: Session,
    course: models.Course,
    event_type_code: str,
) -> schemas.CourseEventType | None:
    normalized_code = str(event_type_code or "").strip().upper()
    return next((item for item in resolve_course_event_types(db, course) if item.code == normalized_code), None)
