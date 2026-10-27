-- Inisialisasi Database iiot untuk Akses Klien External
CREATE DATABASE IF NOT EXISTS iiot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iiot;

-- Buat user klien dengan izin akses remote dari host '%'
CREATE USER IF NOT EXISTS 'andreas.nugroho@gaungnusa.com'@'%' IDENTIFIED BY 'Password123456';
ALTER USER 'andreas.nugroho@gaungnusa.com'@'%' IDENTIFIED BY 'Password123456';
GRANT SELECT, INSERT, UPDATE, CREATE, INDEX ON iiot.* TO 'andreas.nugroho@gaungnusa.com'@'%';
FLUSH PRIVILEGES;

-- Skema flat table telemetry
CREATE TABLE IF NOT EXISTS telemetry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    tenant_slug VARCHAR(64) NULL,
    site_slug VARCHAR(64) NULL,
    voltage DOUBLE NULL,
    current DOUBLE NULL,
    power DOUBLE NULL,
    energy DOUBLE NULL,
    frequency DOUBLE NULL,
    power_factor DOUBLE NULL,
    temperature DOUBLE NULL,
    raw_payload JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ts (ts),
    INDEX idx_device_ts (device_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
