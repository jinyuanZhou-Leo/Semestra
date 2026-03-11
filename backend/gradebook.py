# input:  [SQLAlchemy session, gradebook ORM models, GPA logic helpers, and fact-oriented gradebook API schemas]
# output: [course-gradebook domain service for initialization, validation, solver math, note-free fact serialization, and CRUD mutations]
# pos:    [backend gradebook domain layer used by course APIs, import/export flows, and tests without persisting derived projections]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import date, datetime, timezone
import re
from typing import Iterable, Optional

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
ASSESSMENT_STATUS_VALUES = {"planned", "completed", "excluded"}
FORECAST_MODE_VALUES = {"manual", "solver"}
TARGET_MODE_VALUES = {"percentage", "gpa"}


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
    if value and value in GRADEBOOK_COLOR_TOKENS:
        return value
    return "slate"


def _normalize_name(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise GradebookValidationError(f"{field_name} cannot be empty.")
    return normalized


def _touch_gradebook(gradebook: models.CourseGradebook) -> None:
    timestamp = _now_iso()
    gradebook.revision = int(gradebook.revision or 0) + 1
    gradebook.updated_at = timestamp


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
    program = _resolve_course_program(course)
    return logic.get_scaling_table(program)


def _resolve_target_percentage(
    target_mode: str,
    target_value: float,
    scaling_table: dict,
) -> float:
    if target_mode == "percentage":
        return float(target_value)

    threshold = 100.0
    found = False
    for percentage in range(0, 101):
        gpa_value = logic.calculate_gpa(float(percentage), scaling_table)
        if gpa_value >= float(target_value):
            threshold = float(percentage)
            found = True
            break
    if not found:
        raise GradebookValidationError("Unable to resolve GPA target with the current scaling table.")
    return threshold


def _serialize_scenario_scores(
    assessment: models.GradebookAssessment,
) -> list[schemas.GradebookAssessmentScenarioScore]:
    return [
        schemas.GradebookAssessmentScenarioScore(
            scenario_id=score.scenario_id,
            forecast_score=score.forecast_score,
        )
        for score in sorted(
            assessment.scenario_scores,
            key=lambda item: (item.scenario.order_index if item.scenario else 0, item.id),
        )
    ]


def _lookup_forecast_score(assessment: models.GradebookAssessment, scenario_id: Optional[str]) -> Optional[float]:
    if scenario_id is None:
        return None
    for score in assessment.scenario_scores:
        if score.scenario_id == scenario_id:
            return score.forecast_score
    return None


def _select_baseline_scenario(gradebook: models.CourseGradebook) -> Optional[models.GradebookScenario]:
    for scenario in gradebook.scenarios:
        if scenario.id == gradebook.baseline_scenario_id:
            return scenario
    for scenario in gradebook.scenarios:
        if scenario.is_baseline:
            return scenario
    if gradebook.scenarios:
        return sorted(gradebook.scenarios, key=lambda item: item.order_index)[0]
    return None


def _set_baseline_scenario(
    gradebook: models.CourseGradebook,
    scenario: Optional[models.GradebookScenario],
) -> None:
    gradebook.baseline_scenario_id = scenario.id if scenario else None
    for existing in gradebook.scenarios:
        existing.is_baseline = bool(scenario and existing.id == scenario.id)
        _touch_row(existing)


def _build_scenario_summary(
    gradebook: models.CourseGradebook,
    scenario: models.GradebookScenario,
    target_percentage: float,
    scaling_table: dict,
    validation_issues: list[str],
) -> schemas.GradebookScenarioCard:
    scenario_assessments = [assessment for assessment in gradebook.assessments if assessment.status != "excluded"]
    completed_contribution = 0.0
    manual_contribution = 0.0
    solver_weight = 0.0
    completed_weight = 0.0

    for assessment in scenario_assessments:
        if assessment.status == "completed":
            completed_weight += assessment.weight
            score = assessment.actual_score
            if score is not None:
                completed_contribution += (assessment.weight * score) / 100.0
            continue

        if assessment.forecast_mode == "solver":
            solver_weight += assessment.weight
            continue

        forecast_score = _lookup_forecast_score(assessment, scenario.id)
        if forecast_score is not None:
            manual_contribution += (assessment.weight * forecast_score) / 100.0

    remaining_weight = max(0.0, sum(assessment.weight for assessment in scenario_assessments if assessment.status != "completed"))
    fixed_contribution = completed_contribution + manual_contribution
    required_score: Optional[float]
    projected_percentage: Optional[float]
    feasibility = "on_track"

    if validation_issues:
        required_score = None
        projected_percentage = None
        feasibility = "invalid"
    elif solver_weight > 0:
        required_score = ((target_percentage - fixed_contribution) / solver_weight) * 100.0
        projected_percentage = fixed_contribution + (solver_weight * max(0.0, min(required_score, 100.0))) / 100.0
        if required_score <= 0:
            feasibility = "already_secured"
        elif required_score > 100:
            feasibility = "infeasible"
        elif abs(required_score - 100.0) <= 0.01:
            feasibility = "needs_perfection"
        else:
            feasibility = "on_track"
    else:
        projected_percentage = fixed_contribution
        if projected_percentage >= target_percentage:
            required_score = 0.0
            feasibility = "already_secured"
        else:
            required_score = None
            feasibility = "invalid"

    projected_gpa = logic.calculate_gpa(projected_percentage, scaling_table) if projected_percentage is not None else None
    return schemas.GradebookScenarioCard(
        scenario_id=scenario.id,
        scenario_name=scenario.name,
        projected_percentage=round(projected_percentage, 4) if projected_percentage is not None else None,
        projected_gpa=projected_gpa,
        required_score=round(required_score, 4) if required_score is not None else None,
        remaining_weight=round(remaining_weight, 4),
        feasibility=feasibility,
    )


def _build_validation_issues(gradebook: models.CourseGradebook, scaling_table: dict) -> list[str]:
    issues: list[str] = []
    total_weight = sum(assessment.weight for assessment in gradebook.assessments if assessment.status != "excluded")
    if gradebook.target_mode not in TARGET_MODE_VALUES:
        issues.append("Target mode must be percentage or gpa.")
    if not gradebook.scenarios:
        issues.append("At least one scenario is required.")
    if _select_baseline_scenario(gradebook) is None:
        issues.append("A baseline scenario is required.")
    if abs(total_weight - 100.0) > 0.01:
        issues.append("Active assessment weights must sum to 100.00%.")
    if gradebook.target_mode == "gpa":
        try:
            _resolve_target_percentage(gradebook.target_mode, gradebook.target_value, scaling_table)
        except GradebookValidationError as exc:
            issues.append(str(exc))
    return issues


def _build_formula_breakdown(
    target_percentage: float,
    summary_card: schemas.GradebookScenarioCard,
    gradebook: models.CourseGradebook,
) -> list[str]:
    completed_weight = sum(
        assessment.weight for assessment in gradebook.assessments if assessment.status == "completed"
    )
    solver_weight = sum(
        assessment.weight
        for assessment in gradebook.assessments
        if assessment.status == "planned" and assessment.forecast_mode == "solver"
    )
    return [
        f"Target threshold: {target_percentage:.2f}%",
        f"Completed weight: {completed_weight:.2f}%",
        f"Remaining solver weight: {solver_weight:.2f}%",
        f"Baseline required score: {summary_card.required_score:.2f}%" if summary_card.required_score is not None else "Baseline required score: unavailable",
    ]


def ensure_course_gradebook(db: Session, course: models.Course) -> models.CourseGradebook:
    if course.gradebook is not None:
        return course.gradebook

    gradebook = models.CourseGradebook(
        course_id=course.id,
        target_mode="percentage",
        target_value=85.0,
        revision=1,
    )
    _touch_row(gradebook)
    db.add(gradebook)
    db.flush()

    for index, definition in enumerate(BUILTIN_CATEGORY_DEFINITIONS):
        category = models.GradebookAssessmentCategory(
            gradebook_id=gradebook.id,
            name=definition["name"],
            key=definition["key"],
            is_builtin=True,
            color_token=definition["color_token"],
            order_index=index,
            is_archived=False,
        )
        db.add(category)

    baseline = models.GradebookScenario(
        gradebook_id=gradebook.id,
        name="Expected",
        color_token="emerald",
        order_index=0,
        is_baseline=True,
    )
    _touch_row(baseline)
    db.add(baseline)
    db.flush()

    gradebook.baseline_scenario_id = baseline.id
    db.add(gradebook)
    db.flush()
    db.refresh(gradebook)
    apply_course_gradebook_projection(db, gradebook)
    db.refresh(gradebook)
    return gradebook


def get_course_gradebook_or_404(db: Session, course_id: str) -> models.CourseGradebook:
    course = (
        db.query(models.Course)
        .options(
            joinedload(models.Course.program).joinedload(models.Program.owner),
            joinedload(models.Course.semester).joinedload(models.Semester.program).joinedload(models.Program.owner),
            joinedload(models.Course.gradebook)
            .joinedload(models.CourseGradebook.scenarios),
            joinedload(models.Course.gradebook)
            .joinedload(models.CourseGradebook.categories),
            joinedload(models.Course.gradebook)
            .joinedload(models.CourseGradebook.assessments)
            .joinedload(models.GradebookAssessment.scenario_scores)
            .joinedload(models.GradebookScenarioScore.scenario),
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


def _build_gradebook_summary(gradebook: models.CourseGradebook) -> schemas.GradebookSummary:
    course = gradebook.course
    if course is None:
        raise GradebookValidationError("Gradebook must belong to a course.")

    scaling_table = _resolve_gpa_scale(course)
    validation_issues = _build_validation_issues(gradebook, scaling_table)
    try:
        target_percentage = _resolve_target_percentage(gradebook.target_mode, gradebook.target_value, scaling_table)
    except GradebookValidationError:
        target_percentage = 0.0

    baseline_scenario = _select_baseline_scenario(gradebook)
    scenario_cards = [
        _build_scenario_summary(gradebook, scenario, target_percentage, scaling_table, validation_issues)
        for scenario in sorted(gradebook.scenarios, key=lambda item: item.order_index)
    ]

    baseline_card = next((card for card in scenario_cards if card.scenario_id == gradebook.baseline_scenario_id), None)
    if baseline_card is None and scenario_cards:
        baseline_card = scenario_cards[0]

    completed_contribution = 0.0
    for assessment in gradebook.assessments:
        if assessment.status == "completed" and assessment.actual_score is not None:
            completed_contribution += (assessment.weight * assessment.actual_score) / 100.0

    current_actual_percentage = round(completed_contribution, 4) if completed_contribution > 0 else 0.0
    current_actual_gpa = logic.calculate_gpa(current_actual_percentage, scaling_table) if current_actual_percentage is not None else None
    remaining_weight = round(
        sum(assessment.weight for assessment in gradebook.assessments if assessment.status == "planned"),
        4,
    )

    upcoming_due_items = [
        schemas.GradebookUpcomingDueItem(
            assessment_id=assessment.id,
            title=assessment.title,
            due_date=assessment.due_date,
            category_name=assessment.category.name if assessment.category else None,
            category_color_token=assessment.category.color_token if assessment.category else None,
        )
        for assessment in sorted(
            [
                item
                for item in gradebook.assessments
                if item.status == "planned" and item.due_date is not None
            ],
            key=lambda item: (item.due_date, item.order_index),
        )
    ]

    feasibility = baseline_card.feasibility if baseline_card is not None else "invalid"
    formula_breakdown = _build_formula_breakdown(target_percentage, baseline_card, gradebook) if baseline_card is not None else []

    return schemas.GradebookSummary(
        current_actual_percentage=current_actual_percentage,
        current_actual_gpa=current_actual_gpa,
        baseline_target_mode=gradebook.target_mode,
        baseline_target_value=gradebook.target_value,
        baseline_required_score=baseline_card.required_score if baseline_card else None,
        baseline_projected_percentage=baseline_card.projected_percentage if baseline_card else None,
        baseline_projected_gpa=baseline_card.projected_gpa if baseline_card else None,
        remaining_weight=remaining_weight,
        feasibility=feasibility,
        validation_issues=validation_issues,
        formula_breakdown=formula_breakdown,
        scenario_cards=scenario_cards,
        upcoming_due_items=upcoming_due_items,
    )


def build_course_gradebook_payload(gradebook: models.CourseGradebook) -> schemas.CourseGradebook:
    course = gradebook.course
    if course is None:
        raise GradebookValidationError("Gradebook must belong to a course.")

    scaling_table = _resolve_gpa_scale(course)
    return schemas.CourseGradebook(
        course_id=course.id,
        target_mode=gradebook.target_mode,
        target_value=gradebook.target_value,
        baseline_scenario_id=gradebook.baseline_scenario_id,
        scaling_table={str(key): float(value) for key, value in scaling_table.items()},
        scenarios=[
            schemas.GradebookScenario.model_validate(scenario, from_attributes=True)
            for scenario in sorted(gradebook.scenarios, key=lambda item: item.order_index)
        ],
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
                status=assessment.status,
                forecast_mode=assessment.forecast_mode,
                actual_score=assessment.actual_score,
                order_index=assessment.order_index,
                scenario_scores=_serialize_scenario_scores(assessment),
            )
            for assessment in sorted(gradebook.assessments, key=lambda item: item.order_index)
        ],
    )


def apply_course_gradebook_projection(db: Session, gradebook: models.CourseGradebook) -> schemas.CourseGradebook:
    db.flush()
    db.refresh(gradebook)
    for assessment in list(gradebook.assessments):
        db.refresh(assessment)
    return build_course_gradebook_payload(gradebook)


def get_course_gradebook_payload(db: Session, course_id: str) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    payload = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return payload


def update_target(db: Session, course_id: str, payload: schemas.GradebookTargetUpdate) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    if payload.target_mode not in TARGET_MODE_VALUES:
        raise GradebookValidationError("target_mode must be percentage or gpa.")
    gradebook.target_mode = payload.target_mode
    gradebook.target_value = float(payload.target_value)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def create_scenario(db: Session, course_id: str, payload: schemas.GradebookScenarioCreate) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    scenario = models.GradebookScenario(
        gradebook_id=gradebook.id,
        name=_normalize_name(payload.name, "Scenario name"),
        color_token=_normalize_color_token(payload.color_token or "emerald"),
        order_index=len(gradebook.scenarios),
        is_baseline=False,
    )
    _touch_row(scenario)
    db.add(scenario)
    db.flush()

    source_id = payload.duplicate_from_scenario_id or gradebook.baseline_scenario_id
    for assessment in gradebook.assessments:
        copied_score = _lookup_forecast_score(assessment, source_id)
        score_row = models.GradebookScenarioScore(
            assessment_id=assessment.id,
            scenario_id=scenario.id,
            forecast_score=copied_score,
        )
        db.add(score_row)

    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def update_scenario(
    db: Session,
    course_id: str,
    scenario_id: str,
    payload: schemas.GradebookScenarioUpdate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    scenario = next((item for item in gradebook.scenarios if item.id == scenario_id), None)
    if scenario is None:
        raise GradebookNotFoundError("Scenario not found.")
    if payload.name is not None:
        scenario.name = _normalize_name(payload.name, "Scenario name")
    if payload.color_token is not None:
        scenario.color_token = _normalize_color_token(payload.color_token)
    if payload.is_baseline:
        _set_baseline_scenario(gradebook, scenario)
    _touch_row(scenario)
    _touch_gradebook(gradebook)
    db.add(scenario)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def delete_scenario(
    db: Session,
    course_id: str,
    scenario_id: str,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    scenario = next((item for item in gradebook.scenarios if item.id == scenario_id), None)
    if scenario is None:
        raise GradebookNotFoundError("Scenario not found.")
    if len(gradebook.scenarios) <= 1:
        raise GradebookValidationError("At least one scenario must remain.")
    db.delete(scenario)
    db.flush()
    remaining = [item for item in gradebook.scenarios if item.id != scenario_id]
    if gradebook.baseline_scenario_id == scenario_id:
        next_baseline = sorted(remaining, key=lambda item: item.order_index)[0]
        _set_baseline_scenario(gradebook, next_baseline)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def create_category(db: Session, course_id: str, payload: schemas.GradebookCategoryCreate) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    name = _normalize_name(payload.name, "Category name")
    key = _slugify(name)
    existing_keys = {item.key for item in gradebook.categories}
    suffix = 2
    original_key = key
    while key in existing_keys:
        key = f"{original_key}-{suffix}"
        suffix += 1
    category = models.GradebookAssessmentCategory(
        gradebook_id=gradebook.id,
        name=name,
        key=key,
        is_builtin=False,
        color_token=_normalize_color_token(payload.color_token or "slate"),
        order_index=len(gradebook.categories),
        is_archived=False,
    )
    db.add(category)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
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
        if category.is_builtin:
            raise GradebookValidationError("Builtin categories cannot be renamed.")
        category.name = _normalize_name(payload.name, "Category name")
    if payload.color_token is not None:
        category.color_token = _normalize_color_token(payload.color_token)
    if payload.is_archived is not None and not category.is_builtin:
        category.is_archived = bool(payload.is_archived)
    db.add(category)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
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
    if category.is_builtin:
        raise GradebookValidationError("Builtin categories cannot be deleted.")
    if any(assessment.category_id == category.id for assessment in gradebook.assessments):
        raise GradebookConflictError("Category is still used by assessments. Reassign or remove those assessments first.")
    db.delete(category)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def _sync_assessment_scenario_scores(
    db: Session,
    assessment: models.GradebookAssessment,
    scenarios: Iterable[models.GradebookScenario],
    incoming_scores: Optional[list[schemas.GradebookAssessmentScenarioScore]],
) -> None:
    incoming_by_id = {item.scenario_id: item.forecast_score for item in incoming_scores or []}
    existing_by_id = {item.scenario_id: item for item in assessment.scenario_scores}
    for scenario in scenarios:
        existing = existing_by_id.get(scenario.id)
        if existing is None:
            db.add(
                models.GradebookScenarioScore(
                    assessment_id=assessment.id,
                    scenario_id=scenario.id,
                    forecast_score=incoming_by_id.get(scenario.id),
                )
            )
        elif scenario.id in incoming_by_id:
            existing.forecast_score = incoming_by_id[scenario.id]
            db.add(existing)


def create_assessment(
    db: Session,
    course_id: str,
    payload: schemas.GradebookAssessmentCreate,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    if payload.status not in ASSESSMENT_STATUS_VALUES:
        raise GradebookValidationError("Invalid assessment status.")
    if payload.forecast_mode not in FORECAST_MODE_VALUES:
        raise GradebookValidationError("Invalid forecast mode.")
    if payload.category_id and not any(category.id == payload.category_id for category in gradebook.categories):
        raise GradebookValidationError("Selected category does not exist.")

    assessment = models.GradebookAssessment(
        gradebook_id=gradebook.id,
        category_id=payload.category_id,
        title=_normalize_name(payload.title, "Assessment title"),
        due_date=_parse_due_date(payload.due_date),
        weight=float(payload.weight),
        status=payload.status,
        forecast_mode=payload.forecast_mode,
        actual_score=payload.actual_score,
        order_index=len(gradebook.assessments),
    )
    _touch_row(assessment)
    db.add(assessment)
    db.flush()
    _sync_assessment_scenario_scores(db, assessment, gradebook.scenarios, payload.scenario_scores)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
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
    update_data.pop("scenario_scores", None)
    for key, value in update_data.items():
        if key == "title" and value is not None:
            setattr(assessment, key, _normalize_name(value, "Assessment title"))
        elif key == "due_date":
            setattr(assessment, key, _parse_due_date(value))
        else:
            setattr(assessment, key, value)

    if payload.scenario_scores is not None:
        _sync_assessment_scenario_scores(db, assessment, gradebook.scenarios, payload.scenario_scores)

    _touch_row(assessment)
    _touch_gradebook(gradebook)
    db.add(assessment)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
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
    db.flush()
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
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
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def update_scenario_scores(
    db: Session,
    course_id: str,
    payload: schemas.GradebookScenarioScoresUpdateRequest,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    assessment_map = {assessment.id: assessment for assessment in gradebook.assessments}
    scenario_ids = {scenario.id for scenario in gradebook.scenarios}
    for update in payload.updates:
        assessment = assessment_map.get(update.assessment_id)
        if assessment is None:
            raise GradebookValidationError("One or more assessment_ids do not exist.")
        if update.scenario_id not in scenario_ids:
            raise GradebookValidationError("One or more scenario_ids do not exist.")
        existing = next((item for item in assessment.scenario_scores if item.scenario_id == update.scenario_id), None)
        if existing is None:
            db.add(
                models.GradebookScenarioScore(
                    assessment_id=assessment.id,
                    scenario_id=update.scenario_id,
                    forecast_score=update.forecast_score,
                )
            )
        else:
            existing.forecast_score = update.forecast_score
            db.add(existing)
        _touch_row(assessment)
        db.add(assessment)

    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def convert_to_solver(
    db: Session,
    course_id: str,
    payload: schemas.GradebookConvertToSolverRequest,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    target_ids = set(payload.assessment_ids or [assessment.id for assessment in gradebook.assessments if assessment.status == "planned"])
    for assessment in gradebook.assessments:
        if assessment.id in target_ids and assessment.status == "planned":
            assessment.forecast_mode = "solver"
            _touch_row(assessment)
            db.add(assessment)
    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def apply_solved_score(
    db: Session,
    course_id: str,
    payload: schemas.GradebookApplySolvedScoreRequest,
) -> schemas.CourseGradebook:
    gradebook = get_course_gradebook_or_404(db, course_id)
    scenario_card = next((item for item in _build_gradebook_summary(gradebook).scenario_cards if item.scenario_id == payload.scenario_id), None)
    if scenario_card is None or scenario_card.required_score is None:
        raise GradebookValidationError("Selected scenario does not have a solved score to apply.")
    target_ids = set(
        payload.assessment_ids or [
            assessment.id for assessment in gradebook.assessments
            if assessment.status == "planned" and assessment.forecast_mode == "solver"
        ]
    )
    for assessment in gradebook.assessments:
        if assessment.id not in target_ids:
            continue
        existing = next((item for item in assessment.scenario_scores if item.scenario_id == payload.scenario_id), None)
        if existing is None:
            db.add(
                models.GradebookScenarioScore(
                    assessment_id=assessment.id,
                    scenario_id=payload.scenario_id,
                    forecast_score=scenario_card.required_score,
                )
            )
        else:
            existing.forecast_score = scenario_card.required_score
            db.add(existing)
        assessment.forecast_mode = "manual"
        _touch_row(assessment)
        db.add(assessment)

    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result


def export_course_gradebook(course: models.Course) -> Optional[schemas.CourseGradebookExport]:
    if course.gradebook is None:
        return None
    payload = build_course_gradebook_payload(course.gradebook)
    return schemas.CourseGradebookExport(
        target_mode=payload.target_mode,
        target_value=payload.target_value,
        baseline_scenario_id=payload.baseline_scenario_id,
        scenarios=[
            schemas.GradebookScenarioExport(
                name=scenario.name,
                color_token=scenario.color_token,
                order_index=scenario.order_index,
                is_baseline=scenario.is_baseline,
            )
            for scenario in payload.scenarios
        ],
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
                status=assessment.status,
                forecast_mode=assessment.forecast_mode,
                actual_score=assessment.actual_score,
                order_index=assessment.order_index,
                scenario_scores=assessment.scenario_scores,
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
    for scenario in list(gradebook.scenarios):
        db.delete(scenario)
    db.flush()

    gradebook.target_mode = payload.target_mode
    gradebook.target_value = payload.target_value
    gradebook.baseline_scenario_id = None

    scenarios_by_order: list[models.GradebookScenario] = []
    for scenario_data in sorted(payload.scenarios, key=lambda item: item.order_index):
        scenario = models.GradebookScenario(
            gradebook_id=gradebook.id,
            name=scenario_data.name,
            color_token=_normalize_color_token(scenario_data.color_token),
            order_index=scenario_data.order_index,
            is_baseline=scenario_data.is_baseline,
        )
        _touch_row(scenario)
        db.add(scenario)
        db.flush()
        scenarios_by_order.append(scenario)

    if scenarios_by_order:
        baseline = next((scenario for scenario in scenarios_by_order if scenario.is_baseline), scenarios_by_order[0])
        _set_baseline_scenario(gradebook, baseline)

    categories_by_key: dict[str, models.GradebookAssessmentCategory] = {}
    for category_data in sorted(payload.categories, key=lambda item: item.order_index):
        category = models.GradebookAssessmentCategory(
            gradebook_id=gradebook.id,
            name=category_data.name,
            key=category_data.key or _slugify(category_data.name),
            is_builtin=category_data.is_builtin,
            color_token=_normalize_color_token(category_data.color_token),
            order_index=category_data.order_index,
            is_archived=category_data.is_archived,
        )
        db.add(category)
        db.flush()
        categories_by_key[category.key] = category

    scenarios_by_name = {scenario.name: scenario for scenario in scenarios_by_order}
    scenarios_by_position = {index: scenario for index, scenario in enumerate(scenarios_by_order)}
    for assessment_data in sorted(payload.assessments, key=lambda item: item.order_index):
        category = categories_by_key.get(assessment_data.category_key or "")
        assessment = models.GradebookAssessment(
            gradebook_id=gradebook.id,
            category_id=category.id if category else None,
            title=assessment_data.title,
            due_date=assessment_data.due_date,
            weight=assessment_data.weight,
            status=assessment_data.status,
            forecast_mode=assessment_data.forecast_mode,
            actual_score=assessment_data.actual_score,
            order_index=assessment_data.order_index,
        )
        _touch_row(assessment)
        db.add(assessment)
        db.flush()
        for index, score_data in enumerate(assessment_data.scenario_scores):
            scenario = next(
                (
                    item for item in scenarios_by_order
                    if item.id == score_data.scenario_id
                ),
                None,
            )
            if scenario is None:
                scenario = scenarios_by_position.get(index) or scenarios_by_name.get(
                    next(iter(scenarios_by_name.keys()), "")
                )
            if scenario is None:
                continue
            db.add(
                models.GradebookScenarioScore(
                    assessment_id=assessment.id,
                    scenario_id=scenario.id,
                    forecast_score=score_data.forecast_score,
                )
            )

    _touch_gradebook(gradebook)
    db.add(gradebook)
    result = apply_course_gradebook_projection(db, gradebook)
    db.commit()
    db.refresh(gradebook)
    return result
