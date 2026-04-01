# input:  [SQLAlchemy session, authenticated user model, auth/email-verification helpers, backend ORM models, and course-resource storage helpers]
# output: [account-deletion helper that permanently removes a user plus all owned persisted data and stored course-resource files with explicit child-first cleanup]
# pos:    [Backend account lifecycle service that coordinates irreversible user deletion across relational data, auth metadata, UI workspace records, and local file storage]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from pathlib import Path

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

import auth
import course_resources
import email_verification
import models


PLUGIN_ENTITY_RECORDS_DELETE_STATEMENT = text(
    """
    DELETE FROM plugin_entity_records
    WHERE scope_type = :scope_type AND scope_id IN :scope_ids
    """
).bindparams(bindparam("scope_ids", expanding=True))


def _has_table(db: Session, table_name: str) -> bool:
    result = db.execute(
        text("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :table_name LIMIT 1"),
        {"table_name": table_name},
    ).scalar()
    return bool(result)


def _collect_owned_program_ids(db: Session, *, user_id: str) -> list[str]:
    return [
        row_id
        for (row_id,) in (
            db.query(models.Program.id)
            .filter(models.Program.owner_id == user_id)
            .all()
        )
    ]


def _collect_owned_semester_ids(db: Session, *, program_ids: list[str]) -> list[str]:
    if not program_ids:
        return []
    return [
        row_id
        for (row_id,) in (
            db.query(models.Semester.id)
            .filter(models.Semester.program_id.in_(program_ids))
            .all()
        )
    ]


def _collect_owned_course_ids(db: Session, *, program_ids: list[str], semester_ids: list[str]) -> list[str]:
    if not program_ids and not semester_ids:
        return []
    query = db.query(models.Course.id)
    if program_ids and semester_ids:
        query = query.filter(
            (models.Course.program_id.in_(program_ids)) | (models.Course.semester_id.in_(semester_ids))
        )
    elif program_ids:
        query = query.filter(models.Course.program_id.in_(program_ids))
    else:
        query = query.filter(models.Course.semester_id.in_(semester_ids))
    return [row_id for (row_id,) in query.all()]


def _collect_owned_resource_paths(db: Session, *, base_dir: Path, user_id: str) -> list[Path]:
    resources = (
        db.query(models.CourseResourceFile)
        .join(models.Course, models.CourseResourceFile.course_id == models.Course.id)
        .join(models.Program, models.Course.program_id == models.Program.id)
        .filter(models.Program.owner_id == user_id)
        .all()
    )
    collected: list[Path] = []
    seen: set[Path] = set()
    for resource in resources:
        if resource.resource_kind != "file" or not resource.storage_path:
            continue
        absolute_path = course_resources.resolve_absolute_path(base_dir, resource)
        if absolute_path in seen:
            continue
        seen.add(absolute_path)
        collected.append(absolute_path)
    return collected


