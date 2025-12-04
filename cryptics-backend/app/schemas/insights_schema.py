# app/schemas/insights_schema.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum

# ==================== ENUMS ====================

class SignalType(str, Enum):
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"

class SentimentType(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"

# ==================== TECHNICAL ANALYSIS ====================

class TechnicalIndicators(BaseModel):
    rsi: float = Field(..., description="RSI value (0-100)")
    rsi_signal: str = Field(..., description="RSI interpretation")
    
    macd: float = Field(..., description="MACD value")
    macd_signal: float = Field(..., description="MACD signal line")
    macd_histogram: float = Field(..., description="MACD histogram")
    macd_interpretation: str
    
    bollinger_upper: float
    bollinger_middle: float
    bollinger_lower: float
    bollinger_position: str = Field(..., description="Price position relative to bands")
    
    sma_20: float = Field(..., description="20-period Simple Moving Average")
    sma_50: float = Field(..., description="50-period Simple Moving Average")
    sma_trend: str = Field(..., description="Moving average trend")
    
    volume_sma: float = Field(..., description="Volume moving average")
    volume_ratio: float = Field(..., description="Current volume vs average")

class TechnicalAnalysisResponse(BaseModel):
    symbol: str
    signal: SignalType
    confidence: int = Field(..., ge=0, le=100, description="Signal confidence (0-100)")
    indicators: TechnicalIndicators
    summary: str = Field(..., description="Human-readable summary")
    timestamp: datetime

# ==================== SENTIMENT ANALYSIS ====================

class NewsArticle(BaseModel):
    title: str
    source: str
    published_at: datetime
    url: Optional[str]
    sentiment: SentimentType
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score (-1 to 1)")

class SentimentAnalysisResponse(BaseModel):
    symbol: str
    overall_sentiment: SentimentType
    sentiment_score: float = Field(..., ge=-1, le=1, description="Aggregated sentiment (-1 to 1)")
    news_count: int = Field(..., description="Number of articles analyzed")
    positive_count: int
    negative_count: int
    neutral_count: int
    articles: List[NewsArticle] = Field(..., max_items=10, description="Recent articles")
    summary: str
    timestamp: datetime

# ==================== COMBINED INSIGHTS ====================

class TradingSignal(BaseModel):
    symbol: str
    signal: SignalType
    confidence: int = Field(..., ge=0, le=100)
    reasoning: str = Field(..., description="Why this signal was generated")
    
    # Price levels
    current_price: float
    entry_price: Optional[float] = Field(None, description="Suggested entry price")
    target_price: Optional[float] = Field(None, description="Suggested target price")
    stop_loss: Optional[float] = Field(None, description="Suggested stop loss")
    
    # Risk assessment
    risk_level: RiskLevel
    suitable_for_profiles: List[str] = Field(..., description="Risk profiles this suits")
    
    # Supporting data
    technical_score: int = Field(..., ge=0, le=100)
    sentiment_score: float = Field(..., ge=-1, le=1)
    
    timestamp: datetime

class InsightResponse(BaseModel):
    symbol: str
    signal: TradingSignal
    technical_analysis: TechnicalIndicators
    sentiment: Optional[SentimentAnalysisResponse] = None
    last_updated: datetime

# ==================== MARKET OPPORTUNITIES ====================

class MarketOpportunity(BaseModel):
    symbol: str
    signal: SignalType
    confidence: int
    reason: str
    current_price: float
    price_change_24h: float
    risk_level: RiskLevel

class OpportunitiesResponse(BaseModel):
    opportunities: List[MarketOpportunity]
    based_on_risk_profile: str
    total_analyzed: int
    timestamp: datetime

# ==================== WATCHLIST INSIGHTS ====================

class WatchlistInsight(BaseModel):
    symbol: str
    signal: SignalType
    confidence: int
    current_price: float
    price_change_24h: float
    recommendation: str

class WatchlistInsightsResponse(BaseModel):
    insights: List[WatchlistInsight]
    summary: str = Field(..., description="Overall portfolio recommendation")
    timestamp: datetime