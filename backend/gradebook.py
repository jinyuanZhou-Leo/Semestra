# input:  [SQLAlchemy session, simplified gradebook ORM models, GPA logic helpers, and gradebook API schemas]
# output: [course-gradebook domain service for initialization, preference/category/assessment CRUD, and import/export mapping]
# pos:    [backend gradebook domain layer that persists assessment score facts while leaving forecast and plan calculations to the client]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import date, datetime, timezone
import math
import re
from typing import Optional

from sqlalchemy.orm import Session, joinedload

import logic
import models
import schemas

BUILTIN_CATEGORY_DEFINITIONS = [
    {"name": "Quiz", "key": "quiz", "color_token": "blue"},
    {"name": "Exam", "key": "exam", "color_token": "amber"},
    {"name": "Assignment", "key": "assignment", "color_token": "emerald"},
    {"name": "Project", "key": "project", "color_token": "violet"},
    {"name": "Lab", "key": "lab", "color_token": "cyan"},
    {"name": "Presentation", "key": "presentation", "color_token": "rose"},
    {"name": "Participation", "key": "participation", "color_token": "slate"},
]

GRADEBOOK_COLOR_TOKENS = {"emerald", "blue", "amber", "violet", "rose", "slate", "cyan"}


class GradebookError(ValueError):
    pass


class GradebookNotFoundError(GradebookError):
    pass


class GradebookConflictError(GradebookError):
    pass


class GradebookValidationError(GradebookError):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-") or "category"


def _normalize_color_token(value: Optional[str]) -> str:
    normalized = (value or "").strip()
    if normalized in GRADEBOOK_COLOR_TOKENS:
        return normalized
    if re.fullmatch(r"#[0-9a-fA-F]{6}", normalized):
        return normalized.lower()
    return "slate"


def _is_hex_color(value: Optional[str]) -> bool:
    if not value:
        return False
    return re.fullmatch(r"#[0-9a-fA-F]{6}", value.strip()) is not None


