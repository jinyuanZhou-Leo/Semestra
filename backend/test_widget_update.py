# input:  [requests/json, running API server, and backend DB/user helpers]
# output: [Integration test for widget update behavior]
# pos:    [Manual/integration validation script for widget API using a locally seeded verified user]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests
import json

import crud
from database import SessionLocal
import schemas

BASE_URL = "http://localhost:8000"
EMAIL = "test_widget@example.com"
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

def test_widget_update():
    # 1. Seed a verified user and log in.
    _ensure_verified_user()
    response = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    if response.status_code != 200:
        print("Login failed")
        return
        
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Setup: Create Program -> Semester -> Widget
    prog = requests.post(f"{BASE_URL}/programs/", json={"name": "Widget Test Prog"}, headers=headers).json()
    sem = requests.post(f"{BASE_URL}/programs/{prog['id']}/semesters/", json={"name": "Widget Test Sem"}, headers=headers).json()
    
    # Create a widget
    widget = requests.post(f"{BASE_URL}/semesters/{sem['id']}/widgets/", json={
        "widget_type": "counter",
        "title": "Test Counter",
        "settings": json.dumps({"value": 0})
    }, headers=headers).json()
    
    print(f"Created widget: {widget['id']}")
    
    # 3. Test Partial Update (Layout)
    new_layout = json.dumps({"x": 0, "y": 0, "w": 2, "h": 2})
    update_data = {"layout_config": new_layout}
    
    print("Attempting partial update (layout only)...")
    response = requests.put(f"{BASE_URL}/widgets/{widget['id']}", json=update_data, headers=headers)
    
    if response.status_code == 200:
        print("Partial update SUCCESS!")
        updated_widget = response.json()
        assert updated_widget["layout_config"] == new_layout
        assert updated_widget["title"] == "Test Counter" # Should remain unchanged
        print("Verified persistence of other fields.")
    else:
        print(f"Partial update FAILED: {response.status_code}")
        print(response.text)

    # 4. Test Partial Update (Settings)
    new_settings = json.dumps({"value": 5})
    update_data_2 = {"settings": new_settings}
    
    print("Attempting partial update (settings only)...")
    response = requests.put(f"{BASE_URL}/widgets/{widget['id']}", json=update_data_2, headers=headers)
    
    if response.status_code == 200:
        print("Partial update 2 SUCCESS!")
        updated_widget = response.json()
        assert updated_widget["settings"] == new_settings
        assert updated_widget["layout_config"] == new_layout # Should remain from previous update
    else:
        print(f"Partial update 2 FAILED: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_widget_update()
