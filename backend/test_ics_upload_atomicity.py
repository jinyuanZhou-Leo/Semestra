# input:  [unittest, asyncio, in-memory SQLAlchemy setup, mocked ICS parsing/import helpers, and backend upload route handlers]
# output: [backend regression tests ensuring semester/course ICS uploads remain atomic when schedule import fails]
# pos:    [backend API regression tests covering transactional guarantees for ICS-based semester/course creation routes without an HTTP client dependency]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import asyncio
from io import BytesIO
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import crud
import main
import models
import schemas
from database import Base


class IcsUploadAtomicityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.testing_session_local()

        self.user = models.User(
            email="atomicity@example.com",
            hashed_password="hashed",
            user_setting='{"default_course_credit":0.5}',
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        self.program = crud.create_program(
            self.db,
            schemas.ProgramCreate(
                name="Engineering",
                gpa_scaling_table='{"90-100":4.0}',
                subject_color_map="{}",
                grad_requirement_credits=20.0,
                hide_gpa=False,
                program_timezone="America/Toronto",
            ),
            self.user.id,
        )

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _build_upload_file(self) -> UploadFile:
        return UploadFile(
            filename="schedule.ics",
            file=BytesIO(b"BEGIN:VCALENDAR\nEND:VCALENDAR"),
        )

    def test_semester_upload_rolls_back_when_schedule_import_fails(self) -> None:
        with patch.object(
            main.utils,
            "parse_ics_schedule",
            return_value={
                "semesterStartDate": None,
                "semesterEndDate": None,
                "courses": [{"name": "MIE200", "category": "MIE", "meetings": [{"summary": "bad"}]}],
            },
        ), patch.object(main, "import_course_schedule_from_ics", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                asyncio.run(
                    main.create_semester_from_ics(
                        program_id=self.program.id,
                        file=self._build_upload_file(),
                        name="Winter 2026",
                        db=self.db,
                        current_user=self.user,
                    )
                )

        self.assertEqual(
            self.db.query(models.Semester).filter(models.Semester.program_id == self.program.id).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.Course).filter(models.Course.program_id == self.program.id).count(),
            0,
        )

    def test_course_upload_rolls_back_when_schedule_import_fails(self) -> None:
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=None,
                end_date=None,
            ),
            self.program.id,
        )

        with patch.object(
            main.utils,
            "parse_ics_schedule",
            return_value={
                "courses": [{"name": "MIE200", "category": "MIE", "meetings": [{"summary": "bad"}]}],
            },
        ), patch.object(main, "import_course_schedule_from_ics", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                asyncio.run(
                    main.create_courses_from_ics(
                        program_id=self.program.id,
                        file=self._build_upload_file(),
                        semester_id=semester.id,
                        db=self.db,
                        current_user=self.user,
                    )
                )

        self.assertEqual(
            self.db.query(models.Course).filter(models.Course.program_id == self.program.id).count(),
            0,
        )

    def test_course_upload_persists_sections_and_events_when_schedule_is_valid(self) -> None:
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=None,
                end_date=None,
            ),
            self.program.id,
        )

        with patch.object(
            main.utils,
            "parse_ics_schedule",
            return_value={
                "courses": [
                    {
                        "name": "CSC108",
                        "category": "CSC",
                        "meetings": [
                            {
                                "eventTypeCode": "LECTURE",
                                "sectionId": "0103",
                                "title": "Computer Fundamentals",
                                "dayOfWeek": 1,
                                "startTime": "13:00",
                                "endTime": "14:00",
                                "weekPattern": "EVERY",
                                "startWeek": 1,
                                "endWeek": 14,
                            }
                        ],
                    }
                ],
            },
        ):
            created_courses = asyncio.run(
                main.create_courses_from_ics(
                    program_id=self.program.id,
                    file=self._build_upload_file(),
                    semester_id=semester.id,
                    db=self.db,
                    current_user=self.user,
                )
            )

        self.assertEqual(len(created_courses), 1)
        course = created_courses[0]
        self.assertEqual(
            self.db.query(models.CourseSection).filter(models.CourseSection.course_id == course.id).count(),
            1,
        )
        self.assertEqual(
            self.db.query(models.CourseEvent).filter(models.CourseEvent.course_id == course.id).count(),
            1,
        )


if __name__ == "__main__":
    unittest.main()
