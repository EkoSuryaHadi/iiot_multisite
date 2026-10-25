from pathlib import Path


def test_sps_daily_energy_table_exists(clickhouse_client):
    tables = clickhouse_client.command("SHOW TABLES LIKE 'sps_daily_energy'")
    assert "sps_daily_energy" in tables


def test_telemetry_24_month_retention_ttl(clickhouse_client):
    create_stmt = clickhouse_client.command("SHOW CREATE TABLE telemetry")
    assert "730 DAY" in create_stmt.upper() or "2 YEAR" in create_stmt.upper()


def test_sps_daily_energy_schema_and_migration_file(clickhouse_client):
    init_dir = Path(__file__).resolve().parents[2] / "clickhouse" / "init"
    migration_file = init_dir / "004-sps-energy-aggregations.sql"
    assert migration_file.exists(), "004-sps-energy-aggregations.sql must exist"

    create_stmt = clickhouse_client.command("SHOW CREATE TABLE sps_daily_energy")
    for expected_col in (
        "tenant_slug",
        "site_slug",
        "date",
        "solar_kwh",
        "grid_kwh",
        "load_kwh",
        "solar_contribution_pct",
        "performance_ratio_pct",
        "updated_at",
    ):
        assert expected_col in create_stmt
    assert "ReplacingMergeTree" in create_stmt
    assert "2 YEAR" in create_stmt.upper() or "730 DAY" in create_stmt.upper()
