"""Tes integrasi E2E (Fase 7): alur penuh buat tenant -> site -> device ->
koneksi MQTT -> publish -> query analytics. Dijalankan terhadap stack
`docker compose up -d` yang sungguhan berjalan (bukan mock).
"""
import json
import time

from api_clients import AnalyticsApiClient, DeviceMgmtClient
from mqtt_helper import connect, publish_and_wait


def _topic(tenant_slug: str, site_slug: str, device_key: str, suffix: str) -> str:
    return f"t/{tenant_slug}/s/{site_slug}/d/{device_key}/{suffix}"


def test_full_pipeline_tenant_to_analytics(provisioned_tenant, analytics_client_factory, mqtt_target, device_mgmt_url):
    tenant_slug = provisioned_tenant["tenant"]["slug"]
    site_slug = provisioned_tenant["site"]["slug"]
    device_key = provisioned_tenant["device"]["device_key"]
    creds = provisioned_tenant["credentials"]
    host, port = mqtt_target

    # 1. Koneksi MQTT memakai kredensial hasil provisioning device-mgmt.
    session = connect(host, port, client_id=creds["client_id"], username=creds["client_id"], password=creds["password"])
    try:
        assert session.wait_connected(10), f"Device gagal konek (reason={session.connect_reason_code})"

        # 2. Publish telemetry nyata melalui MQTT.
        telemetry_topic = _topic(tenant_slug, site_slug, device_key, "telemetry")
        unique_temp = 42.42
        publish_and_wait(session, telemetry_topic, json.dumps({"temp": unique_temp}), qos=1, settle=0.5)

        status_topic = _topic(tenant_slug, site_slug, device_key, "status")
        publish_and_wait(session, status_topic, json.dumps({"status": "online"}), qos=1, settle=0.5)
    finally:
        session.close()

    # 3. Tunggu pipeline Rule Engine -> analytics-api -> ClickHouse (buffer flush ~2 detik).
    time.sleep(4)

    # 4. Login sebagai tenant_admin tenant ini, query analytics-api, pastikan data sampai.
    token = DeviceMgmtClient(device_mgmt_url).login(
        provisioned_tenant["tenant_admin_email"], provisioned_tenant["tenant_admin_password"]
    )._token
    analytics = analytics_client_factory(token)

    resp = analytics.get_telemetry(
        device_key=device_key,
        metric_name="temp",
        start="2020-01-01T00:00:00Z",
        end="2100-01-01T00:00:00Z",
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tenant_slug"] == tenant_slug
    values = [p["value"] for p in body["points"]]
    assert unique_temp in values, f"Nilai telemetry {unique_temp} tidak ditemukan di {values}"

    status_resp = analytics.get_devices_status()
    assert status_resp.status_code == 200
    devices = {d["device_key"]: d for d in status_resp.json()["devices"]}
    assert device_key in devices
    assert devices[device_key]["status"] == "online"

    summary_resp = analytics.get_summary_tenant(start="2020-01-01T00:00:00Z", end="2100-01-01T00:00:00Z")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["tenant_slug"] == tenant_slug
    assert summary["device_count"] >= 1
