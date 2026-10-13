"""Tes ACL negatif (Fase 7): pastikan akses lintas tenant / kredensial salah
benar-benar ditolak oleh EMQX (via auth-webhook) dan oleh analytics-api.
"""
import json

from api_clients import DeviceMgmtClient
from mqtt_helper import connect, publish_and_wait


def _topic(tenant_slug: str, site_slug: str, device_key: str, suffix: str) -> str:
    return f"t/{tenant_slug}/s/{site_slug}/d/{device_key}/{suffix}"


def test_device_cannot_publish_to_other_tenant_topic(provisioned_tenant, superadmin_client, mqtt_target, unique_suffix):
    """Device tenant A terhubung dengan kredensial valid miliknya sendiri, tapi
    mencoba publish ke topik milik tenant B -> harus ditolak (disconnect)."""
    host, port = mqtt_target
    creds_a = provisioned_tenant["credentials"]

    # Siapkan tenant B sebagai target topik terlarang.
    slug_b = f"e2e-other-{unique_suffix}"
    tenant_b = superadmin_client.create_tenant(slug=slug_b, name="E2E Other Tenant")
    try:
        site_b = superadmin_client.create_site(tenant_id=tenant_b["id"], slug="siteb", name="Site B")
        device_b = superadmin_client.create_device(
            tenant_id=tenant_b["id"], site_id=site_b["id"], device_key="devb", name="Device B"
        )

        forbidden_topic = _topic(tenant_b["slug"], site_b["slug"], device_b["device_key"], "telemetry")

        session = connect(host, port, client_id=creds_a["client_id"], username=creds_a["client_id"], password=creds_a["password"])
        try:
            assert session.wait_connected(10), "Device A gagal konek dengan kredensial valid miliknya sendiri"

            publish_and_wait(session, forbidden_topic, json.dumps({"temp": 1.0}), qos=1, settle=1.0)

            assert session.wait_disconnected(3), "Broker seharusnya memutus koneksi karena publish lintas tenant"
            assert session.disconnect_reason_code not in (0, None), "Disconnect reason seharusnya bukan normal (0)"
        finally:
            session.close()
    finally:
        superadmin_client.delete_tenant(tenant_b["id"])


def test_device_cannot_connect_with_wrong_password(provisioned_tenant, mqtt_target):
    host, port = mqtt_target
    creds = provisioned_tenant["credentials"]

    session = connect(
        host, port, client_id=creds["client_id"] + "-wrongpw", username=creds["client_id"], password="password-salah-123"
    )
    try:
        assert not session.wait_connected(5), "Koneksi dengan password salah seharusnya ditolak"
        assert session.connect_reason_code not in (0, None)
    finally:
        session.close()


def test_tenant_admin_cannot_see_other_tenant_analytics(
    provisioned_tenant, superadmin_client, analytics_client_factory, device_mgmt_url, unique_suffix
):
    """User tenant A query analytics-api -> tidak boleh melihat data tenant lain,
    walau tenant lain itu punya device & telemetry sendiri."""
    slug_b = f"e2e-other2-{unique_suffix}"
    tenant_b = superadmin_client.create_tenant(slug=slug_b, name="E2E Other Tenant 2")
    try:
        site_b = superadmin_client.create_site(tenant_id=tenant_b["id"], slug="siteb", name="Site B")
        superadmin_client.create_device(tenant_id=tenant_b["id"], site_id=site_b["id"], device_key="devb", name="Device B")

        token = DeviceMgmtClient(device_mgmt_url).login(
            provisioned_tenant["tenant_admin_email"], provisioned_tenant["tenant_admin_password"]
        )._token
        analytics = analytics_client_factory(token)

        # tenant_slug tenant B sengaja dipass, tapi harus diabaikan/ditolak karena bukan superadmin.
        resp = analytics.get_devices_status(tenant_slug=tenant_b["slug"])
        assert resp.status_code == 200
        devices = {d["device_key"] for d in resp.json()["devices"]}
        assert "devb" not in devices
    finally:
        superadmin_client.delete_tenant(tenant_b["id"])
