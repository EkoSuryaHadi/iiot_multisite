import os
import uuid

import pytest

from api_clients import AnalyticsApiClient, DeviceMgmtClient

DEVICE_MGMT_URL = os.environ.get("DEVICE_MGMT_URL", "http://localhost:8001")
ANALYTICS_API_URL = os.environ.get("ANALYTICS_API_URL", "http://localhost:8003")
MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))

SUPERADMIN_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "itdev@gaungnusa.com")
SUPERADMIN_PASSWORD = os.environ.get("SUPERADMIN_PASSWORD", "dolphin")


@pytest.fixture(scope="session")
def superadmin_client() -> DeviceMgmtClient:
    return DeviceMgmtClient(DEVICE_MGMT_URL).login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)


@pytest.fixture()
def unique_suffix() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture()
def provisioned_tenant(superadmin_client, unique_suffix):
    """Membuat tenant + site + device + kredensial MQTT lengkap untuk satu tes, lalu bersihkan setelahnya."""
    slug = f"e2e-{unique_suffix}"
    tenant = superadmin_client.create_tenant(slug=slug, name=f"E2E Tenant {unique_suffix}")
    site = superadmin_client.create_site(tenant_id=tenant["id"], slug="site1", name="Site 1")
    device = superadmin_client.create_device(
        tenant_id=tenant["id"], site_id=site["id"], device_key="dev1", name="Device 1"
    )
    credentials = superadmin_client.provision_credentials(device["id"])

    tenant_admin_email = f"admin-{unique_suffix}@example.com"
    tenant_admin_password = "e2e-password-123"
    superadmin_client.create_user(
        tenant_id=tenant["id"], email=tenant_admin_email, password=tenant_admin_password, role="tenant_admin"
    )

    bundle = {
        "tenant": tenant,
        "site": site,
        "device": device,
        "credentials": credentials,
        "tenant_admin_email": tenant_admin_email,
        "tenant_admin_password": tenant_admin_password,
    }
    yield bundle

    superadmin_client.delete_tenant(tenant["id"])


@pytest.fixture()
def analytics_client_factory():
    def _factory(token: str | None = None) -> AnalyticsApiClient:
        return AnalyticsApiClient(ANALYTICS_API_URL, token)

    return _factory


@pytest.fixture()
def device_mgmt_url() -> str:
    return DEVICE_MGMT_URL


@pytest.fixture()
def mqtt_target() -> tuple[str, int]:
    return MQTT_HOST, MQTT_PORT
