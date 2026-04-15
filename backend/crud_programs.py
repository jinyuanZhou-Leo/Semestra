# input:  [SQLAlchemy session, Program schemas/models, LMS integrations, shared CRUD helpers, plugin-install defaults, and stats recalculation helpers]
# output: [Program CRUD functions with timezone validation, LMS dependency checks, default plugin installation seeding, subject-color-map sync, and active-Program repair on create/delete]
# pos:    [Program-focused backend CRUD slice that owns Program persistence and cross-program invariants, including keeping the required active Program state valid]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

import logic
import models
import schemas
from crud_plugin_registry import _ensure_default_program_plugin_installations
from crud_shared import (
    ProgramLmsDependencyError,
    _sync_program_subject_color_map,
    ensure_user_active_program,
    normalize_timezone,
)


def get_programs(db: Session, user_id: str, skip: int = 0, limit: int = 100):
    programs = (
        db.query(models.Program)
        .options(selectinload(models.Program.plugin_installations))
        .filter(models.Program.owner_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    for program in programs:
        _ensure_default_program_plugin_installations(db, program)
    return programs


def create_program(db: Session, program: schemas.ProgramCreate, user_id: str):
    payload = program.model_dump()
    payload["program_timezone"] = normalize_timezone(payload.get("program_timezone"))
    lms_integration_id = payload.get("lms_integration_id")
    if lms_integration_id:
        integration = (
            db.query(models.LmsIntegration)
            .filter(models.LmsIntegration.id == lms_integration_id, models.LmsIntegration.user_id == user_id)
            .first()
        )
        if integration is None:
            raise ProgramLmsDependencyError("PROGRAM_LMS_INTEGRATION_NOT_FOUND")
    db_program = models.Program(**payload, owner_id=user_id)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    _ensure_default_program_plugin_installations(db, db_program)
    db.refresh(db_program)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is not None:
        ensure_user_active_program(db, user)
    return db_program


def get_program(db: Session, program_id: str, user_id: str):
    program = (
        db.query(models.Program)
        .options(
            selectinload(models.Program.plugin_installations),
            selectinload(models.Program.semesters).selectinload(models.Semester.courses),
            selectinload(models.Program.semesters).selectinload(models.Semester.widgets),
            selectinload(models.Program.semesters).selectinload(models.Semester.tabs),
        )
        .filter(models.Program.id == program_id, models.Program.owner_id == user_id)
        .first()
    )
    if program is None:
        return None
    _ensure_default_program_plugin_installations(db, program)
    return program


def update_program(db: Session, program_id: str, program_update: schemas.ProgramUpdate, user_id: str):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if not db_program:
        return None
    update_data = program_update.model_dump(exclude_unset=True)
    if "program_timezone" in update_data:
        update_data["program_timezone"] = normalize_timezone(update_data["program_timezone"])
    if "lms_integration_id" in update_data:
        next_integration_id = update_data["lms_integration_id"]
        if next_integration_id:
            integration = (
                db.query(models.LmsIntegration)
                .filter(models.LmsIntegration.id == next_integration_id, models.LmsIntegration.user_id == user_id)
                .first()
            )
            if integration is None:
                raise ProgramLmsDependencyError("PROGRAM_LMS_INTEGRATION_NOT_FOUND")
        if next_integration_id != db_program.lms_integration_id and db_program.has_lms_dependencies:
            raise ProgramLmsDependencyError("PROGRAM_LMS_DEPENDENCIES_EXIST")
    for key, value in update_data.items():
        setattr(db_program, key, value)
    _sync_program_subject_color_map(db_program)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)

    logic.recalculate_all_stats(db_program, db)
    return db_program


def delete_program(db: Session, program_id: str, user_id: str):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if db_program:
        db.delete(db_program)
        db.commit()
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is not None:
            ensure_user_active_program(db, user)
    return db_program
