def test_device_authn_allow(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post("/authn", json={"username": client_id, "password": "device-secret"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] == "allow"
    assert body["is_superuser"] is False


def test_device_authn_wrong_password_deny(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post("/authn", json={"username": client_id, "password": "wrong"})
    assert resp.json()["result"] == "deny"


def test_device_authn_inactive_device_deny(client, db_session, device_a, tenant_a, site_a):
    device_a.is_active = False
    db_session.commit()

    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post("/authn", json={"username": client_id, "password": "device-secret"})
    assert resp.json()["result"] == "deny"


def test_dashboard_user_authn_allow(client, viewer_a):
    resp = client.post("/authn", json={"username": "viewer-a@iiot-corp.dev", "password": "viewerpw"})
    body = resp.json()
    assert body["result"] == "allow"
    assert body["is_superuser"] is False


def test_dashboard_user_wrong_password_deny(client, viewer_a):
    resp = client.post("/authn", json={"username": "viewer-a@iiot-corp.dev", "password": "wrong"})
    assert resp.json()["result"] == "deny"


def test_internal_service_authn_allow_superuser(client):
    resp = client.post("/authn", json={"username": "internal-service", "password": "internal-secret"})
    body = resp.json()
    assert body["result"] == "allow"
    assert body["is_superuser"] is True


def test_internal_service_wrong_password_deny(client):
    resp = client.post("/authn", json={"username": "internal-service", "password": "wrong"})
    assert resp.json()["result"] == "deny"


def test_unknown_username_deny(client):
    resp = client.post("/authn", json={"username": "ghost@nowhere.dev", "password": "whatever"})
    assert resp.json()["result"] == "deny"


def test_device_authn_caches_bcrypt_verification(client, device_a, tenant_a, site_a, monkeypatch):
    import app.identity as identity_mod

    call_count = 0
    orig_verify = identity_mod.verify_secret

    def counting_verify(plain: str, hashed: str) -> bool:
        nonlocal call_count
        call_count += 1
        return orig_verify(plain, hashed)

    monkeypatch.setattr(identity_mod, "verify_secret", counting_verify)

    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp1 = client.post("/authn", json={"username": client_id, "password": "device-secret"})
    resp2 = client.post("/authn", json={"username": client_id, "password": "device-secret"})
    assert resp1.json()["result"] == "allow"
    assert resp2.json()["result"] == "allow"
    assert call_count == 1

    # Password salah tetap harus ditolak meskipun kredensial benar sudah di-cache
    resp_wrong = client.post("/authn", json={"username": client_id, "password": "wrong-password"})
    assert resp_wrong.json()["result"] == "deny"
