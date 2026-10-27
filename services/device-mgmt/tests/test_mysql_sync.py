from unittest.mock import MagicMock
from app.mysql_sync import sync_mysql_user, delete_mysql_user


def test_sync_mysql_user_calls_mysql(monkeypatch):
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    def mock_get_conn():
        return mock_conn

    monkeypatch.setattr("app.mysql_sync.get_mysql_admin_connection", mock_get_conn)

    ok = sync_mysql_user("user.baru@perusahaan.com", "SecretPass123!")
    assert ok is True
    assert mock_cursor.execute.call_count == 4


def test_delete_mysql_user_calls_mysql(monkeypatch):
    mock_cursor = MagicMock()
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    def mock_get_conn():
        return mock_conn

    monkeypatch.setattr("app.mysql_sync.get_mysql_admin_connection", mock_get_conn)

    ok = delete_mysql_user("user.lama@perusahaan.com")
    assert ok is True
    assert mock_cursor.execute.call_count == 2
