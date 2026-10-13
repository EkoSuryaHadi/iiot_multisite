from tests.conftest import auth_headers


def test_tenant_admin_cannot_see_other_tenant_sites(client, tenant_a, tenant_b, tenant_a_admin, tenant_b_admin):
    headers_b = auth_headers(client, "admin-b@iiot-corp.dev", "secretpw")
    client.post("/sites", json={"slug": "b-site", "name": "B Site"}, headers=headers_b)

    headers_a = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    resp = client.get("/sites", headers=headers_a)
    assert resp.status_code == 200
    assert resp.json() == []


def test_tenant_admin_cannot_fetch_other_tenant_site_by_id(client, tenant_a, tenant_b, tenant_a_admin, tenant_b_admin):
    headers_b = auth_headers(client, "admin-b@iiot-corp.dev", "secretpw")
    create_resp = client.post("/sites", json={"slug": "b-site", "name": "B Site"}, headers=headers_b)
    site_id = create_resp.json()["id"]

    headers_a = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    resp = client.get(f"/sites/{site_id}", headers=headers_a)
    assert resp.status_code == 404


def test_superadmin_sees_sites_across_tenants(client, superadmin, tenant_a, tenant_b, tenant_a_admin, tenant_b_admin):
    headers_a = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    client.post("/sites", json={"slug": "a-site", "name": "A Site"}, headers=headers_a)

    headers_b = auth_headers(client, "admin-b@iiot-corp.dev", "secretpw")
    client.post("/sites", json={"slug": "b-site", "name": "B Site"}, headers=headers_b)

    headers_super = auth_headers(client, "super@iiot-corp.dev", "supersecret")
    resp = client.get("/sites", headers=headers_super)
    assert resp.status_code == 200
    slugs = {s["slug"] for s in resp.json()}
    assert {"a-site", "b-site"}.issubset(slugs)


def test_device_key_unique_per_tenant_not_global(client, tenant_a, tenant_b, tenant_a_admin, tenant_b_admin):
    headers_a = auth_headers(client, "admin-a@iiot-corp.dev", "secretpw")
    site_a = client.post("/sites", json={"slug": "site-1", "name": "Site 1"}, headers=headers_a).json()
    dev_a = client.post(
        "/devices", json={"device_key": "same-key", "name": "Dev A", "site_id": site_a["id"]}, headers=headers_a
    )
    assert dev_a.status_code == 201

    headers_b = auth_headers(client, "admin-b@iiot-corp.dev", "secretpw")
    site_b = client.post("/sites", json={"slug": "site-1", "name": "Site 1"}, headers=headers_b).json()
    dev_b = client.post(
        "/devices", json={"device_key": "same-key", "name": "Dev B", "site_id": site_b["id"]}, headers=headers_b
    )
    assert dev_b.status_code == 201
