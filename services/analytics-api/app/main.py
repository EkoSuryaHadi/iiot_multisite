from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.buffer import device_status_buffer, telemetry_buffer
from app.clickhouse_client import get_client
from app.mysql_buffer import mysql_telemetry_buffer
from app.oneflux_bridge import oneflux_bridge
from app.rate_limit import limiter
from app.routers import devices, ingest, open_api, sps_analytics, summary, telemetry


@asynccontextmanager
async def lifespan(app: FastAPI):
    telemetry_buffer.start()
    device_status_buffer.start()
    mysql_telemetry_buffer.start_periodic_flush()
    oneflux_bridge.start()
    try:
        yield
    finally:
        await telemetry_buffer.stop()
        await device_status_buffer.stop()
        await mysql_telemetry_buffer.stop()
        await oneflux_bridge.stop()


app = FastAPI(
    title="IIOT Analytics API",
    version="0.1.0",
    lifespan=lifespan,
    description="IIoT Analytics API and Mitratel Open RESTful API Integration",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(ingest.router)
app.include_router(telemetry.router)
app.include_router(devices.router)
app.include_router(summary.router)
app.include_router(sps_analytics.router)
app.include_router(open_api.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    get_client().command("SELECT 1")
    return {"status": "ok"}
