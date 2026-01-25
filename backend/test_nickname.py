import requests
import uuid

BASE_URL = "http://localhost:8000"
EMAIL = f"test_nick_{uuid.uuid4()}@example.com"
PASSWORD = "password123"
NICKNAME = "Test Nickname"

def test_nickname_flow():
    # 1. Register
    print(f"Registering {EMAIL}...")
    resp = requests.post(f"{BASE_URL}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    if resp.status_code != 200:
        print(f"Registration failed: {resp.text}")
        return
    
    # 2. Login
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Check Initial Nickname (Should be None)
    print("Checking initial profile...")
    resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
    user = resp.json()
    assert user.get("nickname") is None
    print("Initial nickname is None (Correct).")
    
    # 4. Update Nickname
    print(f"Updating nickname to '{NICKNAME}'...")
    resp = requests.put(f"{BASE_URL}/users/me", json={"nickname": NICKNAME}, headers=headers)
    if resp.status_code != 200:
        print(f"Update failed: {resp.text}")
        return
    updated_user = resp.json()
    assert updated_user["nickname"] == NICKNAME
    print("Nickname updated successfully.")
    
    # 5. Verify Persistence
    print("Verifying persistence...")
    resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
    user = resp.json()
    assert user["nickname"] == NICKNAME
    print("Persistence verified.")
    
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    try:
        test_nickname_flow()
    except Exception as e:
        print(f"TEST FAILED: {e}")
