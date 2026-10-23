-- Migration: Tabel status terakhir device dan materialized view (Fase optimasi status)
USE iiot;

CREATE TABLE IF NOT EXISTS device_last_seen
(
    tenant_slug LowCardinality(String),
    site_slug   LowCardinality(String),
    device_key  LowCardinality(String),
    last_seen   DateTime64(3, 'UTC'),
    status      LowCardinality(String) DEFAULT 'online',
    updated_at  DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(last_seen)
ORDER BY (tenant_slug, site_slug, device_key);

CREATE MATERIALIZED VIEW IF NOT EXISTS device_last_seen_telemetry_mv TO device_last_seen AS
SELECT
    tenant_slug,
    site_slug,
    device_key,
    ts AS last_seen,
    'online' AS status,
    now() AS updated_at
FROM telemetry;

CREATE MATERIALIZED VIEW IF NOT EXISTS device_last_seen_status_mv TO device_last_seen AS
SELECT
    tenant_slug,
    site_slug,
    device_key,
    ts AS last_seen,
    status,
    now() AS updated_at
FROM device_status;

-- Backfill data lama jika tabel telemetry & device_status sudah berisi data
INSERT INTO device_last_seen (tenant_slug, site_slug, device_key, last_seen, status, updated_at)
SELECT
    tenant_slug,
    site_slug,
    device_key,
    max(ts) AS last_seen,
    'online' AS status,
    now() AS updated_at
FROM telemetry
GROUP BY tenant_slug, site_slug, device_key;

INSERT INTO device_last_seen (tenant_slug, site_slug, device_key, last_seen, status, updated_at)
SELECT
    tenant_slug,
    site_slug,
    device_key,
    max(ts) AS last_seen,
    argMax(status, ts) AS status,
    now() AS updated_at
FROM device_status
GROUP BY tenant_slug, site_slug, device_key;
