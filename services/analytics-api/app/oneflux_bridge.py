import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.sps_engine import (
    DEFAULT_BASELINE_KWH_DAILY,
    DEFAULT_PV_CAPACITY_KWP,
    DEFAULT_RECTIFIER_FLOAT_VOLTAGE,
    calculate_performance_ratio,
    calculate_solar_contribution,
    evaluate_mppt_health,
    evaluate_pv_health,
)

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

logger = logging.getLogger(__name__)


def build_oneflux_payload(
    tenant_slug: str,
    site_slug: str,
    metrics: dict[str, float],
    site_cfg: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Menyusun payload telemetry terstandarisasi untuk Oneflux Mitratel sesuai RKS 2.3.3.c butir 1."""
    cfg = site_cfg or {
        "site_type": "TYPE_A",
        "pv_capacity_kwp": DEFAULT_PV_CAPACITY_KWP,
        "rectifier_float_voltage": DEFAULT_RECTIFIER_FLOAT_VOLTAGE,
        "baseline_kwh_daily": DEFAULT_BASELINE_KWH_DAILY,
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    v_pv = metrics.get("v_pv", metrics.get("v_pv_string1", 0.0))
    i_pv = metrics.get("i_pv", metrics.get("i_pv_string1", 0.0))
    p_pv = metrics.get("p_pv", round(v_pv * i_pv, 2))

    v_mppt_out = metrics.get("v_mppt_out", 0.0)
    i_mppt_out = metrics.get("i_mppt_out", 0.0)
    p_mppt_out = metrics.get("p_mppt_out", round(v_mppt_out * i_mppt_out, 2))

    float_v = cfg.get("rectifier_float_voltage", DEFAULT_RECTIFIER_FLOAT_VOLTAGE)
    v_busbar = metrics.get("v_busbar", v_mppt_out or float_v)
    i_rectifier = metrics.get("i_rectifier", 0.0)
    p_rectifier = metrics.get("p_rectifier", round(v_busbar * i_rectifier, 2))
    p_load = metrics.get("p_load", round(p_mppt_out + p_rectifier, 2))

    irradiance = metrics.get("irradiance", 0.0)
    temp_mppt = metrics.get("temp_mppt", 25.0)

    solar_kwh = metrics.get("solar_kwh", round(p_mppt_out / 1000.0, 3))
    grid_kwh = metrics.get("grid_kwh", round(p_rectifier / 1000.0, 3))
    load_kwh = metrics.get("load_kwh", round(solar_kwh + grid_kwh, 3))

    scr = calculate_solar_contribution(solar_kwh, load_kwh)
    pr = calculate_performance_ratio(solar_kwh, irradiance / 1000.0, cfg.get("pv_capacity_kwp", 5.85))

    pv_h = evaluate_pv_health(solar_kwh, irradiance / 1000.0, cfg.get("pv_capacity_kwp", 5.85))
    mppt_h = evaluate_mppt_health(
        p_pv, p_mppt_out, temp_mppt, v_mppt_out if v_mppt_out > 0 else None, float_v
    )
    overall_h_index = round((pv_h["health_index"] + mppt_h["health_index"]) / 2.0, 2)
    overall_status = "HEALTHY"
    if mppt_h["status"] == "CRITICAL" or pv_h["status"] == "DEGRADED":
        overall_status = "CRITICAL" if mppt_h["status"] == "CRITICAL" else "DEGRADED"
    elif mppt_h["status"] == "WARNING" or pv_h["status"] == "WARNING":
        overall_status = "WARNING"

    return {
        "version": "1.0",
        "timestamp": now_iso,
        "tenant_slug": tenant_slug,
        "site_slug": site_slug,
        "site_type": cfg.get("site_type", "TYPE_A"),
        "electrical": {
            "v_pv": round(v_pv, 2),
            "i_pv": round(i_pv, 2),
            "p_pv": round(p_pv, 2),
            "v_mppt_out": round(v_mppt_out, 2),
            "i_mppt_out": round(i_mppt_out, 2),
            "p_mppt_out": round(p_mppt_out, 2),
            "v_busbar": round(v_busbar, 2),
            "i_rectifier": round(i_rectifier, 2),
            "p_rectifier": round(p_rectifier, 2),
            "p_load": round(p_load, 2),
            "voltage_delta_v": round(v_mppt_out - float_v, 2) if v_mppt_out > 0 else 0.0,
        },
        "environmental": {
            "irradiance": round(irradiance, 2),
            "temp_mppt": round(temp_mppt, 2),
        },
        "performance": {
            "solar_kwh": round(solar_kwh, 3),
            "grid_kwh": round(grid_kwh, 3),
            "load_kwh": round(load_kwh, 3),
            "solar_contribution_pct": scr,
            "performance_ratio_pct": pr,
        },
        "health": {
            "status": overall_status,
            "health_index": overall_h_index,
            "pv_health_status": pv_h["status"],
            "mppt_health_status": mppt_h["status"],
        },
    }


class OnefluxBridge:
    """Northbound MQTT Publisher ke Platform Oneflux Mitratel (RKS Pasal 2.3.3.c butir 1)."""

    def __init__(self) -> None:
        self.enabled = settings.oneflux_mqtt_enabled
        self.host = settings.oneflux_mqtt_host
        self.port = settings.oneflux_mqtt_port
        self.username = settings.oneflux_mqtt_username
        self.password = settings.oneflux_mqtt_password
        self.use_tls = settings.oneflux_mqtt_use_tls
        self.client_id = settings.oneflux_mqtt_client_id
        self.topic_prefix = settings.oneflux_mqtt_topic_prefix
        self.interval = settings.oneflux_publish_interval_seconds

        self._client: Any = None
        self._connected = False

    def start(self) -> None:
        """Memulai koneksi background MQTT client jika enabled."""
        if not self.enabled:
            logger.info("Oneflux Northbound MQTT Bridge dinonaktifkan (oneflux_mqtt_enabled=False).")
            return

        if mqtt is None:
            logger.warning("Paho-MQTT tidak terinstal. Oneflux Bridge dilewati.")
            return

        try:
            try:
                self._client = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION2,
                    client_id=self.client_id,
                    clean_session=True,
                )
            except (AttributeError, TypeError):
                self._client = mqtt.Client(
                    client_id=self.client_id,
                    clean_session=True,
                )

            if self.username and self.password:
                self._client.username_pw_set(self.username, self.password)

            if self.use_tls:
                self._client.tls_set()

            def on_connect(client, userdata, flags, rc, properties=None):
                if rc == 0:
                    self._connected = True
                    logger.info("Terkoneksi ke broker Oneflux Mitratel di %s:%s", self.host, self.port)
                else:
                    self._connected = False
                    logger.warning("Gagal koneksi ke broker Oneflux, rc=%s", rc)

            def on_disconnect(client, userdata, flags, rc=None, properties=None):
                self._connected = False
                logger.info("Terputus dari broker Oneflux Mitratel")

            self._client.on_connect = on_connect
            self._client.on_disconnect = on_disconnect

            self._client.connect_async(self.host, self.port, keepalive=60)
            self._client.loop_start()
        except Exception as exc:
            logger.error("Error inisialisasi Oneflux MQTT Bridge: %s", exc)

    def publish_site_telemetry(
        self, tenant_slug: str, site_slug: str, payload: dict[str, Any]
    ) -> bool:
        """Mempublikasikan payload data telemetri ke platform Oneflux Mitratel dengan QoS 1."""
        if not self.enabled or not self._client:
            return False

        topic = f"{self.topic_prefix}/{tenant_slug}/{site_slug}/telemetry"
        try:
            raw_data = json.dumps(payload)
            self._client.publish(topic, raw_data, qos=1)
            return True
        except Exception as exc:
            logger.error("Gagal mengirim telemetri ke Oneflux [%s]: %s", topic, exc)
            return False

    async def stop(self) -> None:
        """Menghentikan MQTT client loop secara graceful."""
        if self._client:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception:
                pass
            finally:
                self._client = None
                self._connected = False


oneflux_bridge = OnefluxBridge()

