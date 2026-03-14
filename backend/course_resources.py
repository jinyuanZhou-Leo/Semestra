# input:  [filesystem paths/env configuration, SQLAlchemy session, backend ORM models, and uploaded file payloads]
# output: [Course-resource storage helpers, quota calculations, and persistence operations for course-scoped files]
# pos:    [Backend course-resource domain service that enforces account-wide quotas, stores file metadata, and synchronizes disk files with database rows]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import func
from sqlalchemy.orm import Session

import models

DEFAULT_COURSE_RESOURCES_MAX_TOTAL_BYTES = 50 * 1024 * 1024
DEFAULT_COURSE_RESOURCES_STORAGE_DIRNAME = "course_resources"

INLINE_MIME_PREFIXES = ("image/", "text/")
INLINE_MIME_TYPES = {
    "application/pdf",
    "application/json",
}
BLOCKED_UPLOAD_EXTENSIONS = {
    ".bat",
    ".bash",
    ".cmd",
    ".com",
    ".csh",
    ".ksh",
    ".ps1",
    ".psm1",
    ".py",
    ".rb",
    ".sh",
    ".vbs",
    ".zsh",
}


class CourseResourceError(Exception):
    """Base exception for course resource operations."""


class CourseResourceQuotaExceededError(CourseResourceError):
    """Raised when an account-wide quota would be exceeded."""


class CourseResourceStorageError(CourseResourceError):
    """Raised when resource storage cannot be completed."""


@dataclass(frozen=True)
class ResourceQuotaSnapshot:
    total_bytes_used: int
    total_bytes_limit: int

    @property
    def remaining_bytes(self) -> int:
        return max(0, self.total_bytes_limit - self.total_bytes_used)


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat()


def get_storage_root(base_dir: Path) -> Path:
    configured = os.getenv("COURSE_RESOURCES_STORAGE_DIR", "").strip()
    if configured:
        root = Path(configured).expanduser()
        if not root.is_absolute():
            root = (base_dir / root).resolve()
    else:
        root = (base_dir / DEFAULT_COURSE_RESOURCES_STORAGE_DIRNAME).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_total_bytes_limit() -> int:
    raw_value = os.getenv("COURSE_RESOURCES_MAX_TOTAL_BYTES", "").strip()
    if not raw_value:
        return DEFAULT_COURSE_RESOURCES_MAX_TOTAL_BYTES
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise CourseResourceStorageError("COURSE_RESOURCES_MAX_TOTAL_BYTES must be an integer.") from error
    if parsed <= 0:
        raise CourseResourceStorageError("COURSE_RESOURCES_MAX_TOTAL_BYTES must be greater than 0.")
    return parsed


def get_user_quota_snapshot(db: Session, user_id: str) -> ResourceQuotaSnapshot:
    total_used = (
        db.query(func.coalesce(func.sum(models.CourseResourceFile.size_bytes), 0))
        .join(models.Course, models.CourseResourceFile.course_id == models.Course.id)
        .join(models.Program, models.Course.program_id == models.Program.id)
        .filter(models.Program.owner_id == user_id)
        .scalar()
    )
    return ResourceQuotaSnapshot(
        total_bytes_used=int(total_used or 0),
        total_bytes_limit=get_total_bytes_limit(),
    )


def list_course_resources(db: Session, course_id: str) -> list[models.CourseResourceFile]:
    return (
        db.query(models.CourseResourceFile)
        .filter(models.CourseResourceFile.course_id == course_id)
        .order_by(models.CourseResourceFile.updated_at.desc(), models.CourseResourceFile.filename_display.asc())
        .all()
    )


def get_course_resource(db: Session, course_id: str, resource_id: str) -> models.CourseResourceFile | None:
    return (
        db.query(models.CourseResourceFile)
        .filter(
            models.CourseResourceFile.id == resource_id,
            models.CourseResourceFile.course_id == course_id,
        )
        .first()
    )


