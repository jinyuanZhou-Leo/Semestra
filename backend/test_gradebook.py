# input:  [unittest, in-memory SQLAlchemy session setup, gradebook domain service, and backend schemas/models]
# output: [unit tests covering gradebook initialization, category reassignment, preference updates, final grade overrides, percentage and point-based score persistence, score-first assessment behavior, and GPA range continuity]
# pos:    [backend regression tests for the simplified built-in gradebook service and import-safe payload helpers, including points-to-percentage assessment input, final grade override persistence, and continuous integer-band GPA matching]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import unittest
from datetime import date
import json
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import gradebook
import crud
import logic
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
        self.user_id = user.id
        self.program_id = program.id
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

    def test_program_tab_settings_seed_new_gradebook_defaults(self) -> None:
        course = self.db.query(models.Course).filter(models.Course.id == self.course_id).first()
        assert course is not None

        existing_gradebook = self.db.query(models.CourseGradebook).filter(models.CourseGradebook.course_id == self.course_id).first()
        if existing_gradebook is not None:
            self.db.delete(existing_gradebook)
            self.db.commit()

        self.db.add(models.TabSetting(
            settings_key="builtin-gradebook",
            program_id=course.program_id,
            settings=json.dumps({
                "forecast_model": "simple_minimum_needed",
                "categories": [
                    {"name": "Problem Set", "color_token": "emerald"},
                    {"name": "Studio", "color_token": "#123abc"},
                ],
            }),
        ))
        self.db.commit()

        payload = self._payload()

        self.assertEqual(payload.forecast_model, schemas.GradebookForecastModel.SIMPLE_MINIMUM_NEEDED)
        self.assertEqual(
            [category.name for category in payload.categories],
            ["Problem Set", "Studio"],
        )
        self.assertEqual(payload.categories[1].color_token, "#123abc")

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

    def test_final_grade_override_updates_course_grade_fact(self) -> None:
        updated = gradebook.update_preferences(
            self.db,
            self.course_id,
            schemas.GradebookPreferencesUpdate(final_grade_percentage_override=91.5),
        )

        course = self.db.query(models.Course).filter(models.Course.id == self.course_id).one()
        self.assertEqual(updated.final_grade_percentage_override, 91.5)
        self.assertEqual(course.grade_percentage, 91.5)
        self.assertEqual(course.grade_scaled, logic.calculate_gpa(91.5, logic.get_scaling_table(course.program)))

    def test_clearing_final_grade_override_restores_calculated_grade(self) -> None:
        payload = self._payload()
        category_id = payload.categories[0].id
        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Midterm",
                weight=40.0,
                score=80.0,
            ),
        )
        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Final",
                weight=60.0,
                score=90.0,
            ),
        )
        gradebook.update_preferences(
            self.db,
            self.course_id,
            schemas.GradebookPreferencesUpdate(final_grade_percentage_override=95.0),
        )

        updated = gradebook.update_preferences(
            self.db,
            self.course_id,
            schemas.GradebookPreferencesUpdate(final_grade_percentage_override=None),
        )

        course = self.db.query(models.Course).filter(models.Course.id == self.course_id).one()
        self.assertIsNone(updated.final_grade_percentage_override)
        self.assertEqual(course.grade_percentage, 86.0)
        self.assertEqual(course.grade_scaled, logic.calculate_gpa(86.0, logic.get_scaling_table(course.program)))

    def test_semester_gradebook_aggregates_due_date_assessments_with_range_filter(self) -> None:
        payload = self._payload()
        category_id = payload.categories[0].id

        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Inside Window",
                due_date=date(2026, 2, 15),
                weight=20.0,
                score=88.0,
            ),
        )
        gradebook.create_assessment(
            self.db,
            self.course_id,
            schemas.GradebookAssessmentCreate(
                category_id=category_id,
                title="Outside Window",
                due_date=date(2026, 4, 10),
                weight=20.0,
                score=91.0,
            ),
        )

        semester = self.db.query(models.Semester).first()
        assert semester is not None

        aggregated = gradebook.get_semester_gradebook_payload(
            self.db,
            semester.id,
            due_start=date(2026, 2, 1),
            due_end=date(2026, 3, 1),
        )

        self.assertEqual(aggregated.semester_id, semester.id)
        self.assertEqual([assessment.title for assessment in aggregated.assessments], ["Inside Window"])
        self.assertEqual(aggregated.assessments[0].course_id, self.course_id)
        self.assertEqual(aggregated.assessments[0].course_name, "MIE100")

    def test_custom_hex_category_color_is_preserved(self) -> None:
        created = gradebook.create_category(
            self.db,
            self.course_id,
            schemas.GradebookCategoryCreate(name="Reflection", color_token="#123abc"),
        )

        category = next(category for category in created.categories if category.name == "Reflection")
        self.assertEqual(category.color_token, "#123abc")

    def test_calculate_gpa_treats_adjacent_integer_ranges_as_continuous(self) -> None:
        scaling_table = {
            "90-100": 4.0,
            "85-89": 3.7,
            "0-84": 0.0,
        }

        self.assertEqual(logic.calculate_gpa(89.5, scaling_table), 3.7)
        self.assertEqual(logic.calculate_gpa(84.5, scaling_table), 0.0)

    def test_user_gpa_table_update_recomputes_inherited_course_grades(self) -> None:
        user = self.db.query(models.User).filter(models.User.id == self.user_id).one()
        user.user_setting = json.dumps({
            "gpa_scaling_table": json.dumps({
                "90-100": 4.0,
                "85-89": 3.7,
                "80-84": 3.0,
            }),
        })
        course = self.db.query(models.Course).filter(models.Course.id == self.course_id).one()
        course.grade_percentage = 85
        self.db.add_all([user, course])
        self.db.commit()

        logic.update_course_stats(course, self.db)
        self.assertEqual(course.grade_scaled, 3.7)
        unassigned_course = models.Course(
            name="Unassigned MIE200",
            category="MIE",
            credits=0.5,
            program_id=self.program_id,
            grade_percentage=85,
        )
        self.db.add(unassigned_course)
        self.db.commit()
        logic.update_course_stats(unassigned_course, self.db)
        self.assertEqual(unassigned_course.grade_scaled, 3.7)

        crud.update_user(
            self.db,
            self.user_id,
            schemas.UserUpdate(gpa_scaling_table=json.dumps({
                "90-100": 4.0,
                "85-89": 4.0,
                "80-84": 3.7,
            })),
        )

        self.db.refresh(course)
        self.db.refresh(unassigned_course)
        self.assertEqual(course.grade_scaled, 4.0)
        self.assertEqual(unassigned_course.grade_scaled, 4.0)

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
