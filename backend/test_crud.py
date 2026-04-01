# input:  [requests HTTP client, running API server, and backend DB/user helpers]
# output: [Integration test flow for auth and CRUD endpoints]
# pos:    [Manual/integration validation script for CRUD API using a locally seeded verified user]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests

import crud
from database import SessionLocal
import schemas

BASE_URL = "http://localhost:8000"
EMAIL = "test_crud@example.com"
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

def test_crud():
    # 1. Seed a verified user and log in.
    _ensure_verified_user()
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Logged in, token received.")

    # 2. Create Program
    prog_data = {"name": "Test Program", "grad_requirement_credits": 20.0}
    response = requests.post(f"{BASE_URL}/programs/", json=prog_data, headers=headers)
    assert response.status_code == 200
    program_id = response.json()["id"]
    print(f"Program created: {program_id}")

    # 3. Create Semester
    sem_data = {"name": "Fall 2025"}
    response = requests.post(f"{BASE_URL}/programs/{program_id}/semesters/", json=sem_data, headers=headers)
    assert response.status_code == 200
    semester_id = response.json()["id"]
    print(f"Semester created: {semester_id}")

    # 4. Create Course
    course_data = {"name": "Intro to AI", "credits": 0.5}
    response = requests.post(f"{BASE_URL}/semesters/{semester_id}/courses/", json=course_data, headers=headers)
    assert response.status_code == 200
    course_id = response.json()["id"]
    print(f"Course created: {course_id}")

    # 5. Verify hierarchy reading.
    response = requests.get(f"{BASE_URL}/programs/{program_id}", headers=headers)
    data = response.json()
    assert data["semesters"][0]["id"] == semester_id
    print("Verified Program -> Semester hierarchy.")
    
    response = requests.get(f"{BASE_URL}/semesters/{semester_id}", headers=headers)
    data = response.json()
    # Note: Course details might need to be fetched separately or included if schema supports it
    # My schema SemesterWithDetails includes courses: List[Course] = []
    assert len(data["courses"]) == 1
    assert data["courses"][0]["id"] == course_id
    print("Verified Semester -> Course hierarchy.")

    print("ALL TESTS PASSED")

if __name__ == "__main__":
    try:
        test_crud()
    except Exception as e:
        print(f"TEST FAILED: {e}")
