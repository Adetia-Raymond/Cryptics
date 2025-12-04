# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.schemas.auth_schema import RegisterRequest, LoginRequest, TokenResponse
from app.models.user import User
from app.database import get_db
from app.utils.security import hash_password, verify_password
from app.utils.jwt import create_access_token, create_refresh_token, get_current_user
from app.core.redis_auth import blacklist_token
from app.config import settings

from app.utils.jwt import verify_refresh_token



router = APIRouter(prefix="/auth", tags=["Auth"])

# ✅ Initialize OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ✅ SIGNUP
@router.post("/signup", response_model=TokenResponse)
def signup(payload: RegisterRequest, response: Response, db: Session = Depends(get_db), req: Request = None):

    # Check existing email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check existing username
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create user
    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Issue tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # set refresh token as httpOnly cookie (frontend should not persist refresh token)
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    # secure flag enabled in production (only send over HTTPS)
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=settings.PRODUCTION, max_age=max_age, samesite="lax", path="/")

    client_type = (req.headers.get("x-client-type") if req and req.headers else "") or ""
    if client_type.lower() == "mobile":
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    return TokenResponse(
        access_token=access_token
    )


# ✅ LOGIN
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db), req: Request = None):

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=settings.PRODUCTION, max_age=max_age, samesite="lax", path="/")

    client_type = (req.headers.get("x-client-type") if req and req.headers else "") or ""
    if client_type.lower() == "mobile":
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    return TokenResponse(
        access_token=access_token
    )


# ✅ LOGOUT (Redis Blacklist)
@router.post("/logout")
def logout(
    response: Response,
    token: str = Depends(oauth2_scheme)
):
    # blacklist access token
    expire_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    blacklist_token(token, expire_seconds)

    # clear the refresh cookie
    response.delete_cookie("refresh_token", path="/")

    return {"msg": "Logout successful"}

# ✅ REFRESH TOKEN
@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, response: Response):
    # Read refresh token from httpOnly cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = verify_refresh_token(refresh_token)
    user_id = payload.get("sub")

    # Blacklist old refresh token
    blacklist_token(
        refresh_token,
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

    # Create new rotated tokens
    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})

    # set rotated refresh token in cookie
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    response.set_cookie("refresh_token", new_refresh, httponly=True, secure=settings.PRODUCTION, max_age=max_age, samesite="lax", path="/")

    return TokenResponse(
        access_token=new_access
    )



@router.post("/refresh_mobile", response_model=TokenResponse)
def refresh_mobile(payload: dict, response: Response):
    """Mobile-friendly refresh endpoint.

    Accepts JSON body: { "refresh_token": "..." }
    Verifies and rotates refresh token and returns new tokens in the response body
    (does NOT set an httpOnly cookie so native/mobile clients can store the refresh token).
    """
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload_data = verify_refresh_token(refresh_token)
    user_id = payload_data.get("sub")

    # Blacklist old refresh token
    blacklist_token(
        refresh_token,
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )

    # Create new rotated tokens
    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh
    )

