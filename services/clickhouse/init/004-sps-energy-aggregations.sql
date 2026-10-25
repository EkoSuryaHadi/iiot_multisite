-- Migration: Retensi 24 bulan (730 hari) & Tabel Agregasi Harian SPS (Mitratel GTaaS)
USE iiot;

-- Pastikan tabel telemetry dan device_status pada environment eksisting diperbarui ke TTL 730 hari (24 bulan)
ALTER TABLE telemetry MODIFY TTL toDateTime(ts) + INTERVAL 730 DAY;
ALTER TABLE device_status MODIFY TTL toDateTime(ts) + INTERVAL 730 DAY;

-- Tabel agregasi energi harian SPS untuk keperluan audit penagihan / efficiency sharing (RKS 2.3.3.c)
CREATE TABLE IF NOT EXISTS sps_daily_energy
(
    tenant_slug LowCardinality(String),
    site_slug   LowCardinality(String),
    date        Date,
    solar_kwh   Float64,
    grid_kwh    Float64,
    load_kwh    Float64,
    solar_contribution_pct Float64,
    performance_ratio_pct  Float64,
    updated_at  DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_slug, site_slug, date)
TTL date + INTERVAL 2 YEAR;
