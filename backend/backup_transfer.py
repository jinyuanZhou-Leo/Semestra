# input:  [SQLAlchemy session, backend models/schemas/crud/domain services, course-resource storage helpers, LMS crypto/service modules, runtime validation callbacks, and base-dir filesystem access]
# output: [backup export/import service functions plus runtime callback container for account data transfer across current persisted features]
# pos:    [backend backup-transfer domain module that serializes and restores account state outside the FastAPI entrypoint]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import UTC, date, datetime
import json
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

import course_resources
import crud
import gradebook
import logic
import lms_service
import models
import schemas
import todo
from lms_crypto import decrypt_credentials, encrypt_credentials

BACKUP_FORMAT_VERSION = "2.2.2"


@dataclass(frozen=True)
class BackupRuntimeCallbacks:
    error_detail: Callable[[str, str], dict]
    now_utc_iso: Callable[[], str]
    touch_model_timestamp: Callable[[object], None]
    validate_day_of_week: Callable[[int], None]
    validate_time_range: Callable[[str, str], None]
    validate_week_range: Callable[[Optional[int], Optional[int], str], None]
    validate_section_id: Callable[[str], None]
    normalize_week_pattern_input: Callable[[Any], str]
    validate_section_payload: Callable[[str, dict, Session], None]
    validate_reading_week_or_422: Callable[[date, date, Optional[date], Optional[date]], None]


def _export_widget(widget: models.Widget) -> schemas.WidgetExport:
    return schemas.WidgetExport(
        widget_type=widget.widget_type,
        layout_config=widget.layout_config,
        settings=widget.settings,
        is_removable=widget.is_removable,
    )


def _export_tab(tab: models.Tab) -> schemas.TabExport:
    return schemas.TabExport(
        tab_type=tab.tab_type,
        settings=tab.settings,
        order_index=tab.order_index,
        is_removable=tab.is_removable,
        is_draggable=tab.is_draggable,
    )


def _export_plugin_setting(setting: models.PluginSetting) -> schemas.PluginSettingExport:
    return schemas.PluginSettingExport(plugin_id=setting.plugin_id, settings=setting.settings)


def _export_lms_error(code: Optional[str], message: Optional[str]) -> Optional[schemas.LmsIntegrationError]:
    if not code and not message:
        return None
    return schemas.LmsIntegrationError(
        code=code or "LMS_UNKNOWN_ERROR",
        message=message or "Unknown LMS error.",
    )


def _export_course_resources(
    course: models.Course,
    *,
    base_dir: Path,
    error_detail: Callable[[str, str], dict],
) -> list[schemas.CourseResourceExport]:
    exported: list[schemas.CourseResourceExport] = []
    for resource in course.resource_files:
        content_base64: Optional[str] = None
        if resource.resource_kind == "file":
            absolute_path = course_resources.resolve_absolute_path(base_dir, resource)
            if not absolute_path.exists():
                raise HTTPException(
                    status_code=500,
                    detail=error_detail(
                        "COURSE_RESOURCE_FILE_MISSING",
                        f"Stored resource file '{resource.filename_display}' could not be found on disk.",
                    ),
                )
            content_base64 = base64.b64encode(absolute_path.read_bytes()).decode("ascii")
        exported.append(
            schemas.CourseResourceExport(
                filename_original=resource.filename_original,
                filename_display=resource.filename_display,
                resource_kind=resource.resource_kind,
                external_url=resource.external_url,
                mime_type=resource.mime_type,
                size_bytes=resource.size_bytes,
                content_base64=content_base64,
            )
        )
    return exported


def _export_course_event_types(course: models.Course) -> list[schemas.CourseEventTypeExport]:
    return [
        schemas.CourseEventTypeExport(
            id=event_type.id,
            code=event_type.code,
            abbreviation=event_type.abbreviation,
            track_attendance=event_type.track_attendance,
            color=event_type.color,
            icon=event_type.icon,
        )
        for event_type in sorted(course.event_types, key=lambda item: (item.code or "", item.id))
    ]


