from typing import Literal

from pydantic import BaseModel


class AuthnRequest(BaseModel):
    """Body yang dikirim EMQX HTTP authn backend (placeholder dikonfigurasi di EMQX)."""

    username: str | None = None
    password: str | None = None
    clientid: str | None = None
    peerhost: str | None = None


class AuthnResponse(BaseModel):
    result: Literal["allow", "deny", "ignore"]
    is_superuser: bool = False


class AuthzRequest(BaseModel):
    """Body yang dikirim EMQX HTTP authz backend."""

    username: str | None = None
    clientid: str | None = None
    topic: str
    action: Literal["publish", "subscribe"]
    peerhost: str | None = None


class AuthzResponse(BaseModel):
    result: Literal["allow", "deny"]
