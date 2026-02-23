# input:  [requests HTTP client, running API server]
# output: [Integration test flow for auth and CRUD endpoints]
# pos:    [Manual/integration validation script for CRUD API]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests

BASE_URL = "http://localhost:8000"
EMAIL = "test_crud@example.com"
PASSWORD = "Password123"

def test_crud():
    # 1. Register
    requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    
    # 2. Login
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Logged in, token received.")

    # 3. Create Program
    prog_data = {"name": "Test Program", "grad_requirement_credits": 20.0}
    response = requests.post(f"{BASE_URL}/programs/", json=prog_data, headers=headers)
    assert response.status_code == 200
    program_id = response.json()["id"]
    print(f"Program created: {program_id}")

    # 4. Create Semester
    sem_data = {"name": "Fall 2025"}
    response = requests.post(f"{BASE_URL}/programs/{program_id}/semesters/", json=sem_data, headers=headers)
    assert response.status_code == 200
    semester_id = response.json()["id"]
    print(f"Semester created: {semester_id}")

    # 5. Create Course
    course_data = {"name": "Intro to AI", "credits": 0.5}
    response = requests.post(f"{BASE_URL}/semesters/{semester_id}/courses/", json=course_data, headers=headers)
    assert response.status_code == 200
    course_id = response.json()["id"]
    print(f"Course created: {course_id}")

    # 6. Verify Hierarchy Reading
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
