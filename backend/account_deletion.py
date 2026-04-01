# input:  [SQLAlchemy session, authenticated user model, auth/email-verification helpers, backend ORM models, and course-resource storage helpers]
# output: [account-deletion helper that permanently removes a user plus all owned persisted data and stored course-resource files]
# pos:    [Backend account lifecycle service that coordinates irreversible user deletion across relational data, auth metadata, and local file storage]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

import auth
import course_resources
import email_verification
import models


def _collect_owned_program_ids(db: Session, *, user_id: str) -> list[str]:
    return [
        row_id
        for (row_id,) in (
            db.query(models.Program.id)
            .filter(models.Program.owner_id == user_id)
            .all()
        )
    ]


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
    resource_paths = _collect_owned_resource_paths(db, base_dir=base_dir, user_id=user_id)

    if owned_program_ids:
        unassigned_courses = (
            db.query(models.Course)
            .filter(
                models.Course.program_id.in_(owned_program_ids),
                models.Course.semester_id.is_(None),
            )
            .all()
        )
        for course in unassigned_courses:
            db.delete(course)

        semesters = (
            db.query(models.Semester)
            .filter(models.Semester.program_id.in_(owned_program_ids))
            .all()
        )
        for semester in semesters:
            db.delete(semester)

        programs = (
            db.query(models.Program)
            .filter(models.Program.id.in_(owned_program_ids))
            .all()
        )
        for program in programs:
            db.delete(program)

    (
        db.query(models.EmailVerificationChallenge)
        .filter(models.EmailVerificationChallenge.email == user_email)
        .delete(synchronize_session=False)
    )
    db.delete(user)
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
