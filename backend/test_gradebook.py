# input:  [unittest, in-memory SQLAlchemy session setup, gradebook domain service, and backend schemas/models]
# output: [unit tests covering gradebook initialization, category reassignment, preference updates, percentage and point-based score persistence, and score-first assessment behavior]
# pos:    [backend regression tests for the simplified built-in gradebook service and import-safe payload helpers, including points-to-percentage assessment input]
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
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()

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

    def test_builtin_categories_are_initialized(self) -> None:
        payload = self._payload()
        self.assertEqual(payload.target_gpa, 4.0)
        self.assertEqual(payload.forecast_model, schemas.GradebookForecastModel.AUTO)
        self.assertEqual(
            [category.name for category in payload.categories],
            ["Quiz", "Exam", "Assignment", "Project", "Lab", "Presentation", "Participation"],
        )

    def test_delete_category_reassigns_assessments_to_uncategorized(self) -> None:
        payload = self._payload()
        custom = gradebook.create_category(
            self.db,
            self.course_id,
            schemas.GradebookCategoryCreate(name="Reflection", color_token="rose"),
        )
        reflection_category = next(category for category in custom.categories if category.name == "Reflection")

        created = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=reflection_category.id,
                title="Journal",
                due_date=date(2026, 2, 10),
                weight=20.0,
                score=None,
            ),
        )
        assessment_id = created.assessments[0].id

        updated = gradebook.delete_category(self.db, self.course_id, reflection_category.id)
        reassigned = next(assessment for assessment in updated.assessments if assessment.id == assessment_id)

        self.assertIsNone(reassigned.category_id)

    def test_delete_builtin_category_reassigns_assessments_to_uncategorized(self) -> None:
        payload = self._payload()
        builtin_category = payload.categories[0]

        created = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=builtin_category.id,
                title="Quiz 1",
                due_date=date(2026, 2, 3),
                weight=10.0,
                score=None,
            ),
        )
        assessment_id = created.assessments[0].id

        updated = gradebook.delete_category(self.db, self.course_id, builtin_category.id)
        reassigned = next(assessment for assessment in updated.assessments if assessment.id == assessment_id)

        self.assertIsNone(reassigned.category_id)

    def test_score_is_persisted_as_percentage(self) -> None:
        payload = self._payload()
        category_id = payload.categories[0].id

        created = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Midterm",
                due_date=date(2026, 2, 15),
                weight=30.0,
                score=82.5,
            ),
        )

        self.assertEqual(created.assessments[0].score, 82.5)

    def test_points_are_persisted_and_converted_to_percentage(self) -> None:
        payload = self._payload()
        category_id = payload.categories[0].id

        created = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Lab Report",
                due_date=date(2026, 2, 18),
                weight=15.0,
                score=None,
                points_earned=18.0,
                points_possible=20.0,
            ),
        )

        self.assertEqual(created.assessments[0].points_earned, 18.0)
        self.assertEqual(created.assessments[0].points_possible, 20.0)
        self.assertEqual(created.assessments[0].score, 90.0)

    def test_manual_score_update_clears_existing_points(self) -> None:
        payload = self._payload()
        category_id = payload.categories[0].id

        created = gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Quiz 2",
                due_date=date(2026, 2, 20),
                weight=10.0,
                points_earned=9.0,
                points_possible=10.0,
            ),
        )

        updated = gradebook.update_assessment(
            self.db,
            self.course_id,
            created.assessments[0].id,
            schemas.GradebookAssessmentUpdate(
                score=85.0,
                points_earned=None,
                points_possible=None,
            ),
        )

        assessment = next(item for item in updated.assessments if item.id == created.assessments[0].id)
        self.assertEqual(assessment.score, 85.0)
        self.assertIsNone(assessment.points_earned)
        self.assertIsNone(assessment.points_possible)

    def test_update_preferences_persists_target_gpa_and_model(self) -> None:
        updated = gradebook.update_preferences(
            self.db,
            self.course_id,
            schemas.GradebookPreferencesUpdate(
                target_gpa=3.7,
                forecast_model=schemas.GradebookForecastModel.SIMPLE_MINIMUM_NEEDED,
            ),
        )

        self.assertEqual(updated.target_gpa, 3.7)
        self.assertEqual(updated.forecast_model, schemas.GradebookForecastModel.SIMPLE_MINIMUM_NEEDED)

    def test_custom_hex_category_color_is_preserved(self) -> None:
        created = gradebook.create_category(
            self.db,
            self.course_id,
            schemas.GradebookCategoryCreate(name="Reflection", color_token="#123abc"),
        )

        category = next(category for category in created.categories if category.name == "Reflection")
        self.assertEqual(category.color_token, "#123abc")

    def test_gradebook_mutations_do_not_overwrite_course_grade_fields(self) -> None:
        course = self.db.query(models.Course).filter(models.Course.id == self.course_id).first()
        assert course is not None
        course.grade_percentage = 72.5
        course.grade_scaled = 2.7
        self.db.add(course)
        self.db.commit()

        payload = self._payload()
        category_id = payload.categories[0].id

        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Final",
                due_date=date(2026, 4, 21),
                weight=100.0,
                score=None,
            ),
        )

        self.db.refresh(course)
        self.assertEqual(course.grade_percentage, 72.5)
        self.assertEqual(course.grade_scaled, 2.7)


if __name__ == "__main__":
    unittest.main()
