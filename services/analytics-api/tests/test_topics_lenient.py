"""Parser topik ingest harus menerima bentuk longgar perangkat baru.

Bentuk-bentuk ini diambil dari log produksi (device tidak bisa diubah firmware-nya).
Semua tetap harus menghasilkan device_key yang benar — bukan menerima apa saja.
"""
import pytest

from app import topics


@pytest.fixture(autouse=True)
def _stub_lookup(monkeypatch):
    mapping = {
        "GNIS_MockupUSR": ("solar", "jkt"),
        "GNIS_AlphaProject": ("solar", "jkt"),
        "dev-1": ("solar", "jkt"),
    }
    monkeypatch.setattr(topics, "_lookup_device_slugs", lambda key: mapping.get(key))


def test_format_standar():
    p = topics.parse_device_topic("t/solar/s/jkt/d/dev-1/telemetry")
    assert p is not None
    assert (p.tenant_slug, p.site_slug, p.device_key, p.suffix) == ("solar", "jkt", "dev-1", "telemetry")


def test_tanpa_penanda_d():
    p = topics.parse_device_topic("t/solar/s/jkt/GNIS_MockupUSR/telemetry")
    assert p is not None
    assert (p.tenant_slug, p.site_slug, p.device_key, p.suffix) == ("solar", "jkt", "GNIS_MockupUSR", "telemetry")


def test_tanpa_penanda_sama_sekali():
    p = topics.parse_device_topic("/solar/jkt/GNIS_MockupUSR")
    assert p is not None
    assert (p.device_key, p.suffix) == ("GNIS_MockupUSR", "telemetry")


def test_device_tidak_terdaftar_ditolak():
    assert topics.parse_device_topic("/solar/jkt/TIDAK_ADA") is None


def test_tenant_tidak_cocok_ditolak():
    assert topics.parse_device_topic("/lain/jkt/GNIS_MockupUSR") is None


def test_legacy_uptopic_pakai_clientid():
    p = topics.parse_device_topic_with_client("/UpTopic_GNISMQTT", "solar-jkt-GNIS_MockupUSR")
    assert p is not None
    assert (p.tenant_slug, p.site_slug, p.device_key, p.suffix) == ("solar", "jkt", "GNIS_MockupUSR", "telemetry")


def test_topik_nama_device_sendiri_dari_clientid():
    p = topics.parse_device_topic_with_client("/GNISAlphaProject", "solar-jkt-GNIS_AlphaProject")
    assert p is not None
    assert (p.tenant_slug, p.site_slug, p.device_key, p.suffix) == ("solar", "jkt", "GNIS_AlphaProject", "telemetry")


def test_topik_nama_device_lain_tidak_ditebak():
    assert topics.parse_device_topic_with_client("/GNISAlphaProject", "solar-jkt-GNIS_MockupUSR") is None


def test_parse_username_slugs_standar():
    assert topics.parse_username_slugs("solar-jkt-GNIS_AlphaProject") == ("solar", "jkt", "GNIS_AlphaProject")


def test_parse_username_slugs_device_key_mengandung_dash():
    assert topics.parse_username_slugs("solar-jkt-GNIS-Alpha-01") == ("solar", "jkt", "GNIS-Alpha-01")


def test_parse_username_slugs_bukan_device():
    assert topics.parse_username_slugs("internal-service") is None
    assert topics.parse_username_slugs("") is None
    assert topics.parse_username_slugs(None) is None


def test_legacy_tanpa_clientid_tidak_bisa_ditebak():
    assert topics.parse_device_topic_with_client("/UpTopic_GNISMQTT", None) is None


def test_buffered_dinormalkan_ke_telemetry():
    p = topics.parse_device_topic("t/solar/s/jkt/d/dev-1/buffered")
    assert p is not None and p.suffix == "telemetry"


def test_sps_tetap_jalan():
    p = topics.parse_device_topic("sps/solar/jkt/dev-1")
    assert p is not None and p.device_key == "dev-1" and p.suffix == "telemetry"
