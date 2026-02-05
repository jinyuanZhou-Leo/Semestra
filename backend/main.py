from fastapi import FastAPI, Depends, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import os
from pathlib import Path
from dotenv import load_dotenv

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

import models
import schemas
import crud
import auth
from database import engine, get_db

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

# Environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS configuration
origins = [
    FRONTEND_URL,
    "https://semestrauni.vercel.app",
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

def verify_google_id_token(id_token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client ID is not configured")
    try:
        payload = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        return payload
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@app.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.post("/auth/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), remember_me: bool = Form(False), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if remember_me:
        access_token_expires = timedelta(days=15)
    else:
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google", response_model=schemas.Token)
def login_with_google(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    google_payload = verify_google_id_token(payload.id_token)
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Google token missing email or subject")

    user = crud.get_user_by_google_sub(db, google_sub=sub)
    if user:
        access_token = auth.create_access_token(
            data={"sub": user.email}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer"}

    user = crud.get_user_by_email(db, email=email)
    if user:
        if user.google_sub and user.google_sub != sub:
            raise HTTPException(status_code=409, detail="Google account already linked to another user")
        user.google_sub = sub
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = crud.create_user_from_google(db, email=email, google_sub=sub)

    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google/link")
def link_google_account(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    google_payload = verify_google_id_token(payload.id_token)
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Google token missing email or subject")
    if current_user.email.lower() != email.lower():
        raise HTTPException(status_code=400, detail="Google email does not match current user")

    existing = crud.get_user_by_google_sub(db, google_sub=sub)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="Google account already linked to another user")
    if current_user.google_sub and current_user.google_sub != sub:
        raise HTTPException(status_code=409, detail="Current user already linked to a different Google account")

    current_user.google_sub = sub
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"ok": True}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.User)
async def update_user_me(user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, current_user.id, user_update)

from datetime import datetime

@app.get("/users/me/export", response_model=schemas.UserDataExport)
async def export_user_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Export all user data (programs, semesters, courses, widgets, tabs)."""
    programs = crud.get_programs(db, user_id=current_user.id)
    
    programs_export = []
    for program in programs:
        semesters_export = []
        for semester in program.semesters:
            # Courses for this semester
            courses_export = []
            for course in semester.courses:
                widgets_export = [
                    schemas.WidgetExport(
                        widget_type=w.widget_type,
                        layout_config=w.layout_config,
                        settings=w.settings,
                        is_removable=w.is_removable
                    ) for w in course.widgets
                ]
                tabs_export = [
                    schemas.TabExport(
                        tab_type=t.tab_type,
                        settings=t.settings,
                        order_index=t.order_index,
                        is_removable=t.is_removable
                    ) for t in course.tabs
                ]
                courses_export.append(schemas.CourseExport(
                    name=course.name,
                    alias=course.alias,
                    credits=course.credits,
                    grade_percentage=course.grade_percentage,
                    grade_scaled=course.grade_scaled,
                    include_in_gpa=course.include_in_gpa,
                    hide_gpa=course.hide_gpa,
                    widgets=widgets_export,
                    tabs=tabs_export
                ))
            
            # Semester widgets and tabs
            semester_widgets = [
                schemas.WidgetExport(
                    widget_type=w.widget_type,
                    layout_config=w.layout_config,
                    settings=w.settings,
                    is_removable=w.is_removable
                ) for w in semester.widgets
            ]
            semester_tabs = [
                schemas.TabExport(
                    tab_type=t.tab_type,
                    settings=t.settings,
                    order_index=t.order_index,
                    is_removable=t.is_removable
                ) for t in semester.tabs
            ]
            
            semesters_export.append(schemas.SemesterExport(
                name=semester.name,
                average_percentage=semester.average_percentage,
                average_scaled=semester.average_scaled,
                courses=courses_export,
                widgets=semester_widgets,
                tabs=semester_tabs
            ))
        
        programs_export.append(schemas.ProgramExport(
            name=program.name,
            cgpa_scaled=program.cgpa_scaled,
            cgpa_percentage=program.cgpa_percentage,
            gpa_scaling_table=program.gpa_scaling_table,
            grad_requirement_credits=program.grad_requirement_credits,
            hide_gpa=program.hide_gpa,
            semesters=semesters_export
        ))
    
    return schemas.UserDataExport(
        version="1.0",
        exported_at=datetime.utcnow().isoformat(),
        settings=schemas.UserSettingsExport(
            nickname=current_user.nickname,
            gpa_scaling_table=current_user.gpa_scaling_table,
            default_course_credit=current_user.default_course_credit
        ),
        programs=programs_export
    )

@app.post("/users/me/import")
async def import_user_data(
    data: schemas.UserDataImport,
    conflict_mode: str = "skip",
    include_settings: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Import user data with smart conflict handling.
    conflict_mode: 'skip' (ignore conflicts), 'overwrite' (replace existing), 'rename' (add suffix)
    """
    if conflict_mode not in ["skip", "overwrite", "rename"]:
        raise HTTPException(status_code=400, detail="conflict_mode must be 'skip', 'overwrite', or 'rename'")
    
    # Get existing program names for conflict detection
    existing_programs = crud.get_programs(db, user_id=current_user.id)
    existing_names = {p.name.lower(): p for p in existing_programs}
    
    # Import settings if provided and requested
    if include_settings and data.settings:
        update_data = {}
        if data.settings.nickname is not None:
            update_data["nickname"] = data.settings.nickname
        if data.settings.gpa_scaling_table is not None:
            update_data["gpa_scaling_table"] = data.settings.gpa_scaling_table
        if data.settings.default_course_credit is not None:
            update_data["default_course_credit"] = data.settings.default_course_credit
        if update_data:
            crud.update_user(db, current_user.id, schemas.UserUpdate(**update_data))
    
    # Import programs with conflict handling
    imported_programs = 0
    skipped_programs = 0
    imported_semesters = 0
    imported_courses = 0
    
    def import_program_data(program_data, program_name: str):
        """Helper to import a program and its nested data."""
        nonlocal imported_programs, imported_semesters, imported_courses
        
        program = crud.create_program(
            db=db,
            program=schemas.ProgramCreate(
                name=program_name,
                cgpa_scaled=program_data.cgpa_scaled,
                cgpa_percentage=program_data.cgpa_percentage,
                gpa_scaling_table=program_data.gpa_scaling_table,
                grad_requirement_credits=program_data.grad_requirement_credits,
                hide_gpa=program_data.hide_gpa
            ),
            user_id=current_user.id
        )
        imported_programs += 1
        
        for semester_data in program_data.semesters:
            semester = crud.create_semester(
                db=db,
                semester=schemas.SemesterCreate(
                    name=semester_data.name,
                    average_percentage=semester_data.average_percentage,
                    average_scaled=semester_data.average_scaled
                ),
                program_id=program.id
            )
            imported_semesters += 1
            
            # Create semester widgets
            for widget_data in semester_data.widgets:
                crud.create_widget(
                    db=db,
                    widget=schemas.WidgetCreate(
                        widget_type=widget_data.widget_type,
                        layout_config=widget_data.layout_config,
                        settings=widget_data.settings,
                        is_removable=widget_data.is_removable
                    ),
                    semester_id=semester.id
                )
            
            # Create semester tabs
            for tab_data in semester_data.tabs:
                crud.create_tab(
                    db=db,
                    tab=schemas.TabCreate(
                        tab_type=tab_data.tab_type,
                        settings=tab_data.settings,
                        order_index=tab_data.order_index,
                        is_removable=tab_data.is_removable
                    ),
                    semester_id=semester.id
                )
            
            # Create courses
            for course_data in semester_data.courses:
                course = crud.create_course(
                    db=db,
                    course=schemas.CourseCreate(
                        name=course_data.name,
                        alias=course_data.alias,
                        credits=course_data.credits,
                        grade_percentage=course_data.grade_percentage,
                        grade_scaled=course_data.grade_scaled,
                        include_in_gpa=course_data.include_in_gpa,
                        hide_gpa=course_data.hide_gpa
                    ),
                    program_id=program.id,
                    semester_id=semester.id
                )
                imported_courses += 1
                
                # Create course widgets
                for widget_data in course_data.widgets:
                    crud.create_widget(
                        db=db,
                        widget=schemas.WidgetCreate(
                            widget_type=widget_data.widget_type,
                            layout_config=widget_data.layout_config,
                            settings=widget_data.settings,
                            is_removable=widget_data.is_removable
                        ),
                        course_id=course.id
                    )
                
                # Create course tabs
                for tab_data in course_data.tabs:
                    crud.create_tab(
                        db=db,
                        tab=schemas.TabCreate(
                            tab_type=tab_data.tab_type,
                            settings=tab_data.settings,
                            order_index=tab_data.order_index,
                            is_removable=tab_data.is_removable
                        ),
                        course_id=course.id
                    )
    
    for program_data in data.programs:
        name_lower = program_data.name.lower()
        
        if name_lower in existing_names:
            # Conflict detected
            if conflict_mode == "skip":
                skipped_programs += 1
                continue
            elif conflict_mode == "overwrite":
                # Delete existing program first
                existing_program = existing_names[name_lower]
                crud.delete_program(db, program_id=existing_program.id, user_id=current_user.id)
                import_program_data(program_data, program_data.name)
            elif conflict_mode == "rename":
                # Find a unique name
                suffix = 2
                new_name = f"{program_data.name} ({suffix})"
                while new_name.lower() in existing_names:
                    suffix += 1
                    new_name = f"{program_data.name} ({suffix})"
                import_program_data(program_data, new_name)
                # Add to existing names to prevent future conflicts
                existing_names[new_name.lower()] = True
        else:
            # No conflict, just import
            import_program_data(program_data, program_data.name)
            existing_names[name_lower] = True
    
    return {
        "ok": True,
        "conflict_mode": conflict_mode,
        "imported": {
            "programs": imported_programs,
            "semesters": imported_semesters,
            "courses": imported_courses
        },
        "skipped": {
            "programs": skipped_programs
        }
    }

# --- Programs ---
@app.post("/programs/", response_model=schemas.Program)
def create_program(program: schemas.ProgramCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_program(db=db, program=program, user_id=current_user.id)

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
    db_program = crud.update_program(db, program_id=program_id, program_update=program, user_id=current_user.id)
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return db_program

@app.delete("/programs/{program_id}")
def delete_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_program = crud.delete_program(db, program_id=program_id, user_id=current_user.id)
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"ok": True}

# --- Semesters ---
@app.post("/programs/{program_id}/semesters/", response_model=schemas.Semester)
def create_semester_for_program(
    program_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
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
    course_names = utils.parse_ics(content)
    
    if not name:
        name = file.filename.replace(".ics", "")
        
    # Create Semester
    semester_create = schemas.SemesterCreate(name=name)
    semester = crud.create_semester(db=db, semester=semester_create, program_id=program_id)
    
    # Create Courses
    for course_name in course_names:
        category = utils.extract_category(course_name)
        course_create = schemas.CourseCreate(name=course_name, credits=current_user.default_course_credit, category=category)
        crud.create_course(db=db, course=course_create, program_id=program_id, semester_id=semester.id)
        
    return semester

@app.get("/semesters/{semester_id}", response_model=schemas.SemesterWithDetails)
def read_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Need to verify ownership via program -> user
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester

@app.put("/semesters/{semester_id}", response_model=schemas.Semester)
def update_semester(semester_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
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
        
    return crud.update_course(db=db, course_id=course_id, course_update=course)

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    db.delete(db_course)
    db.commit()
    return {"ok": True}

# --- Widgets ---
@app.post("/semesters/{semester_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_semester(
    semester_id: str, widget: schemas.WidgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_widget(db=db, widget=widget, semester_id=semester_id)

@app.post("/courses/{course_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_course(
    course_id: str, widget: schemas.WidgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_widget(db=db, widget=widget, course_id=course_id)

@app.put("/widgets/{widget_id}", response_model=schemas.Widget)
def update_widget(
    widget_id: str, widget: schemas.WidgetUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership via semester -> program -> user OR course -> semester -> program -> user
    # Check Semester widget
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()
    
    # Check Course widget
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()

    db_widget = db_widget_sem or db_widget_course

    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    return crud.update_widget(db=db, widget_id=widget_id, widget_update=widget)

@app.delete("/widgets/{widget_id}")
def delete_widget(
    widget_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Check Semester widget
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()
    
    # Check Course widget
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()

    db_widget = db_widget_sem or db_widget_course

    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
        
    if db_widget.is_removable is False:
        raise HTTPException(status_code=400, detail="Cannot delete this widget")
        
    return crud.delete_widget(db=db, widget_id=widget_id)

# --- Tabs ---
@app.post("/semesters/{semester_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_semester(
    semester_id: str, tab: schemas.TabCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_tab(db=db, tab=tab, semester_id=semester_id)

@app.post("/courses/{course_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_course(
    course_id: str, tab: schemas.TabCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_tab(db=db, tab=tab, course_id=course_id)

@app.put("/tabs/{tab_id}", response_model=schemas.Tab)
def update_tab(
    tab_id: str, tab: schemas.TabUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    return crud.update_tab(db=db, tab_id=tab_id, tab_update=tab)

@app.delete("/tabs/{tab_id}")
def delete_tab(
    tab_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    if db_tab.is_removable is False:
        raise HTTPException(status_code=400, detail="Cannot delete this tab")
    return crud.delete_tab(db, tab_id=tab_id)

@app.get("/")
def read_root():
    return {"message": "Semestra API Running"}
