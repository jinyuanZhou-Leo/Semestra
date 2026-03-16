# input:  [FastAPI router/dependencies, backend CRUD/models/schemas, and shared ownership helpers]
# output: [Widget and tab route handlers for semester/course dashboard layout state]
# pos:    [backend API router for widget/tab CRUD, including force-aware ownership validation across semester and course scopes]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter()


@router.post("/semesters/{semester_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_semester(
    semester_id: str,
    widget: schemas.WidgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id,
        models.Program.owner_id == current_user.id,
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_widget(db=db, widget=widget, semester_id=semester_id)


@router.post("/courses/{course_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_course(
    course_id: str,
    widget: schemas.WidgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id,
        models.Program.owner_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_widget(db=db, widget=widget, course_id=course_id)


@router.put("/widgets/{widget_id}", response_model=schemas.Widget)
def update_widget(
    widget_id: str,
    widget: schemas.WidgetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Program).filter(
        models.Widget.id == widget_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_widget = db_widget_sem or db_widget_course
    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    return crud.update_widget(db=db, widget_id=widget_id, widget_update=widget)


@router.delete("/widgets/{widget_id}")
def delete_widget(
    widget_id: str,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Program).filter(
        models.Widget.id == widget_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_widget = db_widget_sem or db_widget_course
    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    if db_widget.is_removable is False and not force:
        raise HTTPException(status_code=400, detail="Cannot delete this widget")
    return crud.delete_widget(db=db, widget_id=widget_id)


@router.post("/semesters/{semester_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_semester(
    semester_id: str,
    tab: schemas.TabCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id,
        models.Program.owner_id == current_user.id,
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_tab(db=db, tab=tab, semester_id=semester_id)


@router.post("/courses/{course_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_course(
    course_id: str,
    tab: schemas.TabCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id,
        models.Program.owner_id == current_user.id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_tab(db=db, tab=tab, course_id=course_id)


@router.put("/tabs/{tab_id}", response_model=schemas.Tab)
def update_tab(
    tab_id: str,
    tab: schemas.TabUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Program).filter(
        models.Tab.id == tab_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    return crud.update_tab(db=db, tab_id=tab_id, tab_update=tab)


@router.delete("/tabs/{tab_id}")
def delete_tab(
    tab_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Program).filter(
        models.Tab.id == tab_id,
        models.Program.owner_id == current_user.id,
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    if db_tab.is_removable is False:
        raise HTTPException(status_code=400, detail="Cannot delete this tab")
    return crud.delete_tab(db, tab_id=tab_id)
