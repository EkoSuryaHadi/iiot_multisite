import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import clickhouse_connect
from clickhouse_connect.driver.client import Client

from app.config import settings

# clickhouse-connect punya tipe "Client" yang tidak aman dipakai bersamaan oleh
# beberapa thread (FastAPI menjalankan endpoint sync di threadpool). Satu client per
# thread menghindari error "Attempt to execute concurrent queries within the same session".
_thread_local = threading.local()
_override_client: Any = None

# Semua INSERT lewat SATU thread khusus. Tujuannya bukan sekadar serialisasi: client
# per thread membuat create_insert_context() mengulang `DESCRIBE TABLE` setiap insert
# (clickhouse-connect 0.8.x), sehingga ~4.000 DESCRIBE/hari membanjiri query_log dan
# ikut menyumbang churn memori. Dengan satu thread, context-nya bisa di-cache.
_writer_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ch-writer")
_insert_contexts: dict[tuple[int, str], Any] = {}
_contexts_lock = threading.Lock()


def set_override_client(client: Any) -> None:
    global _override_client
    _override_client = client


def get_writer_executor() -> ThreadPoolExecutor:
    return _writer_executor


def get_client() -> Client:
    if _override_client is not None:
        return _override_client
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            database=settings.clickhouse_db,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        _thread_local.client = client
    return client


def _get_insert_context(client: Client, table: str, column_names: list[str]) -> Any:
    key = (id(client), table)
    ctx = _insert_contexts.get(key)
    if ctx is None:
        ctx = client.create_insert_context(table=table, column_names=list(column_names))
        with _contexts_lock:
            _insert_contexts[key] = ctx
    return ctx


def insert_rows(table: str, rows: list[tuple], column_names: list[str]) -> None:
    """Insert dengan context tersimpan. Kalau skema tabel berubah (ALTER TABLE),
    insert pertama gagal -> cache dibuang -> dicoba sekali lagi."""
    client = get_client()
    try:
        client.insert(context=_get_insert_context(client, table, column_names), data=rows)
    except Exception:
        with _contexts_lock:
            _insert_contexts.pop((id(client), table), None)
        client.insert(context=_get_insert_context(client, table, column_names), data=rows)
