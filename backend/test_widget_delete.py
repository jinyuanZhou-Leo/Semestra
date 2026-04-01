# input:  [requests/json/uuid, running API server, and backend DB/user helpers]
# output: [Integration test for widget deletion behavior, including force-delete fallback]
# pos:    [Manual/integration validation script for widget API using a locally seeded verified user]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests
import json
import uuid

import crud
from database import SessionLocal
import schemas

BASE_URL = "http://localhost:8000"
EMAIL = f"test_delete_{uuid.uuid4()}@example.com"
PASSWORD = "Password123"


def _ensure_verified_user() -> None:
    db = SessionLocal()
    try:
        if crud.get_user_by_email(db, EMAIL) is None:
            crud.create_user(
                db,
                schemas.UserCreate(email=EMAIL, password=PASSWORD),
                email_verified_at="2026-03-31T00:00:00+00:00",
            )
    finally:
        db.close()

def test_widget_delete():
    print(f"Testing with user: {EMAIL}")
    
    # 1. Seed a verified user and log in.
    _ensure_verified_user()
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    if response.status_code != 200:
        print("Login failed")
        return
        
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Program and Semester.
    prog = requests.post(f"{BASE_URL}/programs/", json={"name": "Del Test Prog"}, headers=headers).json()
    sem = requests.post(f"{BASE_URL}/programs/{prog['id']}/semesters/", json={"name": "Del Test Sem"}, headers=headers).json()
    
    # 3. Get widgets to find the default Course List.
    sem_details = requests.get(f"{BASE_URL}/semesters/{sem['id']}", headers=headers).json()
    default_widgets = sem_details.get("widgets", [])
    course_list_widget = next((w for w in default_widgets if w["widget_type"] == "course-list"), None)
    
    if not course_list_widget:
        print("FAILED: Default Course List widget not created")
        return

    print(f"Default widget found: {course_list_widget['id']}")
    
    # 4. Attempt to delete the default widget (should fail).
    print("Attempting to delete DEFAULT Course List widget...")
    resp = requests.delete(f"{BASE_URL}/widgets/{course_list_widget['id']}", headers=headers)
    
    if resp.status_code == 400:
        print("SUCCESS: Default widget correctly protected (Status 400).")
    else:
        print(f"FAILED: Expected 400, got {resp.status_code}")
        print(resp.text)
        
    # 5. Create a new manual Course List widget.
    print("Creating manual Course List widget...")
    manual_widget = requests.post(f"{BASE_URL}/semesters/{sem['id']}/widgets/", json={
        "widget_type": "course-list",
        "title": "Manual Courses"
    }, headers=headers).json()
    
    print(f"Manual widget created: {manual_widget['id']}")
    
    # 6. Attempt to delete the manual widget (should succeed).
    print("Attempting to delete MANUAL Course List widget...")
    resp = requests.delete(f"{BASE_URL}/widgets/{manual_widget['id']}", headers=headers)
    
    if resp.status_code == 200:
        print("SUCCESS: Manual widget deleted successfully.")
    else:
        print(f"FAILED: Expected 200, got {resp.status_code}")
        print(resp.text)

    # 7. Attempt to force-delete the default widget (should succeed).
    print("Attempting to force delete DEFAULT Course List widget...")
    resp = requests.delete(f"{BASE_URL}/widgets/{course_list_widget['id']}", headers=headers, params={"force": "true"})

    if resp.status_code == 200:
        print("SUCCESS: Default widget force deleted successfully.")
    else:
        print(f"FAILED: Expected 200, got {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    test_widget_delete()
