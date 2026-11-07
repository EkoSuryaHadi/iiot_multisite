from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.acl import decide
from app.database import get_db
from app.identity import resolve_identity_for_authz
from app.schemas import AuthzRequest, AuthzResponse

router = APIRouter(tags=["emqx"])


@router.post("/authz", response_model=AuthzResponse)
def authz(payload: AuthzRequest, db: Session = Depends(get_db)) -> AuthzResponse:
    identity = resolve_identity_for_authz(db, payload.username)
    if identity is None and payload.clientid:
        identity = resolve_identity_for_authz(db, payload.clientid)
    if identity is None:
        return AuthzResponse(result="deny")

    allowed = decide(identity, payload.topic, payload.action, db)
    return AuthzResponse(result="allow" if allowed else "deny")
