# input:  [raw Program subject-color JSON, course naming/category fields, and subject-code collections]
# output: [shared subject-code parsing, validation, automatic color assignment, and Program color-map serialization helpers]
# pos:    [backend color utility layer that keeps Program, Course, and Todo subject-color resolution on one stable rule]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import json
import re
from typing import Iterable

DEFAULT_SUBJECT_COLORS = (
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#ea580c",
    "#0891b2",
    "#7c3aed",
    "#ca8a04",
    "#db2777",
    "#0f766e",
    "#4f46e5",
    "#65a30d",
    "#c2410c",
)


def is_hex_color(value: str | None) -> bool:
    return bool(value and re.fullmatch(r"#[0-9a-fA-F]{6}", value.strip()))


def normalize_subject_code(value: str | None) -> str:
    if not value:
        return ""
    normalized = re.sub(r"[^A-Za-z]", "", value).upper()
    if 2 <= len(normalized) <= 5:
        return normalized
    return ""


def extract_subject_code_from_text(value: str | None) -> str:
    if not value:
        return ""
    match = re.search(r"\b([A-Za-z]{2,5})[\s-]*\d{2,4}[A-Za-z0-9]*\b", value)
    if not match:
        return ""
    return normalize_subject_code(match.group(1))


def resolve_subject_code(*, category: str | None, alias: str | None, name: str | None) -> str:
    direct = normalize_subject_code(category)
    if direct:
        return direct

    alias_code = extract_subject_code_from_text(alias)
    if alias_code:
        return alias_code

    return extract_subject_code_from_text(name)


def parse_subject_color_map(raw_value: str | None) -> dict[str, str]:
    if not raw_value:
        return {}
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in parsed.items():
        subject_code = normalize_subject_code(str(key))
        if not subject_code or not isinstance(value, str):
            continue
        color = value.strip().lower()
        if not is_hex_color(color):
            continue
        normalized[subject_code] = color
    return normalized


def serialize_subject_color_map(value: dict[str, str]) -> str:
    return json.dumps(
        {
            subject_code: color
            for subject_code, color in sorted(
                (
                    (normalize_subject_code(key), color.strip().lower())
                    for key, color in value.items()
                    if isinstance(color, str)
                ),
                key=lambda item: item[0],
            )
            if subject_code and is_hex_color(color)
        },
        separators=(",", ":"),
    )


def get_automatic_subject_color(subject_code: str, occupied_colors: Iterable[str] = ()) -> str:
    normalized_code = normalize_subject_code(subject_code)
    if not normalized_code:
        return "#3b82f6"

    hash_value = 0
    for character in normalized_code:
        hash_value = ord(character) + ((hash_value << 5) - hash_value)

    preferred_index = abs(hash_value) % len(DEFAULT_SUBJECT_COLORS)
    normalized_occupied_colors = {
        color.strip().lower()
        for color in occupied_colors
        if isinstance(color, str) and is_hex_color(color)
    }
    preferred_color = DEFAULT_SUBJECT_COLORS[preferred_index]
    if preferred_color.lower() not in normalized_occupied_colors:
        return preferred_color

    for offset in range(1, len(DEFAULT_SUBJECT_COLORS)):
        candidate = DEFAULT_SUBJECT_COLORS[(preferred_index + offset) % len(DEFAULT_SUBJECT_COLORS)]
        if candidate.lower() not in normalized_occupied_colors:
            return candidate

    return preferred_color


def resolve_subject_color_assignments(
    subject_codes: Iterable[str],
    persisted_assignments: dict[str, str] | None = None,
) -> dict[str, str]:
    normalized_codes = sorted({
        normalize_subject_code(code)
        for code in subject_codes
        if normalize_subject_code(code)
    })
    normalized_assignments = persisted_assignments or {}
    resolved_map: dict[str, str] = {}
    occupied_colors: set[str] = {
        color.strip().lower()
        for code, color in normalized_assignments.items()
        if code not in normalized_codes and isinstance(color, str) and is_hex_color(color)
    }

    for code in normalized_codes:
        persisted_color = normalized_assignments.get(code)
        if not is_hex_color(persisted_color):
            continue
        normalized_color = persisted_color.strip().lower()
        if normalized_color in occupied_colors:
            continue
        resolved_map[code] = normalized_color
        occupied_colors.add(normalized_color)

    for code in normalized_codes:
        if code in resolved_map:
            continue
        next_color = get_automatic_subject_color(code, occupied_colors)
        resolved_map[code] = next_color
        occupied_colors.add(next_color.lower())

    return resolved_map
