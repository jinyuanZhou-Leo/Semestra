import json
from sqlalchemy.orm import Session
import models

DEFAULT_SCALING_TABLE = {
    "90-100": 4.0,
    "85-89": 4.0,
    "80-84": 3.7,
    "77-79": 3.3,
    "73-76": 3.0,
    "70-72": 2.7,
    "67-69": 2.3,
    "63-66": 2.0,
    "60-62": 1.7,
    "57-59": 1.3,
    "53-56": 1.0,
    "50-52": 0.7,
    "0-49": 0.0
}

def _parse_scaling_table(raw_table: str | None) -> dict | None:
    if not raw_table:
        return None
    try:
        parsed = json.loads(raw_table)
    except Exception:
        return None
    if isinstance(parsed, dict) and parsed:
        return parsed
    return None

def get_scaling_table(program: models.Program | None = None) -> dict:
    """
    Resolves the scaling table to use based on inheritance:
    Program > User Global Default > App Default
    """
    if program:
        program_table = _parse_scaling_table(program.gpa_scaling_table)
        if program_table:
            return program_table

    # Check User Global Default
    if program and program.owner:
        user_table = _parse_scaling_table(program.owner.gpa_scaling_table)
        if user_table:
            return user_table

    return DEFAULT_SCALING_TABLE

def calculate_gpa(percentage: float, scaling_table: dict) -> float:
    """
    Calculates GPA based on percentage and scaling table.
    Supports ranges ("85-89"), lower bounds (">=90", ">90"), and numeric keys.
    """
    if not scaling_table:
        return 0.0

    # First pass: exact range / operator matching
    for range_str, gpa in scaling_table.items():
        try:
            key = str(range_str).strip()
            if '-' in key:
                start, end = map(float, key.split('-'))
                if min(start, end) <= percentage <= max(start, end):
                    return float(gpa)
            elif key.startswith('>') or key.startswith('>='):
                val = float(''.join(ch for ch in key if (ch.isdigit() or ch == '.')))
                if percentage >= val:
                    return float(gpa)
            else:
                # Exact numeric match
                val = float(key)
                if abs(percentage - val) < 0.01:
                    return float(gpa)
        except Exception:
            continue

    # Second pass: treat numeric keys as lower bounds (descending)
    numeric_entries = []
    for key, gpa in scaling_table.items():
        key_str = str(key)
        if '-' in key_str:
            continue
        try:
            val = float(key_str)
        except Exception:
            continue
        numeric_entries.append((val, gpa))

    if numeric_entries:
        numeric_entries.sort(key=lambda item: item[0], reverse=True)
        for val, gpa in numeric_entries:
            if percentage >= val:
                try:
                    return float(gpa)
                except Exception:
                    return 0.0

    # Fallback if no range matches (e.g. > 100 or < 0, or gaps)
    return 0.0

def update_course_stats(course: models.Course, db: Session):
    """
    Updates the scaled GPA for a course.
    """
    # Need to fetch relations if not loaded, but assuming we have access via lazy loading or passed objects
    # course.semester and course.semester.program might trigger DB calls
    
    semester = course.semester
    program = semester.program if semester else None
    
    table = get_scaling_table(program)
    course.grade_scaled = calculate_gpa(course.grade_percentage, table)
    
    db.add(course)
    db.commit()
    db.refresh(course)
    
    # Trigger update up the chain
    if semester:
        update_semester_stats(semester, db)

def update_semester_stats(semester: models.Semester, db: Session):
    """
    Updates average stats for a semester.
    """
    courses = semester.courses
    
    total_credits = 0.0
    weighted_gpa_sum = 0.0
    weighted_percentage_sum = 0.0
    
    for course in courses:
        if course.include_in_gpa:
            # Re-calculate course stats just in case context changed (e.g. Program table changed)
            # But be careful of infinite recursion if we called update_course_stats here effectively.
            # actually logic.update_course_stats calls this function, so we shouldn't call it back unless necessary.
            # We can calculate fresh GPA locally without saving to DB if we want to be fast, OR assume course.grade_scaled is correct.
            # BETTER: We should make sure course.grade_scaled is fresh. 
            # If this was called from update_course_stats, it is fresh.
            # If called from update_program_stats -> update_semester_stats, we might need to refresh courses.
            
            # For now, let's assume we use current values in DB.
            
            total_credits += course.credits
            weighted_gpa_sum += course.grade_scaled * course.credits
            weighted_percentage_sum += course.grade_percentage * course.credits
            
    if total_credits > 0:
        semester.average_scaled = weighted_gpa_sum / total_credits
        semester.average_percentage = weighted_percentage_sum / total_credits
    else:
        semester.average_scaled = 0.0
        semester.average_percentage = 0.0
        
    db.add(semester)
    db.commit()
    db.refresh(semester)
    
    if semester.program:
        update_program_stats(semester.program, db)

def update_program_stats(program: models.Program, db: Session):
    """
    Updates CGPA for the program.
    """
    semesters = program.semesters
    
    total_credits = 0.0
    weighted_gpa_sum = 0.0
    weighted_percentage_sum = 0.0
    
    for semester in semesters:
        # We should iterate over ALL courses in the program directly for accuracy, 
        # or use semester averages weighted by semester credits? 
        # Usually CGPA is (Sum of all course GP * credits) / (Sum of all course credits)
        # So using semester averages might be slightly off if semesters have different credit counts?
        # Actually: Sum(SemAvg * SemCredits) / Sum(SemCredits) == Sum( (SumCourseGP/SemCredits) * SemCredits ) / TotalCredits == Sum(SumCourseGP) / TotalCredits.
        # So it is mathematically equivalent IF SemCredits matches sum of course credits.
        
        # Let's count from semesters to avoid fetching all courses again.
        
        # We need to know how many credits are in the semester. 
        # semester model doesn't store total credits, so we might have to re-sum from courses 
        # OR add a total_credits field to Semester.
        
        # For now, let's fetch all courses through semesters.
        for course in semester.courses:
            if course.include_in_gpa:
                 total_credits += course.credits
                 weighted_gpa_sum += course.grade_scaled * course.credits
                 weighted_percentage_sum += course.grade_percentage * course.credits
    
    if total_credits > 0:
        program.cgpa_scaled = weighted_gpa_sum / total_credits
        program.cgpa_percentage = weighted_percentage_sum / total_credits
    else:
        program.cgpa_scaled = 0.0
        program.cgpa_percentage = 0.0
        
    db.add(program)
    db.commit()
    db.refresh(program)

def recalculate_all_stats(program: models.Program, db: Session):
    """
    Full recalculation, useful when Program settings change.
    """
    # 1. Update all courses (they might depend on Program scaling table)
    for semester in program.semesters:
        for course in semester.courses:
            # We assume update_course_stats triggers up-chain updates, 
            # but that might be inefficient for bulk updates.
            # More efficient: Calculate all courses, commit, then calculate semesters, then program.
            
            table = get_scaling_table(program)
            course.grade_scaled = calculate_gpa(course.grade_percentage, table)
            db.add(course)
        
        # After courses updated, update semester
        db.commit() # Save courses first
        update_semester_stats(semester, db) # This effectively calculates semester average
        
    # Program stats updated by last semester update, or we can explicit call
    update_program_stats(program, db)

def recalculate_semester_full(semester: models.Semester, db: Session):
    """
    Recalculates all course stats in a semester, then the semester stats.
    """
    program = semester.program
    for course in semester.courses:
        table = get_scaling_table(program)
        course.grade_scaled = calculate_gpa(course.grade_percentage, table)
        db.add(course)
    db.commit()
    update_semester_stats(semester, db)
