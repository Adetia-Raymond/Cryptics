# app/schemas/watchlist_schema.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

# ==================== ENUMS ====================
class TimeframeEnum(str, Enum):
    ONE_MIN = "1m"
    FIVE_MIN = "5m"
    FIFTEEN_MIN = "15m"
    ONE_HOUR = "1h"
    FOUR_HOUR = "4h"
    ONE_DAY = "1d"
    ONE_WEEK = "1w"

class AlertTypeEnum(str, Enum):
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    VOLUME_SPIKE = "volume_spike"
    PRICE_CHANGE_PERCENT = "price_change_percent"
    RSI_OVERBOUGHT = "rsi_overbought"
    RSI_OVERSOLD = "rsi_oversold"

class RiskProfileEnum(str, Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"

# ==================== WATCHLIST ====================
class WatchlistItemCreate(BaseModel):
    symbol: str = Field(..., description="Trading pair symbol (e.g., BTCUSDT)")
    notes: Optional[str] = Field(None, max_length=500)
    
    @validator('symbol')
    def validate_symbol(cls, v):
        return v.upper().strip()

class WatchlistItemUpdate(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

class WatchlistItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    symbol: str
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Optional market data (populated by service)
    current_price: Optional[float] = None
    price_change_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    
    class Config:
        from_attributes = True

# ==================== ALERTS ====================
class AlertCreate(BaseModel):
    symbol: str = Field(..., description="Trading pair symbol")
    alert_type: AlertTypeEnum
    threshold: float = Field(..., description="Price or indicator threshold")
    message: Optional[str] = Field(None, max_length=200)
    is_recurring: bool = Field(False, description="Re-trigger after first alert")
    
    @validator('symbol')
    def validate_symbol(cls, v):
        return v.upper().strip()

class AlertUpdate(BaseModel):
    is_active: Optional[bool] = None
    threshold: Optional[float] = None
    message: Optional[str] = None

class AlertResponse(BaseModel):
    id: UUID
    user_id: UUID
    symbol: str
    alert_type: AlertTypeEnum
    threshold: float
    message: Optional[str]
    is_active: bool
    is_recurring: bool
    triggered_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== USER PREFERENCES ====================
class UserPreferencesUpdate(BaseModel):
    # Display preferences
    default_timeframe: Optional[TimeframeEnum] = None
    default_chart_type: Optional[str] = Field(None, pattern="^(candlestick|line|bar)$")
    
    # Filter preferences
    min_volume_24h: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    min_price: Optional[float] = Field(None, ge=0)
    
    # Risk profile
    risk_profile: Optional[RiskProfileEnum] = None
    max_position_size_percent: Optional[float] = Field(None, ge=0, le=100)
    
    # Notification preferences
    enable_price_alerts: Optional[bool] = None
    enable_push_notifications: Optional[bool] = None
    enable_email_alerts: Optional[bool] = None
    
    @validator('max_price')
    def validate_price_range(cls, v, values):
        if v and 'min_price' in values and values['min_price']:
            if v < values['min_price']:
                raise ValueError('max_price must be greater than min_price')
        return v

class UserPreferencesResponse(BaseModel):
    id: UUID
    user_id: UUID
    default_timeframe: str
    default_chart_type: str
    min_volume_24h: Optional[float]
    max_price: Optional[float]
    min_price: Optional[float]
    risk_profile: str
    max_position_size_percent: float
    enable_price_alerts: bool
    enable_push_notifications: bool
    enable_email_alerts: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# ==================== FILTER PRESETS ====================
class FilterPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    min_volume_24h: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    min_price: Optional[float] = Field(None, ge=0)
    min_price_change_24h: Optional[float] = None
    max_price_change_24h: Optional[float] = None
    symbols: Optional[List[str]] = Field(None, description="Specific symbols to include")

class FilterPresetResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    min_volume_24h: Optional[float]
    max_price: Optional[float]
    min_price: Optional[float]
    min_price_change_24h: Optional[float]
    max_price_change_24h: Optional[float]
    symbols: Optional[List[str]]
    created_at: datetime
    
    class Config:
        from_attributes = True