# input:  [unittest, in-memory SQLAlchemy setup, backend LMS service/schema/crypto modules, and fake provider adapters]
# output: [unit tests covering LMS credential encryption metadata, connect semantics, stored validation state transitions, and paginated course reads]
# pos:    [backend regression tests for provider-neutral LMS integration storage and service orchestration]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import json
import os
import unittest
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import lms_service
import models
import schemas
from database import Base
from lms_crypto import decrypt_credentials, encrypt_credentials
from lms_providers import LmsConnectionSummaryData, LmsCoursePageData, LmsCourseSummaryData, LmsProviderError


class _FakeLmsProvider:
    provider = "canvas"

    def __init__(self) -> None:
        self.validation_fail = False
        self.last_list_courses_args = None

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
            LmsCourseSummaryData(
                external_id="course-3",
                name="Compilers",
                course_code="CSC488",
                workflow_state="completed",
                start_at=None,
                end_at=None,
            ),
        ]
        if workflow_state:
            courses = [course for course in courses if course.workflow_state == workflow_state]
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        items = courses[start_index:end_index]
        has_more = end_index < len(courses)
        return LmsCoursePageData(
            items=items,
            page=page,
            page_size=page_size,
            has_more=has_more,
            next_page=page + 1 if has_more else None,
        )


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
        lms_service.get_lms_provider = lambda provider: self.provider

    def tearDown(self) -> None:
        lms_service.get_lms_provider = self.original_get_lms_provider
        self.db.close()
        self.engine.dispose()
        if self.previous_key is None:
            os.environ.pop("LMS_CREDENTIALS_ENCRYPTION_KEY", None)
        else:
            os.environ["LMS_CREDENTIALS_ENCRYPTION_KEY"] = self.previous_key

    def _build_upsert_payload(self, token: str = "token-1") -> schemas.LmsIntegrationUpsertRequest:
        return schemas.LmsIntegrationUpsertRequest(
            provider="canvas",
            config={"base_url": "https://canvas.example.edu"},
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

    def test_upsert_persists_connected_integration_without_plaintext_secret(self) -> None:
        response = lms_service.upsert_integration(self.db, self.user.id, "canvas", self._build_upsert_payload())

        self.assertEqual(response.status, "connected")
        self.assertEqual(response.summary.external_user_id, "42")

        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        self.assertNotIn("token-1", record.credentials_encrypted)
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_failed_upsert_does_not_overwrite_existing_stored_connection(self) -> None:
        lms_service.upsert_integration(self.db, self.user.id, "canvas", self._build_upsert_payload(token="token-1"))
        original_record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        original_encrypted = original_record.credentials_encrypted

        self.provider.validation_fail = True
        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.upsert_integration(self.db, self.user.id, "canvas", self._build_upsert_payload(token="token-2"))

        self.assertEqual(context.exception.code, "LMS_CONNECTION_AUTH_FAILED")

        persisted_record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        self.assertEqual(persisted_record.credentials_encrypted, original_encrypted)
        self.assertEqual(decrypt_credentials(persisted_record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_stored_validation_failure_updates_error_state(self) -> None:
        lms_service.upsert_integration(self.db, self.user.id, "canvas", self._build_upsert_payload())

        self.provider.validation_fail = True
        with self.assertRaises(lms_service.LmsServiceError):
            lms_service.validate_integration(self.db, self.user.id, "canvas", None)

        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        self.assertEqual(record.status, "error")
        self.assertEqual(record.last_error_code, "LMS_CONNECTION_AUTH_FAILED")

    def test_list_courses_returns_stable_paginated_contract(self) -> None:
        lms_service.upsert_integration(self.db, self.user.id, "canvas", self._build_upsert_payload())

        response = lms_service.list_courses(
            self.db,
            self.user.id,
            "canvas",
            page=1,
            page_size=2,
            workflow_state="available",
            enrollment_state="active",
        )

        self.assertEqual(len(response.items), 2)
        self.assertTrue(response.has_more is False)
        self.assertIsNone(response.next_page)
        self.assertEqual(response.items[0].external_id, "course-1")
        self.assertEqual(
            self.provider.last_list_courses_args,
            {
                "page": 1,
                "page_size": 2,
                "workflow_state": "available",
                "enrollment_state": "active",
            },
        )

    def test_unsupported_encrypted_payload_version_fails_safely(self) -> None:
        encrypted = encrypt_credentials({"personal_access_token": "secret"})
        envelope = json.loads(encrypted)
        envelope["version"] = "v999"

        with self.assertRaises(Exception) as context:
            decrypt_credentials(json.dumps(envelope))

        self.assertEqual(context.exception.code, "LMS_ENCRYPTED_PAYLOAD_VERSION_UNSUPPORTED")


if __name__ == "__main__":
    unittest.main()