def delete_user_account(db: Session, *, base_dir: Path, user: models.User) -> None:
    user_email = (user.email or "").strip().lower()
    user_id = user.id
    owned_program_ids = _collect_owned_program_ids(db, user_id=user_id)
    owned_semester_ids = _collect_owned_semester_ids(db, program_ids=owned_program_ids)
    owned_course_ids = _collect_owned_course_ids(
        db,
        program_ids=owned_program_ids,
        semester_ids=owned_semester_ids,
    )
    owned_gradebook_ids = [
        row_id
        for (row_id,) in (
            db.query(models.CourseGradebook.id)
            .filter(models.CourseGradebook.course_id.in_(owned_course_ids))
            .all()
        )
    ] if owned_course_ids else []
    resource_paths = _collect_owned_resource_paths(db, base_dir=base_dir, user_id=user_id)
    has_plugin_entity_records = _has_table(db, "plugin_entity_records")

    if owned_course_ids:
        if has_plugin_entity_records:
            db.execute(
                PLUGIN_ENTITY_RECORDS_DELETE_STATEMENT,
                {"scope_type": "course", "scope_ids": owned_course_ids},
            )
        (
            db.query(models.WorkspaceTabOrderEntry)
            .filter(models.WorkspaceTabOrderEntry.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.TabSetting)
            .filter(models.TabSetting.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Tab)
            .filter(models.Tab.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Widget)
            .filter(models.Widget.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.ProgramCoursePluginActivation)
            .filter(models.ProgramCoursePluginActivation.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseLmsLink)
            .filter(models.CourseLmsLink.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseResourceFile)
            .filter(models.CourseResourceFile.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseEvent)
            .filter(models.CourseEvent.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseSection)
            .filter(models.CourseSection.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseEventType)
            .filter(models.CourseEventType.course_id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )
        if owned_gradebook_ids:
            (
                db.query(models.GradebookAssessment)
                .filter(models.GradebookAssessment.gradebook_id.in_(owned_gradebook_ids))
                .delete(synchronize_session=False)
            )
            (
                db.query(models.GradebookAssessmentCategory)
                .filter(models.GradebookAssessmentCategory.gradebook_id.in_(owned_gradebook_ids))
                .delete(synchronize_session=False)
            )
            (
                db.query(models.CourseGradebook)
                .filter(models.CourseGradebook.id.in_(owned_gradebook_ids))
                .delete(synchronize_session=False)
            )
        (
            db.query(models.Course)
            .filter(models.Course.id.in_(owned_course_ids))
            .delete(synchronize_session=False)
        )

    if owned_semester_ids:
        if has_plugin_entity_records:
            db.execute(
                PLUGIN_ENTITY_RECORDS_DELETE_STATEMENT,
                {"scope_type": "semester", "scope_ids": owned_semester_ids},
            )
        (
            db.query(models.WorkspaceTabOrderEntry)
            .filter(models.WorkspaceTabOrderEntry.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.TabSetting)
            .filter(models.TabSetting.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Tab)
            .filter(models.Tab.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Widget)
            .filter(models.Widget.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.TodoTask)
            .filter(models.TodoTask.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.TodoSection)
            .filter(models.TodoSection.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.SemesterPluginActivation)
            .filter(models.SemesterPluginActivation.semester_id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Semester)
            .filter(models.Semester.id.in_(owned_semester_ids))
            .delete(synchronize_session=False)
        )

    if owned_program_ids:
        if has_plugin_entity_records:
            db.execute(
                PLUGIN_ENTITY_RECORDS_DELETE_STATEMENT,
                {"scope_type": "program", "scope_ids": owned_program_ids},
            )
        (
            db.query(models.TabSetting)
            .filter(models.TabSetting.program_id.in_(owned_program_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.CourseLmsLink)
            .filter(models.CourseLmsLink.program_id.in_(owned_program_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.ProgramPluginInstallation)
            .filter(models.ProgramPluginInstallation.program_id.in_(owned_program_ids))
            .delete(synchronize_session=False)
        )
        (
            db.query(models.Program)
            .filter(models.Program.id.in_(owned_program_ids))
            .delete(synchronize_session=False)
        )

    (
        db.query(models.EmailVerificationChallenge)
        .filter(models.EmailVerificationChallenge.email == user_email)
        .delete(synchronize_session=False)
    )
    (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.user_id == user_id)
        .delete(synchronize_session=False)
    )
    (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .delete(synchronize_session=False)
    )
    db.commit()

    auth.clear_rate_limit(
        db,
        scope=auth.LOGIN_RATE_LIMIT_ACCOUNT_SCOPE,
        raw_key=user_email,
    )
    auth.clear_rate_limit(
        db,
        scope=email_verification.EMAIL_SEND_EMAIL_SCOPE,
        raw_key=user_email,
    )

    for resource_path in resource_paths:
        if resource_path.is_file():
            resource_path.unlink()
