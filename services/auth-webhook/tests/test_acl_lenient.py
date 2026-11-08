"""ACL harus mengizinkan topik device baru yang formatnya tidak baku.

Setiap bentuk di bawah ini benar-benar muncul di log produksi EMQX
(`authorization_permission_denied` / `cannot_publish_to_topic_due_to_not_authorized`).
"""


def _client_id(tenant, site, device_key="dev-1"):
    return f"{tenant.slug}-{site.slug}-{device_key}"


def _authz(client, tenant, site, topic, action, device_key="dev-1"):
    return client.post(
        "/authz",
        json={"username": _client_id(tenant, site, device_key), "topic": topic, "action": action},
    ).json()["result"]


def test_publish_topic_tanpa_penanda_d(client, device_a, tenant_a, site_a):
    topic = f"t/{tenant_a.slug}/s/{site_a.slug}/dev-1/telemetry"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "allow"


def test_publish_topic_tanpa_penanda_sama_sekali(client, device_a, tenant_a, site_a):
    topic = f"/{tenant_a.slug}/{site_a.slug}/dev-1"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "allow"


def test_subscribe_wildcard_ekor_jadi_cmd(client, device_a, tenant_a, site_a):
    topic = f"t/{tenant_a.slug}/s/{site_a.slug}/d/dev-1/#"
    assert _authz(client, tenant_a, site_a, topic, "subscribe") == "allow"


def test_subscribe_tanpa_suffix_jadi_cmd(client, device_a, tenant_a, site_a):
    topic = f"t/{tenant_a.slug}/s/{site_a.slug}/d/dev-1"
    assert _authz(client, tenant_a, site_a, topic, "subscribe") == "allow"


def test_legacy_uptopic_publish_allow(client, device_a, tenant_a, site_a):
    assert _authz(client, tenant_a, site_a, "/UpTopic_GNISMQTT", "publish") == "allow"


def test_legacy_subtop_subscribe_allow(client, device_a, tenant_a, site_a):
    assert _authz(client, tenant_a, site_a, "/SubTopGNIS", "subscribe") == "allow"


def test_legacy_uptopic_tidak_boleh_subscribe(client, device_a, tenant_a, site_a):
    assert _authz(client, tenant_a, site_a, "/UpTopic_GNISMQTT", "subscribe") == "deny"


def test_device_lain_tetap_ditolak_bentuk_longgar(client, device_a, tenant_a, site_a):
    topic = f"/{tenant_a.slug}/{site_a.slug}/dev-2"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "deny"


def test_cmd_tetap_tidak_boleh_dipublish(client, device_a, tenant_a, site_a):
    topic = f"t/{tenant_a.slug}/s/{site_a.slug}/d/dev-1/cmd"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "deny"


def test_gateway_data_prefix_tetap_jalan(client, device_a, tenant_a, site_a):
    topic = f"data/proj/grp/dev-1"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "allow"


def test_topic_tenant_lain_tetap_ditolak(client, device_a, tenant_a, site_a):
    topic = "/other-tenant/other-site/dev-1"
    assert _authz(client, tenant_a, site_a, topic, "publish") == "deny"


def test_publish_topic_nama_device_sendiri(client, device_a, tenant_a, site_a):
    # device baru sering publish ke topik sebatas nama project sendiri
    assert _authz(client, tenant_a, site_a, "/DEV_1", "publish") == "allow"
    assert _authz(client, tenant_a, site_a, "/dev-1", "publish") == "allow"


def test_topic_nama_device_lain_tetap_ditolak(client, device_a, tenant_a, site_a):
    assert _authz(client, tenant_a, site_a, "/GNISAlphaProject", "publish") == "deny"
