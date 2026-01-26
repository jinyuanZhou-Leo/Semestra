import requests
import json
import uuid

BASE_URL = "http://localhost:8000"
EMAIL = f"test_delete_{uuid.uuid4()}@example.com"
PASSWORD = "password123"

def test_widget_delete():
    print(f"Testing with user: {EMAIL}")
    
    # 1. Register
    requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})

    # 2. Login
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    if response.status_code != 200:
        print("Login failed")
        return
        
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create Program & Semester
    prog = requests.post(f"{BASE_URL}/programs/", json={"name": "Del Test Prog"}, headers=headers).json()
    sem = requests.post(f"{BASE_URL}/programs/{prog['id']}/semesters/", json={"name": "Del Test Sem"}, headers=headers).json()
    
    # 4. Get widgets to find the default Course List
    sem_details = requests.get(f"{BASE_URL}/semesters/{sem['id']}", headers=headers).json()
    default_widgets = sem_details.get("widgets", [])
    course_list_widget = next((w for w in default_widgets if w["widget_type"] == "course-list"), None)
    
    if not course_list_widget:
        print("FAILED: Default Course List widget not created")
        return

    print(f"Default widget found: {course_list_widget['id']}")
    
    # 5. ATTEMPT DELETE DEFAULT WIDGET (Should Fail)
    print("Attempting to delete DEFAULT Course List widget...")
    resp = requests.delete(f"{BASE_URL}/widgets/{course_list_widget['id']}", headers=headers)
    
    if resp.status_code == 400:
        print("SUCCESS: Default widget correctly protected (Status 400).")
    else:
        print(f"FAILED: Expected 400, got {resp.status_code}")
        print(resp.text)
        
    # 6. CREATE NEW MANUAL COURSE LIST WIDGET
    print("Creating manual Course List widget...")
    manual_widget = requests.post(f"{BASE_URL}/semesters/{sem['id']}/widgets/", json={
        "widget_type": "course-list",
        "title": "Manual Courses"
    }, headers=headers).json()
    
    print(f"Manual widget created: {manual_widget['id']}")
    
    # 7. ATTEMPT DELETE MANUAL WIDGET (Should Succeed)
    print("Attempting to delete MANUAL Course List widget...")
    resp = requests.delete(f"{BASE_URL}/widgets/{manual_widget['id']}", headers=headers)
    
    if resp.status_code == 200:
        print("SUCCESS: Manual widget deleted successfully.")
    else:
        print(f"FAILED: Expected 200, got {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    test_widget_delete()
