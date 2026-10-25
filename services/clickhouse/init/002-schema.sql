-- Skema telemetry IIoT - Fase 5.
-- Format "long": satu baris per metrik (metric_name, metric_value) agar fleksibel
-- menampung payload device apapun tanpa perlu migrasi kolom tiap ada metrik baru.
USE iiot;

CREATE TABLE IF NOT EXISTS telemetry
(
    tenant_slug  LowCardinality(String),
    site_slug    LowCardinality(String),
    device_key   LowCardinality(String),
    metric_name  LowCardinality(String),
    metric_value Float64,
    ts           DateTime64(3, 'UTC'),
    raw_payload  String DEFAULT '',
    inserted_at  DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (tenant_slug, site_slug, device_key, metric_name, ts)
TTL toDateTime(ts) + INTERVAL 730 DAY
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS device_status
(
    tenant_slug LowCardinality(String),
    site_slug   LowCardinality(String),
    device_key  LowCardinality(String),
    status      LowCardinality(String),
    ts          DateTime64(3, 'UTC'),
    raw_payload String DEFAULT '',
    inserted_at DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (tenant_slug, site_slug, device_key, ts)
TTL toDateTime(ts) + INTERVAL 730 DAY
SETTINGS index_granularity = 8192;

-- Agregasi 1 menit (avg/min/max/count per metrik) via AggregatingMergeTree + Materialized View.
CREATE TABLE IF NOT EXISTS telemetry_agg_1m
(
    tenant_slug LowCardinality(String),
    site_slug   LowCardinality(String),
    device_key  LowCardinality(String),
    metric_name LowCardinality(String),
    bucket      DateTime,
    avg_value   AggregateFunction(avg, Float64),
    min_value   AggregateFunction(min, Float64),
    max_value   AggregateFunction(max, Float64),
    sample_count AggregateFunction(count)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (tenant_slug, site_slug, device_key, metric_name, bucket)
TTL bucket + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_agg_1m_mv TO telemetry_agg_1m AS
SELECT
    tenant_slug,
    site_slug,
    device_key,
    metric_name,
    toStartOfMinute(ts) AS bucket,
    avgState(metric_value) AS avg_value,
    minState(metric_value) AS min_value,
    maxState(metric_value) AS max_value,
    countState() AS sample_count
FROM telemetry
GROUP BY tenant_slug, site_slug, device_key, metric_name, bucket;

-- Agregasi 1 jam.
CREATE TABLE IF NOT EXISTS telemetry_agg_1h
(
    tenant_slug LowCardinality(String),
    site_slug   LowCardinality(String),
    device_key  LowCardinality(String),
    metric_name LowCardinality(String),
    bucket      DateTime,
    avg_value   AggregateFunction(avg, Float64),
    min_value   AggregateFunction(min, Float64),
    max_value   AggregateFunction(max, Float64),
    sample_count AggregateFunction(count)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (tenant_slug, site_slug, device_key, metric_name, bucket)
TTL bucket + INTERVAL 2 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_agg_1h_mv TO telemetry_agg_1h AS
SELECT
    tenant_slug,
    site_slug,
    device_key,
    metric_name,
    toStartOfHour(ts) AS bucket,
    avgState(metric_value) AS avg_value,
    minState(metric_value) AS min_value,
    maxState(metric_value) AS max_value,
    countState() AS sample_count
FROM telemetry
GROUP BY tenant_slug, site_slug, device_key, metric_name, bucket;

-- Status terakhir tiap device via ReplacingMergeTree + Materialized Views
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
