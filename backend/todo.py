# input:  [SQLAlchemy session, backend ORM/schema modules, and legacy builtin-event-core todo tab settings]
# output: [semester-scoped todo domain helpers for migration, CRUD mutations, validation, and API payload assembly]
# pos:    [Backend domain service that owns persisted Todo tables, stores task data without backend ordering, and bridges legacy tab.settings storage into the semester-level model]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
import json
from typing import Any

from sqlalchemy.orm import Session

import models
import schemas

BUILTIN_TIMETABLE_TODO_TAB_TYPE = "builtin-todo"
COMPLETED_SECTION_ID = "__completed__"
DEFAULT_SECTION_NAME = "General"
SEMESTER_TODO_SETTINGS_KEY = "semesterTodo"
VALID_PRIORITIES = {"", "LOW", "MEDIUM", "HIGH", "URGENT"}


class TodoValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class TodoNotFoundError(ValueError):
    def __init__(self, resource: str):
        super().__init__(resource)
        self.resource = resource


@dataclass
class CourseSnapshot:
    course_id: str
    course_name: str
    course_category: str
    course_color: str
    todo_tab: models.Tab | None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _touch_row(row: object) -> None:
    timestamp = _now_iso()
    if hasattr(row, "created_at") and not getattr(row, "created_at", ""):
        setattr(row, "created_at", timestamp)
    if hasattr(row, "updated_at"):
        setattr(row, "updated_at", timestamp)


def _parse_json_object(raw_value: str | None) -> dict[str, Any]:
    if not raw_value:
        return {}
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _read_string(value: Any, fallback: str = "") -> str:
    return value if isinstance(value, str) else fallback


def _read_bool(value: Any, fallback: bool = False) -> bool:
    return value if isinstance(value, bool) else fallback


def _parse_date(value: Any) -> date | None:
    raw_value = _read_string(value).strip()
    if not raw_value:
        return None
    try:
        return date.fromisoformat(raw_value)
    except ValueError:
        return None


def _parse_time(value: Any) -> str | None:
    raw_value = _read_string(value).strip()
    if len(raw_value) != 5 or raw_value[2] != ":":
        return None
    hour_text, minute_text = raw_value.split(":")
    if not hour_text.isdigit() or not minute_text.isdigit():
        return None
    hour = int(hour_text)
    minute = int(minute_text)
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def _parse_priority(value: Any) -> str:
    normalized = _read_string(value).strip().upper()
    return normalized if normalized in VALID_PRIORITIES else ""


def _build_course_snapshots(semester: models.Semester) -> list[CourseSnapshot]:
    return [
        CourseSnapshot(
            course_id=course.id,
            course_name=course.name,
            course_category=course.category or "",
            course_color=course.color or "",
            todo_tab=next((tab for tab in course.tabs if tab.tab_type == BUILTIN_TIMETABLE_TODO_TAB_TYPE), None),
        )
        for course in sorted(semester.courses, key=lambda item: (item.name or "").lower())
    ]


def _normalize_sections(raw_sections: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_sections, list):
        return []

    parsed_sections: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(raw_sections):
        if not isinstance(item, dict):
            continue
        section_id = _read_string(item.get("id")).strip()
        if not section_id or section_id == COMPLETED_SECTION_ID or section_id in seen_ids:
            continue
        seen_ids.add(section_id)
        order_value = item.get("order")
        order_index = int(order_value) if isinstance(order_value, (int, float)) else index
        parsed_sections.append(
            {
                "id": section_id,
                "name": _read_string(item.get("name"), DEFAULT_SECTION_NAME).strip() or DEFAULT_SECTION_NAME,
                "order_index": order_index,
            }
        )

    parsed_sections.sort(key=lambda item: item["order_index"])
    for index, section in enumerate(parsed_sections):
        section["order_index"] = index
    return parsed_sections


