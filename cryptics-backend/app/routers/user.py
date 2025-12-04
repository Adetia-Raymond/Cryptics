from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user_schema import UserResponse, UserUpdateRequest
from app.models.user import User
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/test")
def test():
    return {"msg": "user router ok"}

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/me", response_model=UserResponse)
def get_me(user = Depends(get_current_user), 
           db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    return db_user

@router.put("/update", response_model=UserResponse)
def update_user(
    update_data: UserUpdateRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    db_user = db.query(User).filter(User.id == user.id).first()

    # Update username
    if update_data.username:
        # Check if username is used
        exists = db.query(User).filter(
            User.username == update_data.username,
            User.id != user.id
        ).first()

        if exists:
            raise HTTPException(status_code=400, detail="Username already in use")

        db_user.username = update_data.username

    # Update email
    if update_data.email:
        exists = db.query(User).filter(
            User.email == update_data.email,
            User.id != user.id
        ).first()

        if exists:
            raise HTTPException(status_code=400, detail="Email already in use")

        db_user.email = update_data.email

    db.commit()
    db.refresh(db_user)

    return db_user
