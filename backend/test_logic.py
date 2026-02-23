# input:  [requests/json/time, running API server]
# output: [Integration tests for academic logic endpoints]
# pos:    [Manual/integration validation script for logic API]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests
import json
import time

BASE_URL = "http://localhost:8000"
EMAIL = "test_logic@example.com"
PASSWORD = "Password123"

def test_logic():
    # 1. Register & Login
    requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    if response.status_code != 200:
        print("Login failed:", response.text)
        return
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Logged in.")

    # 2. Create Program
    prog_data = {"name": "Test Program", "grad_requirement_credits": 20.0}
    response = requests.post(f"{BASE_URL}/programs/", json=prog_data, headers=headers)
    program_id = response.json()["id"]
    print(f"Program created: {program_id}")

    # 3. Create Semester
    sem_data = {"name": "Fall 2025"}
    response = requests.post(f"{BASE_URL}/programs/{program_id}/semesters/", json=sem_data, headers=headers)
    semester_id = response.json()["id"]
    print(f"Semester created: {semester_id}")

    # 4. Create Course (Grade 90, Credits 1.0)
    # No scaling table yet, so scaled grade should be 0.0
    course_data = {
        "name": "Intro to AI", 
        "credits": 1.0, 
        "grade_percentage": 90.0,
        "include_in_gpa": True
    }
    response = requests.post(f"{BASE_URL}/semesters/{semester_id}/courses/", json=course_data, headers=headers)
    course_id = response.json()["id"]
    print(f"Course created: {course_id}")
    
    # Check course scaled grade
    response = requests.get(f"{BASE_URL}/semesters/{semester_id}", headers=headers)
    courses = response.json()["courses"]
    course = next(c for c in courses if c["id"] == course_id)
    print(f"Initial Scaled: {course['grade_scaled']} (Expected 4.0)")
    assert course['grade_scaled'] == 4.0

    # 5. Add Scaling Table to Program
    # Format: "min-max": points
    scaling_table = {"85-100": 4.0, "80-84": 3.7, "70-79": 3.0}
    prog_update = {
        "name": "Test Program",
        "grad_requirement_credits": 20.0,
        "gpa_scaling_table": json.dumps(scaling_table)
    }
    response = requests.put(f"{BASE_URL}/programs/{program_id}", json=prog_update, headers=headers)
    assert response.status_code == 200
    print("Program updated with scaling table.")

    # 6. Trigger update by updating course grade to 95
    # Logic is triggered on course update
    course_update = {
        "name": "Intro to AI",
        "credits": 1.0,
        "grade_percentage": 95.0
    }
    response = requests.put(f"{BASE_URL}/courses/{course_id}", json=course_update, headers=headers)
    assert response.status_code == 200
    print("Course updated.")

    # 7. Check Logic Results
    # Course
    response = requests.get(f"{BASE_URL}/semesters/{semester_id}", headers=headers)
    sem_data = response.json()
    course = next(c for c in sem_data["courses"] if c["id"] == course_id)
    print(f"Course Scaled: {course['grade_scaled']} (Expected 4.0)")
    assert course['grade_scaled'] == 4.0
    
    # Semester (Average of 1 course = 4.0)
    print(f"Semester Avg Scaled: {sem_data['average_scaled']} (Expected 4.0)")
    assert sem_data['average_scaled'] == 4.0
    
    # Program
    response = requests.get(f"{BASE_URL}/programs/{program_id}", headers=headers)
    prog_data = response.json()
    print(f"Program CGPA Scaled: {prog_data['cgpa_scaled']} (Expected 4.0)")
    assert prog_data['cgpa_scaled'] == 4.0
    
    print("ALL LOGIC TESTS PASSED")

if __name__ == "__main__":
    try:
        test_logic()
    except Exception as e:
        print(f"TEST FAILED: {e}")
