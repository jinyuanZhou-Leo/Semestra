# input:  [SQLAlchemy session, Semester/Course schemas/models, shared CRUD helpers, plugin-governance helpers, layout helpers, and academic recalculation services]
# output: [Semester draft/CRUD functions plus Course CRUD with gradebook setup, stat updates, and semester reassignment validation]
# pos:    [Academic-entity slice of backend CRUD that owns Semester and Course lifecycle outside plugin-specific mutation endpoints]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import gradebook
import logic
import models
import schemas
from crud_layout import create_widget
from crud_plugin_governance import (
    _ensure_default_program_plugin_installations,
    _ensure_default_semester_plugin_activations,
    _refresh_semester_review_ready,
    _serialize_semester_plugin_activation,
)
from crud_shared import (
    BUILTIN_EVENT_TYPES,
    CourseSemesterAssignmentError,
    PluginGovernanceError,
    _now_utc_iso,
    _sync_program_subject_color_map,
    get_default_semester_dates,
)


def get_current_semester_draft(db: Session, program_id: str) -> models.Semester | None:
    return (
        db.query(models.Semester)
        .filter(models.Semester.program_id == program_id, models.Semester.lifecycle_state == "draft")
        .order_by(models.Semester.draft_updated_at.desc(), models.Semester.id.desc())
        .first()
    )


def _serialize_semester_draft(semester: models.Semester) -> dict:
    review_state = _refresh_semester_review_ready(semester)
    return {
        "id": semester.id,
        "program_id": semester.program_id,
        "name": semester.name,
        "average_percentage": semester.average_percentage,
        "average_scaled": semester.average_scaled,
        "start_date": semester.start_date,
        "end_date": semester.end_date,
        "reading_week_start": semester.reading_week_start,
        "reading_week_end": semester.reading_week_end,
        "lifecycle_state": semester.lifecycle_state,
        "creation_step": semester.creation_step,
        "draft_updated_at": semester.draft_updated_at,
        "review_ready": semester.review_ready,
        "review_errors": review_state["review_errors"],
        "plugin_activations": [
            _serialize_semester_plugin_activation(semester, activation, review_state)
            for activation in sorted(
                semester.plugin_activations,
                key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "",
            )
        ] if Session.object_session(semester) else [],
    }


def create_semester_draft(db: Session, program_id: str, payload: schemas.SemesterDraftCreateRequest) -> dict:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Program not found.")
    _ensure_default_program_plugin_installations(db, program)
    existing_draft = get_current_semester_draft(db, program_id)
    if existing_draft is not None:
        raise PluginGovernanceError("SEMESTER_DRAFT_EXISTS", "A Semester draft is already in progress for this Program.")
    create_payload = payload.model_dump()
    start_date = create_payload.get("start_date")
    end_date = create_payload.get("end_date")
    if start_date is None or end_date is None:
        default_start, default_end = get_default_semester_dates()
        create_payload["start_date"] = start_date or default_start
        create_payload["end_date"] = end_date or default_end
    now = _now_utc_iso()
    db_semester = models.Semester(
        **create_payload,
        program_id=program_id,
        lifecycle_state="draft",
        draft_updated_at=now,
        review_ready=False,
    )
    db.add(db_semester)
    try:
        db.flush()
        _ensure_default_semester_plugin_activations(db, db_semester, commit=False)
        db.add(models.Widget(widget_type="course-list", is_removable=False, semester_id=db_semester.id))
        _refresh_semester_review_ready(db_semester)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if get_current_semester_draft(db, program_id) is not None:
            raise PluginGovernanceError("SEMESTER_DRAFT_EXISTS", "A Semester draft is already in progress for this Program.") from exc
        raise
    except Exception:
        db.rollback()
        raise
    db.refresh(db_semester)
    return _serialize_semester_draft(db_semester)


def update_semester_draft(db: Session, semester_id: str, payload: schemas.SemesterDraftUpdateRequest) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be updated through the wizard.")
    update_data = payload.model_dump(exclude_unset=True)
    if "start_date" in update_data and update_data["start_date"] is None:
        update_data["start_date"] = semester.start_date
    if "end_date" in update_data and update_data["end_date"] is None:
        update_data["end_date"] = semester.end_date
    for key, value in update_data.items():
        setattr(semester, key, value)
    semester.draft_updated_at = _now_utc_iso()
    _refresh_semester_review_ready(semester)
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return _serialize_semester_draft(semester)


