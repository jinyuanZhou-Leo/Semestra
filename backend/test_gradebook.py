# input:  [unittest, in-memory SQLAlchemy session setup, gradebook domain service, and backend schemas/models]
# output: [unit tests covering gradebook initialization, category guards, due-date sorting, projection stability, and solver math]
# pos:    [backend regression tests for the built-in gradebook domain service]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import unittest
from datetime import date
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import gradebook
import models
import schemas
from database import Base


class GradebookServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = TestingSessionLocal()

        user = models.User(email="gradebook@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(user)
        self.db.flush()

        program = models.Program(name="Engineering", owner_id=user.id, program_timezone="America/Toronto")
        self.db.add(program)
        self.db.flush()

        semester = models.Semester(
            name="Winter 2026",
            program_id=program.id,
            start_date=date(2026, 1, 5),
            end_date=date(2026, 4, 20),
        )
        self.db.add(semester)
        self.db.flush()

        course = models.Course(
            name="MIE100",
            category="MIE",
            credits=0.5,
            program_id=program.id,
            semester_id=semester.id,
        )
        self.db.add(course)
        self.db.commit()
        self.course_id = course.id

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _payload(self) -> schemas.CourseGradebook:
        return gradebook.get_course_gradebook_payload(self.db, self.course_id)

    def _revision(self) -> int:
        return self._payload().revision

    def test_builtin_categories_are_initialized(self) -> None:
        payload = self._payload()
        self.assertEqual(payload.scenarios[0].name, "Expected")
        self.assertEqual(
            [category.name for category in payload.categories],
            ["Quiz", "Exam", "Assignment", "Project", "Lab", "Presentation", "Participation"],
        )

    def test_cannot_delete_category_in_use(self) -> None:
        payload = self._payload()
        custom = gradebook.create_category(
            self.db,
            self.course_id,
            schemas.GradebookCategoryCreate(
                revision=payload.revision,
                name="Reflection",
                color_token="rose",
            ),
        )
        reflection_category = next(category for category in custom.categories if category.name == "Reflection")
        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                revision=custom.revision,
                category_id=reflection_category.id,
                title="Quiz 1",
                due_date=date(2026, 2, 10),
                weight=20.0,
                status=schemas.GradebookAssessmentStatus.PLANNED,
                forecast_mode=schemas.GradebookForecastMode.MANUAL,
                scenario_scores=[schemas.GradebookAssessmentScenarioScore(scenario_id=custom.scenarios[0].id, forecast_score=88.0)],
            ),
        )

        with self.assertRaises(gradebook.GradebookConflictError):
            gradebook.delete_category(
                self.db,
                self.course_id,
                reflection_category.id,
                schemas.GradebookRevisionRequest(revision=self._revision()),
            )

    def test_upcoming_due_items_are_sorted_and_ignore_completed_or_excluded(self) -> None:
        payload = self._payload()
        scenario_id = payload.scenarios[0].id
        category_id = payload.categories[0].id

        def create_item(title: str, due_date: date, status: schemas.GradebookAssessmentStatus) -> None:
            gradebook.create_assessment(
                self.db,
                self.course_id,
                schemas.GradebookAssessmentCreate(
                    revision=self._revision(),
                    category_id=category_id,
                    title=title,
                    due_date=due_date,
                    weight=25.0,
                    status=status,
                    forecast_mode=schemas.GradebookForecastMode.MANUAL,
                    scenario_scores=[schemas.GradebookAssessmentScenarioScore(scenario_id=scenario_id, forecast_score=80.0)],
                ),
            )

        create_item("Essay", date(2026, 4, 2), schemas.GradebookAssessmentStatus.PLANNED)
        create_item("Completed Quiz", date(2026, 3, 1), schemas.GradebookAssessmentStatus.COMPLETED)
        create_item("Midterm", date(2026, 3, 15), schemas.GradebookAssessmentStatus.PLANNED)
        create_item("Dropped Lab", date(2026, 3, 10), schemas.GradebookAssessmentStatus.EXCLUDED)

        latest = self._payload()
        self.assertEqual([item.title for item in latest.summary.upcoming_due_items], ["Midterm", "Essay"])

    def test_category_and_due_date_changes_do_not_change_projection(self) -> None:
        payload = self._payload()
        scenario_id = payload.scenarios[0].id
        quiz_category = next(category for category in payload.categories if category.name == "Quiz")
        exam_category = next(category for category in payload.categories if category.name == "Exam")

        latest = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                revision=payload.revision,
                category_id=quiz_category.id,
                title="Final",
                due_date=date(2026, 4, 20),
                weight=100.0,
                status=schemas.GradebookAssessmentStatus.PLANNED,
                forecast_mode=schemas.GradebookForecastMode.MANUAL,
                scenario_scores=[schemas.GradebookAssessmentScenarioScore(scenario_id=scenario_id, forecast_score=87.0)],
            ),
        )
        assessment_id = latest.assessments[0].id
        before_projection = latest.summary.baseline_projected_percentage

        updated = gradebook.update_assessment(
            self.db,
            self.course_id,
            assessment_id,
            schemas.GradebookAssessmentUpdate(
                revision=latest.revision,
                category_id=exam_category.id,
                due_date=date(2026, 4, 25),
            ),
        )

        self.assertEqual(before_projection, updated.summary.baseline_projected_percentage)

    def test_solver_required_score_respects_gpa_target_threshold(self) -> None:
        payload = self._payload()
        scenario_id = payload.scenarios[0].id
        category_id = payload.categories[0].id

        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                revision=payload.revision,
                category_id=category_id,
                title="Midterm",
                due_date=date(2026, 2, 15),
                weight=50.0,
                status=schemas.GradebookAssessmentStatus.COMPLETED,
                forecast_mode=schemas.GradebookForecastMode.MANUAL,
                actual_score=80.0,
                scenario_scores=[schemas.GradebookAssessmentScenarioScore(scenario_id=scenario_id, forecast_score=80.0)],
            ),
        )

        after_completed = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                revision=self._revision(),
                category_id=category_id,
                title="Final",
                due_date=date(2026, 4, 21),
                weight=50.0,
                status=schemas.GradebookAssessmentStatus.PLANNED,
                forecast_mode=schemas.GradebookForecastMode.SOLVER,
                scenario_scores=[schemas.GradebookAssessmentScenarioScore(scenario_id=scenario_id, forecast_score=None)],
            ),
        )

        updated_target = gradebook.update_target(
            self.db,
            self.course_id,
            schemas.GradebookTargetUpdate(
                revision=after_completed.revision,
                target_mode=schemas.GradebookTargetMode.GPA,
                target_value=4.0,
            ),
        )

        self.assertAlmostEqual(updated_target.summary.baseline_required_score or 0.0, 90.0, places=2)


if __name__ == "__main__":
    unittest.main()
