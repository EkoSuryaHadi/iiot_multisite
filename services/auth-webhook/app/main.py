from fastapi import FastAPI

from app.routers import authn, authz

app = FastAPI(title="IIOT Auth Webhook (EMQX authn/authz)", version="0.1.0")

app.include_router(authn.router)
app.include_router(authz.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
