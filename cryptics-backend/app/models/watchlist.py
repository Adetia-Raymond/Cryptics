# app/models/watchlist.py
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base

class Watchlist(Base):
    """User's cryptocurrency watchlist"""
    __tablename__ = "watchlist"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), default=None)
    
    # Relationships
    user = relationship("User", back_populates="watchlist_items")


class Alert(Base):
    """Price and indicator alerts"""
    __tablename__ = "alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)
    threshold = Column(Float, nullable=False)
    message = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    is_recurring = Column(Boolean, default=False)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="alerts")


class UserPreferences(Base):
    """User display and risk preferences"""
    __tablename__ = "user_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Display preferences
    default_timeframe = Column(String(10), default="1h")
    default_chart_type = Column(String(20), default="candlestick")
    
    # Filter preferences
    min_volume_24h = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    min_price = Column(Float, nullable=True)
    
    # Risk profile
    risk_profile = Column(String(20), default="moderate")
    max_position_size_percent = Column(Float, default=10.0)
    
    # Notification preferences
    enable_price_alerts = Column(Boolean, default=True)
    enable_push_notifications = Column(Boolean, default=True)
    enable_email_alerts = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), default=None)
    
    # Relationships
    user = relationship("User", back_populates="preferences", uselist=False)


class FilterPreset(Base):
    """Saved filter presets for market scanning"""
    __tablename__ = "filter_presets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    
    # Filter criteria
    min_volume_24h = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    min_price = Column(Float, nullable=True)
    min_price_change_24h = Column(Float, nullable=True)
    max_price_change_24h = Column(Float, nullable=True)
    symbols = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="filter_presets")