def _normalize_name(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise GradebookValidationError(f"{field_name} cannot be empty.")
    return normalized


def _normalize_percentage(value: Optional[float], field_name: str, *, allow_none: bool = True) -> Optional[float]:
    if value is None:
        if allow_none:
            return None
        raise GradebookValidationError(f"{field_name} is required.")
    numeric = float(value)
    if not math.isfinite(numeric) or numeric < 0.0 or numeric > 100.0:
        raise GradebookValidationError(f"{field_name} must be between 0 and 100.")
    return numeric


def _normalize_target_gpa(value: float) -> float:
    numeric = float(value)
    if not math.isfinite(numeric) or numeric < 0.0:
        raise GradebookValidationError("target_gpa must be a non-negative number.")
    return numeric


def _touch_gradebook(gradebook: models.CourseGradebook) -> None:
    gradebook.revision = int(gradebook.revision or 0) + 1
    gradebook.updated_at = _now_iso()


def _touch_row(row: object) -> None:
    timestamp = _now_iso()
    if hasattr(row, "created_at") and not getattr(row, "created_at"):
        setattr(row, "created_at", timestamp)
    if hasattr(row, "updated_at"):
        setattr(row, "updated_at", timestamp)


def _parse_due_date(value: Optional[str | date]) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise GradebookValidationError("due_date must use YYYY-MM-DD format.") from exc


def _resolve_course_program(course: models.Course) -> Optional[models.Program]:
    if course.program is not None:
        return course.program
    if course.semester is not None:
        return course.semester.program
    return None


def _resolve_gpa_scale(course: models.Course) -> dict:
    return logic.get_scaling_table(_resolve_course_program(course))


def ensure_course_gradebook(db: Session, course: models.Course) -> models.CourseGradebook:
    if course.gradebook is not None:
        return course.gradebook

    gradebook = models.CourseGradebook(
        course_id=course.id,
        target_gpa=4.0,
        forecast_model=schemas.GradebookForecastModel.AUTO.value,
        revision=1,
    )
    _touch_row(gradebook)
    db.add(gradebook)
    db.flush()

    for index, definition in enumerate(BUILTIN_CATEGORY_DEFINITIONS):
        db.add(
            models.GradebookAssessmentCategory(
                gradebook_id=gradebook.id,
                name=definition["name"],
                key=definition["key"],
                is_builtin=True,
                color_token=definition["color_token"],
                order_index=index,
                is_archived=False,
            )
        )

    db.flush()
    db.refresh(gradebook)
    return gradebook


def get_course_gradebook_or_404(db: Session, course_id: str) -> models.CourseGradebook:
    course = (
        db.query(models.Course)
        .options(
            joinedload(models.Course.program).joinedload(models.Program.owner),
            joinedload(models.Course.semester).joinedload(models.Semester.program).joinedload(models.Program.owner),
            joinedload(models.Course.gradebook).joinedload(models.CourseGradebook.categories),
            joinedload(models.Course.gradebook)
            .joinedload(models.CourseGradebook.assessments)
            .joinedload(models.GradebookAssessment.category),
        )
        .filter(models.Course.id == course_id)
        .first()
    )
    if course is None:
        raise GradebookNotFoundError("Course not found.")
    return ensure_course_gradebook(db, course)


def build_course_gradebook_payload(gradebook: models.CourseGradebook) -> schemas.CourseGradebook:
    course = gradebook.course
    if course is None:
        raise GradebookValidationError("Gradebook must belong to a course.")

    scaling_table = _resolve_gpa_scale(course)
    return schemas.CourseGradebook(
        course_id=course.id,
        target_gpa=float(gradebook.target_gpa),
        forecast_model=gradebook.forecast_model,
        scaling_table={str(key): float(value) for key, value in scaling_table.items()},
        categories=[
            schemas.GradebookAssessmentCategory.model_validate(category, from_attributes=True)
            for category in sorted(gradebook.categories, key=lambda item: item.order_index)
        ],
        assessments=[
            schemas.GradebookAssessment(
                id=assessment.id,
                category_id=assessment.category_id,
                title=assessment.title,
                due_date=assessment.due_date,
                weight=assessment.weight,
                score=assessment.score,
                order_index=assessment.order_index,
            )
            for assessment in sorted(gradebook.assessments, key=lambda item: item.order_index)
        ],
    )


def get_course_gradebook_payload(db: Session, course_id: str) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    payload = build_course_gradebook_payload(gradebook)
    db.commit()
    db.refresh(gradebook)
    return payload


def update_preferences(
    db: Session,
    course_id: str,
    payload: schemas.GradebookPreferencesUpdate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    if payload.target_gpa is not None:
        gradebook.target_gpa = _normalize_target_gpa(payload.target_gpa)
    if payload.forecast_model is not None:
        gradebook.forecast_model = payload.forecast_model
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def create_category(db: Session, course_id: str, payload: schemas.GradebookCategoryCreate) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    name = _normalize_name(payload.name, "Category name")
    key = _slugify(name)
    existing_keys = {item.key for item in gradebook.categories}
    original_key = key
    suffix = 2
    while key in existing_keys:
        key = f"{original_key}-{suffix}"
        suffix += 1

    db.add(
        models.GradebookAssessmentCategory(
            gradebook_id=gradebook.id,
            name=name,
            key=key,
            is_builtin=False,
            color_token=_normalize_color_token(payload.color_token),
            order_index=len(gradebook.categories),
            is_archived=False,
        )
    )
    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def update_category(
    db: Session,
    course_id: str,
    category_id: str,
    payload: schemas.GradebookCategoryUpdate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    category = next((item for item in gradebook.categories if item.id == category_id), None)
    if category is None:
        raise GradebookNotFoundError("Category not found.")
    if payload.name is not None:
        category.name = _normalize_name(payload.name, "Category name")
    if payload.color_token is not None:
        category.color_token = _normalize_color_token(payload.color_token)
    if payload.is_archived is not None:
        category.is_archived = bool(payload.is_archived)
    db.add(category)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def delete_category(
    db: Session,
    course_id: str,
    category_id: str,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    category = next((item for item in gradebook.categories if item.id == category_id), None)
    if category is None:
        raise GradebookNotFoundError("Category not found.")

    for assessment in gradebook.assessments:
        if assessment.category_id == category.id:
            assessment.category_id = None
            _touch_row(assessment)
            db.add(assessment)

    db.delete(category)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def create_assessment(
    db: Session,
    course_id: str,
    payload: schemas.GradebookAssessmentCreate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    if payload.category_id and not any(category.id == payload.category_id for category in gradebook.categories):
        raise GradebookValidationError("Selected category does not exist.")

    assessment = models.GradebookAssessment(
        gradebook_id=gradebook.id,
        category_id=payload.category_id,
        title=_normalize_name(payload.title, "Assessment title"),
        due_date=_parse_due_date(payload.due_date),
        weight=_normalize_percentage(payload.weight, "weight", allow_none=False) or 0.0,
        score=_normalize_percentage(payload.score, "score"),
        order_index=len(gradebook.assessments),
    )
    _touch_row(assessment)
    db.add(assessment)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def update_assessment(
    db: Session,
    course_id: str,
    assessment_id: str,
    payload: schemas.GradebookAssessmentUpdate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    assessment = next((item for item in gradebook.assessments if item.id == assessment_id), None)
    if assessment is None:
        raise GradebookNotFoundError("Assessment not found.")
    if payload.category_id is not None and payload.category_id and not any(category.id == payload.category_id for category in gradebook.categories):
        raise GradebookValidationError("Selected category does not exist.")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "title" and value is not None:
            setattr(assessment, key, _normalize_name(value, "Assessment title"))
        elif key == "due_date":
            setattr(assessment, key, _parse_due_date(value))
        elif key == "weight" and value is not None:
            assessment.weight = _normalize_percentage(value, "weight", allow_none=False) or 0.0
        elif key == "score":
            assessment.score = _normalize_percentage(value, "score")
        else:
            setattr(assessment, key, value)

    _touch_row(assessment)
    _touch_gradebook(gradebook)
    db.add(assessment)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def delete_assessment(
    db: Session,
    course_id: str,
    assessment_id: str,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    assessment = next((item for item in gradebook.assessments if item.id == assessment_id), None)
    if assessment is None:
        raise GradebookNotFoundError("Assessment not found.")
    db.delete(assessment)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def reorder_assessments(
    db: Session,
    course_id: str,
    payload: schemas.GradebookAssessmentReorderRequest,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    existing_ids = {assessment.id for assessment in gradebook.assessments}
    requested_ids = list(payload.assessment_ids)
    if set(requested_ids) != existing_ids:
        raise GradebookValidationError("assessment_ids must include every assessment exactly once.")

    order_map = {assessment_id: index for index, assessment_id in enumerate(requested_ids)}
    for assessment in gradebook.assessments:
        assessment.order_index = order_map[assessment.id]
        _touch_row(assessment)
        db.add(assessment)

    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result


def export_course_gradebook(course: models.Course) -> Optional[schemas.CourseGradebookExport]:
    if course.gradebook is None:
        return None
    payload = build_course_gradebook_payload(course.gradebook)
    return schemas.CourseGradebookExport(
        target_gpa=payload.target_gpa,
        forecast_model=payload.forecast_model,
        categories=[
            schemas.GradebookAssessmentCategoryExport(
                name=category.name,
                key=category.key,
                is_builtin=category.is_builtin,
                color_token=category.color_token,
                order_index=category.order_index,
                is_archived=category.is_archived,
            )
            for category in payload.categories
        ],
        assessments=[
            schemas.GradebookAssessmentExport(
                title=assessment.title,
                category_key=next((category.key for category in payload.categories if category.id == assessment.category_id), None),
                due_date=assessment.due_date,
                weight=assessment.weight,
                score=assessment.score,
                order_index=assessment.order_index,
            )
            for assessment in payload.assessments
        ],
    )


def import_course_gradebook(
    db: Session,
    course_id: str,
    payload: schemas.CourseGradebookExport,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)

    for assessment in list(gradebook.assessments):
        db.delete(assessment)
    for category in list(gradebook.categories):
        db.delete(category)
    db.flush()

    gradebook.target_gpa = _normalize_target_gpa(payload.target_gpa)
    gradebook.forecast_model = payload.forecast_model

    categories_by_key: dict[str, models.GradebookAssessmentCategory] = {}
    for category_data in sorted(payload.categories, key=lambda item: item.order_index):
        category = models.GradebookAssessmentCategory(
            gradebook_id=gradebook.id,
            name=_normalize_name(category_data.name, "Category name"),
            key=category_data.key or _slugify(category_data.name),
            is_builtin=category_data.is_builtin,
            color_token=_normalize_color_token(category_data.color_token),
            order_index=category_data.order_index,
            is_archived=category_data.is_archived,
        )
        db.add(category)
        db.flush()
        categories_by_key[category.key] = category

    for assessment_data in sorted(payload.assessments, key=lambda item: item.order_index):
        category = categories_by_key.get(assessment_data.category_key or "")
        assessment = models.GradebookAssessment(
            gradebook_id=gradebook.id,
            category_id=category.id if category else None,
            title=_normalize_name(assessment_data.title, "Assessment title"),
            due_date=assessment_data.due_date,
            weight=_normalize_percentage(assessment_data.weight, "weight", allow_none=False) or 0.0,
            score=_normalize_percentage(assessment_data.score, "score"),
            order_index=assessment_data.order_index,
        )
        _touch_row(assessment)
        db.add(assessment)

    _touch_gradebook(gradebook)
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    result = build_course_gradebook_payload(gradebook)
    db.commit()
    return result
