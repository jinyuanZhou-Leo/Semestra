# input:  [unittest, in-memory SQLAlchemy setup, auth route handlers, email-verification service, and mocked Resend HTTP calls]
# output: [backend regression tests for email-code registration, email-code login, and password-reset auth flows]
# pos:    [backend unit tests covering the Resend-backed email verification lifecycle without requiring a running Semestra server]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import unittest
from pathlib import Path
import sys
from unittest.mock import patch

from fastapi import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import api_auth
import crud
import email_verification
import models
import schemas
from database import Base


class _MockResendResponse:
    def __init__(self, *, status_code: int = 200, payload: dict | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {"id": "email_123"}
        self.content = b"{}"

    def json(self) -> dict:
        return dict(self._payload)


class EmailVerificationFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.testing_session_local()
        self.request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/auth/email/send-code",
                "headers": [(b"user-agent", b"unit-test")],
                "client": ("127.0.0.1", 12345),
            }
        )

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="000000")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_register_code_verification_creates_user_only_after_completion(self, _mock_post, _mock_code) -> None:
        send_response = api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="new-user@example.com", purpose="register"),
            self.request,
            self.db,
        )
        self.assertTrue(send_response.ok)
        self.assertIsNone(crud.get_user_by_email(self.db, "new-user@example.com"))

        challenge = self.db.query(models.EmailVerificationChallenge).filter_by(email="new-user@example.com").one()
        verification_token = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email="new-user@example.com", purpose="register", code="000000"),
            self.db,
        ).verification_token
        self.assertNotEqual(challenge.code_hash, "000000")

        response = Response()
        token_payload = api_auth.complete_registration(
            schemas.RegisterCompleteRequest(
                verification_token=verification_token,
                nickname="New User",
                password="Password123",
            ),
            response,
            self.db,
        )

        created_user = crud.get_user_by_email(self.db, "new-user@example.com")
        self.assertIsNotNone(created_user)
        self.assertIsNotNone(created_user.email_verified_at)
        self.assertEqual(token_payload["token_type"], "bearer")
        self.assertIn("semestra_session=", response.headers.get("set-cookie", ""))

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="123456")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_email_code_login_flow_sets_cookie_for_existing_user(self, _mock_post, _mock_code) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="login@example.com", nickname="Login", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )

        api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email=user.email, purpose="login"),
            self.request,
            self.db,
        )
        verification_token = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email=user.email, purpose="login", code="123456"),
            self.db,
        ).verification_token

        response = Response()
        login_payload = api_auth.login_with_email_code(
            schemas.EmailCodeLoginRequest(verification_token=verification_token, remember_me=True),
            response,
            self.db,
        )

        self.assertEqual(login_payload["token_type"], "bearer")
        self.assertIn("semestra_session=", response.headers.get("set-cookie", ""))

    def test_login_send_code_for_unknown_user_returns_generic_success(self) -> None:
        response = api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="missing@example.com", purpose="login"),
            self.request,
            self.db,
        )

        self.assertTrue(response.ok)
        self.assertEqual(
            self.db.query(models.EmailVerificationChallenge).filter_by(email="missing@example.com").count(),
            0,
        )

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="654321")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_password_reset_updates_hash_and_marks_user_verified(self, _mock_post, _mock_code) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="reset@example.com", nickname="Reset", password="Password123"),
        )
        old_hash = user.hashed_password
        old_session_version = user.session_version

        api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email=user.email, purpose="reset_password"),
            self.request,
            self.db,
        )
        verification_token = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email=user.email, purpose="reset_password", code="654321"),
            self.db,
        ).verification_token

        response = Response()
        api_auth.complete_password_reset(
            schemas.PasswordResetCompleteRequest(
                verification_token=verification_token,
                new_password="UpdatedPass123",
            ),
            response,
            self.db,
        )

        refreshed_user = crud.get_user_by_email(self.db, user.email)
        self.assertNotEqual(refreshed_user.hashed_password, old_hash)
        self.assertGreater(refreshed_user.session_version, old_session_version)
        self.assertIsNotNone(refreshed_user.email_verified_at)
        self.assertTrue(crud.verify_password("UpdatedPass123", refreshed_user.hashed_password))


if __name__ == "__main__":
    unittest.main()