def guess_mime_type(filename: str, provided_mime_type: str | None) -> str:
    normalized = (provided_mime_type or "").strip()
    if normalized:
        return normalized
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def should_open_inline(mime_type: str) -> bool:
    return mime_type.startswith(INLINE_MIME_PREFIXES) or mime_type in INLINE_MIME_TYPES


def sanitize_display_name(value: str) -> str:
    normalized = " ".join((value or "").replace("/", " ").replace("\\", " ").split()).strip()
    if not normalized:
        raise CourseResourceStorageError("File name is required.")
    return normalized[:255]


def validate_upload_filename(filename: str) -> None:
    normalized = sanitize_display_name(filename)
    suffix = Path(normalized).suffix.lower()
    if suffix in BLOCKED_UPLOAD_EXTENSIONS:
        raise CourseResourceStorageError("Script files are not allowed.")


def normalize_external_url(url: str) -> str:
    normalized = url.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise CourseResourceStorageError("A valid http or https URL is required.")
    return normalized


def build_external_resource_name(url: str) -> str:
    parsed = urlparse(url)
    if parsed.path and parsed.path != "/":
        return Path(parsed.path).name or parsed.netloc
    return parsed.netloc


def build_storage_relative_path(user_id: str, course_id: str, resource_id: str, filename: str) -> Path:
    suffix = Path(filename).suffix[:32]
    safe_suffix = "".join(ch for ch in suffix if ch.isalnum() or ch in {".", "_", "-"})
    return Path(user_id) / course_id / f"{resource_id}{safe_suffix}"


def create_course_resource(
    db: Session,
    *,
    base_dir: Path,
    user_id: str,
    course_id: str,
    filename_original: str,
    filename_display: str,
    mime_type: str,
    content: bytes,
) -> models.CourseResourceFile:
    resource_id = models.generate_uuid()
    relative_path = build_storage_relative_path(user_id, course_id, resource_id, filename_original)
    storage_root = get_storage_root(base_dir)
    absolute_path = storage_root / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(content)

    timestamp = now_utc_iso()
    resource = models.CourseResourceFile(
        id=resource_id,
        course_id=course_id,
        filename_original=filename_original,
        filename_display=sanitize_display_name(filename_display),
        resource_kind="file",
        external_url=None,
        mime_type=guess_mime_type(filename_original, mime_type),
        size_bytes=len(content),
        storage_path=str(relative_path),
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(resource)
    try:
        db.commit()
    except Exception:
        if absolute_path.exists():
            absolute_path.unlink()
        raise
    db.refresh(resource)
    return resource


def create_external_course_resource(
    db: Session,
    *,
    course_id: str,
    external_url: str,
    filename_display: str | None = None,
) -> models.CourseResourceFile:
    normalized_url = normalize_external_url(external_url)
    display_name = sanitize_display_name(filename_display or build_external_resource_name(normalized_url))
    timestamp = now_utc_iso()
    resource = models.CourseResourceFile(
        id=models.generate_uuid(),
        course_id=course_id,
        filename_original=normalized_url,
        filename_display=display_name,
        resource_kind="link",
        external_url=normalized_url,
        mime_type="text/uri-list",
        size_bytes=0,
        storage_path="",
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def rename_course_resource(db: Session, resource: models.CourseResourceFile, filename_display: str) -> models.CourseResourceFile:
    resource.filename_display = sanitize_display_name(filename_display)
    resource.updated_at = now_utc_iso()
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def resolve_absolute_path(base_dir: Path, resource: models.CourseResourceFile) -> Path:
    return get_storage_root(base_dir) / resource.storage_path


def delete_course_resource(db: Session, *, base_dir: Path, resource: models.CourseResourceFile) -> None:
    absolute_path = resolve_absolute_path(base_dir, resource)
    db.delete(resource)
    db.commit()
    if absolute_path.exists():
        absolute_path.unlink()
