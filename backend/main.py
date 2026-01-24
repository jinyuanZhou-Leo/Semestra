from fastapi import FastAPI, Depends, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

import models
import schemas
import crud
import auth
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

from fastapi import UploadFile, File
import utils

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.User)
async def update_user_me(user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, current_user.id, user_update)

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
    name: str = None, 
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
        course_create = schemas.CourseCreate(name=course_name, credit=0.5) # Default credit
        crud.create_course(db=db, course=course_create, semester_id=semester.id)
        
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
    return crud.create_course(db=db, course=course, semester_id=semester_id)

@app.get("/courses/{course_id}", response_model=schemas.CourseWithWidgets)
def read_course(course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership via semester -> program -> user
    db_course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    # SQLAlchemy relationships (widgets) are lazy loaded, so pydantic will fetch them if in schema
    return db_course

@app.put("/courses/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership (via semester -> program -> user)
    db_course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    return crud.update_course(db=db, course_id=course_id, course_update=course)

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
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
        
    if db_widget.widget_type == "course-list":
        raise HTTPException(status_code=400, detail="Cannot delete default Course List widget")
        
    return crud.delete_widget(db=db, widget_id=widget_id)

@app.get("/")
def read_root():
    return {"message": "Semestra API Running"}