def _export_course_sections(course: models.Course) -> list[schemas.CourseSectionExport]:
    return [
        schemas.CourseSectionExport(
            id=section.id,
            sectionId=section.section_id,
            eventTypeCode=section.event_type_code,
            title=section.title,
            instructor=section.instructor,
            location=section.location,
            dayOfWeek=section.day_of_week,
            startTime=section.start_time,
            endTime=section.end_time,
            weekPattern=section.week_pattern,
            startWeek=section.start_week,
            endWeek=section.end_week,
        )
        for section in sorted(course.sections, key=lambda item: (item.day_of_week, item.start_time, item.section_id))
    ]


def _export_course_events(course: models.Course) -> list[schemas.CourseEventExport]:
    return [
        schemas.CourseEventExport(
            id=event.id,
            eventTypeCode=event.event_type_code,
            sectionId=event.section_id,
            title=event.title,
            dayOfWeek=event.day_of_week,
            startTime=event.start_time,
            endTime=event.end_time,
            weekPattern=event.week_pattern,
            startWeek=event.start_week,
            endWeek=event.end_week,
            enable=event.enable,
            skip=event.skip,
            note=event.note,
        )
        for event in sorted(course.events, key=lambda item: (item.day_of_week, item.start_time, item.id))
    ]


def _export_course(
    course: models.Course,
    *,
    base_dir: Path,
    error_detail: Callable[[str, str], dict],
) -> schemas.CourseExport:
    lms_link = None
    if course.lms_link is not None:
        lms_link = schemas.LmsCourseLinkExport(
            lms_integration_id=course.lms_link.lms_integration_id,
            external_course_id=course.lms_link.external_course_id,
            external_course_code=course.lms_link.external_course_code,
            external_name=course.lms_link.external_name,
            sync_enabled=course.lms_link.sync_enabled,
            last_synced_at=course.lms_link.last_synced_at,
            last_error=_export_lms_error(course.lms_link.last_error_code, course.lms_link.last_error_message),
        )

    return schemas.CourseExport(
        id=course.id,
        name=course.name,
        alias=course.alias,
        category=course.category,
        color=course.color,
        credits=course.credits,
        grade_percentage=course.grade_percentage,
        grade_scaled=course.grade_scaled,
        include_in_gpa=course.include_in_gpa,
        hide_gpa=course.hide_gpa,
        widgets=[_export_widget(widget) for widget in course.widgets],
        tabs=[_export_tab(tab) for tab in course.tabs],
        plugin_settings=[_export_plugin_setting(setting) for setting in course.plugin_settings],
        gradebook=gradebook.export_course_gradebook(course),
        resource_files=_export_course_resources(course, base_dir=base_dir, error_detail=error_detail),
        lms_link=lms_link,
        event_types=_export_course_event_types(course),
        sections=_export_course_sections(course),
        events=_export_course_events(course),
    )


def _export_todo_state(db: Session, semester: models.Semester) -> Optional[schemas.TodoSemesterExport]:
    state = todo.get_semester_state(db, semester)
    if not state.sections and not state.tasks:
        return None
    return schemas.TodoSemesterExport(
        sections=[
            schemas.TodoSectionExport(
                id=section.id,
                name=section.name,
                created_at=section.created_at,
                updated_at=section.updated_at,
            )
            for section in state.sections
        ],
        tasks=[
            schemas.TodoTaskExport(
                id=task.id,
                title=task.title,
                note=task.note,
                due_date=task.due_date,
                due_time=task.due_time,
                priority=task.priority,
                completed=task.completed,
                course_id=task.course_id,
                section_id=task.section_id,
                origin_section_id=task.origin_section_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
            for task in state.tasks
        ],
    )


def _export_lms_integrations(db: Session, current_user: models.User) -> list[schemas.LmsIntegrationExport]:
    records = (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.user_id == current_user.id)
        .order_by(models.LmsIntegration.display_name.asc(), models.LmsIntegration.created_at.asc())
        .all()
    )
    return [
        schemas.LmsIntegrationExport(
            id=record.id,
            display_name=record.display_name,
            provider=record.provider,
            status=record.status,
            config=json.loads(record.config_json or "{}"),
            credentials=decrypt_credentials(record.credentials_encrypted) if record.credentials_encrypted else {},
            last_checked_at=record.last_checked_at,
            last_error=_export_lms_error(record.last_error_code, record.last_error_message),
            summary=None,
        )
        for record in records
    ]


def export_user_data(
    db: Session,
    current_user: models.User,
    *,
    base_dir: Path,
    error_detail: Callable[[str, str], dict],
) -> schemas.UserDataExport:
    programs = crud.get_programs(db, user_id=current_user.id)
    programs_export: list[schemas.ProgramExport] = []

    for program in programs:
        semesters_export: list[schemas.SemesterExport] = []
        semester_courses_by_id = {course.id for semester in program.semesters for course in semester.courses}

        for semester in program.semesters:
            semesters_export.append(
                schemas.SemesterExport(
                    id=semester.id,
                    name=semester.name,
                    average_percentage=semester.average_percentage,
                    average_scaled=semester.average_scaled,
                    start_date=semester.start_date,
                    end_date=semester.end_date,
                    reading_week_start=semester.reading_week_start,
                    reading_week_end=semester.reading_week_end,
                    courses=[
                        _export_course(course, base_dir=base_dir, error_detail=error_detail)
                        for course in semester.courses
                    ],
                    widgets=[_export_widget(widget) for widget in semester.widgets],
                    tabs=[_export_tab(tab) for tab in semester.tabs],
                    plugin_settings=[_export_plugin_setting(setting) for setting in semester.plugin_settings],
                    todo=_export_todo_state(db, semester),
                )
            )

        programs_export.append(
            schemas.ProgramExport(
                id=program.id,
                name=program.name,
                cgpa_scaled=program.cgpa_scaled,
                cgpa_percentage=program.cgpa_percentage,
                gpa_scaling_table=program.gpa_scaling_table,
                subject_color_map=program.subject_color_map or "{}",
                grad_requirement_credits=program.grad_requirement_credits,
                hide_gpa=program.hide_gpa,
                program_timezone=program.program_timezone or "UTC",
                lms_integration_id=program.lms_integration_id,
                courses=[
                    _export_course(course, base_dir=base_dir, error_detail=error_detail)
                    for course in program.courses
                    if course.id not in semester_courses_by_id
                ],
                semesters=semesters_export,
            )
        )

    user_setting = crud.get_user_setting_dict(current_user)
    return schemas.UserDataExport(
        version=BACKUP_FORMAT_VERSION,
        exported_at=datetime.now(UTC).isoformat(),
        settings=schemas.UserSettingsExport(
            nickname=current_user.nickname,
            gpa_scaling_table=user_setting["gpa_scaling_table"],
            default_course_credit=user_setting["default_course_credit"],
            background_plugin_preload=user_setting["background_plugin_preload"],
        ),
        lms_integrations=_export_lms_integrations(db, current_user),
        programs=programs_export,
    )


def _import_widgets(
    db: Session,
    widgets: list[schemas.WidgetExport],
    *,
    semester_id: Optional[str] = None,
    course_id: Optional[str] = None,
) -> None:
    for widget_data in widgets:
        crud.create_widget(
            db=db,
            widget=schemas.WidgetCreate(
                widget_type=widget_data.widget_type,
                layout_config=widget_data.layout_config,
                settings=widget_data.settings,
                is_removable=widget_data.is_removable,
            ),
            semester_id=semester_id,
            course_id=course_id,
        )


def _import_tabs(
    db: Session,
    tabs: list[schemas.TabExport],
    *,
    semester_id: Optional[str] = None,
    course_id: Optional[str] = None,
) -> None:
    for tab_data in tabs:
        crud.create_tab(
            db=db,
            tab=schemas.TabCreate(
                tab_type=tab_data.tab_type,
                settings=tab_data.settings,
                order_index=tab_data.order_index,
                is_removable=tab_data.is_removable,
                is_draggable=tab_data.is_draggable,
            ),
            semester_id=semester_id,
            course_id=course_id,
        )


def _import_plugin_settings(
    db: Session,
    settings: list[schemas.PluginSettingExport],
    *,
    semester_id: Optional[str] = None,
    course_id: Optional[str] = None,
) -> None:
    for plugin_setting_data in settings:
        crud.upsert_plugin_setting(
            db=db,
            plugin_setting=schemas.PluginSettingCreate(
                plugin_id=plugin_setting_data.plugin_id,
                settings=plugin_setting_data.settings,
            ),
            semester_id=semester_id,
            course_id=course_id,
        )


def _import_course_resources(
    db: Session,
    resources: list[schemas.CourseResourceExport],
    *,
    course_id: str,
    current_user: models.User,
    base_dir: Path,
    error_detail: Callable[[str, str], dict],
) -> None:
    for resource_data in resources:
        if resource_data.resource_kind == "link":
            course_resources.create_external_course_resource(
                db=db,
                course_id=course_id,
                external_url=resource_data.external_url or resource_data.filename_original,
                filename_display=resource_data.filename_display,
            )
            continue

        if not resource_data.content_base64:
            raise HTTPException(
                status_code=422,
                detail=error_detail(
                    "BACKUP_RESOURCE_CONTENT_MISSING",
                    f"Resource '{resource_data.filename_display}' is missing file content.",
                ),
            )
        course_resources.create_course_resource(
            db=db,
            base_dir=base_dir,
            user_id=current_user.id,
            course_id=course_id,
            filename_original=resource_data.filename_original,
            filename_display=resource_data.filename_display,
            mime_type=resource_data.mime_type,
            content=base64.b64decode(resource_data.content_base64),
        )


def _import_course_event_types(
    db: Session,
    course_id: str,
    event_types: list[schemas.CourseEventTypeExport],
    *,
    touch_model_timestamp: Callable[[object], None],
) -> None:
    if not event_types:
        return
    db.query(models.CourseEventType).filter(models.CourseEventType.course_id == course_id).delete(synchronize_session=False)
    db.commit()
    for event_type_data in event_types:
        row = models.CourseEventType(
            course_id=course_id,
            code=event_type_data.code,
            abbreviation=event_type_data.abbreviation,
            track_attendance=event_type_data.track_attendance,
            color=event_type_data.color,
            icon=event_type_data.icon,
            created_at="",
            updated_at="",
        )
        touch_model_timestamp(row)
        db.add(row)
    db.commit()


def _import_course_sections(
    db: Session,
    course_id: str,
    sections: list[schemas.CourseSectionExport],
    *,
    runtime: BackupRuntimeCallbacks,
) -> None:
    for section_data in sections:
        payload = section_data.model_dump(by_alias=False, exclude={"id"})
        runtime.validate_day_of_week(int(payload["day_of_week"]))
        runtime.validate_time_range(payload["start_time"], payload["end_time"])
        runtime.validate_week_range(payload["start_week"], payload["end_week"], "SECTION")
        runtime.validate_section_id(payload["section_id"])
        payload["week_pattern"] = runtime.normalize_week_pattern_input(payload["week_pattern"])
        runtime.validate_section_payload(course_id, payload, db)
        row = models.CourseSection(course_id=course_id, **payload)
        runtime.touch_model_timestamp(row)
        db.add(row)
    db.commit()


def _import_course_events(
    db: Session,
    course_id: str,
    events: list[schemas.CourseEventExport],
    *,
    runtime: BackupRuntimeCallbacks,
) -> None:
    for event_data in events:
        payload = event_data.model_dump(by_alias=False, exclude={"id"})
        runtime.validate_day_of_week(int(payload["day_of_week"]))
        runtime.validate_time_range(payload["start_time"], payload["end_time"])
        runtime.validate_week_range(payload["start_week"], payload["end_week"], "EVENT")
        payload["week_pattern"] = runtime.normalize_week_pattern_input(payload["week_pattern"])
        row = models.CourseEvent(course_id=course_id, **payload)
        runtime.touch_model_timestamp(row)
        db.add(row)
    db.commit()


def _import_course_lms_link(
    db: Session,
    *,
    course: models.Course,
    link_data: Optional[schemas.LmsCourseLinkExport],
    integration_id_map: dict[str, str],
    now_utc_iso: Callable[[], str],
) -> None:
    if link_data is None or not link_data.lms_integration_id:
        return
    mapped_integration_id = integration_id_map.get(link_data.lms_integration_id)
    if not mapped_integration_id:
        return
    row = models.CourseLmsLink(
        course_id=course.id,
        program_id=course.program_id,
        lms_integration_id=mapped_integration_id,
        external_course_id=link_data.external_course_id,
        external_course_code=link_data.external_course_code,
        external_name=link_data.external_name,
        sync_enabled=link_data.sync_enabled,
        last_synced_at=link_data.last_synced_at,
        last_error_code=link_data.last_error.code if link_data.last_error else None,
        last_error_message=link_data.last_error.message if link_data.last_error else None,
        created_at=now_utc_iso(),
        updated_at=now_utc_iso(),
    )
    db.add(row)
    db.commit()


def _import_course_export(
    db: Session,
    *,
    course_data: schemas.CourseExport,
    program_id: str,
    semester_id: Optional[str],
    current_user: models.User,
    integration_id_map: dict[str, str],
    base_dir: Path,
    runtime: BackupRuntimeCallbacks,
) -> models.Course:
    course = crud.create_course(
        db=db,
        course=schemas.CourseCreate(
            name=course_data.name,
            alias=course_data.alias,
            category=course_data.category,
            color=course_data.color,
            credits=course_data.credits,
            grade_percentage=course_data.grade_percentage,
            grade_scaled=course_data.grade_scaled,
            include_in_gpa=course_data.include_in_gpa,
            hide_gpa=course_data.hide_gpa,
        ),
        program_id=program_id,
        semester_id=semester_id,
    )
    _import_widgets(db, course_data.widgets, course_id=course.id)
    _import_tabs(db, course_data.tabs, course_id=course.id)
    _import_plugin_settings(db, course_data.plugin_settings, course_id=course.id)
    if course_data.gradebook is not None:
        gradebook.import_course_gradebook(db, course.id, course_data.gradebook)
    _import_course_event_types(db, course.id, course_data.event_types, touch_model_timestamp=runtime.touch_model_timestamp)
    _import_course_sections(db, course.id, course_data.sections, runtime=runtime)
    _import_course_events(db, course.id, course_data.events, runtime=runtime)
    _import_course_resources(
        db,
        course_data.resource_files,
        course_id=course.id,
        current_user=current_user,
        base_dir=base_dir,
        error_detail=runtime.error_detail,
    )
    _import_course_lms_link(
        db,
        course=course,
        link_data=course_data.lms_link,
        integration_id_map=integration_id_map,
        now_utc_iso=runtime.now_utc_iso,
    )
    return course


def _import_semester_todo(
    db: Session,
    *,
    semester: models.Semester,
    todo_data: Optional[schemas.TodoSemesterExport],
    course_id_map: dict[str, str],
    touch_model_timestamp: Callable[[object], None],
) -> None:
    if todo_data is None:
        return

    section_id_map: dict[str, str] = {}
    for section_data in todo_data.sections:
        row = models.TodoSection(
            id=models.generate_uuid(),
            semester_id=semester.id,
            name=section_data.name,
            created_at=section_data.created_at or "",
            updated_at=section_data.updated_at or "",
        )
        touch_model_timestamp(row)
        db.add(row)
        section_id_map[section_data.id or row.id] = row.id
    db.commit()

    for task_data in todo_data.tasks:
        row = models.TodoTask(
            id=models.generate_uuid(),
            semester_id=semester.id,
            course_id=course_id_map.get(task_data.course_id) if task_data.course_id else None,
            section_id=section_id_map.get(task_data.section_id) if task_data.section_id else None,
            origin_section_id=section_id_map.get(task_data.origin_section_id) if task_data.origin_section_id else None,
            title=task_data.title,
            note=task_data.note,
            due_date=task_data.due_date,
            due_time=task_data.due_time,
            priority=task_data.priority,
            completed=task_data.completed,
            created_at=task_data.created_at or "",
            updated_at=task_data.updated_at or "",
        )
        touch_model_timestamp(row)
        db.add(row)
    db.commit()


