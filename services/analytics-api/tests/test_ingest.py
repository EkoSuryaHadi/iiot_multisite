async def test_ingest_telemetry_numeric_metrics(client, ch_client, flush_buffers):
    resp = await client.post(
        "/ingest",
        json={
            "topic": "t/acme/s/jkt/d/gw-01/telemetry",
            "payload": {"temp": 25.5, "humidity": 60},
            "clientid": "acme-jkt-gw-01",
            "publish_received_at": 1700000000000,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["accepted"] is True
    assert body["rows_buffered"] == 2

    await flush_buffers()

    rows = ch_client.query(
        "SELECT tenant_slug, site_slug, device_key, metric_name, metric_value FROM telemetry ORDER BY metric_name"
    ).result_rows
    assert len(rows) == 2
    assert rows[0] == ("acme", "jkt", "gw-01", "humidity", 60.0)
    assert rows[1] == ("acme", "jkt", "gw-01", "temp", 25.5)


async def test_ingest_telemetry_payload_as_json_string(client, ch_client, flush_buffers):
    resp = await client.post(
        "/ingest",
        json={
            "topic": "t/acme/s/jkt/d/gw-01/telemetry",
            "payload": '{"pressure": 1013.25}',
        },
    )
    assert resp.status_code == 200
    await flush_buffers()

    rows = ch_client.query("SELECT metric_name, metric_value FROM telemetry").result_rows
    assert rows == [("pressure", 1013.25)]


async def test_ingest_status(client, ch_client, flush_buffers):
    resp = await client.post(
        "/ingest",
        json={"topic": "t/acme/s/jkt/d/gw-01/status", "payload": {"status": "online"}},
    )
    assert resp.status_code == 200
    assert resp.json()["rows_buffered"] == 1

    await flush_buffers()

    rows = ch_client.query("SELECT tenant_slug, site_slug, device_key, status FROM device_status").result_rows
    assert rows == [("acme", "jkt", "gw-01", "online")]


async def test_ingest_status_missing_status_field_rejected(client, ch_client):
    resp = await client.post(
        "/ingest",
        json={"topic": "t/acme/s/jkt/d/gw-01/status", "payload": {"foo": "bar"}},
    )
    assert resp.status_code == 400


async def test_ingest_invalid_topic_rejected(client, ch_client):
    resp = await client.post("/ingest", json={"topic": "not-a-valid-topic", "payload": {"temp": 1}})
    assert resp.status_code == 400


async def test_ingest_invalid_payload_rejected(client, ch_client):
    resp = await client.post(
        "/ingest", json={"topic": "t/acme/s/jkt/d/gw-01/telemetry", "payload": "not-json-{{{"}
    )
    assert resp.status_code == 400


async def test_ingest_unsupported_topic_suffix_rejected(client, ch_client):
    resp = await client.post(
        "/ingest", json={"topic": "t/acme/s/jkt/d/gw-01/cmd", "payload": {"foo": "bar"}}
    )
    assert resp.status_code == 400


async def test_ingest_telemetry_ignores_non_numeric_fields(client, ch_client, flush_buffers):
    resp = await client.post(
        "/ingest",
        json={
            "topic": "t/acme/s/jkt/d/gw-01/telemetry",
            "payload": {"temp": 25.5, "unit": "celsius", "ok": True},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["rows_buffered"] == 1

    await flush_buffers()
    rows = ch_client.query("SELECT metric_name FROM telemetry").result_rows
    assert rows == [("temp",)]


async def test_ingest_batch_flush_on_size_threshold(client, ch_client, flush_buffers, monkeypatch):
    from app.buffer import telemetry_buffer

    monkeypatch.setattr(telemetry_buffer, "_batch_size", 3)

    for i in range(3):
        resp = await client.post(
            "/ingest",
            json={"topic": "t/acme/s/jkt/d/gw-01/telemetry", "payload": {"counter": i}},
        )
        assert resp.status_code == 200

    # Batch size 3 tercapai di request ke-3, flush otomatis terjadi tanpa perlu flush_buffers manual.
    rows = ch_client.query("SELECT metric_value FROM telemetry ORDER BY metric_value").result_rows
    assert rows == [(0.0,), (1.0,), (2.0,)]
