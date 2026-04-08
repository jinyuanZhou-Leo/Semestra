# input:  [unittest, in-memory SQLAlchemy setup, backend LMS service/schema/crypto modules, Canvas adapter hardening, and fake provider adapters]
# output: [unit tests covering multi-integration LMS storage, Canvas outbound-request hardening, Program/Course LMS link rules, provider-backed imports, read-only navigation/announcement/module summary with inline items/module item/assignment/page/quiz/grade/syllabus/calendar contracts, normalized module-item target metadata, file proxy/download handling, and program-level course stat/reassignment safeguards]
# pos:    [backend regression tests for LMS orchestration plus Canvas adapter security boundaries and program/course behaviors that interact with provider setup, navigation/page/quiz/grade/syllabus/file browsing, inline module item summary propagation, normalized module targets, file metadata/content streaming, and semester assignment]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import json
import os
import unittest
from datetime import date
from pathlib import Path
import sys
from unittest.mock import patch

import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import crud
import main
import lms_service
import models
import schemas
from database import Base
from lms_crypto import decrypt_credentials, encrypt_credentials
from lms_canvas import CanvasLmsProvider
from lms_providers import (
    LmsAssignmentSummaryData,
    LmsAnnouncementSummaryData,
    LmsCalendarEventSummaryData,
    LmsConnectionSummaryData,
    LmsCourseFileData,
    LmsCourseFileStreamData,
    LmsCoursePageData,
    LmsCourseNavigationData,
    LmsCourseNavigationTabData,
    LmsCourseSyllabusData,
    LmsCourseSummaryData,
    LmsGradeSummaryData,
    LmsModuleItemData,
    LmsModuleSummaryData,
    LmsPageDetailData,
    LmsPageSummaryData,
    LmsProviderError,
    LmsQuizSummaryData,
)


