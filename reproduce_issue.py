import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def run():
    # 1. Register/Login
    email = "test_repro@example.com"
    password = "Password123"
    
    # Try register
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={"email": email, "password": password})
        if resp.status_code == 200:
            print("Registered new user")
        elif resp.status_code == 400:
            print("User already exists, proceeding to login")
        else:
            print(f"Register failed: {resp.status_code} {resp.text}")
            return
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    # Login
    resp = requests.post(f"{BASE_URL}/auth/token", data={"username": email, "password": password})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        return
    
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Logged in successfully")

    # 2. Create Program
    resp = requests.post(f"{BASE_URL}/programs/", json={"name": "Test Program", "grad_requirement_credits": 120}, headers=headers)
    if resp.status_code != 200:
        print(f"Create program failed: {resp.status_code} {resp.text}")
        return
    program = resp.json()
    program_id = program["id"]
    print(f"Created program {program_id}")

    # 3. Create Semester
    resp = requests.post(f"{BASE_URL}/programs/{program_id}/semesters/", json={"name": "Test Semester"}, headers=headers)
    if resp.status_code != 200:
        print(f"Create semester failed: {resp.status_code} {resp.text}")
        return
    semester = resp.json()
    semester_id = semester["id"]
    print(f"Created semester {semester_id}")

    # 3.5 Create Course
    resp = requests.post(f"{BASE_URL}/semesters/{semester_id}/courses/", json={"name": "Test Course", "credits": 0.5}, headers=headers)
    if resp.status_code != 200:
        print(f"Create course failed: {resp.status_code} {resp.text}")
    print("Created course")

    # 4. Fetch Semester (The issue point)
    resp = requests.get(f"{BASE_URL}/semesters/{semester_id}", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Fetch semester success!")
        # Check if widgets and courses are present
        if "courses" in data and "widgets" in data:
            print("Response structure matches expectation.")
            print(f"Courses: {len(data['courses'])}, Widgets: {len(data['widgets'])}")
        else:
            print("Response MISSING courses or widgets fields!")
            print(data.keys())
    else:
        print(f"Fetch semester FAILED: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    run()
