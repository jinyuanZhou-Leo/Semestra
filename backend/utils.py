from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from icalendar import Calendar
import re

SECTION_TOKEN_PATTERN = re.compile(
    r"\b(LEC|TUT|PRA|LAB|SEM|DIS|WKS|CLN|LBR|EXM|TST|QUI)\s*(0*[0-9]{1,6})[A-Z]*\b",
    flags=re.IGNORECASE,
)
COURSE_TOKEN_PATTERN = re.compile(r"^([A-Za-z]{2,6}\d{2,4})(?:[A-Za-z]\d)?[A-Za-z]?$")
INSTRUCTOR_PATTERN = re.compile(r"(?:Instructor|Instructors|Prof|Professor)\s*[:\-]\s*(.+)", flags=re.IGNORECASE)

EVENT_TYPE_CODE_BY_SECTION_PREFIX = {
    "LEC": "LECTURE",
    "TUT": "TUTORIAL",
    "PRA": "PRACTICAL",
    "LAB": "PRACTICAL",
}
WEEKDAY_TOKEN_TO_ISO = {
    "MO": 1,
    "TU": 2,
    "WE": 3,
    "TH": 4,
    "FR": 5,
    "SA": 6,
    "SU": 7,
}

DEFAULT_EVENT_TYPE_CODE = "LECTURE"
DEFAULT_WEEK_PATTERN = "EVERY"


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return str(value)


def _normalize_course_name(summary: str) -> str:
    cleaned = re.sub(SECTION_TOKEN_PATTERN, "", summary)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""

    first_token = cleaned.split(" ", 1)[0].upper()
    match = COURSE_TOKEN_PATTERN.match(first_token)
    if match:
        return match.group(1).upper()

    without_suffix = re.sub(r"[HY]\d\s*$", "", cleaned, flags=re.IGNORECASE).strip()
    return without_suffix


def _extract_section_fields(summary: str) -> tuple[str | None, str | None]:
    match = SECTION_TOKEN_PATTERN.search(summary.upper())
    if not match:
        return None, None
    section_prefix = match.group(1).upper()
    section_digits = re.sub(r"\D", "", match.group(2))
    section_id = section_digits if section_digits else None
    return section_prefix, section_id


def _infer_event_type_code(summary: str, section_prefix: str | None) -> str:
    if section_prefix:
        return EVENT_TYPE_CODE_BY_SECTION_PREFIX.get(section_prefix, section_prefix)

    upper_summary = summary.upper()
    for prefix, code in EVENT_TYPE_CODE_BY_SECTION_PREFIX.items():
        if prefix in upper_summary:
            return code
    return DEFAULT_EVENT_TYPE_CODE


def _extract_title_and_instructor(description: str, course_name: str) -> tuple[str | None, str | None]:
    if not description:
        return None, None

    lines = [line.strip() for line in re.split(r"[\r\n]+", description) if line.strip()]
    title: str | None = None
    instructor: str | None = None

    for line in lines:
        if instructor is None:
            instructor_match = INSTRUCTOR_PATTERN.search(line)
            if instructor_match:
                instructor = instructor_match.group(1).strip()

        if title is not None:
            continue
        if ":" in line and len(line.split(":", 1)[0]) <= 20:
            continue
        if course_name and course_name.upper() in line.upper():
            continue
        if SECTION_TOKEN_PATTERN.search(line):
            continue
        title = line[:160]

    return title, instructor


def _safe_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except Exception:
        return fallback

def _parse_byday_values(values: list[Any]) -> list[int]:
    days: list[int] = []
    for raw in values:
        token_group = _as_text(raw).upper()
        for token in token_group.split(","):
            normalized = token.strip()
            if not normalized:
                continue
            day_token = normalized[-2:]
            iso_day = WEEKDAY_TOKEN_TO_ISO.get(day_token)
            if iso_day is not None:
                days.append(iso_day)
    return sorted(set(days))

def _parse_weekly_recurrence(component, start_date: date) -> tuple[int, date, list[int], int | None]:
    interval = 1
    recurrence_end_date = start_date
    byday_days: list[int] = []
    count: int | None = 1
    rrule = component.get("rrule")

    if not rrule:
        return interval, recurrence_end_date, byday_days, count

    frequency_values = rrule.get("FREQ") or []
    frequency = _as_text(frequency_values[0]).upper() if frequency_values else ""
    if frequency != "WEEKLY":
        return interval, recurrence_end_date, byday_days, count

    interval_values = rrule.get("INTERVAL")
    if interval_values:
        interval = max(1, _safe_int(interval_values[0], 1))

    until_values = rrule.get("UNTIL")
    if until_values:
        until_value = until_values[0]
        if isinstance(until_value, datetime):
            recurrence_end_date = until_value.date()
        elif isinstance(until_value, date):
            recurrence_end_date = until_value
    else:
        recurrence_end_date = start_date + timedelta(days=16 * 7)

    count_values = rrule.get("COUNT")
    if count_values:
        count = max(1, _safe_int(count_values[0], 1))
        if not until_values:
            recurrence_end_date = start_date + timedelta(days=(count * interval * 7) + 7)
    else:
        count = None

    byday_values = rrule.get("BYDAY") or []
    byday_days = _parse_byday_values(byday_values)

    return interval, max(start_date, recurrence_end_date), byday_days, count

