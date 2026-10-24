import pytest
from app.models import Site, Device, DeviceAsset, SiteConfigurationType


def test_sps_site_configuration(db_session, test_tenant):
    site = Site(
        tenant_id=test_tenant.id,
        slug="site-jkt-01",
        name="Site Jakarta 01",
        site_type=SiteConfigurationType.TYPE_A,
        pv_capacity_kwp=5.85,
        mppt_capacity_a=80.0,
        rectifier_float_voltage=53.5,
        baseline_kwh_daily=72.0,
        latitude=-6.2088,
        longitude=106.8456,
        tower_type="4 Legged 72M",
    )
    db_session.add(site)
    db_session.commit()
    assert site.site_type == SiteConfigurationType.TYPE_A
    assert site.pv_capacity_kwp == 5.85


def test_sps_device_asset_serial_tracking(db_session, test_site, test_tenant):
    device = Device(tenant_id=test_tenant.id, site_id=test_site.id, device_key="mppt-01", name="MPPT Unit 1")
    db_session.add(device)
    db_session.commit()

    asset = DeviceAsset(
        device_id=device.id,
        asset_type="mppt",
        brand="Huawei / Vertiv",
        model="MPPT 80A 250V",
        serial_number="SN-MPPT-2026-9988",
        warranty_years=2,
        is_spare=False,
    )
    db_session.add(asset)
    db_session.commit()
    assert asset.serial_number == "SN-MPPT-2026-9988"


def test_sps_site_api_endpoints(client, tenant_a_admin, tenant_a):
    from tests.conftest import auth_headers

    headers = auth_headers(client, tenant_a_admin.email, "secretpw")

    # 1. Non-breaking: Site creation without SPS fields
    res = client.post("/sites", headers=headers, json={"slug": "legacy-site", "name": "Legacy Site"})
    assert res.status_code == 201
    data = res.json()
    assert data["slug"] == "legacy-site"
    assert data["site_type"] is None

    # 2. Site creation with SPS fields
    payload = {
        "slug": "sps-site-01",
        "name": "SPS Site 01",
        "site_type": "TYPE_B",
        "pv_capacity_kwp": 8.2,
        "mppt_capacity_a": 100.0,
        "rectifier_float_voltage": 53.5,
        "baseline_kwh_daily": 108.0,
        "latitude": -6.9175,
        "longitude": 107.6191,
        "tower_type": "3 Legged 52M",
    }
    res = client.post("/sites", headers=headers, json=payload)
    assert res.status_code == 201
    sps_data = res.json()
    assert sps_data["site_type"] == "TYPE_B"
    assert sps_data["pv_capacity_kwp"] == 8.2
    assert sps_data["tower_type"] == "3 Legged 52M"

    # 3. Create device and asset
    dev_res = client.post(
        "/devices",
        headers=headers,
        json={"device_key": "logger-01", "name": "4G Data Logger", "site_id": sps_data["id"]},
    )
    assert dev_res.status_code == 201
    dev_data = dev_res.json()

    asset_payload = {
        "asset_type": "logger",
        "brand": "Haiwell",
        "model": "DL-4G-UPS",
        "serial_number": "SN-HW-2026-1234",
        "warranty_years": 3,
        "is_spare": False,
    }
    asset_res = client.post(
        f"/devices/{dev_data['id']}/assets", headers=headers, json=asset_payload
    )
    assert asset_res.status_code == 201
    assert asset_res.json()["serial_number"] == "SN-HW-2026-1234"

    # 4. List assets
    list_res = client.get(f"/devices/{dev_data['id']}/assets", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

