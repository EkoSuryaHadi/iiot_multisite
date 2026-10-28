import json
from unittest.mock import MagicMock, patch

import pytest
from app.config import settings
from app.oneflux_bridge import OnefluxBridge, build_oneflux_payload


def test_build_oneflux_payload():
    metrics = {
        "v_pv": 180.5,
        "i_pv": 16.0,
        "p_pv": 2888.0,
        "v_mppt_out": 54.2,
        "i_mppt_out": 52.0,
        "p_mppt_out": 2818.4,
        "v_busbar": 54.0,
        "i_rectifier": 10.5,
        "p_rectifier": 567.0,
        "p_load": 3385.4,
        "irradiance": 820.0,
        "temp_mppt": 43.5,
        "solar_kwh": 14.5,
        "grid_kwh": 3.2,
        "load_kwh": 17.7,
    }
    site_cfg = {
        "site_type": "TYPE_A",
        "pv_capacity_kwp": 5.85,
        "rectifier_float_voltage": 53.5,
    }

    payload = build_oneflux_payload("mitratel", "site-dki-01", metrics, site_cfg)

    assert payload["tenant_slug"] == "mitratel"
    assert payload["site_slug"] == "site-dki-01"
    assert "timestamp" in payload
    assert payload["electrical"]["v_pv"] == 180.5
    assert payload["electrical"]["v_mppt_out"] == 54.2
    assert payload["performance"]["solar_contribution_pct"] > 0
    assert payload["environmental"]["irradiance"] == 820.0
    assert "health" in payload


def test_publish_site_telemetry_disabled():
    bridge = OnefluxBridge()
    # When disabled, publish is safely skipped without exception
    result = bridge.publish_site_telemetry(
        tenant_slug="mitratel",
        site_slug="site-01",
        payload={"test": 123},
    )
    assert result is False


def test_publish_site_telemetry_mock():
    bridge = OnefluxBridge()
    bridge.enabled = True
    bridge._connected = True

    mock_client = MagicMock()
    bridge._client = mock_client

    payload = {"status": "ok", "solar_kwh": 10.5}
    result = bridge.publish_site_telemetry("mitratel", "site-01", payload)

    assert result is True
    expected_topic = f"{settings.oneflux_mqtt_topic_prefix}/mitratel/site-01/telemetry"
    mock_client.publish.assert_called_once()
    call_args = mock_client.publish.call_args
    assert call_args[0][0] == expected_topic
    assert json.loads(call_args[0][1]) == payload
    assert call_args[1]["qos"] == 1


@pytest.mark.asyncio
async def test_start_stop_lifecycle():
    bridge = OnefluxBridge()
    bridge.enabled = False
    bridge.start()
    await bridge.stop()
    assert bridge._client is None
