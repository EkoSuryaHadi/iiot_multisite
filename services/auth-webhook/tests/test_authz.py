def _own_topic(tenant_a, site_a, suffix: str) -> str:
    return f"t/{tenant_a.slug}/s/{site_a.slug}/d/dev-1/{suffix}"


def test_device_can_publish_telemetry_on_own_topic(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post(
        "/authz", json={"username": client_id, "topic": _own_topic(tenant_a, site_a, "telemetry"), "action": "publish"}
    )
    assert resp.json()["result"] == "allow"


def test_device_cannot_publish_cmd(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post(
        "/authz", json={"username": client_id, "topic": _own_topic(tenant_a, site_a, "cmd"), "action": "publish"}
    )
    assert resp.json()["result"] == "deny"


def test_device_can_subscribe_cmd(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    resp = client.post(
        "/authz", json={"username": client_id, "topic": _own_topic(tenant_a, site_a, "cmd"), "action": "subscribe"}
    )
    assert resp.json()["result"] == "allow"


def test_device_cannot_access_other_devices_topic(client, device_a, tenant_a, site_a):
    client_id = f"{tenant_a.slug}-{site_a.slug}-dev-1"
    other_topic = f"t/{tenant_a.slug}/s/{site_a.slug}/d/dev-2/telemetry"
    resp = client.post("/authz", json={"username": client_id, "topic": other_topic, "action": "publish"})
    assert resp.json()["result"] == "deny"


def test_viewer_can_subscribe_within_tenant(client, viewer_a, tenant_a, site_a):
    resp = client.post(
        "/authz",
        json={"username": "viewer-a@iiot-corp.dev", "topic": _own_topic(tenant_a, site_a, "telemetry"), "action": "subscribe"},
    )
    assert resp.json()["result"] == "allow"


def test_viewer_cannot_publish_cmd(client, viewer_a, tenant_a, site_a):
    resp = client.post(
        "/authz",
        json={"username": "viewer-a@iiot-corp.dev", "topic": _own_topic(tenant_a, site_a, "cmd"), "action": "publish"},
    )
    assert resp.json()["result"] == "deny"


def test_tenant_admin_can_publish_cmd_within_tenant(client, tenant_admin_a, tenant_a, site_a):
    resp = client.post(
        "/authz",
        json={"username": "admin-a@iiot-corp.dev", "topic": _own_topic(tenant_a, site_a, "cmd"), "action": "publish"},
    )
    assert resp.json()["result"] == "allow"


def test_viewer_cannot_subscribe_other_tenant(client, viewer_a, tenant_b):
    other_topic = f"t/{tenant_b.slug}/s/site-1/d/dev-x/telemetry"
    resp = client.post("/authz", json={"username": "viewer-a@iiot-corp.dev", "topic": other_topic, "action": "subscribe"})
    assert resp.json()["result"] == "deny"


def test_internal_service_can_access_anything(client):
    resp = client.post(
        "/authz", json={"username": "internal-service", "topic": "t/anything/s/x/d/y/telemetry", "action": "publish"}
    )
    assert resp.json()["result"] == "allow"


def test_unknown_identity_denied(client):
    resp = client.post("/authz", json={"username": "ghost@nowhere.dev", "topic": "t/x/s/y/d/z/telemetry", "action": "subscribe"})
    assert resp.json()["result"] == "deny"