def _expand_occurrence_dates(
    start_date: date,
    end_date: date,
    interval: int,
    byday_days: list[int],
    count: int | None,
) -> list[date]:
    days = byday_days or [start_date.isoweekday()]
    week_anchor = start_date - timedelta(days=start_date.isoweekday() - 1)
    occurrences: list[date] = []
    guard = 0

    while guard < 128:
        week_start = week_anchor + timedelta(days=guard * max(1, interval) * 7)
        if week_start > end_date + timedelta(days=7):
            break
        for day in days:
            occurrence_date = week_start + timedelta(days=day - 1)
            if occurrence_date < start_date:
                continue
            if occurrence_date > end_date:
                continue
            occurrences.append(occurrence_date)
            if count is not None and len(occurrences) >= count:
                return occurrences
        guard += 1

    if not occurrences:
        return [start_date]
    return sorted(set(occurrences))


def _expand_week_indexes(start_date: date, end_date: date, interval: int, semester_start: date) -> list[int]:
    result: list[int] = []
    step = timedelta(days=max(1, interval) * 7)
    cursor = start_date
    guard = 0

    while cursor <= end_date and guard < 256:
        week_index = ((cursor - semester_start).days // 7) + 1
        result.append(max(1, week_index))
        cursor += step
        guard += 1

    if not result:
        fallback_week = ((start_date - semester_start).days // 7) + 1
        result.append(max(1, fallback_week))

    return sorted(set(result))


def _resolve_week_pattern(weeks: list[int]) -> str:
    if len(weeks) <= 1:
        return DEFAULT_WEEK_PATTERN

    gaps = {weeks[index + 1] - weeks[index] for index in range(len(weeks) - 1)}
    if gaps == {2}:
        return "ODD" if weeks[0] % 2 == 1 else "EVEN"
    return DEFAULT_WEEK_PATTERN


def parse_ics_schedule(file_content: bytes) -> dict[str, Any]:
    """
    Parse ICS and return structured data for semester/course/section/event creation.
    """
    calendar = Calendar.from_ical(file_content)
    raw_meetings: list[dict[str, Any]] = []
    date_range_candidates: list[tuple[date, date]] = []

    for component in calendar.walk():
        if component.name != "VEVENT":
            continue

        try:
            decoded_start = component.decoded("dtstart")
            decoded_end = component.decoded("dtend")
        except Exception:
            continue

        start_date_value: date | None = None
        end_date_value: date | None = None
        if isinstance(decoded_start, datetime):
            start_date_value = decoded_start.date()
        elif isinstance(decoded_start, date):
            start_date_value = decoded_start

        if isinstance(decoded_end, datetime):
            end_date_value = decoded_end.date()
        elif isinstance(decoded_end, date):
            # In ICS, date-only DTEND is exclusive. Convert to inclusive end date.
            end_date_value = decoded_end - timedelta(days=1)

        if start_date_value and end_date_value:
            if end_date_value < start_date_value:
                end_date_value = start_date_value
            date_range_candidates.append((start_date_value, end_date_value))

        if not isinstance(decoded_start, datetime) or not isinstance(decoded_end, datetime):
            continue
        if decoded_end <= decoded_start:
            continue

        summary = _as_text(component.get("summary")).strip()
        if not summary:
            continue

        course_name = _normalize_course_name(summary)
        if not course_name:
            continue

        section_prefix, section_id = _extract_section_fields(summary)
        event_type_code = _infer_event_type_code(summary, section_prefix)
        location = _as_text(component.get("location")).strip() or None
        description = _as_text(component.get("description")).strip()
        title, instructor = _extract_title_and_instructor(description, course_name)

        meeting_start_date = decoded_start.date()
        recurrence_interval, recurrence_end_date, byday_days, recurrence_count = _parse_weekly_recurrence(component, meeting_start_date)
        occurrence_dates = _expand_occurrence_dates(
            start_date=meeting_start_date,
            end_date=recurrence_end_date,
            interval=recurrence_interval,
            byday_days=byday_days,
            count=recurrence_count,
        )

        for occurrence_date in occurrence_dates:
            raw_meetings.append(
                {
                    "courseName": course_name,
                    "eventTypeCode": event_type_code.upper(),
                    "sectionId": section_id,
                    "title": title,
                    "instructor": instructor,
                    "location": location,
                    "dayOfWeek": occurrence_date.isoweekday(),
                    "startTime": decoded_start.strftime("%H:%M"),
                    "endTime": decoded_end.strftime("%H:%M"),
                    "startDate": occurrence_date,
                    "endDate": occurrence_date,
                    "interval": 1,
                    "note": description or None,
                }
            )

    if not raw_meetings:
        if not date_range_candidates:
            return {"semesterStartDate": None, "semesterEndDate": None, "courses": []}
        semester_start = min(item[0] for item in date_range_candidates)
        semester_end = max(item[1] for item in date_range_candidates)
        return {"semesterStartDate": semester_start, "semesterEndDate": semester_end, "courses": []}

    semester_start = min(item["startDate"] for item in raw_meetings)
    semester_end = max(item["endDate"] for item in raw_meetings)
    if date_range_candidates:
        semester_start = min(semester_start, min(item[0] for item in date_range_candidates))
        semester_end = max(semester_end, max(item[1] for item in date_range_candidates))

    grouped_by_course: dict[str, dict[tuple[Any, ...], dict[str, Any]]] = {}
    for item in raw_meetings:
        course_name = item["courseName"]
        grouped_by_course.setdefault(course_name, {})
        course_map = grouped_by_course[course_name]

        weeks = _expand_week_indexes(item["startDate"], item["endDate"], item["interval"], semester_start)
        meeting_key = (
            item["eventTypeCode"],
            item["sectionId"],
            item["title"],
            item["instructor"],
            item["location"],
            item["dayOfWeek"],
            item["startTime"],
            item["endTime"],
        )

        aggregate = course_map.get(meeting_key)
        if aggregate is None:
            aggregate = {
                "eventTypeCode": item["eventTypeCode"],
                "sectionId": item["sectionId"],
                "title": item["title"],
                "instructor": item["instructor"],
                "location": item["location"],
                "dayOfWeek": item["dayOfWeek"],
                "startTime": item["startTime"],
                "endTime": item["endTime"],
                "weeks": set(),
                "note": item["note"],
            }
            course_map[meeting_key] = aggregate

        aggregate["weeks"].update(weeks)
        if not aggregate["note"] and item["note"]:
            aggregate["note"] = item["note"]

    courses: list[dict[str, Any]] = []
    for course_name in sorted(grouped_by_course.keys()):
        meetings: list[dict[str, Any]] = []
        course_map = grouped_by_course[course_name]

        for aggregate in course_map.values():
            weeks = sorted(aggregate["weeks"])
            start_week = weeks[0]
            end_week = weeks[-1]
            week_pattern = _resolve_week_pattern(weeks)
            meetings.append(
                {
                    "eventTypeCode": aggregate["eventTypeCode"],
                    "sectionId": aggregate["sectionId"],
                    "title": aggregate["title"],
                    "instructor": aggregate["instructor"],
                    "location": aggregate["location"],
                    "dayOfWeek": aggregate["dayOfWeek"],
                    "startTime": aggregate["startTime"],
                    "endTime": aggregate["endTime"],
                    "weekPattern": week_pattern,
                    "startWeek": start_week,
                    "endWeek": end_week,
                    "note": aggregate["note"],
                }
            )

        meetings.sort(key=lambda item: (item["dayOfWeek"], item["startTime"], item["eventTypeCode"], item["sectionId"] or ""))
        courses.append(
            {
                "name": course_name,
                "category": extract_category(course_name),
                "meetings": meetings,
            }
        )

    return {
        "semesterStartDate": semester_start,
        "semesterEndDate": semester_end,
        "courses": courses,
    }


def parse_ics(file_content: bytes) -> list[str]:
    """
    Parse ICS and return unique course names.
    """
    parsed = parse_ics_schedule(file_content)
    return [course["name"] for course in parsed.get("courses", [])]


def extract_category(course_name: str) -> str | None:
    """
    Extract category from course name, e.g. "MIE100" -> "MIE".
    """
    if not course_name:
        return None

    match = re.match(r"^([A-Za-z]{2,4})\d", course_name.strip())
    if match:
        return match.group(1).upper()

    first_word = course_name.strip().split(" ")[0]
    if first_word.isalpha() and len(first_word) > 1:
        return first_word

    return None
