# app/routers/insights.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.jwt import get_current_user
from app.models.user import User
from app.schemas.insights_schema import (
    TechnicalAnalysisResponse,
    SentimentAnalysisResponse,
    InsightResponse,
    OpportunitiesResponse
)
from app.services.technical_service import TechnicalService
from app.services.sentiment_service import SentimentService
from app.services.insights_service import InsightsService

router = APIRouter(prefix="/insights", tags=["AI Insights"])


# ==================== TECHNICAL ANALYSIS ====================

@router.get("/technical/{symbol}", response_model=TechnicalAnalysisResponse)
async def get_technical_analysis(
    symbol: str,
    interval: str = Query("1h", description="Timeframe (1m, 5m, 15m, 1h, 4h, 1d)"),
    current_user: User = Depends(get_current_user)
):
    """
    Get technical analysis for a symbol
    
    Calculates:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Bands
    - Moving Averages (SMA 20, 50)
    - Volume Analysis
    
    Returns buy/sell/hold signal with confidence level
    """
    try:
        return await TechnicalService.analyze(symbol, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Technical analysis failed: {str(e)}")


# ==================== SENTIMENT ANALYSIS ====================

@router.get("/sentiment/{symbol}", response_model=SentimentAnalysisResponse)
async def get_sentiment_analysis(
    symbol: str,
    limit: int = Query(10, ge=1, le=20, description="Number of news articles to analyze"),
    current_user: User = Depends(get_current_user)
):
    """
    Get sentiment analysis for a symbol using AI
    
    - Fetches latest crypto news
    - Analyzes sentiment with FinBERT (AI model)
    - Returns positive/negative/neutral sentiment
    - Shows recent news articles with sentiment scores
    
    Cached for 15 minutes for performance
    """
    try:
        return await SentimentService.analyze_sentiment(symbol, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


# ==================== COMBINED SIGNAL ====================

@router.get("/signal/{symbol}", response_model=InsightResponse)
async def get_trading_signal(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive trading signal (Technical + Sentiment + AI)
    
    Combines:
    - Technical indicators (70% weight)
    - Market sentiment from news (30% weight)
    - User's risk profile
    
    Returns:
    - BUY/SELL/HOLD recommendation
    - Confidence level (0-100)
    - Entry price, target, and stop loss
    - Risk assessment
    - Detailed reasoning
    """
    try:
        return await InsightsService.get_signal(
            symbol=symbol,
            user_id=current_user.id,
            db=db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal generation failed: {str(e)}")


# ==================== MARKET OPPORTUNITIES ====================

@router.get("/opportunities", response_model=OpportunitiesResponse)
async def get_market_opportunities(
    limit: int = Query(10, ge=1, le=20, description="Number of opportunities to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Find top trading opportunities based on your risk profile
    
    Scans popular cryptocurrencies and returns:
    - Top buy/sell opportunities
    - Filtered by your risk tolerance
    - Sorted by confidence level
    
    Analyzes: BTC, ETH, BNB, XRP, ADA, DOGE, SOL, MATIC, DOT, AVAX
    """
    try:
        return await InsightsService.get_opportunities(
            user_id=current_user.id,
            db=db,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Opportunity scan failed: {str(e)}")


# ==================== QUICK INSIGHT ====================

@router.get("/quick/{symbol}")
async def get_quick_insight(
    symbol: str,
    current_user: User = Depends(get_current_user)
):
    """
    Quick insight for mobile app (lightweight, fast)
    
    Returns only essential info:
    - Signal (BUY/SELL/HOLD)
    - Confidence
    - One-line summary
    
    Perfect for watchlist cards and quick checks
    """
    try:
        technical = await TechnicalService.analyze(symbol, interval="1h", limit=50)
        
        return {
            "symbol": symbol,
            "signal": technical.signal.value,
            "confidence": technical.confidence,
            "summary": technical.summary,
            "rsi": technical.indicators.rsi,
            "timestamp": technical.timestamp.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quick insight failed: {str(e)}")


# ==================== CACHE MANAGEMENT ====================
@router.delete("/cache/clear")
async def clear_insights_cache(
    current_user: User = Depends(get_current_user)
):
    """Clear all insights cache"""
    from app.core.redis_cache import redis_cache
    
    try:
        cleared_count = 0
        
        # Clear news cache
        async for key in redis_cache.scan_iter("news:*"):
            await redis_cache.delete(key)
            cleared_count += 1
        
        # Clear sentiment cache
        async for key in redis_cache.scan_iter("sentiment:*"):
            await redis_cache.delete(key)
            cleared_count += 1
        
        # Clear technical cache
        async for key in redis_cache.scan_iter("technical:*"):
            await redis_cache.delete(key)
            cleared_count += 1
        
        return {
            "message": "Cache cleared successfully",
            "keys_cleared": cleared_count
        }
    except Exception as e:
        return {"error": str(e)}