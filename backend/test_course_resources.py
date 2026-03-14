# input:  [unittest, tempfile storage roots, in-memory SQLAlchemy setup, and course_resources domain helpers]
# output: [backend regression tests for course-resource quota accounting, file persistence, saved-link resources, and rename sanitization]
# pos:    [backend unit tests covering the course-resource service without requiring HTTP requests]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import tempfile
import unittest
from datetime import date
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import course_resources
import models
from database import Base


class CourseResourcesServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()
        self.tempdir = tempfile.TemporaryDirectory()
        self.base_dir = Path(self.tempdir.name)

        user = models.User(email="resources@example.com", hashed_password="hashed", user_setting="{}")
        other_user = models.User(email="other@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add_all([user, other_user])
        self.db.flush()
        self.user_id = user.id
        self.other_user_id = other_user.id

        program = models.Program(name="Engineering", owner_id=user.id, program_timezone="America/Toronto")
        other_program = models.Program(name="Arts", owner_id=other_user.id, program_timezone="America/Toronto")
        self.db.add_all([program, other_program])
        self.db.flush()

        semester = models.Semester(
            name="Winter 2026",
            program_id=program.id,
            start_date=date(2026, 1, 5),
            end_date=date(2026, 4, 20),
        )
        self.db.add(semester)
        self.db.flush()

        self.course = models.Course(name="MIE100", category="MIE", credits=0.5, program_id=program.id, semester_id=semester.id)
        self.other_course_same_user = models.Course(name="MIE101", category="MIE", credits=0.5, program_id=program.id, semester_id=semester.id)
        self.other_course_other_user = models.Course(name="ART100", category="ART", credits=0.5, program_id=other_program.id)
        self.db.add_all([self.course, self.other_course_same_user, self.other_course_other_user])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.tempdir.cleanup()

    def test_quota_snapshot_counts_all_courses_for_same_account(self) -> None:
        course_resources.create_course_resource(
            self.db,
            base_dir=self.base_dir,
            user_id=self.user_id,
            course_id=self.course.id,
            filename_original="syllabus.pdf",
            filename_display="syllabus.pdf",
            mime_type="application/pdf",
            content=b"abc",
        )
        course_resources.create_course_resource(
            self.db,
            base_dir=self.base_dir,
            user_id=self.user_id,
            course_id=self.other_course_same_user.id,
            filename_original="week1.txt",
            filename_display="week1.txt",
            mime_type="text/plain",
            content=b"hello",
        )
        course_resources.create_course_resource(
            self.db,
            base_dir=self.base_dir,
            user_id=self.other_user_id,
            course_id=self.other_course_other_user.id,
            filename_original="ignore.txt",
            filename_display="ignore.txt",
            mime_type="text/plain",
            content=b"ignore-me",
        )

        snapshot = course_resources.get_user_quota_snapshot(self.db, self.user_id)

        self.assertEqual(snapshot.total_bytes_used, 8)
        self.assertEqual(snapshot.remaining_bytes, snapshot.total_bytes_limit - 8)

    def test_create_rename_and_delete_resource_keeps_disk_in_sync(self) -> None:
        resource = course_resources.create_course_resource(
            self.db,
            base_dir=self.base_dir,
            user_id=self.user_id,
            course_id=self.course.id,
            filename_original="lecture-notes.pdf",
            filename_display="lecture-notes.pdf",
            mime_type="application/pdf",
            content=b"pdf-data",
        )
        absolute_path = course_resources.resolve_absolute_path(self.base_dir, resource)
        self.assertTrue(absolute_path.exists())

        renamed = course_resources.rename_course_resource(self.db, resource, "Lecture Notes.pdf")
        self.assertEqual(renamed.filename_display, "Lecture Notes.pdf")

        course_resources.delete_course_resource(self.db, base_dir=self.base_dir, resource=renamed)
        self.assertFalse(absolute_path.exists())

    def test_create_external_resource_stores_url_without_using_quota(self) -> None:
        resource = course_resources.create_external_course_resource(
            self.db,
            course_id=self.course.id,
            external_url="https://example.com/slides/week-1",
            filename_display="Week 1 slides",
        )

        self.assertEqual(resource.resource_kind, "link")
        self.assertEqual(resource.external_url, "https://example.com/slides/week-1")
        self.assertEqual(resource.size_bytes, 0)

        snapshot = course_resources.get_user_quota_snapshot(self.db, self.user_id)
        self.assertEqual(snapshot.total_bytes_used, 0)


if __name__ == "__main__":
    unittest.main()
