import requests
import json

BASE_URL = "http://localhost:8000"
EMAIL = "test_widget@example.com"
PASSWORD = "Password123"

def test_widget_update():
    # 1. Register/Login (reuse or create new)
    try:
        requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    except:
        pass # User might exist

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
