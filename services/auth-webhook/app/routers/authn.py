from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.identity import authenticate
from app.schemas import AuthnRequest, AuthnResponse

router = APIRouter(tags=["emqx"])


@router.post("/authn", response_model=AuthnResponse)
def authn(payload: AuthnRequest, db: Session = Depends(get_db)) -> AuthnResponse:
    identity = authenticate(db, payload.username, payload.password)
    if identity is None:
        return AuthnResponse(result="deny")
    return AuthnResponse(result="allow", is_superuser=identity.is_superuser)
