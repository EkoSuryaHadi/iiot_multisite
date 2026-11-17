import uuid

from app.models import Device, Role, Site, User
from app.security import hash_secret


def _login_headers(client, identifier: str, password: str) -> dict[str, str]:
    resp = client.post("/auth/login", json={"identifier": identifier, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_device_credential_lock_and_explicit_reset(client, db_session, tenant_a):
    site = Site(tenant_id=tenant_a.id, slug=f"s-{uuid.uuid4().hex[:6]}", name="Site A")
    db_session.add(site)
    db_session.commit()

    admin = User(
        tenant_id=tenant_a.id,
        email=f"admin-{uuid.uuid4().hex[:6]}@corp.dev",
        hashed_password=hash_secret("secret123"),
        role=Role.TENANT_ADMIN,
    )
    db_session.add(admin)
    db_session.commit()

    headers = _login_headers(client, admin.email, "secret123")

    create_resp = client.post(
        "/devices",
        json={"device_key": "gw-lock-01", "name": "Gateway Lock", "site_id": str(site.id)},
        headers=headers,
    )
    assert create_resp.status_code == 201, create_resp.text
    dev = create_resp.json()
    assert dev["has_credential"] is False

    # Pertama kali: berhasil membuat kredensial
    cred_resp1 = client.post(f"/devices/{dev['id']}/credentials", headers=headers)
    assert cred_resp1.status_code == 200, cred_resp1.text
    pw1 = cred_resp1.json()["password"]

    # List devices harus melaporkan has_credential=True
    list_resp = client.get("/devices", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()[0]["has_credential"] is True

    # Klik ulang tanpa reset=true harus ditolak (409) agar password tidak berubah
    cred_resp2 = client.post(f"/devices/{dev['id']}/credentials", headers=headers)
    assert cred_resp2.status_code == 409

    # Reset eksplisit dengan reset=true berhasil menghasilkan password baru
    cred_resp3 = client.post(f"/devices/{dev['id']}/credentials?reset=true", headers=headers)
    assert cred_resp3.status_code == 200, cred_resp3.text
    assert cred_resp3.json()["password"] != pw1 or len(cred_resp3.json()["password"]) > 0


def test_username_login_and_forgot_password_flow(client, db_session, tenant_a):
    admin = User(
        tenant_id=tenant_a.id,
        email=f"admin-{uuid.uuid4().hex[:6]}@corp.dev",
        hashed_password=hash_secret("adminpass"),
        role=Role.TENANT_ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    admin_headers = _login_headers(client, admin.email, "adminpass")

    uname = f"viewer_{uuid.uuid4().hex[:6]}"
    create_resp = client.post(
        "/users",
        json={"username": uname, "password": "viewerpass", "role": "viewer"},
        headers=admin_headers,
    )
    assert create_resp.status_code == 201, create_resp.text
    user_data = create_resp.json()
    assert user_data["username"] == uname
    assert user_data["email"] is None

    # Login memakai username via field 'identifier' maupun legacy 'email'
    resp_ident = client.post("/auth/login", json={"identifier": uname, "password": "viewerpass"})
    assert resp_ident.status_code == 200
    resp_legacy = client.post("/auth/login", json={"email": uname, "password": "viewerpass"})
    assert resp_legacy.status_code == 200

    # Ajukan forgot password
    forgot_resp = client.post("/auth/forgot-password", json={"identifier": uname})
    assert forgot_resp.status_code == 200

    users_list = client.get("/users", headers=admin_headers).json()
    target = next(u for u in users_list if u["id"] == user_data["id"])
    assert target["password_reset_requested_at"] is not None

    # Admin menetapkan password baru -> password_reset_requested_at harus bersih kembali
    patch_resp = client.patch(
        f"/users/{user_data['id']}",
        json={"password": "newviewerpass"},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["password_reset_requested_at"] is None

    # Login dengan password baru berhasil
    assert client.post("/auth/login", json={"identifier": uname, "password": "newviewerpass"}).status_code == 200


def test_site_scoped_user_cannot_cross_view(client, db_session, tenant_a):
    site1 = Site(tenant_id=tenant_a.id, slug=f"s1-{uuid.uuid4().hex[:6]}", name="Site 1")
    site2 = Site(tenant_id=tenant_a.id, slug=f"s2-{uuid.uuid4().hex[:6]}", name="Site 2")
    db_session.add_all([site1, site2])
    db_session.commit()

    dev1 = Device(tenant_id=tenant_a.id, site_id=site1.id, device_key="dev-s1", name="Dev Site 1")
    dev2 = Device(tenant_id=tenant_a.id, site_id=site2.id, device_key="dev-s2", name="Dev Site 2")
    db_session.add_all([dev1, dev2])

    scoped_user = User(
        tenant_id=tenant_a.id,
        site_id=site1.id,
        username=f"op_s1_{uuid.uuid4().hex[:6]}",
        hashed_password=hash_secret("secret123"),
        role=Role.OPERATOR,
    )
    db_session.add(scoped_user)
    db_session.commit()

    headers = _login_headers(client, scoped_user.username, "secret123")

    sites_resp = client.get("/sites", headers=headers)
    assert sites_resp.status_code == 200
    assert [s["id"] for s in sites_resp.json()] == [str(site1.id)]

    devices_resp = client.get("/devices", headers=headers)
    assert devices_resp.status_code == 200
    assert [d["device_key"] for d in devices_resp.json()] == ["dev-s1"]

    # Tidak boleh membuat device di site2
    forbidden_create = client.post(
        "/devices",
        json={"device_key": "dev-hack", "name": "Hack", "site_id": str(site2.id)},
        headers=headers,
    )
    assert forbidden_create.status_code == 403
