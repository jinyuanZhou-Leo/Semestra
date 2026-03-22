# input:  [FastAPI framework, domain route modules, backend schemas/models/crud/utils/auth/lms/resource services, env-backed runtime settings, and widget delete query flags]
# output: [FastAPI app instance, router registration, and remaining Program/Semester/Course route handlers that are not yet split into separate backend API modules]
# pos:    [Backend entry point that boots the FastAPI app, wires middleware and modular routers, and keeps the remaining program/semester/course orchestration endpoints plus course LMS navigation, announcement, assignment, grade, module, page, quiz, and syllabus reads]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from fastapi import Body, FastAPI, Depends, HTTPException, Form, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import Optional
import os
from pathlib import Path
from dotenv import load_dotenv

import models
import schemas
from api_auth import export_user_data, import_user_data, router as auth_router
from api_common import (
    build_course_resource_list_response,
    error_detail,
    get_owned_course,
    get_owned_semester,
    raise_gradebook_http_error,
    raise_lms_http_error,
    raise_todo_http_error,
    resolve_semester_date_bounds,
    validate_reading_week_or_422,
)
from api_course_schedule import router as course_schedule_router
from api_layout import router as layout_router
import crud
import gradebook
import todo
import course_resources
import auth
import lms_service
from database import engine, get_db
from schedule_support import import_course_schedule_from_ics

BASE_DIR = Path(__file__).parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load .env only for local development. Production should use platform env vars.
if ENVIRONMENT == "development":
    env_local_path = BASE_DIR / ".env"
    if env_local_path.exists():
        load_dotenv(env_local_path)

models.Base.metadata.create_all(bind=engine)

from fastapi import UploadFile, File
import utils

