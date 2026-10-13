-- Dibuat otomatis oleh ClickHouse entrypoint saat container pertama kali start.
-- Database utama dibuat lewat CLICKHOUSE_DB env var; file ini tempat skema
-- tambahan (tabel telemetry dkk) akan ditambahkan pada Fase 5.

CREATE DATABASE IF NOT EXISTS iiot;
