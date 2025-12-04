# app/models/user.py
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), default=None)
    
    # ==================== RELATIONSHIPS ====================
    
    # Watchlist & Preferences
    watchlist_items = relationship(
        "Watchlist", 
        back_populates="user", 
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    alerts = relationship(
        "Alert",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    preferences = relationship(
        "UserPreferences",
        back_populates="user",
        uselist=False,  # One-to-one relationship
        cascade="all, delete-orphan"
    )
    
    filter_presets = relationship(
        "FilterPreset",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    # Portfolio
    transactions = relationship(
        "Transaction",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )