# input:  [FastAPI router/dependencies, backend models/schemas/crud, shared API helpers, schedule support functions, and icalendar export types]
# output: [Course event-type/section/event CRUD routes plus schedule query and export endpoints]
# pos:    [backend API router for course schedule management and calendar export workflows]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from icalendar import Calendar, Event as ICalEvent
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api_common import error_detail, get_event_type_or_404, get_owned_course, get_owned_semester, get_semester_max_week, touch_model_timestamp
from database import get_db
from schedule_support import (
    collect_course_week_items,
    collect_semester_range_items,
    collect_semester_week_items,
    detect_conflicts,
    ensure_builtin_event_types_for_course,
    get_course_semester_and_timezone,
    normalize_event_skip,
    normalize_week_pattern_input,
    parse_export_weeks,
    parse_time_value,
    resolve_week_index,
    serialize_schedule_item,
    validate_event_payload,
    validate_section_payload,
    week_date,
)
import auth
import crud
import models
import schemas

router = APIRouter()


@router.get("/courses/{course_id}/event-types", response_model=list[schemas.CourseEventType])
def get_course_event_types(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    ensure_builtin_event_types_for_course(db, course_id)
    db.commit()
    return (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id)
        .order_by(models.CourseEventType.code.asc())
        .all()
    )


@router.post("/courses/{course_id}/event-types", response_model=schemas.CourseEventType)
def create_course_event_type(
    course_id: str,
    payload: schemas.CourseEventTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    code = payload.code.strip()
    abbreviation = payload.abbreviation.strip()
    if not code:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_EVENT_TYPE_CODE", "code cannot be empty."))
    if not abbreviation:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_EVENT_TYPE_ABBREVIATION", "abbreviation cannot be empty."))

    event_type = models.CourseEventType(
        course_id=course_id,
        code=code,
        abbreviation=abbreviation,
        track_attendance=bool(payload.track_attendance),
        color=payload.color,
        icon=payload.icon,
    )
    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_DUPLICATE", "Duplicate code or abbreviation for this course."),
        )
    db.refresh(event_type)
    return event_type


@router.patch("/courses/{course_id}/event-types/{event_type_code}", response_model=schemas.CourseEventTypePatchResponse)
def update_course_event_type(
    course_id: str,
    event_type_code: str,
    payload: schemas.CourseEventTypeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    event_type = get_event_type_or_404(db, course_id, event_type_code.strip())
    update_data = payload.dict(exclude_unset=True, by_alias=False)
    normalized_count = 0
    previous_track = bool(event_type.track_attendance)

    if "abbreviation" in update_data and update_data["abbreviation"] is not None:
        update_data["abbreviation"] = update_data["abbreviation"].strip()
        if not update_data["abbreviation"]:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_EVENT_TYPE_ABBREVIATION", "abbreviation cannot be empty."),
            )

    old_code = event_type.code
    new_code = None
    if "code" in update_data and update_data["code"] is not None:
        new_code = update_data["code"].strip()
        if not new_code:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_EVENT_TYPE_CODE", "code cannot be empty."),
            )
        if new_code != old_code:
            existing = (
                db.query(models.CourseEventType)
                .filter(
                    models.CourseEventType.course_id == course_id,
                    models.CourseEventType.code == new_code,
                    models.CourseEventType.id != event_type.id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=422,
                    detail=error_detail("EVENT_TYPE_DUPLICATE", "code already exists for this course."),
                )

    for key, value in update_data.items():
        setattr(event_type, key, value)

    if new_code and new_code != old_code:
        db.query(models.CourseEvent).filter(
            models.CourseEvent.course_id == course_id,
            models.CourseEvent.event_type_code == old_code,
        ).update({models.CourseEvent.event_type_code: new_code}, synchronize_session=False)
        db.query(models.CourseSection).filter(
            models.CourseSection.course_id == course_id,
            models.CourseSection.event_type_code == old_code,
        ).update({models.CourseSection.event_type_code: new_code}, synchronize_session=False)

    if (not previous_track) and event_type.track_attendance:
        normalized_count = (
            db.query(models.CourseEvent)
            .filter(
                models.CourseEvent.course_id == course_id,
                models.CourseEvent.event_type_code == event_type.code,
                models.CourseEvent.skip == True,
            )
            .update({models.CourseEvent.skip: False}, synchronize_session=False)
        )

    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_DUPLICATE", "Duplicate abbreviation for this course."),
        )
    db.refresh(event_type)
    return {"event_type": event_type, "normalized_events": normalized_count}


@router.delete("/courses/{course_id}/event-types/{event_type_code}")
def delete_course_event_type(
    course_id: str,
    event_type_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    event_type = (
        db.query(models.CourseEventType)
        .filter(
            models.CourseEventType.course_id == course_id,
            models.CourseEventType.code == event_type_code.strip(),
        )
        .first()
    )
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")
    db.delete(event_type)
    db.commit()
    return {"ok": True}


@router.get("/courses/{course_id}/sections", response_model=list[schemas.CourseSection])
def get_course_sections(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id)
        .order_by(models.CourseSection.day_of_week.asc(), models.CourseSection.start_time.asc())
        .all()
    )


@router.post("/courses/{course_id}/sections", response_model=schemas.CourseSection)
def create_course_section(
    course_id: str,
    section: schemas.CourseSectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    ensure_builtin_event_types_for_course(db, course_id)
    payload = section.dict(by_alias=False)
    payload["section_id"] = payload["section_id"].strip()
    if not payload["section_id"]:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_SECTION_ID", "sectionId cannot be empty."))
    validate_section_payload(course_id, payload, db)

    db_section = models.CourseSection(course_id=course_id, **payload)
    touch_model_timestamp(db_section)
    db.add(db_section)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_DUPLICATE", "sectionId must be unique within course."))
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_CREATE_FAILED", f"Failed to create section: {str(exc)}"),
        ) from exc
    db.refresh(db_section)
    return db_section


@router.patch("/courses/{course_id}/sections/{section_id}", response_model=schemas.CourseSection)
def update_course_section(
    course_id: str,
    section_id: str,
    section_update: schemas.CourseSectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    db_section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = section_update.dict(exclude_unset=True, by_alias=False)
    merged = {
        "event_type_code": update_data.get("event_type_code", db_section.event_type_code),
        "day_of_week": update_data.get("day_of_week", db_section.day_of_week),
        "start_time": update_data.get("start_time", db_section.start_time),
        "end_time": update_data.get("end_time", db_section.end_time),
        "week_pattern": update_data.get("week_pattern", db_section.week_pattern),
        "start_week": update_data.get("start_week", db_section.start_week),
        "end_week": update_data.get("end_week", db_section.end_week),
    }
    validate_section_payload(course_id, merged, db)

    for key, value in update_data.items():
        if key == "event_type_code" and value is not None:
            value = value.strip()
        if key == "week_pattern" and value is not None:
            value = normalize_week_pattern_input(value)
        setattr(db_section, key, value)

    touch_model_timestamp(db_section)
    db.add(db_section)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_UPDATE_CONFLICT", "Failed to update section due to constraint conflict."))
    db.refresh(db_section)
    return db_section


@router.delete("/courses/{course_id}/sections/{section_id}")
def delete_course_section(
    course_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    db_section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(db_section)
    db.commit()
    return {"ok": True}


@router.post("/courses/{course_id}/sections/import", response_model=list[schemas.CourseSection])
def import_course_sections(
    course_id: str,
    payload: schemas.CourseSectionImportRequest,
    mode: str = Query("merge"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    if mode not in {"merge", "replace"}:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_IMPORT_MODE", "mode must be merge or replace."))

    try:
        if mode == "replace":
            db.query(models.CourseSection).filter(models.CourseSection.course_id == course_id).delete(synchronize_session=False)

        for item in payload.items:
            item_payload = item.dict(by_alias=False)
            item_payload["section_id"] = item_payload["section_id"].strip()
            if not item_payload["section_id"]:
                raise HTTPException(status_code=422, detail=error_detail("INVALID_SECTION_ID", "sectionId cannot be empty."))
            validate_section_payload(course_id, item_payload, db)
            db_section = models.CourseSection(course_id=course_id, **item_payload)
            touch_model_timestamp(db_section)
            db.add(db_section)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_IMPORT_CONFLICT", "Section import failed due to duplicate values."))

    return (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id)
        .order_by(models.CourseSection.day_of_week.asc(), models.CourseSection.start_time.asc())
        .all()
    )


@router.get("/courses/{course_id}/events", response_model=list[schemas.CourseEvent])
def get_course_events(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.course_id == course_id)
        .order_by(models.CourseEvent.day_of_week.asc(), models.CourseEvent.start_time.asc())
        .all()
    )


def _create_course_event_record(
    course_id: str,
    payload: schemas.CourseEventCreate,
    db: Session,
    auto_commit: bool = True,
) -> models.CourseEvent:
    ensure_builtin_event_types_for_course(db, course_id)
    event_payload = payload.dict(by_alias=False)
    validate_event_payload(course_id, event_payload, db)
    db_event = models.CourseEvent(course_id=course_id, **event_payload)
    touch_model_timestamp(db_event)
    db.add(db_event)
    try:
        if auto_commit:
            db.commit()
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("EVENT_CREATE_CONFLICT", "Event create failed due to constraint conflict."))
    db.refresh(db_event)
    return db_event


@router.post("/courses/{course_id}/events", response_model=schemas.CourseEvent)
def create_course_event(
    course_id: str,
    payload: schemas.CourseEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return _create_course_event_record(course_id, payload, db, auto_commit=True)


def _update_course_event_record(
    course_id: str,
    event_id: str,
    payload: schemas.CourseEventUpdate,
    db: Session,
    auto_commit: bool = True,
) -> models.CourseEvent:
    db_event = (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.id == event_id, models.CourseEvent.course_id == course_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = payload.dict(exclude_unset=True, by_alias=False)
    merged_payload = {
        "event_type_code": update_data.get("event_type_code", db_event.event_type_code),
        "section_id": update_data.get("section_id", db_event.section_id),
        "day_of_week": update_data.get("day_of_week", db_event.day_of_week),
        "start_time": update_data.get("start_time", db_event.start_time),
        "end_time": update_data.get("end_time", db_event.end_time),
        "week_pattern": update_data.get("week_pattern", db_event.week_pattern),
        "start_week": update_data.get("start_week", db_event.start_week),
        "end_week": update_data.get("end_week", db_event.end_week),
        "skip": update_data.get("skip", db_event.skip),
    }
    validate_event_payload(course_id, merged_payload, db)

    for key, value in update_data.items():
        if key == "event_type_code" and value is not None:
            value = value.strip().upper()
        if key == "week_pattern" and value is not None:
            value = normalize_week_pattern_input(value)
        setattr(db_event, key, value)

    db_event.skip = merged_payload["skip"]
    touch_model_timestamp(db_event)
    db.add(db_event)
    try:
        if auto_commit:
            db.commit()
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("EVENT_UPDATE_CONFLICT", "Event update failed due to constraint conflict."))
    db.refresh(db_event)
    return db_event


@router.patch("/courses/{course_id}/events/{event_id}", response_model=schemas.CourseEvent)
def update_course_event(
    course_id: str,
    event_id: str,
    payload: schemas.CourseEventUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return _update_course_event_record(course_id, event_id, payload, db, auto_commit=True)


def _delete_course_event_record(
    course_id: str,
    event_id: str,
    db: Session,
    auto_commit: bool = True,
) -> None:
    db_event = (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.id == event_id, models.CourseEvent.course_id == course_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(db_event)
    if auto_commit:
        db.commit()
    else:
        db.flush()


@router.delete("/courses/{course_id}/events/{event_id}")
def delete_course_event(
    course_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    _delete_course_event_record(course_id, event_id, db, auto_commit=True)
    return {"ok": True}


def _batch_error_payload(exc: HTTPException) -> dict:
    detail = exc.detail
    if isinstance(detail, dict):
        return {
            "code": detail.get("code", "BATCH_ITEM_FAILED"),
            "message": detail.get("message", "Batch item failed."),
        }
    return {"code": "BATCH_ITEM_FAILED", "message": str(detail)}


def _apply_batch_item(
    course_id: str,
    item: schemas.CourseEventBatchItem,
    db: Session,
    auto_commit: bool,
) -> Optional[models.CourseEvent]:
    if item.op == "create":
        if item.data is None:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "create operation requires data."))
        payload = schemas.CourseEventCreate.model_validate(item.data)
        return _create_course_event_record(course_id, payload, db, auto_commit=auto_commit)

    if item.op == "update":
        if not item.event_id:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "update operation requires eventId."))
        if item.data is None:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "update operation requires data."))
        payload = schemas.CourseEventUpdate.model_validate(item.data)
        return _update_course_event_record(course_id, item.event_id, payload, db, auto_commit=auto_commit)

    if item.op == "delete":
        if not item.event_id:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "delete operation requires eventId."))
        _delete_course_event_record(course_id, item.event_id, db, auto_commit=auto_commit)
        return None

    raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", f"Unsupported op '{item.op}'."))


@router.post("/courses/{course_id}/events/batch", response_model=schemas.CourseEventBatchResponse)
def batch_course_events(
    course_id: str,
    payload: schemas.CourseEventBatchRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    if payload.atomic:
        results: list[dict] = []
        try:
            for index, item in enumerate(payload.items):
                event = _apply_batch_item(course_id, item, db, auto_commit=False)
                result = {"index": index, "ok": True}
                if event is not None:
                    result["event"] = event
                results.append(result)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            err = _batch_error_payload(exc)
            raise HTTPException(status_code=422, detail={"failedIndex": index, **err})
        return {"atomic": True, "total": len(payload.items), "succeeded": len(results), "failed": 0, "results": results}

    results: list[dict] = []
    succeeded = 0
    failed = 0
    for index, item in enumerate(payload.items):
        try:
            event = _apply_batch_item(course_id, item, db, auto_commit=True)
            entry = {"index": index, "ok": True}
            if event is not None:
                entry["event"] = event
            results.append(entry)
            succeeded += 1
        except HTTPException as exc:
            db.rollback()
            results.append({"index": index, "ok": False, "error": _batch_error_payload(exc)})
            failed += 1

    return {"atomic": False, "total": len(payload.items), "succeeded": succeeded, "failed": failed, "results": results}


@router.get("/schedule/course/{course_id}", response_model=schemas.ScheduleResponse)
def get_course_schedule(
    course_id: str,
    week: Optional[int] = None,
    with_conflicts: bool = Query(True, alias="withConflicts"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course, semester, timezone = get_course_semester_and_timezone(db, current_user, course_id)
    resolved_week = resolve_week_index(semester, timezone, week)
    max_week = get_semester_max_week(semester)
    items, warnings = collect_course_week_items(db, course, semester, resolved_week)
    if with_conflicts:
        items = detect_conflicts(items)
    serialized = [serialize_schedule_item(item) for item in items]
    return {"week": resolved_week, "maxWeek": max_week, "items": serialized, "warnings": warnings}


@router.get("/schedule/semester/{semester_id}", response_model=schemas.ScheduleResponse)
def get_semester_schedule(
    semester_id: str,
    week: Optional[int] = None,
    with_conflicts: bool = Query(True, alias="withConflicts"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    program = crud.get_program(db, semester.program_id, current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    timezone = (program.program_timezone or "UTC").strip() or "UTC"
    resolved_week = resolve_week_index(semester, timezone, week)
    max_week = get_semester_max_week(semester)
    items, warnings = collect_semester_week_items(db, semester, resolved_week)
    if with_conflicts:
        items = detect_conflicts(items)
    serialized = [serialize_schedule_item(item) for item in items]
    return {"week": resolved_week, "maxWeek": max_week, "items": serialized, "warnings": warnings}


@router.get("/schedule/semester/{semester_id}/calendar-events", response_model=schemas.ScheduleRangeResponse)
def get_semester_schedule_calendar_events(
    semester_id: str,
    start: date = Query(...),
    end: date = Query(...),
    with_conflicts: bool = Query(True, alias="withConflicts"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    items, warnings = collect_semester_range_items(db=db, semester=semester, start_date=start, end_date=end, with_conflicts=with_conflicts)
    serialized = [serialize_schedule_item(item) for item in items]
    return {"start": start, "end": end, "items": serialized, "warnings": warnings}


def collect_export_items_for_week(
    scope: schemas.ExportScope,
    scope_id: str,
    week: int,
    db: Session,
    current_user: models.User,
) -> tuple[list[dict], models.Semester]:
    if scope == schemas.ExportScope.COURSE:
        course, semester, _timezone = get_course_semester_and_timezone(db, current_user, scope_id)
        items, _warnings = collect_course_week_items(db, course, semester, week)
        return detect_conflicts(items), semester

    semester = get_owned_semester(db, current_user, scope_id)
    items, _warnings = collect_semester_week_items(db, semester, week)
    return detect_conflicts(items), semester


def build_export_payload(
    request: schemas.ScheduleExportRequest,
    export_format: str,
    db: Session,
    current_user: models.User,
) -> dict:
    if request.scope == schemas.ExportScope.COURSE:
        _course, semester, timezone = get_course_semester_and_timezone(db, current_user, request.scope_id)
    else:
        semester = get_owned_semester(db, current_user, request.scope_id)
        program = crud.get_program(db, semester.program_id, current_user.id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        timezone = (program.program_timezone or "UTC").strip() or "UTC"

    weeks = parse_export_weeks(request.range, request.week, request.start_week, request.end_week, semester, timezone)

    merged_items: list[dict] = []
    for week in weeks:
        week_items, _semester = collect_export_items_for_week(request.scope, request.scope_id, week, db, current_user)
        for item in week_items:
            if item["skip"]:
                if export_format == "ics":
                    continue
                if request.skip_render_mode == schemas.SkipRenderMode.HIDE_SKIPPED:
                    continue
                item["render_state"] = "SKIPPED_GRAY"
            else:
                item["render_state"] = "NORMAL"
            merged_items.append(item)

    return {"semester": semester, "weeks": weeks, "items": merged_items}


@router.post("/schedule/export/png", response_model=schemas.JsonExportResponse)
def export_schedule_png(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "png", db, current_user)
    serialized = [serialize_schedule_item(item, include_render_state=True) for item in payload["items"]]
    return {
        "format": "png",
        "scope": request.scope,
        "scopeId": request.scope_id,
        "weeks": payload["weeks"],
        "itemCount": len(serialized),
        "skipRenderMode": request.skip_render_mode,
        "items": serialized,
    }


@router.post("/schedule/export/pdf", response_model=schemas.JsonExportResponse)
def export_schedule_pdf(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "pdf", db, current_user)
    serialized = [serialize_schedule_item(item, include_render_state=True) for item in payload["items"]]
    return {
        "format": "pdf",
        "scope": request.scope,
        "scopeId": request.scope_id,
        "weeks": payload["weeks"],
        "itemCount": len(serialized),
        "skipRenderMode": request.skip_render_mode,
        "items": serialized,
    }


@router.post("/schedule/export/ics")
def export_schedule_ics(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "ics", db, current_user)
    semester = payload["semester"]

    calendar = Calendar()
    calendar.add("prodid", "-//Semestra//Schedule Export//EN")
    calendar.add("version", "2.0")

    for item in payload["items"]:
        event_date = week_date(semester.start_date, item["week"], item["day_of_week"])
        dtstart = datetime.combine(event_date, parse_time_value(item["start_time"]))
        dtend = datetime.combine(event_date, parse_time_value(item["end_time"]))

        ical_event = ICalEvent()
        ical_event.add("uid", f"{item['event_id']}-{item['week']}@semestra")
        ical_event.add("summary", f"{item['course_name']} {item['event_type_code']}")
        ical_event.add("dtstart", dtstart)
        ical_event.add("dtend", dtend)
        if item.get("note"):
            ical_event.add("description", item["note"])
        calendar.add_component(ical_event)

    filename = f"schedule-{request.scope.value}-{request.scope_id}.ics"
    return Response(
        content=calendar.to_ical(),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'},
    )
