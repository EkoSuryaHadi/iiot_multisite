from tests.conftest import auth_headers


def test_only_superadmin_can_create_tenant(client, superadmin, tenant_a_admin):
    headers = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    resp = client.post("/tenants", json={"slug": "new-tenant", "name": "New Tenant"}, headers=headers)
    assert resp.status_code == 403


def test_superadmin_can_create_tenant(client, superadmin):
    headers = auth_headers(client, "super@iiot-corp.dev", "supersecret")
    resp = client.post("/tenants", json={"slug": "acme", "name": "Acme"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["slug"] == "acme"


def test_viewer_cannot_create_site(client, db_session, tenant_a):
    from app.models import Role, User
    from app.security import hash_secret

    viewer = User(
        tenant_id=tenant_a.id, email="viewer@iiot-corp.dev", hashed_password=hash_secret("viewerpw"), role=Role.VIEWER
    )
    db_session.add(viewer)
    db_session.commit()

    headers = auth_headers(client, "viewer@iiot-corp.dev", "viewerpw")
    resp = client.post("/sites", json={"slug": "site-1", "name": "Site 1"}, headers=headers)
    assert resp.status_code == 403


def test_tenant_admin_can_create_site_in_own_tenant(client, tenant_a, tenant_a_admin):
    headers = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    resp = client.post("/sites", json={"slug": "site-1", "name": "Site 1"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["tenant_id"] == str(tenant_a.id)


def test_operator_can_create_device_but_not_site(client, db_session, tenant_a, tenant_a_admin):
    from app.models import Role, User
    from app.security import hash_secret

    headers_admin = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    site_resp = client.post("/sites", json={"slug": "site-1", "name": "Site 1"}, headers=headers_admin)
    site_id = site_resp.json()["id"]

    operator = User(
        tenant_id=tenant_a.id,
        email="operator@iiot-corp.dev",
        hashed_password=hash_secret("operatorpw"),
        role=Role.OPERATOR,
    )
    db_session.add(operator)
    db_session.commit()

    headers_op = auth_headers(client, "operator@iiot-corp.dev", "operatorpw")

    site_forbidden = client.post("/sites", json={"slug": "site-2", "name": "Site 2"}, headers=headers_op)
    assert site_forbidden.status_code == 403

    device_resp = client.post(
        "/devices", json={"device_key": "dev-1", "name": "Device 1", "site_id": site_id}, headers=headers_op
    )
    assert device_resp.status_code == 201