class _FakeLmsProvider:
    provider = "canvas"

    def __init__(self) -> None:
        self.validation_fail = False
        self.last_list_courses_args = None
        self.last_navigation_args = None
        self.last_announcements_args = None
        self.last_modules_args = None
        self.last_module_items_args = None
        self.last_file_args = None
        self.last_quizzes_args = None
        self.last_grades_args = None
        self.last_syllabus_args = None
        self.last_list_pages_args = None
        self.last_get_page_args = None

    def normalize_integration_config(self, value):
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CONFIG_INVALID", "config must be a JSON object.")
        base_url = str(value.get("base_url") or "").strip()
        if not base_url:
            raise LmsProviderError("LMS_CONFIG_INVALID", "base_url is required.")
        return {"base_url": base_url.rstrip("/")}

    def normalize_integration_credentials(self, value):
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "credentials must be a JSON object.")
        token = str(value.get("personal_access_token") or "").strip()
        if not token:
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "personal_access_token is required.")
        return {"personal_access_token": token}

    def mask_credentials(self, credentials):
        token = str(credentials.get("personal_access_token") or "").strip()
        return f"{token[:4]}{'*' * max(4, len(token) - 4)}" if token else None

    def validate_connection(self, config, credentials):
        if self.validation_fail:
            raise LmsProviderError("LMS_CONNECTION_AUTH_FAILED", "Canvas rejected the personal access token.")
        return LmsConnectionSummaryData(
            external_user_id="42",
            display_name="Ada Lovelace",
            login_id="ada",
            email="ada@example.com",
        )

    def get_connection_summary(self, config, credentials):
        return self.validate_connection(config, credentials)

    def list_courses(self, config, credentials, *, page, page_size, workflow_state, enrollment_state):
        self.last_list_courses_args = {
            "page": page,
            "page_size": page_size,
            "workflow_state": workflow_state,
            "enrollment_state": enrollment_state,
        }
        courses = [
            LmsCourseSummaryData(
                external_id="course-1",
                name="Algorithms",
                course_code="CSC373",
                workflow_state="available",
                start_at="2026-01-05T00:00:00Z",
                end_at="2026-04-20T00:00:00Z",
            ),
            LmsCourseSummaryData(
                external_id="course-2",
                name="Databases",
                course_code="CSC343",
                workflow_state="available",
                start_at="2026-01-05T00:00:00Z",
                end_at="2026-04-20T00:00:00Z",
            ),
        ]
        if workflow_state:
            courses = [course for course in courses if course.workflow_state == workflow_state]
        return LmsCoursePageData(
            items=courses[:page_size],
            page=page,
            page_size=page_size,
            has_more=False,
            next_page=None,
        )

    def get_course(self, config, credentials, external_course_id):
        return LmsCourseSummaryData(
            external_id=external_course_id,
            name=f"Course {external_course_id}",
            course_code=f"CSC{external_course_id[-1]}00",
            workflow_state="available",
            start_at=None,
            end_at=None,
        )

    def list_assignments(self, config, credentials, external_course_id):
        return [
            LmsAssignmentSummaryData(
                external_id=f"{external_course_id}-assignment-1",
                title="Problem Set",
                description=None,
                due_at="2026-02-01T12:00:00Z",
                due_date="2026-02-01",
                unlock_at=None,
                lock_at=None,
                html_url="https://example.com/assignments/1",
                published=True,
                submission_types=["online_upload"],
            ),
        ]

    def get_course_navigation(self, config, credentials, external_course_id):
        self.last_navigation_args = {
            "external_course_id": external_course_id,
        }
        return LmsCourseNavigationData(
            default_view="wiki",
            front_page_url="https://example.com/courses/123/pages/home",
            tabs=[
                LmsCourseNavigationTabData(
                    tab_id="home",
                    label="Home",
                    html_url="https://example.com/courses/123",
                    hidden=False,
                    position=1,
                    tab_type=None,
                    active=True,
                ),
                LmsCourseNavigationTabData(
                    tab_id="modules",
                    label="Modules",
                    html_url="https://example.com/courses/123/modules",
                    hidden=False,
                    position=2,
                    tab_type=None,
                    active=False,
                ),
            ],
        )

    def list_course_announcements(self, config, credentials, external_course_id):
        self.last_announcements_args = {
            "external_course_id": external_course_id,
        }
        return [
            LmsAnnouncementSummaryData(
                announcement_id="announcement-1",
                title="Welcome",
                body="<p>Welcome to the course.</p>",
                posted_at="2026-01-05T12:00:00Z",
                updated_at="2026-01-05T12:30:00Z",
                html_url="https://example.com/courses/123/announcements/1",
            ),
        ]

    def list_course_modules(self, config, credentials, external_course_id):
        self.last_modules_args = {
            "external_course_id": external_course_id,
        }
        return [
            LmsModuleSummaryData(
                module_id="module-1",
                name="Module 1",
                position=1,
                published=True,
                state="active",
                unlock_at=None,
                item_count=1,
                items=[
                    LmsModuleItemData(
                        module_item_id="module-item-1",
                        title="Lecture 1",
                        item_type="Page",
                        content_id="page-1",
                        html_url="https://example.com/courses/123/pages/lecture-1",
                        url="/courses/123/pages/lecture-1",
                        position=1,
                        indent=0,
                        published=True,
                        completion_requirement_type="must_view",
                        new_tab=False,
                        target_type="page",
                        page_url="lecture-1",
                        content_details=None,
                        in_app_supported=True,
                    )
                ],
            ),
        ]

    def list_course_module_items(self, config, credentials, external_course_id, module_id):
        self.last_module_items_args = {
            "external_course_id": external_course_id,
            "module_id": module_id,
        }
        return [
            LmsModuleItemData(
                module_item_id="module-item-1",
                title="Lecture 1",
                item_type="Page",
                content_id="page-1",
                html_url="https://example.com/courses/123/pages/lecture-1",
                url="/courses/123/pages/lecture-1",
                position=1,
                indent=0,
                published=True,
                completion_requirement_type="must_view",
                new_tab=False,
                target_type="page",
                page_url="lecture-1",
                content_details={"page_url": "lecture-1", "published": True},
                in_app_supported=True,
            )
        ]

    def get_course_file(self, config, credentials, external_course_id, file_id):
        self.last_file_args = {
            "external_course_id": external_course_id,
            "file_id": file_id,
        }
        return LmsCourseFileData(
            file_id=file_id,
            display_name="Lecture Notes.pdf",
            filename="lecture-notes.pdf",
            mime_type="application/pdf",
            size_bytes=1024,
            url="https://example.com/files/lecture-notes.pdf",
            preview_url="https://example.com/files/lecture-notes/preview",
            locked_for_user=False,
            lock_explanation=None,
        )

    def open_course_file(self, config, credentials, external_course_id, file_id):
        file_data = self.get_course_file(config, credentials, external_course_id, file_id)
        return LmsCourseFileStreamData(
            **file_data.__dict__,
            content=iter([b"file-bytes"]),
        )

    def list_course_pages(self, config, credentials, external_course_id):
        self.last_list_pages_args = {
            "external_course_id": external_course_id,
        }
        return [
            LmsPageSummaryData(
                page_id="1",
                url="home",
                title="Home",
                updated_at="2026-02-01T12:00:00Z",
                html_url="https://example.com/courses/123/pages/home",
                published=True,
                front_page=True,
            ),
            LmsPageSummaryData(
                page_id="2",
                url="syllabus",
                title="Syllabus",
                updated_at="2026-02-02T12:00:00Z",
                html_url="https://example.com/courses/123/pages/syllabus",
                published=True,
                front_page=False,
            ),
        ]

    def list_course_quizzes(self, config, credentials, external_course_id):
        self.last_quizzes_args = {
            "external_course_id": external_course_id,
        }
        return [
            LmsQuizSummaryData(
                quiz_id="quiz-1",
                title="Week 1 Quiz",
                description="<p>Quiz description.</p>",
                due_at="2026-02-03T12:00:00Z",
                unlock_at="2026-02-01T12:00:00Z",
                lock_at="2026-02-04T12:00:00Z",
                html_url="https://example.com/courses/123/quizzes/1",
                published=True,
            ),
        ]

    def list_grades(self, config, credentials, external_course_id):
        self.last_grades_args = {
            "external_course_id": external_course_id,
        }
        return [
            LmsGradeSummaryData(
                enrollment_id="enrollment-1",
                enrollment_type="StudentEnrollment",
                enrollment_role="StudentEnrollment",
                enrollment_state="active",
                html_url="https://example.com/courses/123/users/1",
                grades_html_url="https://example.com/courses/123/grades",
                current_grade="A-",
                final_grade="B+",
                current_score=91.3,
                final_score=88.7,
                current_points=182.5,
                unposted_current_grade="A",
                unposted_final_grade="A-",
                unposted_current_score=93.0,
                unposted_final_score=90.1,
                has_grading_periods=True,
                current_grading_period_title="Winter Term",
                current_period_current_grade="A",
                current_period_final_grade="A-",
                current_period_current_score=94.2,
                current_period_final_score=91.6,
            ),
        ]

    def get_course_syllabus(self, config, credentials, external_course_id):
        self.last_syllabus_args = {
            "external_course_id": external_course_id,
        }
        return LmsCourseSyllabusData(
            body="<p>Course syllabus body.</p>",
            html_url="https://example.com/courses/123/assignments/syllabus",
        )

    def get_course_page(self, config, credentials, external_course_id, page_ref):
        self.last_get_page_args = {
            "external_course_id": external_course_id,
            "page_ref": page_ref,
        }
        return LmsPageDetailData(
            page_id="1",
            url=str(page_ref),
            title="Home",
            updated_at="2026-02-01T12:00:00Z",
            html_url="https://example.com/courses/123/pages/home",
            published=True,
            front_page=True,
            body="<p>Welcome to the course page.</p>",
            locked_for_user=False,
            lock_explanation=None,
            editing_roles="teachers,students",
        )

    def list_calendar_events(self, config, credentials, *, context_codes, start_at, end_at):
        del start_at, end_at
        return [
            LmsCalendarEventSummaryData(
                external_id=f"{context_code}-event",
                external_course_id=context_code.replace("course_", ""),
                title="Midterm",
                description=None,
                location="Room 101",
                start_at="2026-02-10T14:00:00Z",
                end_at="2026-02-10T16:00:00Z",
                all_day=False,
                html_url="https://example.com/calendar",
                event_type_code="CALENDAR",
            )
            for context_code in context_codes
        ]


class LmsIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_key = os.environ.get("LMS_CREDENTIALS_ENCRYPTION_KEY")
        os.environ["LMS_CREDENTIALS_ENCRYPTION_KEY"] = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()

        user = models.User(email="lms@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.user = user

        self.provider = _FakeLmsProvider()
        self.original_get_lms_provider = lms_service.get_lms_provider
        def _resolve_provider(provider: str):
            if provider == self.provider.provider:
                return self.provider
            raise LmsProviderError("LMS_PROVIDER_NOT_SUPPORTED", f"Provider '{provider}' is not supported.", status_code=404)

        lms_service.get_lms_provider = _resolve_provider

        self.program = crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Computer Science", lms_integration_id=None),
            self.user.id,
        )
        self.semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 20),
            ),
            self.program.id,
        )

    def tearDown(self) -> None:
        lms_service.get_lms_provider = self.original_get_lms_provider
        self.db.close()
        self.engine.dispose()
        if self.previous_key is None:
            os.environ.pop("LMS_CREDENTIALS_ENCRYPTION_KEY", None)
        else:
            os.environ["LMS_CREDENTIALS_ENCRYPTION_KEY"] = self.previous_key

    def _build_create_payload(self, token: str = "token-1", display_name: str = "Canvas Main") -> schemas.LmsIntegrationCreateRequest:
        return schemas.LmsIntegrationCreateRequest(
            provider="canvas",
            display_name=display_name,
            config={"base_url": "https://example.com"},
            credentials={"personal_access_token": token},
        )

    def test_encrypt_credentials_produces_versioned_metadata(self) -> None:
        encrypted = encrypt_credentials({"personal_access_token": "secret"})
        envelope = json.loads(encrypted)

        self.assertEqual(envelope["version"], "v1")
        self.assertEqual(envelope["algorithm"], "AES256_GCM")
        self.assertIn("nonce", envelope)
        self.assertIn("ciphertext", envelope)
        self.assertIn("tag", envelope)
        self.assertEqual(decrypt_credentials(encrypted)["personal_access_token"], "secret")

    def test_canvas_provider_normalizes_page_list_response(self) -> None:
        with self.assertRaises(LmsProviderError) as context:
            CanvasLmsProvider().normalize_integration_config({"base_url": "http://127.0.0.1"})

        self.assertEqual(context.exception.code, "LMS_CONFIG_INVALID")

    def test_canvas_provider_blocks_cross_origin_pagination_links(self) -> None:
        class FakeResponse:
            def __init__(self, payload, links=None):
                self._payload = payload
                self.links = links or {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append(
                    {
                        "url": url,
                        "params": params,
                        "timeout": timeout,
                        "allow_redirects": allow_redirects,
                    }
                )
                return FakeResponse(
                    [{"id": "course-1", "name": "Algorithms"}],
                    links={"next": {"url": "https://evil.example/api/v1/courses?page=2"}},
                )

        provider = CanvasLmsProvider()
        session = FakeSession()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            with self.assertRaises(LmsProviderError) as context:
                provider.list_courses(
                    {"base_url": "https://example.com"},
                    {"personal_access_token": "token"},
                    page=1,
                    page_size=20,
                    workflow_state=None,
                    enrollment_state=None,
                )

        self.assertEqual(context.exception.code, "LMS_PROVIDER_ERROR")
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["allow_redirects"], False)

    def test_canvas_provider_normalizes_page_list_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self, response):
                self.response = response
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return self.response

        session = FakeSession(
            FakeResponse(
                [
                    {
                        "page_id": 1,
                        "url": "home",
                        "title": "Home",
                        "updated_at": "2026-02-01T12:00:00Z",
                        "html_url": "https://example.com/courses/123/pages/home",
                        "published": True,
                        "front_page": True,
                    },
                ]
            )
        )
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            pages = provider.list_course_pages(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/pages")
        self.assertEqual(session.calls[0]["params"], {"per_page": 100, "sort": "title", "order": "asc"})
        self.assertEqual(pages[0].page_id, "1")
        self.assertTrue(pages[0].front_page)
        self.assertEqual(pages[0].url, "home")

    def test_canvas_provider_normalizes_page_detail_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self, response):
                self.response = response
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return self.response

        session = FakeSession(
            FakeResponse(
                {
                    "page_id": 1,
                    "url": "home",
                    "title": "Home",
                    "updated_at": "2026-02-01T12:00:00Z",
                    "html_url": "https://example.com/courses/123/pages/home",
                    "published": True,
                    "front_page": True,
                    "body": "<p>Welcome to the course page.</p>",
                    "locked_for_user": False,
                    "lock_explanation": None,
                    "editing_roles": "teachers,students",
                }
            )
        )
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            page = provider.get_course_page(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
                "home",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/pages/home")
        self.assertEqual(page.page_id, "1")
        self.assertEqual(page.body, "<p>Welcome to the course page.</p>")
        self.assertFalse(page.locked_for_user)
        self.assertEqual(page.editing_roles, "teachers,students")

    def test_canvas_provider_normalizes_navigation_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                if url.endswith("/front_page"):
                    return FakeResponse(
                        {
                            "html_url": "https://example.com/courses/123/pages/home",
                            "url": "home",
                        }
                    )
                if url.endswith("/tabs"):
                    return FakeResponse(
                        [
                            {
                                "id": "home",
                                "label": "Home",
                                "html_url": "https://example.com/courses/123",
                                "hidden": False,
                                "position": 1,
                            },
                            {
                                "id": "modules",
                                "label": "Modules",
                                "html_url": "https://example.com/courses/123/modules",
                                "hidden": False,
                                "position": 2,
                            },
                        ]
                    )
                return FakeResponse({"default_view": "wiki"})

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            navigation = provider.get_course_navigation(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 3)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1")
        self.assertEqual(session.calls[1]["url"], "https://example.com/api/v1/courses/course-1/front_page")
        self.assertEqual(session.calls[2]["url"], "https://example.com/api/v1/courses/course-1/tabs")
        self.assertEqual(session.calls[2]["params"], {"per_page": 100})
        self.assertEqual(navigation.default_view, "wiki")
        self.assertEqual(navigation.front_page_url, "https://example.com/courses/123/pages/home")
        self.assertEqual([item.tab_id for item in navigation.tabs], ["home", "modules"])
        self.assertTrue(navigation.tabs[0].active)

    def test_canvas_provider_normalizes_announcements_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return FakeResponse(
                    [
                        {
                            "id": "announcement-1",
                            "title": "Welcome",
                            "message": "<p>Welcome to the course.</p>",
                            "posted_at": "2026-01-05T12:00:00Z",
                            "updated_at": "2026-01-05T12:30:00Z",
                            "html_url": "https://example.com/courses/123/announcements/1",
                            "context_code": "course_course-1",
                        }
                    ]
                )

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            announcements = provider.list_course_announcements(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/announcements")
        self.assertEqual(session.calls[0]["params"], {"per_page": 100, "context_codes[]": ["course_course-1"]})
        self.assertEqual(announcements[0].announcement_id, "announcement-1")
        self.assertEqual(announcements[0].body, "<p>Welcome to the course.</p>")
        self.assertEqual(announcements[0].posted_at, "2026-01-05T12:00:00Z")

    def test_canvas_provider_normalizes_modules_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return FakeResponse(
                    [
                        {
                            "id": "module-1",
                            "name": "Module 1",
                            "position": 1,
                            "published": True,
                            "workflow_state": "active",
                            "items_count": 1,
                            "items": [
                                {
                                    "id": "module-item-1",
                                    "title": "Lecture 1",
                                    "type": "Page",
                                    "content_id": "page-1",
                                    "html_url": "https://example.com/courses/123/pages/lecture-1",
                                    "url": "/courses/123/pages/lecture-1",
                                    "page_url": "lecture-1",
                                    "position": 1,
                                    "indent": 0,
                                    "published": True,
                                    "completion_requirement": {"type": "must_view"},
                                    "new_tab": False,
                                }
                            ],
                        }
                    ]
                )

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            modules = provider.list_course_modules(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/modules")
        self.assertEqual(session.calls[0]["params"], {"per_page": 100, "include[]": ["items"]})
        self.assertEqual(modules[0].module_id, "module-1")
        self.assertEqual(modules[0].item_count, 1)
        self.assertEqual(modules[0].items[0].title, "Lecture 1")
        self.assertEqual(modules[0].items[0].page_url, "lecture-1")

    def test_canvas_provider_normalizes_module_items_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return FakeResponse(
                    [
                        {
                            "id": "module-item-1",
                            "title": "Lecture 1",
                            "type": "Page",
                            "content_id": "page-1",
                            "html_url": "https://example.com/courses/123/pages/lecture-1",
                            "url": "/courses/123/pages/lecture-1",
                            "page_url": "lecture-1",
                            "position": 1,
                            "indent": 0,
                            "published": True,
                            "completion_requirement": {"type": "must_view"},
                            "new_tab": False,
                            "content_details": {"page_url": "lecture-1", "published": True},
                        }
                    ]
                )

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            items = provider.list_course_module_items(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
                "module-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/modules/module-1/items")
        self.assertEqual(session.calls[0]["params"], {"per_page": 100, "include[]": ["content_details"]})
        self.assertEqual(items[0].module_item_id, "module-item-1")
        self.assertEqual(items[0].completion_requirement_type, "must_view")
        self.assertEqual(items[0].target_type, "page")
        self.assertEqual(items[0].page_url, "lecture-1")
        self.assertTrue(items[0].in_app_supported)
        self.assertEqual(items[0].content_details, {"page_url": "lecture-1", "published": True})

    def test_canvas_provider_classifies_module_item_targets(self) -> None:
        provider = CanvasLmsProvider()
        in_app_types = ("Page", "Assignment", "Quiz", "File", "SubHeader")
        external_types = ("ExternalTool", "ExternalUrl", "DiscussionTopic")

        for item_type in in_app_types:
            normalized = provider._normalize_module_item({"id": "1", "type": item_type})
            self.assertTrue(normalized.in_app_supported, item_type)
            self.assertNotIn(normalized.target_type, {None, "external_tool", "external_url", "discussion"})

        for item_type in external_types:
            normalized = provider._normalize_module_item({"id": "1", "type": item_type})
            self.assertFalse(normalized.in_app_supported, item_type)
            self.assertIn(normalized.target_type, {"external_tool", "external_url", "discussion"})

    def test_canvas_provider_fetches_course_file_metadata_and_stream(self) -> None:
        class FakeResponse:
            def __init__(self, payload=None, chunks=None):
                self._payload = payload
                self._chunks = chunks or []
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

            def iter_content(self, chunk_size=65536):
                del chunk_size
                yield from self._chunks

            def close(self):
                return None

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None, stream=None):
                self.calls.append({
                    "url": url,
                    "params": params,
                    "timeout": timeout,
                    "allow_redirects": allow_redirects,
                    "stream": stream,
                })
                if url.endswith("/files/55"):
                    return FakeResponse(
                        {
                            "id": 55,
                            "display_name": "Lecture Notes.pdf",
                            "filename": "lecture-notes.pdf",
                            "content-type": "application/pdf",
                            "size": 1024,
                            "url": "https://example.com/files/lecture-notes.pdf",
                            "preview_url": "https://example.com/files/lecture-notes/preview",
                            "locked_for_user": False,
                            "lock_explanation": None,
                        }
                    )
                return FakeResponse(chunks=[b"pdf-bytes"])

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            file_data = provider.get_course_file(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
                "55",
            )
            file_stream = provider.open_course_file(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
                "55",
            )

        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/files/55")
        self.assertEqual(session.calls[0]["stream"], None)
        self.assertEqual(file_data.file_id, "55")
        self.assertEqual(file_data.display_name, "Lecture Notes.pdf")
        self.assertEqual(file_data.mime_type, "application/pdf")
        self.assertEqual(session.calls[1]["url"], "https://example.com/api/v1/courses/course-1/files/55")
        self.assertIsNone(session.calls[1]["stream"])
        self.assertEqual(session.calls[2]["url"], "https://example.com/files/lecture-notes.pdf")
        self.assertTrue(session.calls[2]["stream"])
        self.assertEqual(file_stream.file_id, "55")
        self.assertEqual(b"".join(file_stream.content), b"pdf-bytes")

    def test_canvas_provider_follows_cross_origin_file_redirects_without_forwarding_canvas_auth(self) -> None:
        class FakeResponse:
            def __init__(self, payload=None, *, status_code=200, headers=None, chunks=None):
                self._payload = payload
                self.links = {}
                self.status_code = status_code
                self.headers = headers or {}
                self._chunks = chunks or []

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise requests.HTTPError(response=self)
                return None

            def json(self):
                return self._payload

            def iter_content(self, chunk_size=65536):
                del chunk_size
                yield from self._chunks

            def close(self):
                return None

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None, stream=None):
                self.calls.append({
                    "url": url,
                    "params": params,
                    "timeout": timeout,
                    "allow_redirects": allow_redirects,
                    "stream": stream,
                })
                if url == "https://example.com/api/v1/courses/course-1/files/55":
                    return FakeResponse(
                        {
                            "id": 55,
                            "display_name": "Lecture Notes.pdf",
                            "filename": "lecture-notes.pdf",
                            "content-type": "application/pdf",
                            "size": 1024,
                            "url": "https://example.com/files/lecture-notes.pdf",
                            "locked_for_user": False,
                            "lock_explanation": None,
                        }
                    )
                if url == "https://example.com/files/lecture-notes.pdf":
                    return FakeResponse(
                        status_code=302,
                        headers={"Location": "https://files.examplecdn.com/lecture-notes.pdf?token=abc"},
                    )
                raise AssertionError(f"Unexpected session URL {url}")

        session = FakeSession()
        provider = CanvasLmsProvider()
        cross_origin_calls: list[dict[str, object]] = []

        def fake_cross_origin_get(url, timeout=None, allow_redirects=None, stream=None):
            cross_origin_calls.append({
                "url": url,
                "timeout": timeout,
                "allow_redirects": allow_redirects,
                "stream": stream,
            })
            if url == "https://files.examplecdn.com/lecture-notes.pdf?token=abc":
                return FakeResponse(chunks=[b"pdf-bytes"])
            raise AssertionError(f"Unexpected cross-origin URL {url}")

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            with patch("lms_canvas._resolve_and_validate_hostname", return_value=None):
                with patch("lms_canvas.requests.get", side_effect=fake_cross_origin_get):
                    file_stream = provider.open_course_file(
                        {"base_url": "https://example.com"},
                        {"personal_access_token": "token"},
                        "course-1",
                        "55",
                    )

        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/files/55")
        self.assertEqual(session.calls[1]["url"], "https://example.com/files/lecture-notes.pdf")
        self.assertTrue(session.calls[1]["stream"])
        self.assertEqual(cross_origin_calls[0]["url"], "https://files.examplecdn.com/lecture-notes.pdf?token=abc")
        self.assertTrue(cross_origin_calls[0]["stream"])
        self.assertEqual(b"".join(file_stream.content), b"pdf-bytes")

    def test_canvas_provider_normalizes_quizzes_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self):
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return FakeResponse(
                    [
                        {
                            "id": 1,
                            "title": "Week 1 Quiz",
                            "description": "<p>Quiz description.</p>",
                            "due_at": "2026-02-03T12:00:00Z",
                            "unlock_at": "2026-02-01T12:00:00Z",
                            "lock_at": "2026-02-04T12:00:00Z",
                            "html_url": "https://example.com/courses/123/quizzes/1",
                            "published": True,
                        }
                    ]
                )

        session = FakeSession()
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            quizzes = provider.list_course_quizzes(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1/quizzes")
        self.assertEqual(session.calls[0]["params"], {"per_page": 100})
        self.assertEqual(quizzes[0].quiz_id, "1")
        self.assertEqual(quizzes[0].title, "Week 1 Quiz")
        self.assertTrue(quizzes[0].published)

    def test_canvas_provider_normalizes_syllabus_response(self) -> None:
        class FakeResponse:
            def __init__(self, payload):
                self._payload = payload
                self.links = {}
                self.status_code = 200

            def raise_for_status(self):
                return None

            def json(self):
                return self._payload

        class FakeSession:
            def __init__(self, response):
                self.response = response
                self.calls = []

            def get(self, url, params=None, timeout=None, allow_redirects=None):
                self.calls.append({"url": url, "params": params, "timeout": timeout, "allow_redirects": allow_redirects})
                return self.response

        session = FakeSession(
            FakeResponse(
                {
                    "id": "course-1",
                    "syllabus_body": "<p>Course syllabus body.</p>",
                }
            )
        )
        provider = CanvasLmsProvider()

        with patch.object(CanvasLmsProvider, "_build_session", return_value=("https://example.com", session)):
            syllabus = provider.get_course_syllabus(
                {"base_url": "https://example.com"},
                {"personal_access_token": "token"},
                "course-1",
            )

        self.assertEqual(len(session.calls), 1)
        self.assertEqual(session.calls[0]["url"], "https://example.com/api/v1/courses/course-1")
        self.assertEqual(session.calls[0]["params"], {"include[]": ["syllabus_body"]})
        self.assertEqual(syllabus.body, "<p>Course syllabus body.</p>")
        self.assertEqual(syllabus.html_url, "https://example.com/courses/course-1/assignments/syllabus")

    def test_create_integration_persists_connected_record_without_plaintext_secret(self) -> None:
        response = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        self.assertEqual(response.status, "connected")
        self.assertEqual(response.summary.external_user_id, "42")

        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        self.assertEqual(record.display_name, "Canvas Main")
        self.assertNotIn("token-1", record.credentials_encrypted)
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_list_courses_supports_multiple_integrations(self) -> None:
        first = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(display_name="Canvas A"))
        second = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(token="token-2", display_name="Canvas B"))

        response = lms_service.list_courses_for_integration(
            self.db,
            self.user.id,
            second.id,
            page=1,
            page_size=20,
            workflow_state="available",
            enrollment_state="active",
        )

        self.assertEqual(first.provider, second.provider)
        self.assertEqual(response.integration_id, second.id)
        self.assertEqual(len(response.items), 2)
        self.assertEqual(
            self.provider.last_list_courses_args,
            {
                "page": 1,
                "page_size": 20,
                "workflow_state": "available",
                "enrollment_state": "active",
            },
        )

    def test_update_integration_allows_display_name_only(self) -> None:
        created = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        updated = lms_service.update_integration(
            self.db,
            self.user.id,
            created.id,
            schemas.LmsIntegrationUpdateRequest(display_name="Canvas Renamed"),
        )

        self.assertEqual(updated.display_name, "Canvas Renamed")
        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.id == created.id).one()
        self.assertEqual(record.display_name, "Canvas Renamed")
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_update_integration_allows_config_only_with_stored_credentials(self) -> None:
        created = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        updated = lms_service.update_integration(
            self.db,
            self.user.id,
            created.id,
            schemas.LmsIntegrationUpdateRequest(config={"base_url": "https://canvas.changed.example.edu"}),
        )

        self.assertEqual(updated.config["base_url"], "https://canvas.changed.example.edu")
        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.id == created.id).one()
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_program_cannot_switch_integration_after_lms_dependencies_exist(self) -> None:
        first = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(display_name="Canvas A"))
        second = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(token="token-2", display_name="Canvas B"))
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=first.id),
            self.user.id,
        )
        import_response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(external_course_ids=["course-1"]),
        )

        self.assertEqual(import_response.results[0].status, "created")
        with self.assertRaises(crud.ProgramLmsDependencyError) as context:
            crud.update_program(
                self.db,
                self.program.id,
                schemas.ProgramUpdate(lms_integration_id=second.id),
                self.user.id,
            )

        self.assertEqual(str(context.exception), "PROGRAM_LMS_DEPENDENCIES_EXIST")

    def test_existing_course_can_link_to_program_integration(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC"),
            self.program.id,
            self.semester.id,
        )

        link = lms_service.upsert_course_link(
            self.db,
            self.user.id,
            course.id,
            schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
        )

        self.assertEqual(link.external_course_id, "course-1")
        self.assertEqual(link.integration_display_name, "Canvas Main")

    def test_same_external_course_cannot_link_twice_in_program(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        first_course = crud.create_course(self.db, schemas.CourseCreate(name="Algorithms", credits=0.5), self.program.id, self.semester.id)
        second_course = crud.create_course(self.db, schemas.CourseCreate(name="Databases", credits=0.5), self.program.id, self.semester.id)
        lms_service.upsert_course_link(
            self.db,
            self.user.id,
            first_course.id,
            schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
        )

        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.upsert_course_link(
                self.db,
                self.user.id,
                second_course.id,
                schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
            )

        self.assertEqual(context.exception.code, "COURSE_LMS_LINK_CONFLICT")

    def test_import_program_courses_creates_local_courses_and_links(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )

        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1", "course-2"],
                semester_id=self.semester.id,
            ),
        )

        self.assertEqual([item.status for item in response.results], ["created", "created"])
        linked_courses = self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).all()
        self.assertEqual(len(linked_courses), 2)

    def test_import_program_courses_rolls_back_full_batch_when_later_fetch_fails(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        original_get_course = self.provider.get_course

        def failing_get_course(config, credentials, external_course_id):
            if external_course_id == "course-2":
                raise LmsProviderError("LMS_PROVIDER_REQUEST_FAILED", "provider exploded", 502)
            return original_get_course(config, credentials, external_course_id)

        with patch.object(self.provider, "get_course", side_effect=failing_get_course):
            with self.assertRaises(lms_service.LmsServiceError) as context:
                lms_service.import_program_courses(
                    self.db,
                    self.user.id,
                    self.program.id,
                    schemas.LmsCourseImportRequest(
                        external_course_ids=["course-1", "course-2"],
                        semester_id=self.semester.id,
                    ),
                )

        self.assertEqual(context.exception.code, "LMS_PROVIDER_REQUEST_FAILED")
        self.assertEqual(
            self.db.query(models.Course).filter(models.Course.program_id == self.program.id).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).count(),
            0,
        )

    def test_import_program_courses_rolls_back_when_link_setup_fails_after_course_creation(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )

        with patch.object(lms_service, "_populate_course_link_from_summary", side_effect=RuntimeError("bad link")):
            with self.assertRaises(lms_service.LmsServiceError) as context:
                lms_service.import_program_courses(
                    self.db,
                    self.user.id,
                    self.program.id,
                    schemas.LmsCourseImportRequest(
                        external_course_ids=["course-1"],
                        semester_id=self.semester.id,
                    ),
                )

        self.assertEqual(context.exception.code, "LMS_INTERNAL_ERROR")
        self.assertEqual(
            self.db.query(models.Course).filter(models.Course.program_id == self.program.id).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).count(),
            0,
        )

    def test_import_program_courses_raises_on_existing_link_conflict(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        existing_course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Existing", credits=0.5, category="CSC"),
            self.program.id,
            self.semester.id,
        )
        self.db.add(
            models.CourseLmsLink(
                course_id=existing_course.id,
                program_id=self.program.id,
                lms_integration_id=integration.id,
                external_course_id="course-1",
                sync_enabled=True,
            )
        )
        self.db.commit()

        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.import_program_courses(
                self.db,
                self.user.id,
                self.program.id,
                schemas.LmsCourseImportRequest(
                    external_course_ids=["course-1", "course-2"],
                    semester_id=self.semester.id,
                ),
            )

        self.assertEqual(context.exception.code, "COURSE_LMS_LINK_CONFLICT")
        self.assertEqual(
            self.db.query(models.Course).filter(models.Course.program_id == self.program.id).count(),
            1,
        )
        self.assertEqual(
            self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).count(),
            1,
        )

    def test_read_only_assignment_and_calendar_reads_use_local_course_context(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        assignments = lms_service.list_course_assignments(self.db, self.user.id, course.id)
        semester_calendar = lms_service.list_semester_calendar_events(self.db, self.user.id, self.semester.id)

        self.assertEqual(assignments.items[0].course_id, course.id)
        self.assertEqual(assignments.items[0].course_name, course.name)
        self.assertEqual(assignments.items[0].course_display_code, "CSC100")
        self.assertEqual(len(semester_calendar.items), 2)
        self.assertTrue(all(item.course_id == course.id for item in semester_calendar.items))
        self.assertTrue(all(item.course_name == course.name for item in semester_calendar.items))
        self.assertTrue(all(item.course_display_code == "CSC100" for item in semester_calendar.items))
        self.assertEqual({item.event_type_code for item in semester_calendar.items}, {"CALENDAR", "ASSIGNMENT"})

    def test_course_pages_are_available_through_service_and_route(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        pages = lms_service.list_course_pages(self.db, self.user.id, course.id)
        page = lms_service.get_course_page(self.db, self.user.id, course.id, "home")

        self.assertEqual(self.provider.last_list_pages_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_get_page_args, {"external_course_id": "course-1", "page_ref": "home"})
        self.assertEqual([item.title for item in pages.items], ["Home", "Syllabus"])
        self.assertTrue(pages.items[0].front_page)
        self.assertEqual(page.body, "<p>Welcome to the course page.</p>")
        self.assertEqual(page.editing_roles, "teachers,students")
        self.assertEqual(page.url, "home")

        route_pages = main.read_course_lms_pages(course.id, db=self.db, current_user=self.user)
        route_page = main.read_course_lms_page(course.id, "home", db=self.db, current_user=self.user)

        self.assertEqual(route_pages.items[0].url, "home")
        self.assertEqual(route_page.body, "<p>Welcome to the course page.</p>")
        self.assertEqual(route_page.page_id, "1")

    def test_course_navigation_announcements_modules_quizzes_grades_and_syllabus_are_available_through_service_and_route(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        navigation = lms_service.get_course_navigation(self.db, self.user.id, course.id)
        announcements = lms_service.list_course_announcements(self.db, self.user.id, course.id)
        modules = lms_service.list_course_modules(self.db, self.user.id, course.id)
        module_items = lms_service.list_course_module_items(self.db, self.user.id, course.id, "module-1")
        quizzes = lms_service.list_course_quizzes(self.db, self.user.id, course.id)
        grades = lms_service.list_course_grades(self.db, self.user.id, course.id)
        syllabus = lms_service.get_course_syllabus(self.db, self.user.id, course.id)

        self.assertEqual(self.provider.last_navigation_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_announcements_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_modules_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_module_items_args, {"external_course_id": "course-1", "module_id": "module-1"})
        self.assertEqual(self.provider.last_quizzes_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_grades_args, {"external_course_id": "course-1"})
        self.assertEqual(self.provider.last_syllabus_args, {"external_course_id": "course-1"})
        self.assertEqual(navigation.default_view, "wiki")
        self.assertEqual(navigation.front_page_url, "https://example.com/courses/123/pages/home")
        self.assertEqual([item.tab_id for item in navigation.tabs], ["home", "modules"])
        self.assertTrue(navigation.tabs[0].active)
        self.assertEqual(announcements.items[0].title, "Welcome")
        self.assertEqual(announcements.items[0].html_url, "https://example.com/courses/123/announcements/1")
        self.assertEqual(modules.items[0].item_count, 1)
        self.assertEqual(modules.items[0].items[0].module_item_id, "module-item-1")
        self.assertEqual(modules.items[0].items[0].title, "Lecture 1")
        self.assertEqual(module_items.items[0].module_item_id, "module-item-1")
        self.assertEqual(module_items.items[0].completion_requirement_type, "must_view")
        self.assertEqual(module_items.items[0].target_type, "page")
        self.assertTrue(module_items.items[0].in_app_supported)
        self.assertEqual(quizzes.items[0].quiz_id, "quiz-1")
        self.assertEqual(quizzes.items[0].html_url, "https://example.com/courses/123/quizzes/1")
        self.assertEqual(grades.items[0].grades_html_url, "https://example.com/courses/123/grades")
        self.assertEqual(grades.items[0].current_grade, "A-")
        self.assertEqual(grades.items[0].current_period_current_score, 94.2)
        self.assertEqual(syllabus.body, "<p>Course syllabus body.</p>")
        self.assertEqual(syllabus.html_url, "https://example.com/courses/123/assignments/syllabus")

        route_navigation = main.read_course_lms_navigation(course.id, db=self.db, current_user=self.user)
        route_announcements = main.read_course_lms_announcements(course.id, db=self.db, current_user=self.user)
        route_modules = main.read_course_lms_modules(course.id, db=self.db, current_user=self.user)
        route_module_items = main.read_course_lms_module_items(course.id, "module-1", db=self.db, current_user=self.user)
        route_quizzes = main.read_course_lms_quizzes(course.id, db=self.db, current_user=self.user)
        route_grades = main.read_course_lms_grades(course.id, db=self.db, current_user=self.user)
        route_syllabus = main.read_course_lms_syllabus(course.id, db=self.db, current_user=self.user)

        self.assertEqual(route_navigation.front_page_url, "https://example.com/courses/123/pages/home")
        self.assertEqual(route_announcements.items[0].announcement_id, "announcement-1")
        self.assertEqual(route_modules.items[0].module_id, "module-1")
        self.assertEqual(route_modules.items[0].item_count, 1)
        self.assertEqual(route_modules.items[0].items[0].module_item_id, "module-item-1")
        self.assertEqual(route_module_items.items[0].module_item_id, "module-item-1")
        self.assertEqual(route_module_items.items[0].target_type, "page")
        self.assertEqual(route_quizzes.items[0].title, "Week 1 Quiz")
        self.assertEqual(route_grades.items[0].final_score, 88.7)
        self.assertEqual(route_syllabus.body, "<p>Course syllabus body.</p>")

    def test_course_module_file_is_available_through_service_and_route(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        file_item = LmsModuleItemData(
            module_item_id="module-item-file-1",
            title="Lecture Notes",
            item_type="File",
            content_id="55",
            html_url="https://example.com/courses/123/files/55",
            url="https://example.com/courses/123/files/55",
            position=1,
            indent=0,
            published=True,
            completion_requirement_type=None,
            new_tab=False,
            target_type="file",
            page_url=None,
            external_url=None,
            content_details={"file_id": "55"},
            in_app_supported=True,
        )

        with patch.object(self.provider, "list_course_module_items", return_value=[file_item]):
            file_metadata = lms_service.get_course_module_file(self.db, self.user.id, course.id, "module-1", "module-item-file-1")
            file_download = lms_service.open_course_module_file(self.db, self.user.id, course.id, "module-1", "module-item-file-1")

            route_metadata = main.read_course_lms_module_item_file(course.id, "module-1", "module-item-file-1", db=self.db, current_user=self.user)
            route_download = main.download_course_lms_module_item_file(course.id, "module-1", "module-item-file-1", db=self.db, current_user=self.user)

        self.assertEqual(self.provider.last_file_args, {"external_course_id": "course-1", "file_id": "55"})
        self.assertEqual(file_metadata.file_id, "55")
        self.assertEqual(file_metadata.display_name, "Lecture Notes.pdf")
        self.assertEqual(file_metadata.download_url, f"/courses/{course.id}/lms/modules/module-1/items/module-item-file-1/file/download")
        self.assertEqual(b"".join(file_download[1]), b"file-bytes")
        self.assertEqual(route_metadata.file_id, "55")
        self.assertEqual(route_metadata.download_url, f"/courses/{course.id}/lms/modules/module-1/items/module-item-file-1/file/download")
        self.assertEqual(route_download.media_type, "application/pdf")
        self.assertIn('inline; filename="Lecture Notes.pdf"', route_download.headers["content-disposition"])

    def test_semester_calendar_returns_empty_when_program_lms_is_not_configured(self) -> None:
        semester_calendar = lms_service.list_semester_calendar_events(self.db, self.user.id, self.semester.id)

        self.assertEqual(semester_calendar.items, [])

    def test_semester_calendar_filters_items_to_requested_date_range(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        semester_calendar = lms_service.list_semester_calendar_events(
            self.db,
            self.user.id,
            self.semester.id,
            start_date=date(2026, 2, 10),
            end_date=date(2026, 2, 11),
        )

        self.assertEqual(len(semester_calendar.items), 1)
        self.assertEqual(semester_calendar.items[0].course_id, course.id)
        self.assertEqual(semester_calendar.items[0].event_type_code, "CALENDAR")

    def test_non_canvas_provider_returns_clear_not_supported_error_for_pages(self) -> None:
        integration = models.LmsIntegration(
            user_id=self.user.id,
            display_name="Moodle Main",
            provider="moodle",
            status="connected",
            config_json=json.dumps({"base_url": "https://moodle.example.edu"}),
            credentials_encrypted=encrypt_credentials({"personal_access_token": "token-moodle"}),
        )
        self.db.add(integration)
        self.db.commit()
        self.db.refresh(integration)
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Unsupported", credits=0.5),
            self.program.id,
            self.semester.id,
        )
        link = models.CourseLmsLink(
            course_id=course.id,
            program_id=self.program.id,
            lms_integration_id=integration.id,
            external_course_id="course-1",
            sync_enabled=True,
        )
        self.db.add(link)
        self.db.commit()

        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.list_course_pages(self.db, self.user.id, course.id)

        self.assertEqual(context.exception.code, "LMS_PROVIDER_NOT_SUPPORTED")
        self.assertEqual(context.exception.status_code, 404)

    def test_non_canvas_provider_returns_clear_not_supported_error_for_navigation(self) -> None:
        integration = models.LmsIntegration(
            user_id=self.user.id,
            display_name="Moodle Main",
            provider="moodle",
            status="connected",
            config_json=json.dumps({"base_url": "https://moodle.example.edu"}),
            credentials_encrypted=encrypt_credentials({"personal_access_token": "token-moodle"}),
        )
        self.db.add(integration)
        self.db.commit()
        self.db.refresh(integration)
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Unsupported", credits=0.5),
            self.program.id,
            self.semester.id,
        )
        link = models.CourseLmsLink(
            course_id=course.id,
            program_id=self.program.id,
            lms_integration_id=integration.id,
            external_course_id="course-1",
            sync_enabled=True,
        )
        self.db.add(link)
        self.db.commit()

        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.get_course_navigation(self.db, self.user.id, course.id)

        self.assertEqual(context.exception.code, "LMS_PROVIDER_NOT_SUPPORTED")
        self.assertEqual(context.exception.status_code, 404)

    def test_program_level_course_recomputes_grade_scaled_without_semester(self) -> None:
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Program Level", credits=0.5, grade_percentage=85),
            self.program.id,
            None,
        )

        self.assertIsNone(course.semester_id)
        self.assertEqual(course.grade_scaled, 4.0)

        updated = crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(grade_percentage=80),
        )

        self.assertEqual(updated.grade_scaled, 3.7)

    def test_removing_course_from_semester_recomputes_previous_semester_stats(self) -> None:
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Assigned", credits=0.5, grade_percentage=80),
            self.program.id,
            self.semester.id,
        )
        self.db.refresh(self.semester)
        self.assertEqual(self.semester.average_percentage, 80.0)
        self.assertEqual(self.semester.average_scaled, 3.7)

        updated = crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(semester_id=None),
        )

        self.assertIsNone(updated.semester_id)
        self.assertEqual(updated.grade_scaled, 3.7)
        self.db.refresh(self.semester)
        self.assertEqual(self.semester.average_percentage, 0.0)
        self.assertEqual(self.semester.average_scaled, 0.0)

    def test_course_cannot_move_to_semester_in_another_program(self) -> None:
        other_program = crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Other Program", lms_integration_id=None),
            self.user.id,
        )
        other_semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(name="Other Semester"),
            other_program.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC"),
            self.program.id,
            self.semester.id,
        )

        with self.assertRaises(crud.CourseSemesterAssignmentError) as context:
            crud.update_course(
                self.db,
                course.id,
                schemas.CourseUpdate(semester_id=other_semester.id),
            )

        self.assertEqual(str(context.exception), "SEMESTER_PROGRAM_MISMATCH")

    def test_create_course_rejects_semester_in_another_program(self) -> None:
        other_program = crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Other Program", lms_integration_id=None),
            self.user.id,
        )
        other_semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(name="Other Semester"),
            other_program.id,
        )

        with self.assertRaises(crud.CourseSemesterAssignmentError) as context:
            crud.create_course(
                self.db,
                schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC"),
                self.program.id,
                other_semester.id,
            )

        self.assertEqual(str(context.exception), "SEMESTER_PROGRAM_MISMATCH")

    def test_update_course_rolls_back_if_downstream_stats_update_fails(self) -> None:
        draft_semester = models.Semester(
            name="Draft Semester",
            program_id=self.program.id,
            start_date=date(2026, 1, 5),
            end_date=date(2026, 4, 20),
            lifecycle_state="draft",
            draft_updated_at="2026-01-01T00:00:00+00:00",
            review_ready=False,
        )
        self.db.add(draft_semester)
        self.db.commit()
        self.db.refresh(draft_semester)
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC", grade_percentage=80),
            self.program.id,
            draft_semester.id,
        )
        self.db.refresh(draft_semester)
        original_draft_updated_at = draft_semester.draft_updated_at
        original_average_percentage = draft_semester.average_percentage
        original_average_scaled = draft_semester.average_scaled

        with patch("crud_academics.logic.update_semester_stats", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                crud.update_course(
                    self.db,
                    course.id,
                    schemas.CourseUpdate(grade_percentage=95),
                )

        self.db.refresh(course)
        self.db.refresh(draft_semester)
        self.assertEqual(course.grade_percentage, 80)
        self.assertEqual(draft_semester.average_percentage, original_average_percentage)
        self.assertEqual(draft_semester.average_scaled, original_average_scaled)
        self.assertEqual(draft_semester.draft_updated_at, original_draft_updated_at)

    def test_delete_course_rolls_back_if_downstream_stats_update_fails(self) -> None:
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC", grade_percentage=80),
            self.program.id,
            self.semester.id,
        )

        with patch("crud_academics.logic.update_semester_stats", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                crud.delete_course(self.db, course.id)

        restored = self.db.query(models.Course).filter(models.Course.id == course.id).first()
        self.assertIsNotNone(restored)

    def test_read_error_updates_integration_and_link_state(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        with patch.object(self.provider, "list_course_pages", side_effect=LmsProviderError("LMS_PROVIDER_REQUEST_FAILED", "nope", 502)):
            with self.assertRaises(lms_service.LmsServiceError) as context:
                lms_service.list_course_pages(self.db, self.user.id, course.id)

        self.assertEqual(context.exception.code, "LMS_PROVIDER_REQUEST_FAILED")
        link = self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.course_id == course.id).one()
        integration_record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.id == integration.id).one()
        self.assertEqual(link.last_error_code, "LMS_PROVIDER_REQUEST_FAILED")
        self.assertEqual(integration_record.status, "error")

    def test_semester_calendar_error_updates_all_link_states(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1", "course-2"],
                semester_id=self.semester.id,
            ),
        )
        self.assertEqual(len(response.results), 2)

        with patch.object(self.provider, "list_assignments", side_effect=LmsProviderError("LMS_PROVIDER_REQUEST_FAILED", "calendar failed", 502)):
            with self.assertRaises(lms_service.LmsServiceError) as context:
                lms_service.list_semester_calendar_events(self.db, self.user.id, self.semester.id)

        self.assertEqual(context.exception.code, "LMS_PROVIDER_REQUEST_FAILED")
        links = self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).all()
        self.assertEqual({link.last_error_code for link in links}, {"LMS_PROVIDER_REQUEST_FAILED"})

    def test_parse_json_dict_logs_debug_on_invalid_payload(self) -> None:
        with self.assertLogs("lms_service", level="DEBUG") as captured:
            parsed = lms_service._parse_json_dict("{invalid")

        self.assertEqual(parsed, {})
        self.assertTrue(any("Failed to parse LMS JSON object payload." in message for message in captured.output))

    def test_integration_to_schema_logs_debug_when_masking_fails(self) -> None:
        integration = models.LmsIntegration(
            id="integration-mask-test",
            user_id=self.user.id,
            display_name="Canvas Main",
            provider="canvas",
            status="connected",
            config_json=json.dumps({"base_url": "https://canvas.example.edu"}),
            credentials_encrypted=encrypt_credentials({"personal_access_token": "token-1"}),
        )

        with patch.object(lms_service, "_provider_from_integration", side_effect=RuntimeError("bad mask")):
            with self.assertLogs("lms_service", level="DEBUG") as captured:
                response = lms_service._integration_to_schema(integration)

        self.assertIsNone(response.masked_api_key)
        self.assertTrue(any("Failed to mask stored LMS credentials" in message for message in captured.output))


if __name__ == "__main__":
    unittest.main()
