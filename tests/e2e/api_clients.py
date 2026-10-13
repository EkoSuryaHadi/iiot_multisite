"""Client HTTP tipis ke device-mgmt & analytics-api, dipakai tes E2E."""
import httpx


class DeviceMgmtClient:
    def __init__(self, base_url: str, token: str | None = None) -> None:
        self._base_url = base_url
        self._token = token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    def login(self, email: str, password: str) -> "DeviceMgmtClient":
        resp = httpx.post(f"{self._base_url}/auth/login", json={"email": email, "password": password}, timeout=10)
        resp.raise_for_status()
        return DeviceMgmtClient(self._base_url, resp.json()["access_token"])

    def create_tenant(self, slug: str, name: str) -> dict:
        resp = httpx.post(f"{self._base_url}/tenants", json={"slug": slug, "name": name}, headers=self._headers(), timeout=10)
        resp.raise_for_status()
        return resp.json()

    def create_site(self, tenant_id: str, slug: str, name: str) -> dict:
        resp = httpx.post(
            f"{self._base_url}/sites",
            json={"slug": slug, "name": name, "tenant_id": tenant_id},
            headers=self._headers(),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def create_device(self, tenant_id: str, site_id: str, device_key: str, name: str) -> dict:
        resp = httpx.post(
            f"{self._base_url}/devices",
            json={"device_key": device_key, "name": name, "site_id": site_id, "tenant_id": tenant_id},
            headers=self._headers(),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def create_user(self, tenant_id: str, email: str, password: str, role: str) -> dict:
        resp = httpx.post(
            f"{self._base_url}/users",
            json={"email": email, "password": password, "role": role, "tenant_id": tenant_id},
            headers=self._headers(),
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def provision_credentials(self, device_id: str) -> dict:
        resp = httpx.post(f"{self._base_url}/devices/{device_id}/credentials", headers=self._headers(), timeout=10)
        resp.raise_for_status()
        return resp.json()

    def delete_tenant(self, tenant_id: str) -> None:
        httpx.delete(f"{self._base_url}/tenants/{tenant_id}", headers=self._headers(), timeout=10)


class AnalyticsApiClient:
    def __init__(self, base_url: str, token: str | None = None) -> None:
        self._base_url = base_url
        self._token = token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    def get_telemetry(self, **params) -> httpx.Response:
        return httpx.get(f"{self._base_url}/telemetry", params=params, headers=self._headers(), timeout=10)

    def get_devices_status(self, **params) -> httpx.Response:
        return httpx.get(f"{self._base_url}/devices/status", params=params, headers=self._headers(), timeout=10)

    def get_summary_tenant(self, **params) -> httpx.Response:
        return httpx.get(f"{self._base_url}/summary/tenant", params=params, headers=self._headers(), timeout=10)
