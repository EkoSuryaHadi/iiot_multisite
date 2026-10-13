import threading

import clickhouse_connect
from clickhouse_connect.driver.client import Client

from app.config import settings

# clickhouse-connect punya tipe "Client" yang tidak aman dipakai bersamaan oleh
# beberapa thread (FastAPI menjalankan endpoint sync di threadpool, buffer ingest
# juga insert lewat asyncio.to_thread). Satu client per thread menghindari error
# "Attempt to execute concurrent queries within the same session".
_thread_local = threading.local()


def get_client() -> Client:
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
