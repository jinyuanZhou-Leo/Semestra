# input:  [unittest, in-memory SQLAlchemy setup, auth route handlers, email-verification service, and mocked Resend HTTP calls]
# output: [backend regression tests for email-code registration, password/email-code/Google login identity edge cases, non-enumerating and email-driven auth responses, and password-reset auth flows plus purpose-specific Resend template payload selection]
# pos:    [backend unit tests covering the Resend-backed email verification lifecycle, normalized login/register identity handling, non-enumerating and email-driven auth responses, and purpose-specific template delivery payloads without requiring a running Semestra server]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import asyncio
import unittest
from pathlib import Path
import sys
from unittest.mock import patch

from fastapi import HTTPException
from fastapi import Response
from fastapi.security import OAuth2PasswordRequestForm
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
    def test_register_code_verification_creates_user_only_after_completion(self, mock_post, _mock_code) -> None:
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
        resend_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(resend_payload["template"]["id"], "semestra-create-account")
        self.assertEqual(resend_payload["template"]["variables"]["OTP_CODE"], "000000")
        self.assertNotIn("html", resend_payload)
        self.assertNotIn("text", resend_payload)

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="123456")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_continue_email_code_login_flow_sets_cookie_for_existing_user(self, mock_post, _mock_code) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="login@example.com", nickname="Login", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )

        api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email=user.email, purpose="continue"),
            self.request,
            self.db,
        )
        verify_response = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email=user.email, purpose="continue", code="123456"),
            self.db,
        )

        response = Response()
        login_payload = api_auth.login_with_email_code(
            schemas.EmailCodeLoginRequest(verification_token=verify_response.verification_token, remember_me=True),
            response,
            self.db,
        )

        self.assertEqual(verify_response.next_step, "login")
        self.assertEqual(login_payload["token_type"], "bearer")
        self.assertIn("semestra_session=", response.headers.get("set-cookie", ""))
        resend_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(resend_payload["template"]["id"], "semestra-login")
        self.assertEqual(resend_payload["template"]["variables"]["OTP_CODE"], "123456")
        self.assertNotIn("html", resend_payload)
        self.assertNotIn("text", resend_payload)

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="223344")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_continue_email_code_routes_new_email_to_register(self, mock_post, _mock_code) -> None:
        response = api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="continue-register@example.com", purpose="continue"),
            self.request,
            self.db,
        )

        self.assertTrue(response.ok)
        self.assertEqual(response.message, "If this email can continue, a verification code has been sent.")

        verify_response = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email="continue-register@example.com", purpose="continue", code="223344"),
            self.db,
        )

        self.assertEqual(verify_response.next_step, "register")
        challenge = email_verification.get_verified_challenge_from_token(
            self.db,
            verification_token=verify_response.verification_token,
            expected_purpose="register",
        )
        self.assertEqual(challenge.email, "continue-register@example.com")
        resend_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(resend_payload["template"]["id"], "semestra-create-account")

    def test_login_send_code_for_unknown_user_returns_generic_success_without_challenge(self) -> None:
        response = api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="missing@example.com", purpose="login"),
            self.request,
            self.db,
        )

        self.assertTrue(response.ok)
        self.assertEqual(
            response.message,
            "If this email can sign in, a verification code has been sent.",
        )
        self.assertEqual(
            self.db.query(models.EmailVerificationChallenge).filter_by(email="missing@example.com").count(),
            0,
        )

    def test_password_login_accepts_mixed_case_email(self) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="login@example.com", nickname="Login", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )

        response = Response()
        form_data = OAuth2PasswordRequestForm(
            username="Login@Example.com",
            password="Password123",
            scope="",
        )
        token_payload = asyncio.run(
            api_auth.login_for_access_token(
                request=self.request,
                response=response,
                form_data=form_data,
                remember_me=False,
                db=self.db,
            )
        )

        self.assertEqual(token_payload["token_type"], "bearer")
        self.assertIn("semestra_session=", response.headers.get("set-cookie", ""))
        self.assertEqual(crud.get_user_by_email(self.db, "LOGIN@example.com").id, user.id)

    def test_password_login_for_unknown_email_returns_invalid_credentials(self) -> None:
        form_data = OAuth2PasswordRequestForm(
            username="missing@example.com",
            password="Password123",
            scope="",
        )

        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                api_auth.login_for_access_token(
                    request=self.request,
                    response=Response(),
                    form_data=form_data,
                    remember_me=False,
                    db=self.db,
                )
            )

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail["code"], "INVALID_CREDENTIALS")

    def test_register_send_code_for_existing_email_returns_generic_success_without_challenge(self) -> None:
        crud.create_user(
            self.db,
            schemas.UserCreate(email="existing@example.com", nickname="Existing", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )

        response = api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="Existing@Example.com", purpose="register"),
            self.request,
            self.db,
        )

        self.assertTrue(response.ok)
        self.assertEqual(
            response.message,
            "If this email can create an account, a verification code has been sent.",
        )
        self.assertEqual(
            self.db.query(models.EmailVerificationChallenge).filter_by(email="existing@example.com", purpose="register").count(),
            0,
        )

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="112233")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_register_complete_rejects_email_created_after_verification(self, _mock_post, _mock_code) -> None:
        api_auth.send_auth_email_code(
            schemas.EmailCodeSendRequest(email="race@example.com", purpose="register"),
            self.request,
            self.db,
        )
        verification_token = api_auth.verify_auth_email_code(
            schemas.EmailCodeVerifyRequest(email="race@example.com", purpose="register", code="112233"),
            self.db,
        ).verification_token
        crud.create_user(
            self.db,
            schemas.UserCreate(email="Race@Example.com", nickname="Race", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )

        with self.assertRaises(HTTPException) as context:
            api_auth.complete_registration(
                schemas.RegisterCompleteRequest(
                    verification_token=verification_token,
                    nickname="Second",
                    password="Password123",
                ),
                Response(),
                self.db,
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(context.exception.detail["code"], "EMAIL_ALREADY_REGISTERED")

    @patch("api_auth.verify_google_id_token")
    def test_google_login_matches_existing_email_case_insensitively(self, mock_verify_google_id_token) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="google@example.com", nickname="Google", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )
        mock_verify_google_id_token.return_value = {
            "email": "Google@Example.com",
            "email_verified": True,
            "sub": "google-sub-123",
        }

        response = Response()
        token_payload = api_auth.login_with_google(
            self.request,
            schemas.GoogleAuthRequest(id_token="token"),
            response,
            self.db,
        )

        refreshed_user = crud.get_user(self.db, user.id)
        self.assertEqual(token_payload["token_type"], "bearer")
        self.assertEqual(refreshed_user.google_sub, "google-sub-123")
        self.assertIn("semestra_session=", response.headers.get("set-cookie", ""))

    @patch("email_verification.AUTH_EMAIL_FROM", "Semestra <no-reply@auth.example.com>")
    @patch("email_verification.RESEND_API_KEY", "re_test_123")
    @patch("email_verification._generate_verification_code", return_value="654321")
    @patch("email_verification.requests.post", return_value=_MockResendResponse())
    def test_password_reset_updates_hash_and_marks_user_verified(self, mock_post, _mock_code) -> None:
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
        resend_payload = mock_post.call_args.kwargs["json"]
        self.assertEqual(resend_payload["template"]["id"], "semestra-pw-reset")
        self.assertEqual(resend_payload["template"]["variables"]["OTP_CODE"], "654321")
        self.assertNotIn("html", resend_payload)
        self.assertNotIn("text", resend_payload)


if __name__ == "__main__":
    unittest.main()
