# input:  [Environment variables, base64/json helpers, cryptography AESGCM primitive, and LMS credentials payloads]
# output: [Versioned credential encryption/decryption helpers for LMS provider secrets]
# pos:    [Security utility for provider-neutral LMS secret storage inside the backend service layer]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import base64
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


LMS_CREDENTIALS_CRYPTO_VERSION = "v1"
LMS_CREDENTIALS_ALGORITHM = "AES256_GCM"
LMS_CREDENTIALS_KEY_ENV = "LMS_CREDENTIALS_ENCRYPTION_KEY"


class LmsCryptoError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _add_base64_padding(value: str) -> str:
    return value + ("=" * (-len(value) % 4))


def _load_encryption_key() -> bytes:
    raw_key = (os.getenv(LMS_CREDENTIALS_KEY_ENV) or "").strip()
    if not raw_key:
        raise LmsCryptoError(
            "LMS_ENCRYPTION_NOT_CONFIGURED",
            f"{LMS_CREDENTIALS_KEY_ENV} is required before storing or reading LMS credentials.",
        )

    try:
        decoded = base64.urlsafe_b64decode(_add_base64_padding(raw_key))
    except Exception:
        decoded = raw_key.encode("utf-8")

    if len(decoded) != 32:
        raise LmsCryptoError(
            "LMS_ENCRYPTION_KEY_INVALID",
            f"{LMS_CREDENTIALS_KEY_ENV} must decode to exactly 32 bytes for AES-256-GCM.",
        )

    return decoded


def encrypt_credentials(payload: dict[str, Any]) -> str:
    key = _load_encryption_key()
    nonce = os.urandom(12)
    plaintext = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    encrypted = AESGCM(key).encrypt(nonce, plaintext, associated_data=None)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]

    envelope = {
        "version": LMS_CREDENTIALS_CRYPTO_VERSION,
        "algorithm": LMS_CREDENTIALS_ALGORITHM,
        "nonce": base64.urlsafe_b64encode(nonce).decode("utf-8"),
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("utf-8"),
        "tag": base64.urlsafe_b64encode(tag).decode("utf-8"),
        "key_id": "active",
    }
    return json.dumps(envelope, separators=(",", ":"), sort_keys=True)


def decrypt_credentials(encrypted_payload: str) -> dict[str, Any]:
    key = _load_encryption_key()
    try:
        envelope = json.loads(encrypted_payload)
    except Exception as exc:
        raise LmsCryptoError("LMS_ENCRYPTED_PAYLOAD_INVALID", "Stored LMS credentials are not valid JSON.") from exc

    if not isinstance(envelope, dict):
        raise LmsCryptoError("LMS_ENCRYPTED_PAYLOAD_INVALID", "Stored LMS credentials payload must be a JSON object.")

    version = envelope.get("version")
    if version != LMS_CREDENTIALS_CRYPTO_VERSION:
        raise LmsCryptoError(
            "LMS_ENCRYPTED_PAYLOAD_VERSION_UNSUPPORTED",
            "Stored LMS credentials use an unsupported encryption payload version.",
        )

    algorithm = envelope.get("algorithm")
    if algorithm != LMS_CREDENTIALS_ALGORITHM:
        raise LmsCryptoError(
            "LMS_ENCRYPTED_PAYLOAD_ALGORITHM_UNSUPPORTED",
            "Stored LMS credentials use an unsupported encryption algorithm.",
        )

    try:
        nonce = base64.urlsafe_b64decode(_add_base64_padding(str(envelope["nonce"])))
        ciphertext = base64.urlsafe_b64decode(_add_base64_padding(str(envelope["ciphertext"])))
        tag = base64.urlsafe_b64decode(_add_base64_padding(str(envelope["tag"])))
        plaintext = AESGCM(key).decrypt(nonce, ciphertext + tag, associated_data=None)
        payload = json.loads(plaintext.decode("utf-8"))
    except LmsCryptoError:
        raise
    except Exception as exc:
        raise LmsCryptoError("LMS_ENCRYPTED_PAYLOAD_DECRYPT_FAILED", "Stored LMS credentials could not be decrypted.") from exc

    if not isinstance(payload, dict):
        raise LmsCryptoError("LMS_ENCRYPTED_PAYLOAD_INVALID", "Decrypted LMS credentials payload must be a JSON object.")

    return payload
