# input:  [requests/uuid, running API server, and backend DB/user helpers]
# output: [Integration test for nickname update and retrieval]
# pos:    [Manual/integration validation script for profile API using a locally seeded verified user]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import requests
import uuid

import crud
from database import SessionLocal
import schemas

BASE_URL = "http://localhost:8000"
EMAIL = f"test_nick_{uuid.uuid4()}@example.com"
PASSWORD = "Password123"
NICKNAME = "Test Nickname"


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

def test_nickname_flow():
    # 1. Seed a verified user and log in.
    print(f"Preparing {EMAIL}...")
    _ensure_verified_user()
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/token", data={"username": EMAIL, "password": PASSWORD})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Check initial nickname (should be None).
    print("Checking initial profile...")
    resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
    user = resp.json()
    assert user.get("nickname") is None
    print("Initial nickname is None (Correct).")
    
    # 3. Update nickname.
    print(f"Updating nickname to '{NICKNAME}'...")
    resp = requests.put(f"{BASE_URL}/users/me", json={"nickname": NICKNAME}, headers=headers)
    if resp.status_code != 200:
        print(f"Update failed: {resp.text}")
        return
    updated_user = resp.json()
    assert updated_user["nickname"] == NICKNAME
    print("Nickname updated successfully.")
    
    # 4. Verify persistence.
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