def finalize_semester_draft(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be finalized.")
    review_state = _refresh_semester_review_ready(semester)
    if not semester.review_ready:
        first_error = next(iter(review_state["review_errors"]), None)
        message = first_error["message"] if isinstance(first_error, dict) and first_error.get("message") else "Resolve the draft review errors before finalizing this Semester."
        raise PluginGovernanceError("SEMESTER_DRAFT_REVIEW_FAILED", message)
    semester.lifecycle_state = "active"
    semester.creation_step = "review"
    semester.draft_updated_at = _now_utc_iso()
    semester.review_ready = True
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return _serialize_semester_draft(semester)


def discard_semester_draft(db: Session, semester_id: str) -> models.Semester | None:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        return None
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be discarded.")
    db.delete(semester)
    db.commit()
    return semester


def get_semesters(db: Session, program_id: str):
    return db.query(models.Semester).filter(models.Semester.program_id == program_id).all()


def create_semester(db: Session, semester: schemas.SemesterCreate, program_id: str):
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Program not found.")
    _ensure_default_program_plugin_installations(db, program)
    payload = semester.model_dump()
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    if start_date is None or end_date is None:
        default_start, default_end = get_default_semester_dates()
        payload["start_date"] = start_date or default_start
        payload["end_date"] = end_date or default_end
    db_semester = models.Semester(**payload, program_id=program_id)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    _ensure_default_semester_plugin_activations(db, db_semester)
    _refresh_semester_review_ready(db_semester)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    if not any(widget.widget_type == "course-list" for widget in db_semester.widgets):
        create_widget(db, schemas.WidgetCreate(widget_type="course-list", is_removable=False), semester_id=db_semester.id)
    return db_semester


def update_semester(db: Session, semester_id: str, semester_update: schemas.SemesterCreate):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not db_semester:
        return None
    update_data = semester_update.model_dump()
    if update_data.get("start_date") is None:
        update_data["start_date"] = db_semester.start_date
    if update_data.get("end_date") is None:
        update_data["end_date"] = db_semester.end_date
    for key, value in update_data.items():
        setattr(db_semester, key, value)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    logic.recalculate_semester_full(db_semester, db)
    return db_semester


def delete_semester(db: Session, semester_id: str):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if db_semester:
        db.delete(db_semester)
        db.commit()
    return db_semester


def get_courses(db: Session, program_id: str, semester_id: str | None = None, unassigned: bool = False):
    query = db.query(models.Course).filter(models.Course.program_id == program_id)
    if unassigned:
        query = query.filter(models.Course.semester_id == None)
    elif semester_id:
        query = query.filter(models.Course.semester_id == semester_id)
    return query.all()


def get_course(db: Session, course_id: str):
    return db.query(models.Course).filter(models.Course.id == course_id).first()


def _validate_course_semester_assignment(db: Session, course: models.Course, semester_id: str | None) -> None:
    if semester_id is None:
        return
    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if target_semester is None:
        raise CourseSemesterAssignmentError("SEMESTER_NOT_FOUND")
    if target_semester.program_id != course.program_id:
        raise CourseSemesterAssignmentError("SEMESTER_PROGRAM_MISMATCH")


def create_course(db: Session, course: schemas.CourseCreate, program_id: str, semester_id: str | None = None):
    db_course = models.Course(**course.model_dump(), program_id=program_id, semester_id=semester_id)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)

    for builtin_type in BUILTIN_EVENT_TYPES:
        db.add(models.CourseEventType(
            course_id=db_course.id,
            code=builtin_type["code"],
            abbreviation=builtin_type["abbreviation"],
            track_attendance=False,
            created_at="",
            updated_at="",
        ))
    db.commit()
    db.refresh(db_course)
    gradebook.ensure_course_gradebook(db, db_course)
    if db_course.program and _sync_program_subject_color_map(db_course.program):
        db.add(db_course.program)
        db.commit()
    db.refresh(db_course)

    logic.update_course_stats(db_course, db)
    if db_course.semester is not None and db_course.semester.lifecycle_state == "draft":
        db_course.semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(db_course.semester)
        db.add(db_course.semester)
        db.commit()
        db.refresh(db_course.semester)
    return db_course


def update_course(db: Session, course_id: str, course_update: schemas.CourseUpdate):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None
    previous_semester_id = db_course.semester_id
    update_data = course_update.model_dump(exclude_unset=True)
    if "semester_id" in update_data:
        _validate_course_semester_assignment(db, db_course, update_data["semester_id"])
    for key, value in update_data.items():
        setattr(db_course, key, value)
    if db_course.program:
        _sync_program_subject_color_map(db_course.program)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)

    logic.update_course_stats(db_course, db)
    if previous_semester_id and previous_semester_id != db_course.semester_id:
        previous_semester = db.query(models.Semester).filter(models.Semester.id == previous_semester_id).first()
        if previous_semester is not None:
            logic.update_semester_stats(previous_semester, db)
            if previous_semester.lifecycle_state == "draft":
                previous_semester.draft_updated_at = _now_utc_iso()
                _refresh_semester_review_ready(previous_semester)
                db.add(previous_semester)
                db.commit()

    current_semester = db_course.semester
    if current_semester is not None and current_semester.lifecycle_state == "draft":
        current_semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(current_semester)
        db.add(current_semester)
        db.commit()
    return db_course


def delete_course(db: Session, course_id: str):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None

    previous_semester_id = db_course.semester_id
    program_id = db_course.program_id
    db.delete(db_course)
    db.commit()

    if previous_semester_id:
        previous_semester = db.query(models.Semester).filter(models.Semester.id == previous_semester_id).first()
        if previous_semester is not None:
            logic.update_semester_stats(previous_semester, db)
            if previous_semester.lifecycle_state == "draft":
                previous_semester.draft_updated_at = _now_utc_iso()
                _refresh_semester_review_ready(previous_semester)
                db.add(previous_semester)
                db.commit()

    if program_id:
        program = db.query(models.Program).filter(models.Program.id == program_id).first()
        if program is not None and _sync_program_subject_color_map(program):
            db.add(program)
            db.commit()

    return db_course
