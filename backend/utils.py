from icalendar import Calendar
import re

def parse_ics(file_content: bytes) -> list[str]:
    """
    Parses an ICS file content and returns a list of unique course names.
    Ignores section codes like 'LEC0103' or similar patterns.
    """
    cal = Calendar.from_ical(file_content)
    courses = set()

    for component in cal.walk():
        if component.name == "VEVENT":
            summary = str(component.get('summary'))
            if summary:
                # Common patterns in university ICS files:
                # "APS100H1 F LEC0101" -> "APS100H1 F" or just "APS100"
                # Let's try to be smart. 
                # Strategy: 
                # 1. Split by common separators (space, dash)
                # 2. Look for patterns that look like course codes (e.g. 3-4 letters + 3 numbers)
                # 3. Or just take the first part of the summary if it looks like a code and remove section info.
                
                # REGEX UPDATE: Remove section codes AND common suffixes like H1, Y1
                # 1. Remove Section Codes: (LEC|TUT|PRA) followed by digits/letters
                clean_summary = re.sub(r'\s+(LEC|TUT|PRA)\s*\d+[A-Z]*\s*', '', summary, flags=re.IGNORECASE)
                
                # 2. Remove Course Suffixes (e.g., "H1", "Y1") at the end of the string
                # Matches H or Y followed by a digit at the end of the string (ignoring whitespace)
                clean_summary = re.sub(r'[HY]\d\s*$', '', clean_summary, flags=re.IGNORECASE)

                # Remove any trailing junk or common suffixes if needed, 
                # but for now just strip whitespace.
                clean_name = clean_summary.strip()
                
                # Split by space and take the first part if it looks like a course code? 
                # Some summaries are "Computer Fundamentals", not "APS105...". 
                # But the user example "APS105H1 LEC0103" suggests the summary includes the code.
                # If the summary is JUST the title "Computer Fundamentals" (as seen in some ICS lines?), 
                # we might have an issue. 
                # Let's check the ICS file again. 
                # SUMMARY:APS105H1 LEC0103
                # DESCRIPTION:Computer Fundamentals...
                # So SUMMARY *is* the code. OK.
                
                if clean_name:
                    courses.add(clean_name)

    return list(courses)
