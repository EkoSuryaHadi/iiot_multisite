from tests.conftest import auth_headers


def test_login_success(client, superadmin):
    resp = client.post("/auth/login", json={"email": "super@iiot-corp.dev", "password": "supersecret"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


def test_login_wrong_password(client, superadmin):
    resp = client.post("/auth/login", json={"email": "super@iiot-corp.dev", "password": "wrong"})
    assert resp.status_code == 401


def test_refresh_token(client, superadmin):
    login_resp = client.post("/auth/login", json={"email": "super@iiot-corp.dev", "password": "supersecret"})
    refresh_token = login_resp.json()["refresh_token"]

    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_access_without_token_rejected(client, tenant_a):
    resp = client.get("/sites")
    assert resp.status_code == 401


def test_access_with_invalid_token_rejected(client):
    resp = client.get("/sites", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401
