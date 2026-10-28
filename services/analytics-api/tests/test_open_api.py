import pytest
from app.config import settings


@pytest.mark.asyncio
async def test_open_api_unauthorized(client):
    res = await client.get("/api/v1/external/sites/site-jkt-01/metrics")
    assert res.status_code == 401
    assert "Invalid or missing" in res.json().get("detail", "")


@pytest.mark.asyncio
async def test_open_api_invalid_key(client):
    res = await client.get(
        "/api/v1/external/sites/site-jkt-01/metrics",
        headers={"X-Mitratel-API-Key": "wrong-secret-key"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_open_api_authorized_metrics(client):
    valid_key = settings.mitratel_api_key
    res = await client.get(
        "/api/v1/external/sites/site-jkt-01/metrics",
        headers={"X-Mitratel-API-Key": valid_key},
    )
    assert res.status_code == 200
    data = res.json()
    assert "solar_contribution_pct" in data
    assert "performance_ratio_pct" in data
    assert "power_flow" in data
    assert data["site_slug"] == "site-jkt-01"


@pytest.mark.asyncio
async def test_open_api_authorized_health(client):
    valid_key = settings.mitratel_api_key
    res = await client.get(
        "/api/v1/external/sites/site-jkt-01/health",
        headers={"X-Mitratel-API-Key": valid_key},
    )
    assert res.status_code == 200
    data = res.json()
    assert "pv_health" in data
    assert "mppt_health" in data
    assert "site_health_index" in data


@pytest.mark.asyncio
async def test_open_api_authorized_daily(client):
    valid_key = settings.mitratel_api_key
    res = await client.get(
        "/api/v1/external/sites/site-jkt-01/daily",
        headers={"X-Mitratel-API-Key": valid_key},
    )
    assert res.status_code == 200
    data = res.json()
    assert "records" in data
    assert "total" in data
