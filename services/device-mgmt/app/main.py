from fastapi import FastAPI

from app.routers import auth, devices, sites, tenants, users

app = FastAPI(title="IIOT Device & User Management API", version="0.1.0")

app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(sites.router)
app.include_router(users.router)
app.include_router(devices.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