app = FastAPI()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS configuration
origins = [
    FRONTEND_URL,
    "https://semestra.jyleo.cc",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
origins = list({o for o in origins if o})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(course_schedule_router)
app.include_router(layout_router)

# --- Programs ---
@app.post("/programs/", response_model=schemas.Program)
def create_program(program: schemas.ProgramCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        return crud.create_program(db=db, program=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )
    except crud.ProgramLmsDependencyError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("PROGRAM_LMS_INTEGRATION_NOT_FOUND", "Selected LMS integration was not found."),
        )

@app.get("/programs/", response_model=list[schemas.Program])
def read_programs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_programs(db, user_id=current_user.id, skip=skip, limit=limit)

@app.get("/programs/{program_id}", response_model=schemas.ProgramWithSemesters)
def read_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program

@app.put("/programs/{program_id}", response_model=schemas.Program)
def update_program(program_id: str, program: schemas.ProgramUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        db_program = crud.update_program(db, program_id=program_id, program_update=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )
    except crud.ProgramLmsDependencyError as exc:
        if str(exc) == "PROGRAM_LMS_DEPENDENCIES_EXIST":
            raise HTTPException(
                status_code=409,
                detail=error_detail("PROGRAM_LMS_DEPENDENCIES_EXIST", "Program LMS cannot be changed while linked LMS courses still exist."),
            )
        raise HTTPException(
            status_code=422,
            detail=error_detail("PROGRAM_LMS_INTEGRATION_NOT_FOUND", "Selected LMS integration was not found."),
        )
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return db_program

@app.delete("/programs/{program_id}")
def delete_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_program = crud.delete_program(db, program_id=program_id, user_id=current_user.id)
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"ok": True}


@app.get("/programs/{program_id}/lms/courses", response_model=schemas.LmsCourseListResponse)
def list_program_lms_courses(
    program_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    workflow_state: Optional[str] = Query(default=None),
    enrollment_state: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_program_courses(
            db,
            current_user.id,
            program_id,
            page=page,
            page_size=page_size,
            workflow_state=workflow_state,
            enrollment_state=enrollment_state,
        )
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/programs/{program_id}/lms/courses/import", response_model=schemas.LmsCourseImportResponse)
def import_program_lms_courses(
    program_id: str,
    payload: schemas.LmsCourseImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.import_program_courses(db, current_user.id, program_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/programs/{program_id}/lms/semesters/import", response_model=schemas.LmsSemesterImportResponse)
def import_program_lms_semester(
    program_id: str,
    payload: schemas.LmsSemesterImportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        semester, import_response = lms_service.import_semester_with_courses(db, current_user.id, program_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)
    return {
        "semester": semester,
        "courses": import_response,
    }

# --- Semesters ---
@app.post("/programs/{program_id}/semesters/", response_model=schemas.Semester)
def create_semester_for_program(
    program_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    resolved_start_date, resolved_end_date = resolve_semester_date_bounds(semester.start_date, semester.end_date)
    if resolved_start_date > resolved_end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    validate_reading_week_or_422(
        resolved_start_date,
        resolved_end_date,
        semester.reading_week_start,
        semester.reading_week_end,
    )
    return crud.create_semester(db=db, semester=semester, program_id=program_id)

@app.post("/programs/{program_id}/semesters/upload", response_model=schemas.Semester)
async def create_semester_from_ics(
    program_id: str, 
    file: UploadFile = File(...), 
    name: str = Form(None), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = parsed_schedule.get("courses", [])
    
    if not name:
        name = file.filename.replace(".ics", "")

    start_date = parsed_schedule.get("semesterStartDate") or datetime.utcnow().date()
    end_date = parsed_schedule.get("semesterEndDate") or (start_date + timedelta(days=111))
    if end_date < start_date:
        end_date = start_date

    semester_create = schemas.SemesterCreate(name=name, start_date=start_date, end_date=end_date)
    semester = crud.create_semester(db=db, semester=semester_create, program_id=program_id)
    
    # Create courses and import structured schedule data from ICS.
    user_setting = crud.get_user_setting_dict(current_user)
    default_course_credit = float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
    if not parsed_courses:
        parsed_courses = [{"name": course_name, "category": utils.extract_category(course_name), "meetings": []} for course_name in utils.parse_ics(content)]

    for parsed_course in parsed_courses:
        course_name = str(parsed_course.get("name", "")).strip()
        if not course_name:
            continue
        category = parsed_course.get("category") or utils.extract_category(course_name)
        course_create = schemas.CourseCreate(name=course_name, credits=default_course_credit, category=category)
        created_course = crud.create_course(db=db, course=course_create, program_id=program_id, semester_id=semester.id)

        meetings = parsed_course.get("meetings", [])
        if not isinstance(meetings, list) or len(meetings) == 0:
            continue

        try:
            import_course_schedule_from_ics(db, created_course, meetings)
            db.commit()
        except Exception:
            db.rollback()
        
    return semester

@app.post("/programs/{program_id}/courses/upload", response_model=list[schemas.Course])
async def create_courses_from_ics(
    program_id: str,
    file: UploadFile = File(...),
    semester_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    target_semester_id: str | None = None
    if semester_id:
        semester = db.query(models.Semester).join(models.Program).filter(
            models.Semester.id == semester_id,
            models.Semester.program_id == program_id,
            models.Program.owner_id == current_user.id,
        ).first()
        if semester is None:
            raise HTTPException(status_code=404, detail="Semester not found")
        target_semester_id = semester.id

    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = parsed_schedule.get("courses", [])

    user_setting = crud.get_user_setting_dict(current_user)
    default_course_credit = float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
    if not parsed_courses:
        parsed_courses = [{"name": course_name, "category": utils.extract_category(course_name), "meetings": []} for course_name in utils.parse_ics(content)]

    created_courses: list[models.Course] = []
    for parsed_course in parsed_courses:
        course_name = str(parsed_course.get("name", "")).strip()
        if not course_name:
            continue

        category = parsed_course.get("category") or utils.extract_category(course_name)
        course_create = schemas.CourseCreate(name=course_name, credits=default_course_credit, category=category)
        created_course = crud.create_course(
            db=db,
            course=course_create,
            program_id=program_id,
            semester_id=target_semester_id,
        )
        created_courses.append(created_course)

        meetings = parsed_course.get("meetings", [])
        if not isinstance(meetings, list) or len(meetings) == 0:
            continue

        import_course_schedule_from_ics(db, created_course, meetings)

    db.commit()
    for course in created_courses:
        db.refresh(course)

    return created_courses

@app.get("/semesters/{semester_id}", response_model=schemas.SemesterWithDetails)
def read_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Need to verify ownership via program -> user
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester


@app.get("/semesters/{semester_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_semester_lms_assignments(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_semester_assignments(db, current_user.id, semester_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/semesters/{semester_id}/lms/calendar-events", response_model=schemas.LmsCalendarEventListResponse)
def read_semester_lms_calendar_events(
    semester_id: str,
    start: Optional[date] = Query(None),
    end: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_semester_calendar_events(
            db,
            current_user.id,
            semester_id,
            start_date=start,
            end_date=end,
        )
    except Exception as exc:
        raise_lms_http_error(exc)

@app.get("/semesters/{semester_id}/plugin-settings", response_model=list[schemas.PluginSetting])
def read_semester_plugin_settings(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    return crud.get_plugin_settings_for_context(db, semester_id=semester_id)

@app.put("/semesters/{semester_id}/plugin-settings/{plugin_id}", response_model=schemas.PluginSetting)
def upsert_semester_plugin_setting(
    semester_id: str,
    plugin_id: str,
    plugin_setting: schemas.PluginSettingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_semester(db, current_user, semester_id)
    payload = plugin_setting.copy(update={"plugin_id": plugin_id})
    return crud.upsert_plugin_setting(db, payload, semester_id=semester_id)

@app.put("/semesters/{semester_id}", response_model=schemas.Semester)
def update_semester(semester_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    resolved_start_date, resolved_end_date = resolve_semester_date_bounds(
        semester.start_date or db_semester.start_date,
        semester.end_date or db_semester.end_date,
    )
    if resolved_start_date > resolved_end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    validate_reading_week_or_422(
        resolved_start_date,
        resolved_end_date,
        semester.reading_week_start,
        semester.reading_week_end,
    )
    return crud.update_semester(db, semester_id=semester_id, semester_update=semester)

@app.delete("/semesters/{semester_id}")
def delete_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    crud.delete_semester(db, semester_id=semester_id)
    return {"ok": True}

@app.get("/semesters/{semester_id}/todo", response_model=schemas.TodoSemesterState)
def read_semester_todo(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.get_semester_state(db, semester)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.post("/semesters/{semester_id}/todo/sections", response_model=schemas.TodoSemesterState)
def create_semester_todo_section(
    semester_id: str,
    payload: schemas.TodoSectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.create_section(db, semester, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.patch("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
def update_semester_todo_section(
    semester_id: str,
    section_id: str,
    payload: schemas.TodoSectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.update_section(db, semester, section_id, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/sections/{section_id}", response_model=schemas.TodoSemesterState)
def delete_semester_todo_section(
    semester_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.delete_section(db, semester, section_id)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.post("/semesters/{semester_id}/todo/tasks", response_model=schemas.TodoSemesterState)
def create_semester_todo_task(
    semester_id: str,
    payload: schemas.TodoTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.create_task(db, semester, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.patch("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
def update_semester_todo_task(
    semester_id: str,
    task_id: str,
    payload: schemas.TodoTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.update_task(db, semester, task_id, payload)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/tasks/{task_id}", response_model=schemas.TodoSemesterState)
def delete_semester_todo_task(
    semester_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.delete_task(db, semester, task_id)
    except Exception as exc:
        raise_todo_http_error(exc)

@app.delete("/semesters/{semester_id}/todo/tasks/completed", response_model=schemas.TodoSemesterState)
def clear_completed_semester_todo_tasks(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    try:
        return todo.clear_completed_tasks(db, semester)
    except Exception as exc:
        raise_todo_http_error(exc)

# --- Courses ---
@app.post("/semesters/{semester_id}/courses/", response_model=schemas.Course)
def create_course_for_semester(
    semester_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify semester ownership
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_course(db=db, course=course, program_id=semester.program_id, semester_id=semester_id)

@app.post("/programs/{program_id}/courses/", response_model=schemas.Course)
def create_course_for_program(
    program_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.create_course(db=db, course=course, program_id=program_id, semester_id=None)

@app.get("/programs/{program_id}/courses/", response_model=list[schemas.Course])
def read_courses_for_program(
    program_id: str, 
    semester_id: str = None, 
    unassigned: bool = False, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.get_courses(db, program_id=program_id, semester_id=semester_id, unassigned=unassigned)

@app.get("/courses/{course_id}", response_model=schemas.CourseWithWidgets)
def read_course(course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership via program -> user
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    # SQLAlchemy relationships (widgets) are lazy loaded, so pydantic will fetch them if in schema
    return db_course


@app.get("/courses/{course_id}/lms-link", response_model=Optional[schemas.LmsCourseLinkSummary])
def read_course_lms_link(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_link(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.put("/courses/{course_id}/lms-link", response_model=schemas.LmsCourseLinkSummary)
def upsert_course_lms_link(
    course_id: str,
    payload: schemas.LmsCourseLinkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.upsert_course_link(db, current_user.id, course_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.post("/courses/{course_id}/lms-link/sync", response_model=schemas.LmsCourseLinkSummary)
def sync_course_lms_link(
    course_id: str,
    payload: Optional[schemas.LmsCourseLinkSyncRequest] = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.sync_course_link(db, current_user.id, course_id, payload)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.delete("/courses/{course_id}/lms-link", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_lms_link(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        lms_service.delete_course_link(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/courses/{course_id}/lms/assignments", response_model=schemas.LmsAssignmentListResponse)
def read_course_lms_assignments(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_assignments(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/grades", response_model=schemas.LmsGradeListResponse)
def read_course_lms_grades(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_grades(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/navigation", response_model=schemas.LmsCourseNavigationResponse)
def read_course_lms_navigation(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_navigation(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/announcements", response_model=schemas.LmsAnnouncementListResponse)
def read_course_lms_announcements(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_announcements(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/modules", response_model=schemas.LmsModuleListResponse)
def read_course_lms_modules(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_modules(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/quizzes", response_model=schemas.LmsQuizListResponse)
def read_course_lms_quizzes(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_quizzes(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/pages", response_model=schemas.LmsPageListResponse)
def read_course_lms_pages(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.list_course_pages(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/pages/{page_ref}", response_model=schemas.LmsPageDetail)
def read_course_lms_page(
    course_id: str,
    page_ref: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_page(db, current_user.id, course_id, page_ref)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/lms/syllabus", response_model=schemas.LmsCourseSyllabusResponse)
def read_course_lms_syllabus(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    try:
        return lms_service.get_course_syllabus(db, current_user.id, course_id)
    except Exception as exc:
        raise_lms_http_error(exc)


@app.get("/courses/{course_id}/plugin-settings", response_model=list[schemas.PluginSetting])
def read_course_plugin_settings(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return crud.get_plugin_settings_for_context(db, course_id=course_id)

@app.put("/courses/{course_id}/plugin-settings/{plugin_id}", response_model=schemas.PluginSetting)
def upsert_course_plugin_setting(
    course_id: str,
    plugin_id: str,
    plugin_setting: schemas.PluginSettingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    payload = plugin_setting.copy(update={"plugin_id": plugin_id})
    return crud.upsert_plugin_setting(db, payload, course_id=course_id)

@app.get("/courses/{course_id}/resources", response_model=schemas.CourseResourceListResponse)
def read_course_resources(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return build_course_resource_list_response(db, current_user, course_id)

@app.post("/courses/{course_id}/resources/upload", response_model=schemas.CourseResourceUploadResponse)
async def upload_course_resources(
    course_id: str,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    quota = course_resources.get_user_quota_snapshot(db, current_user.id)
    running_total = quota.total_bytes_used
    uploaded_files: list[models.CourseResourceFile] = []
    failed_files: list[schemas.CourseResourceUploadFailure] = []

    for file in files:
        filename = (file.filename or "").strip() or "untitled"
        try:
            course_resources.validate_upload_filename(filename)
            content = await file.read()
            projected_total = running_total + len(content)
            if projected_total > quota.total_bytes_limit:
                failed_files.append(schemas.CourseResourceUploadFailure(
                    filename=filename,
                    code="ACCOUNT_STORAGE_LIMIT_EXCEEDED",
                    message="Uploading this file would exceed the 50MB account resource limit.",
                ))
                continue

            uploaded = course_resources.create_course_resource(
                db,
                base_dir=BASE_DIR,
                user_id=current_user.id,
                course_id=course_id,
                filename_original=filename,
                filename_display=filename,
                mime_type=file.content_type,
                content=content,
            )
            uploaded_files.append(uploaded)
            running_total += uploaded.size_bytes
        except course_resources.CourseResourceStorageError as error:
            failed_files.append(schemas.CourseResourceUploadFailure(
                filename=filename,
                code="INVALID_FILE_NAME",
                message=str(error),
            ))
        except Exception as error:
            print(f"Failed to upload course resource '{filename}': {error}")
            failed_files.append(schemas.CourseResourceUploadFailure(
                filename=filename,
                code="UPLOAD_FAILED",
                message="Failed to store this file.",
            ))

    return schemas.CourseResourceUploadResponse(
        uploaded_files=uploaded_files,
        failed_files=failed_files,
        total_bytes_used=running_total,
        total_bytes_limit=quota.total_bytes_limit,
        remaining_bytes=max(0, quota.total_bytes_limit - running_total),
    )

@app.post("/courses/{course_id}/resources/links", response_model=schemas.CourseResourceFile)
def create_course_resource_link(
    course_id: str,
    payload: schemas.CourseResourceLinkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return course_resources.create_external_course_resource(
        db,
        course_id=course_id,
        external_url=payload.url,
        filename_display=payload.filename_display,
    )

@app.patch("/courses/{course_id}/resources/{resource_id}", response_model=schemas.CourseResourceFile)
def rename_course_resource(
    course_id: str,
    resource_id: str,
    payload: schemas.CourseResourceRenameRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    try:
        return course_resources.rename_course_resource(db, resource, payload.filename_display)
    except course_resources.CourseResourceStorageError as error:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_RESOURCE_FILENAME", str(error)),
        ) from error

@app.delete("/courses/{course_id}/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_resource(
    course_id: str,
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    course_resources.delete_course_resource(db, base_dir=BASE_DIR, resource=resource)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.get("/courses/{course_id}/resources/{resource_id}/download")
def download_course_resource(
    course_id: str,
    resource_id: str,
    download: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    resource = course_resources.get_course_resource(db, course_id, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Course resource not found")
    if resource.resource_kind == "link" and resource.external_url:
        return Response(status_code=status.HTTP_302_FOUND, headers={"Location": resource.external_url})
    absolute_path = course_resources.resolve_absolute_path(BASE_DIR, resource)
    if not absolute_path.exists():
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(
        path=absolute_path,
        media_type=resource.mime_type,
        filename=resource.filename_display,
        content_disposition_type=(
            "attachment"
            if download
            else ("inline" if course_resources.should_open_inline(resource.mime_type) else "attachment")
        ),
    )

@app.put("/courses/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: str, course: schemas.CourseUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership (via program -> user)
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    try:
        return crud.update_course(db=db, course_id=course_id, course_update=course)
    except crud.CourseSemesterAssignmentError as exc:
        if str(exc) == "SEMESTER_NOT_FOUND":
            raise HTTPException(status_code=404, detail=error_detail("SEMESTER_NOT_FOUND", "Semester not found."))
        raise HTTPException(
            status_code=422,
            detail=error_detail("SEMESTER_PROGRAM_MISMATCH", "Semester does not belong to this course's Program."),
        )

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    crud.delete_course(db, course_id)
    return {"ok": True}


@app.get("/courses/{course_id}/gradebook", response_model=schemas.CourseGradebook)
def read_course_gradebook(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.get_course_gradebook_payload(db, course.id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/preferences", response_model=schemas.CourseGradebook)
def update_course_gradebook_preferences(
    course_id: str,
    payload: schemas.GradebookPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_preferences(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.post("/courses/{course_id}/gradebook/categories", response_model=schemas.CourseGradebook)
def create_course_gradebook_category(
    course_id: str,
    payload: schemas.GradebookCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.create_category(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
def update_course_gradebook_category(
    course_id: str,
    category_id: str,
    payload: schemas.GradebookCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_category(db, course.id, category_id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.delete("/courses/{course_id}/gradebook/categories/{category_id}", response_model=schemas.CourseGradebook)
def delete_course_gradebook_category(
    course_id: str,
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.delete_category(db, course.id, category_id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.post("/courses/{course_id}/gradebook/assessments", response_model=schemas.CourseGradebook)
def create_course_gradebook_assessment(
    course_id: str,
    payload: schemas.GradebookAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.create_assessment(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.patch("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
def update_course_gradebook_assessment(
    course_id: str,
    assessment_id: str,
    payload: schemas.GradebookAssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.update_assessment(db, course.id, assessment_id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.delete("/courses/{course_id}/gradebook/assessments/{assessment_id}", response_model=schemas.CourseGradebook)
def delete_course_gradebook_assessment(
    course_id: str,
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.delete_assessment(db, course.id, assessment_id)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.put("/courses/{course_id}/gradebook/assessments/reorder", response_model=schemas.CourseGradebook)
def reorder_course_gradebook_assessments(
    course_id: str,
    payload: schemas.GradebookAssessmentReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = get_owned_course(db, current_user, course_id)
    try:
        return gradebook.reorder_assessments(db, course.id, payload)
    except Exception as exc:
        raise_gradebook_http_error(exc)


@app.get("/")
def read_root():
    return {"message": "Semestra API Running"}