def _import_lms_integrations(
    db: Session,
    *,
    current_user: models.User,
    payloads: list[schemas.LmsIntegrationExport],
    now_utc_iso: Callable[[], str],
) -> dict[str, str]:
    integration_id_map: dict[str, str] = {}
    for integration_data in payloads:
        provider_impl = lms_service.get_lms_provider(integration_data.provider)
        config = provider_impl.normalize_integration_config(integration_data.config)
        credentials = provider_impl.normalize_integration_credentials(integration_data.credentials)
        row = models.LmsIntegration(
            user_id=current_user.id,
            display_name=integration_data.display_name,
            provider=provider_impl.provider,
            status=(integration_data.status or "connected").strip() or "connected",
            config_json=json.dumps(config, separators=(",", ":"), sort_keys=True),
            credentials_encrypted=encrypt_credentials(credentials),
            last_checked_at=integration_data.last_checked_at,
            last_error_code=integration_data.last_error.code if integration_data.last_error else None,
            last_error_message=integration_data.last_error.message if integration_data.last_error else None,
            created_at=now_utc_iso(),
            updated_at=now_utc_iso(),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        if integration_data.id:
            integration_id_map[integration_data.id] = row.id
    return integration_id_map


def import_user_data(
    db: Session,
    current_user: models.User,
    data: schemas.UserDataImport,
    *,
    conflict_mode: str,
    include_settings: bool,
    base_dir: Path,
    runtime: BackupRuntimeCallbacks,
) -> dict[str, Any]:
    if conflict_mode not in ["skip", "overwrite", "rename"]:
        raise HTTPException(status_code=400, detail="conflict_mode must be 'skip', 'overwrite', or 'rename'")

    existing_programs = crud.get_programs(db, user_id=current_user.id)
    existing_names = {program.name.lower(): program for program in existing_programs}

    if include_settings and data.settings:
        user_setting = crud.get_user_setting_dict(current_user)
        update_data: dict[str, Any] = {}
        provided_fields = set(data.settings.model_fields_set)
        if data.settings.nickname is not None:
            update_data["nickname"] = data.settings.nickname
        if "gpa_scaling_table" in provided_fields and data.settings.gpa_scaling_table is not None:
            user_setting["gpa_scaling_table"] = data.settings.gpa_scaling_table
        if "default_course_credit" in provided_fields:
            user_setting["default_course_credit"] = data.settings.default_course_credit
        if "background_plugin_preload" in provided_fields:
            user_setting["background_plugin_preload"] = data.settings.background_plugin_preload
        update_data["user_setting"] = json.dumps(user_setting)
        crud.update_user(db, current_user.id, schemas.UserUpdate(**update_data))

    integration_id_map = _import_lms_integrations(
        db,
        current_user=current_user,
        payloads=data.lms_integrations,
        now_utc_iso=runtime.now_utc_iso,
    )

    imported_programs = 0
    skipped_programs = 0
    imported_semesters = 0
    imported_courses = 0

    def import_program_data(program_data: schemas.ProgramExport, program_name: str) -> None:
        nonlocal imported_programs, imported_semesters, imported_courses

        mapped_integration_id = integration_id_map.get(program_data.lms_integration_id) if program_data.lms_integration_id else None
        program = crud.create_program(
            db=db,
            program=schemas.ProgramCreate(
                name=program_name,
                cgpa_scaled=program_data.cgpa_scaled,
                cgpa_percentage=program_data.cgpa_percentage,
                gpa_scaling_table=program_data.gpa_scaling_table,
                subject_color_map=program_data.subject_color_map,
                grad_requirement_credits=program_data.grad_requirement_credits,
                hide_gpa=program_data.hide_gpa,
                program_timezone=program_data.program_timezone,
                lms_integration_id=mapped_integration_id,
            ),
            user_id=current_user.id,
        )
        imported_programs += 1

        for course_data in program_data.courses:
            _import_course_export(
                db,
                course_data=course_data,
                program_id=program.id,
                semester_id=None,
                current_user=current_user,
                integration_id_map=integration_id_map,
                base_dir=base_dir,
                runtime=runtime,
            )
            imported_courses += 1

        for semester_data in program_data.semesters:
            start_date = semester_data.start_date
            end_date = semester_data.end_date
            if start_date is None or end_date is None:
                default_start, default_end = crud.get_default_semester_dates()
                start_date = start_date or default_start
                end_date = end_date or default_end
            runtime.validate_reading_week_or_422(
                start_date,
                end_date,
                semester_data.reading_week_start,
                semester_data.reading_week_end,
            )

            semester = models.Semester(
                program_id=program.id,
                name=semester_data.name,
                average_percentage=semester_data.average_percentage,
                average_scaled=semester_data.average_scaled,
                start_date=start_date,
                end_date=end_date,
                reading_week_start=semester_data.reading_week_start,
                reading_week_end=semester_data.reading_week_end,
            )
            db.add(semester)
            db.commit()
            db.refresh(semester)
            imported_semesters += 1

            _import_widgets(db, semester_data.widgets, semester_id=semester.id)
            _import_tabs(db, semester_data.tabs, semester_id=semester.id)
            _import_plugin_settings(db, semester_data.plugin_settings, semester_id=semester.id)

            course_id_map: dict[str, str] = {}
            for course_data in semester_data.courses:
                course = _import_course_export(
                    db,
                    course_data=course_data,
                    program_id=program.id,
                    semester_id=semester.id,
                    current_user=current_user,
                    integration_id_map=integration_id_map,
                    base_dir=base_dir,
                    runtime=runtime,
                )
                if course_data.id:
                    course_id_map[course_data.id] = course.id
                imported_courses += 1

            _import_semester_todo(
                db,
                semester=semester,
                todo_data=semester_data.todo,
                course_id_map=course_id_map,
                touch_model_timestamp=runtime.touch_model_timestamp,
            )

        logic.recalculate_all_stats(program, db)

    for program_data in data.programs:
        name_lower = program_data.name.lower()
        if name_lower in existing_names:
            if conflict_mode == "skip":
                skipped_programs += 1
                continue
            if conflict_mode == "overwrite":
                existing_program = existing_names[name_lower]
                crud.delete_program(db, program_id=existing_program.id, user_id=current_user.id)
                import_program_data(program_data, program_data.name)
                existing_names[name_lower] = True
                continue
            suffix = 2
            next_name = f"{program_data.name} ({suffix})"
            while next_name.lower() in existing_names:
                suffix += 1
                next_name = f"{program_data.name} ({suffix})"
            import_program_data(program_data, next_name)
            existing_names[next_name.lower()] = True
            continue

        import_program_data(program_data, program_data.name)
        existing_names[name_lower] = True

    return {
        "ok": True,
        "conflict_mode": conflict_mode,
        "imported": {
            "programs": imported_programs,
            "semesters": imported_semesters,
            "courses": imported_courses,
            "lms_integrations": len(data.lms_integrations),
        },
        "skipped": {
            "programs": skipped_programs,
        },
    }
