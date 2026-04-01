# input:  [unittest, env patching, in-memory SQLAlchemy setup, backend auth helpers, FastAPI middleware config helper, and Starlette request scopes]
# output: [backend regression tests for CSRF enforcement, typed-token auth boundaries, logout revocation state, login throttling, and production host/docs hardening]
# pos:    [backend unit tests covering auth-layer security helpers and middleware configuration without requiring a running Semestra server]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to
import asyncio
from datetime import timedelta
import os
import unittest
from pathlib import Path
import sys
from unittest.mock import patch

from fastapi import FastAPI
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request
from starlette.middleware.trustedhost import TrustedHostMiddleware

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import auth
import email_verification
import main
import models
from database import Base


class AuthSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()
        self.user = models.User(email="auth-security@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _build_request(
        self,
        *,
        method: str = "POST",
        origin: str | None = None,
        csrf_header: str | None = None,
        cookies: dict[str, str] | None = None,
        client_host: str = "127.0.0.1",
    ) -> Request:
        headers: list[tuple[bytes, bytes]] = []
        if origin:
            headers.append((b"origin", origin.encode("utf-8")))
        if csrf_header:
            headers.append((auth.AUTH_CSRF_HEADER_NAME.lower().encode("utf-8"), csrf_header.encode("utf-8")))
        if cookies:
            cookie_value = "; ".join(f"{key}={value}" for key, value in cookies.items())
            headers.append((b"cookie", cookie_value.encode("utf-8")))
        scope = {
            "type": "http",
            "method": method,
            "path": "/programs/",
            "headers": headers,
            "client": (client_host, 12345),
        }
        return Request(scope)

    def test_cookie_authenticated_write_requires_matching_csrf_token(self) -> None:
        request = self._build_request(
            origin="http://localhost:5173",
            cookies={
                auth.AUTH_COOKIE_NAME: "session-token",
                auth.AUTH_CSRF_COOKIE_NAME: "cookie-token",
            },
        )

        with self.assertRaises(HTTPException) as context:
            auth.enforce_cookie_request_security(request)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "Missing or invalid CSRF token.")

    def test_cookie_authenticated_write_rejects_untrusted_origin(self) -> None:
        request = self._build_request(
            origin="https://evil.example",
            csrf_header="csrf-token",
            cookies={
                auth.AUTH_COOKIE_NAME: "session-token",
                auth.AUTH_CSRF_COOKIE_NAME: "csrf-token",
            },
        )

        with self.assertRaises(HTTPException) as context:
            auth.enforce_cookie_request_security(request)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "Invalid request origin for cookie-authenticated write request.")

    def test_cookie_authenticated_write_accepts_matching_csrf_token(self) -> None:
        request = self._build_request(
            origin="http://localhost:5173",
            csrf_header="csrf-token",
            cookies={
                auth.AUTH_COOKIE_NAME: "session-token",
                auth.AUTH_CSRF_COOKIE_NAME: "csrf-token",
            },
        )

        auth.enforce_cookie_request_security(request)

    def test_build_fastapi_kwargs_disables_docs_in_production(self) -> None:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            kwargs = main._build_fastapi_kwargs()

        self.assertIsNone(kwargs["docs_url"])
        self.assertIsNone(kwargs["redoc_url"])
        self.assertIsNone(kwargs["openapi_url"])

    def test_trusted_host_middleware_rejects_unknown_host(self) -> None:
        app = FastAPI()

        with patch.dict(os.environ, {"ALLOWED_HOSTS": "api.example.com,testserver"}, clear=False):
            main._configure_middlewares(app)

        trusted_host_middleware = next(
            middleware
            for middleware in app.user_middleware
            if middleware.cls is TrustedHostMiddleware
        )
        self.assertEqual(trusted_host_middleware.kwargs["allowed_hosts"], ["api.example.com", "testserver"])

    def test_revoked_session_version_rejects_old_token(self) -> None:
        token = auth.create_user_access_token(self.user, timedelta(minutes=15))
        request = self._build_request(
            method="GET",
            cookies={auth.AUTH_COOKIE_NAME: token},
        )

        authenticated_user = asyncio.run(auth.get_current_user(request=request, token=None, db=self.db))
        self.assertEqual(authenticated_user.id, self.user.id)

        auth.revoke_user_sessions(self.db, self.user)
        with self.assertRaises(HTTPException) as context:
            asyncio.run(auth.get_current_user(request=request, token=None, db=self.db))

        self.assertEqual(context.exception.status_code, 401)

    def test_non_access_token_cannot_authenticate_user(self) -> None:
        verification_token = auth.create_access_token(
            data={
                "sub": self.user.email,
                email_verification.EMAIL_VERIFICATION_PURPOSE_CLAIM: "login",
                email_verification.EMAIL_VERIFICATION_CHALLENGE_ID_CLAIM: "challenge-id",
                email_verification.EMAIL_VERIFICATION_NONCE_CLAIM: "nonce",
            },
            expires_delta=timedelta(minutes=15),
            token_type=auth.EMAIL_VERIFICATION_TOKEN_TYPE,
        )
        request = self._build_request(method="GET")

        with self.assertRaises(HTTPException) as context:
            asyncio.run(auth.get_current_user(request=request, token=verification_token, db=self.db))

        self.assertEqual(context.exception.status_code, 401)

    def test_legacy_direct_register_route_is_not_exposed(self) -> None:
        self.assertFalse(any(route.path == "/auth/register" for route in main.app.routes))

    def test_password_login_rate_limit_blocks_after_threshold(self) -> None:
        request = self._build_request(client_host="203.0.113.10")
        client_ip, account_key = auth.enforce_password_login_rate_limits(self.db, request, self.user.email)

        for _ in range(auth.AUTH_RATE_LIMIT_ACCOUNT_MAX_ATTEMPTS):
            auth.record_password_login_failure(self.db, client_ip=client_ip, account_key=account_key)

        with self.assertRaises(auth.AuthRateLimitExceededError):
            auth.enforce_password_login_rate_limits(self.db, request, self.user.email)


if __name__ == "__main__":
    unittest.main()
