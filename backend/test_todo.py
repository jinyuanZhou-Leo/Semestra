# input:  [unittest, in-memory SQLAlchemy session setup, backend todo service, CRUD helpers, and backend schemas/models]
# output: [unit tests covering todo serialization without backend order persistence, Program-derived course colors, stable Program subject-color locking, and section reassignment updates]
# pos:    [backend regression tests for the table-backed todo service after removing persisted todo ordering and adding Program subject-code color defaults]
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

import models
import schemas
import crud
import todo
from database import Base


class TodoServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()

        user = models.User(email="todo@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(user)
        self.db.flush()
        self.user_id = user.id

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

        self.semester = semester
        self.course = course
        self.program = program

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_semester_state_omits_order_index_fields(self) -> None:
        todo.create_section(self.db, self.semester, schemas.TodoSectionCreate(name="Planning"))
        payload = todo.create_task(
            self.db,
            self.semester,
            schemas.TodoTaskCreate(
                title="Write lab notes",
                note="Bring calculator",
                course_id=self.course.id,
            ),
        )

        payload_dump = payload.model_dump()
        task_payload = payload_dump["tasks"][0]
        section_payload = payload_dump["sections"][0]

        self.assertNotIn("order_index", task_payload)
        self.assertNotIn("order_index", section_payload)

    def test_update_task_moves_task_between_sections_without_reorder_payload(self) -> None:
        section_payload = todo.create_section(self.db, self.semester, schemas.TodoSectionCreate(name="Planning"))
        section_id = section_payload.sections[0].id
        created = todo.create_task(
            self.db,
            self.semester,
            schemas.TodoTaskCreate(
                title="Finish assignment",
                note="",
                course_id=self.course.id,
            ),
        )
        task_id = created.tasks[0].id

        updated = todo.update_task(
            self.db,
            self.semester,
            task_id,
            schemas.TodoTaskUpdate(section_id=section_id),
        )

        moved = next(task for task in updated.tasks if task.id == task_id)
        self.assertEqual(moved.section_id, section_id)

    def test_semester_state_uses_program_subject_color_map_for_default_course_color(self) -> None:
        self.program.subject_color_map = '{"MIE":"#2563eb"}'
        self.db.add(self.program)
        self.db.commit()
        self.db.refresh(self.semester)

        payload = todo.get_semester_state(self.db, self.semester)

        self.assertEqual(payload.course_options[0].color, "#2563eb")

    def test_semester_state_prefers_course_override_color(self) -> None:
        self.program.subject_color_map = '{"MIE":"#2563eb"}'
        self.course.color = "#111111"
        self.db.add(self.program)
        self.db.add(self.course)
        self.db.commit()
        self.db.refresh(self.semester)

        payload = todo.get_semester_state(self.db, self.semester)

        self.assertEqual(payload.course_options[0].color, "#111111")

    def test_program_subject_color_map_keeps_existing_assignments_stable_for_new_codes(self) -> None:
        crud.create_course(
            self.db,
            schemas.CourseCreate(
                name="AAA100",
                category="AAA",
                credits=0.5,
            ),
            program_id=self.program.id,
            semester_id=self.semester.id,
        )
        synced_program = crud.get_program(self.db, self.program.id, self.user_id)
        assert synced_program is not None
        first_map = todo.parse_subject_color_map(synced_program.subject_color_map)
        first_color = first_map["AAA"]

        crud.create_course(
            self.db,
            schemas.CourseCreate(
                name="AAM100",
                category="AAM",
                credits=0.5,
            ),
            program_id=self.program.id,
            semester_id=self.semester.id,
        )
        synced_program = crud.get_program(self.db, self.program.id, self.user_id)
        assert synced_program is not None
        next_map = todo.parse_subject_color_map(synced_program.subject_color_map)

        self.assertEqual(next_map["AAA"], first_color)
        self.assertNotEqual(next_map["AAM"], first_color)


if __name__ == "__main__":
    unittest.main()