def _normalize_tasks(
    raw_tasks: Any,
    *,
    valid_section_ids: set[str],
    default_course: CourseSnapshot | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(raw_tasks, list):
        return []

    parsed_tasks: list[dict[str, Any]] = []
    for index, item in enumerate(raw_tasks):
        if not isinstance(item, dict):
            continue
        task_id = _read_string(item.get("id")).strip()
        title = _read_string(item.get("title")).strip()
        if not task_id or not title:
            continue

        raw_section_id = _read_string(item.get("sectionId")).strip()
        raw_origin_section_id = _read_string(item.get("originSectionId")).strip()
        completed = _read_bool(item.get("completed"), False) or raw_section_id == COMPLETED_SECTION_ID

        section_id = raw_section_id if raw_section_id in valid_section_ids else ""
        origin_section_id = raw_origin_section_id if raw_origin_section_id in valid_section_ids else None
        if raw_section_id == COMPLETED_SECTION_ID:
            section_id = ""
        if completed and origin_section_id is None and section_id:
            origin_section_id = section_id

        order_value = item.get("order")
        order_index = int(order_value) if isinstance(order_value, (int, float)) else index
        parsed_tasks.append(
            {
                "id": task_id,
                "title": title,
                "note": _read_string(item.get("note"), _read_string(item.get("description"))),
                "section_id": section_id,
                "origin_section_id": origin_section_id,
                "course_id": _read_string(item.get("courseId"), default_course.course_id if default_course else "").strip(),
                "due_date": _parse_date(item.get("dueDate")),
                "due_time": _parse_time(item.get("dueTime")),
                "priority": _parse_priority(item.get("priority")),
                "completed": completed,
                "order_index": order_index,
                "created_at": _read_string(item.get("createdAt")),
                "updated_at": _read_string(item.get("updatedAt")),
            }
        )

    parsed_tasks.sort(key=lambda item: (item["order_index"], item["created_at"], item["title"].lower()))
    for index, task in enumerate(parsed_tasks):
        task["order_index"] = index
    return parsed_tasks


def _normalize_legacy_course_storage(
    todo_tab: models.Tab | None,
    course: CourseSnapshot,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    parsed_settings = _parse_json_object(todo_tab.settings if todo_tab else None)
    course_list = parsed_settings.get("courseList")
    sections = _normalize_sections(course_list.get("sections") if isinstance(course_list, dict) else None)
    valid_section_ids = {section["id"] for section in sections}
    tasks = _normalize_tasks(
        course_list.get("tasks") if isinstance(course_list, dict) else None,
        valid_section_ids=valid_section_ids,
        default_course=course,
    )
    return sections, tasks


def _migrate_legacy_semester_state(
    semester_settings: dict[str, Any],
    course_snapshots: list[CourseSnapshot],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    semester_todo = semester_settings.get(SEMESTER_TODO_SETTINGS_KEY)
    if isinstance(semester_todo, dict):
        sections = _normalize_sections(semester_todo.get("sections"))
        valid_section_ids = {section["id"] for section in sections}
        tasks = _normalize_tasks(semester_todo.get("tasks"), valid_section_ids=valid_section_ids)
        return sections, tasks

    merged_sections: list[dict[str, Any]] = []
    merged_tasks: list[dict[str, Any]] = []
    merged_section_ids_by_name: dict[str, str] = {}

    def ensure_section(name: str) -> str:
        normalized_name = name.strip() or DEFAULT_SECTION_NAME
        key = normalized_name.lower()
        existing = merged_section_ids_by_name.get(key)
        if existing:
            return existing
        section_id = f"migrated-section-{len(merged_sections) + 1}"
        merged_section_ids_by_name[key] = section_id
        merged_sections.append(
            {
                "id": section_id,
                "name": normalized_name,
                "order_index": len(merged_sections),
            }
        )
        return section_id

    for course in course_snapshots:
        _, legacy_tasks = _normalize_legacy_course_storage(course.todo_tab, course)
        for task in legacy_tasks:
            merged_tasks.append(
                {
                    **task,
                    "course_id": course.course_id,
                    # Legacy course todo data did not participate in the semester section model.
                    "section_id": "",
                    "origin_section_id": None,
                }
            )

    semester_custom_lists = semester_settings.get("semesterCustomLists")
    if isinstance(semester_custom_lists, list):
        for raw_list in semester_custom_lists:
            if not isinstance(raw_list, dict):
                continue
            list_name = _read_string(raw_list.get("name"), "Imported").strip() or "Imported"
            list_sections = _normalize_sections(raw_list.get("sections"))
            section_name_by_id = {section["id"]: section["name"] for section in list_sections}
            list_key = _read_string(raw_list.get("id"), list_name)
            fallback_section_id = ensure_section(list_name)
            mapped_section_ids = {
                section_id: ensure_section(f"{list_name} · {section_name}")
                for section_id, section_name in section_name_by_id.items()
            }
            list_tasks = _normalize_tasks(raw_list.get("tasks"), valid_section_ids=set(section_name_by_id.keys()))

            for task in list_tasks:
                mapped_section_id = fallback_section_id
                if task["section_id"]:
                    mapped_section_id = mapped_section_ids.get(task["section_id"], fallback_section_id)
                merged_tasks.append(
                    {
                        **task,
                        "course_id": task["course_id"] or "",
                        "section_id": "" if task["completed"] else mapped_section_id,
                        "origin_section_id": mapped_section_id if task["completed"] else None,
                        "legacy_list_key": list_key,
                    }
                )

    merged_tasks.sort(key=lambda item: (item["created_at"], item["title"].lower(), item["id"]))
    for index, task in enumerate(merged_tasks):
        task["order_index"] = index

    return merged_sections, merged_tasks


def _sanitize_legacy_todo_settings(raw_settings: str | None) -> str:
    parsed = _parse_json_object(raw_settings)
    parsed.pop(SEMESTER_TODO_SETTINGS_KEY, None)
    parsed.pop("semesterCustomLists", None)
    parsed.pop("courseList", None)
    return json.dumps(parsed) if parsed else "{}"


def _ensure_course_belongs_to_semester(semester: models.Semester, course_id: str | None) -> models.Course | None:
    if not course_id:
        return None
    course = next((item for item in semester.courses if item.id == course_id), None)
    if course is None:
        raise TodoValidationError("INVALID_TODO_COURSE", "The selected course does not belong to this semester.")
    return course


def _get_section_map(semester: models.Semester) -> dict[str, models.TodoSection]:
    return {section.id: section for section in semester.todo_sections}


def _sort_sections(semester: models.Semester) -> list[models.TodoSection]:
    return sorted(semester.todo_sections, key=lambda item: (item.created_at, item.name.lower(), item.id))


def _sort_tasks(semester: models.Semester) -> list[models.TodoTask]:
    return sorted(semester.todo_tasks, key=lambda item: (item.created_at, item.id))


def _serialize_state(semester: models.Semester) -> schemas.TodoSemesterState:
    sections = [
        schemas.TodoSection(
            id=section.id,
            semester_id=section.semester_id,
            name=section.name,
            created_at=section.created_at,
            updated_at=section.updated_at,
        )
        for section in _sort_sections(semester)
    ]

    course_map = {course.id: course for course in semester.courses}
    tasks = [
        schemas.TodoTask(
            id=task.id,
            semester_id=task.semester_id,
            title=task.title,
            note=task.note or "",
            due_date=task.due_date,
            due_time=task.due_time,
            priority=task.priority or "",
            completed=bool(task.completed),
            course_id=task.course_id,
            course_name=(course_map[task.course_id].name if task.course_id and task.course_id in course_map else ""),
            course_category=(course_map[task.course_id].category or "" if task.course_id and task.course_id in course_map else ""),
            course_color=(course_map[task.course_id].color or "" if task.course_id and task.course_id in course_map else ""),
            section_id=task.section_id,
            origin_section_id=task.origin_section_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
        for task in _sort_tasks(semester)
    ]

    course_options = [
        schemas.TodoCourseOption(
            id=course.id,
            name=course.name,
            category=course.category or "",
            color=course.color or "",
        )
        for course in sorted(semester.courses, key=lambda item: (item.name or "").lower())
    ]

    return schemas.TodoSemesterState(
        semester_id=semester.id,
        sections=sections,
        tasks=tasks,
        course_options=course_options,
    )


def ensure_migrated(db: Session, semester: models.Semester) -> None:
    if semester.todo_sections or semester.todo_tasks:
        return

    semester_tab = next((tab for tab in semester.tabs if tab.tab_type == BUILTIN_TIMETABLE_TODO_TAB_TYPE), None)
    course_snapshots = _build_course_snapshots(semester)
    semester_settings = _parse_json_object(semester_tab.settings if semester_tab else None)
    sections_data, tasks_data = _migrate_legacy_semester_state(semester_settings, course_snapshots)
    section_id_set = {section["id"] for section in sections_data}

    for section in sections_data:
        row = models.TodoSection(
            id=section["id"],
            semester_id=semester.id,
            name=section["name"],
        )
        _touch_row(row)
        db.add(row)

    for task in tasks_data:
        if task["section_id"] and task["section_id"] not in section_id_set:
            task["section_id"] = ""
        if task["origin_section_id"] and task["origin_section_id"] not in section_id_set:
            task["origin_section_id"] = None
        _ensure_course_belongs_to_semester(semester, task["course_id"] or None)
        row = models.TodoTask(
            id=task["id"],
            semester_id=semester.id,
            course_id=task["course_id"] or None,
            section_id=task["section_id"] or None,
            origin_section_id=task["origin_section_id"],
            title=task["title"],
            note=task["note"],
            due_date=task["due_date"],
            due_time=task["due_time"],
            priority=task["priority"],
            completed=task["completed"],
            created_at=task["created_at"] or "",
            updated_at=task["updated_at"] or "",
        )
        _touch_row(row)
        db.add(row)

    if semester_tab is not None:
        semester_tab.settings = _sanitize_legacy_todo_settings(semester_tab.settings)
        db.add(semester_tab)

    for course_snapshot in course_snapshots:
        if course_snapshot.todo_tab is None:
            continue
        course_snapshot.todo_tab.settings = _sanitize_legacy_todo_settings(course_snapshot.todo_tab.settings)
        db.add(course_snapshot.todo_tab)

    db.commit()
    db.refresh(semester)


def get_semester_state(db: Session, semester: models.Semester) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    db.refresh(semester)
    return _serialize_state(semester)


def create_section(db: Session, semester: models.Semester, payload: schemas.TodoSectionCreate) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    normalized_name = payload.name.strip() or DEFAULT_SECTION_NAME
    if any(section.name.strip().lower() == normalized_name.lower() for section in semester.todo_sections):
        raise TodoValidationError("DUPLICATE_TODO_SECTION", "A section with this name already exists.")
    row = models.TodoSection(
        semester_id=semester.id,
        name=normalized_name,
    )
    _touch_row(row)
    db.add(row)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def update_section(
    db: Session,
    semester: models.Semester,
    section_id: str,
    payload: schemas.TodoSectionUpdate,
) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    section = next((item for item in semester.todo_sections if item.id == section_id), None)
    if section is None:
        raise TodoNotFoundError("section")
    if payload.name is not None:
        normalized_name = payload.name.strip() or DEFAULT_SECTION_NAME
        if any(item.id != section.id and item.name.strip().lower() == normalized_name.lower() for item in semester.todo_sections):
            raise TodoValidationError("DUPLICATE_TODO_SECTION", "A section with this name already exists.")
        section.name = normalized_name
    _touch_row(section)
    db.add(section)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def delete_section(db: Session, semester: models.Semester, section_id: str) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    section = next((item for item in semester.todo_sections if item.id == section_id), None)
    if section is None:
        raise TodoNotFoundError("section")

    remaining_sections = [item for item in _sort_sections(semester) if item.id != section_id]
    fallback_section_id = remaining_sections[0].id if remaining_sections else None
    for task in semester.todo_tasks:
        if task.section_id == section_id:
            task.section_id = fallback_section_id
            if task.completed:
                task.origin_section_id = fallback_section_id
            _touch_row(task)
            db.add(task)
        elif task.origin_section_id == section_id:
            task.origin_section_id = fallback_section_id
            _touch_row(task)
            db.add(task)

    db.delete(section)

    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def create_task(db: Session, semester: models.Semester, payload: schemas.TodoTaskCreate) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    _ensure_course_belongs_to_semester(semester, payload.course_id)
    section_map = _get_section_map(semester)
    if payload.section_id and payload.section_id not in section_map:
        raise TodoValidationError("INVALID_TODO_SECTION", "The selected section does not exist.")
    if payload.origin_section_id and payload.origin_section_id not in section_map:
        raise TodoValidationError("INVALID_TODO_SECTION", "The selected section does not exist.")

    row = models.TodoTask(
        semester_id=semester.id,
        course_id=payload.course_id,
        section_id=payload.section_id or None,
        origin_section_id=(payload.origin_section_id or payload.section_id or None) if payload.completed else None,
        title=payload.title.strip(),
        note=payload.note.strip(),
        due_date=payload.due_date,
        due_time=payload.due_time,
        priority=str(payload.priority.value if hasattr(payload.priority, "value") else payload.priority),
        completed=payload.completed,
    )
    _touch_row(row)
    db.add(row)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def update_task(
    db: Session,
    semester: models.Semester,
    task_id: str,
    payload: schemas.TodoTaskUpdate,
) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    task = next((item for item in semester.todo_tasks if item.id == task_id), None)
    if task is None:
        raise TodoNotFoundError("task")

    updates = payload.model_dump(exclude_unset=True)
    section_map = _get_section_map(semester)

    if "course_id" in updates:
        _ensure_course_belongs_to_semester(semester, updates["course_id"])
    if "section_id" in updates and updates["section_id"] and updates["section_id"] not in section_map:
        raise TodoValidationError("INVALID_TODO_SECTION", "The selected section does not exist.")
    if "origin_section_id" in updates and updates["origin_section_id"] and updates["origin_section_id"] not in section_map:
        raise TodoValidationError("INVALID_TODO_SECTION", "The selected section does not exist.")

    for key, value in updates.items():
        if key == "title" and value is not None:
            task.title = value.strip()
        elif key == "note" and value is not None:
            task.note = value.strip()
        elif key in {"section_id", "origin_section_id", "course_id"}:
            setattr(task, key, value or None)
        elif key == "priority" and value is not None:
            task.priority = str(value.value if hasattr(value, "value") else value)
        else:
            setattr(task, key, value)

    if task.completed and task.origin_section_id is None:
        task.origin_section_id = task.section_id
    if not task.completed:
        task.origin_section_id = None

    _touch_row(task)
    db.add(task)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def delete_task(db: Session, semester: models.Semester, task_id: str) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    task = next((item for item in semester.todo_tasks if item.id == task_id), None)
    if task is None:
        raise TodoNotFoundError("task")
    db.delete(task)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)


def clear_completed_tasks(db: Session, semester: models.Semester) -> schemas.TodoSemesterState:
    ensure_migrated(db, semester)
    for task in list(semester.todo_tasks):
        if task.completed:
            db.delete(task)
    db.commit()
    db.refresh(semester)
    return _serialize_state(semester)
