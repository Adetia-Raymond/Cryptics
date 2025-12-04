# app/services/insights_service.py
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.services.technical_service import TechnicalService
from app.services.sentiment_service import SentimentService
from app.services.binance_service import BinanceService
from app.models.watchlist import UserPreferences
from app.schemas.insights_schema import (
    TradingSignal, InsightResponse, SignalType, RiskLevel,
    MarketOpportunity, OpportunitiesResponse,
    WatchlistInsight, WatchlistInsightsResponse
)

class InsightsService:
    """Main service that combines technical analysis, sentiment, and user preferences"""
    
    @staticmethod
    async def get_signal(symbol: str, user_id: Optional[UUID] = None, db: Optional[Session] = None) -> InsightResponse:
        """
        Get comprehensive trading signal for a symbol
        
        Args:
            symbol: Trading pair (e.g., BTCUSDT)
            user_id: User ID for personalized recommendations
            db: Database session for user preferences
            
        Returns:
            InsightResponse with technical, sentiment, and combined signal
        """
        
        # Get technical analysis
        technical = await TechnicalService.analyze(symbol)
        
        # Get sentiment analysis (with error handling)
        try:
            sentiment = await SentimentService.analyze_sentiment(symbol, limit=10)
        except Exception as e:
            print(f"Sentiment analysis failed: {e}")
            sentiment = None
        
        # Get current price
        price_data = await BinanceService.get_price(symbol)
        current_price = float(price_data.get('price', 0)) if price_data else 0
        
        # Get 24h change
        ticker_data = await BinanceService.get_24h_ticker(symbol)
        price_change_24h = float(ticker_data.get('priceChangePercent', 0)) if ticker_data else 0
        
        # Combine signals
        combined_signal, confidence, risk_level = InsightsService._combine_signals(
            technical_signal=technical.signal,
            technical_confidence=technical.confidence,
            sentiment=sentiment,
            user_risk_profile=None  # TODO: Get from user preferences if provided
        )
        
        # Calculate price targets
        entry_price, target_price, stop_loss = InsightsService._calculate_price_targets(
            current_price=current_price,
            signal=combined_signal,
            bb_upper=technical.indicators.bollinger_upper,
            bb_lower=technical.indicators.bollinger_lower
        )
        
        # Generate reasoning
        reasoning = InsightsService._generate_reasoning(
            technical=technical,
            sentiment=sentiment,
            combined_signal=combined_signal
        )
        
        # Determine suitable risk profiles
        suitable_profiles = InsightsService._get_suitable_profiles(risk_level)
        
        # Create trading signal
        signal = TradingSignal(
            symbol=symbol,
            signal=combined_signal,
            confidence=confidence,
            reasoning=reasoning,
            current_price=current_price,
            entry_price=entry_price,
            target_price=target_price,
            stop_loss=stop_loss,
            risk_level=risk_level,
            suitable_for_profiles=suitable_profiles,
            technical_score=technical.confidence,
            sentiment_score=sentiment.sentiment_score if sentiment else 0,
            timestamp=datetime.utcnow()
        )
        
        return InsightResponse(
            symbol=symbol,
            signal=signal,
            technical_analysis=technical.indicators,
            sentiment=sentiment,
            last_updated=datetime.utcnow()
        )
    
    @staticmethod
    def _combine_signals(
        technical_signal: SignalType,
        technical_confidence: int,
        sentiment,
        user_risk_profile: Optional[str]
    ) -> tuple[SignalType, int, RiskLevel]:
        """Combine technical and sentiment signals into final recommendation.

        If sentiment is present but contains zero articles (or explicitly indicates
        it is unavailable), we treat sentiment as unavailable and favor the
        technical signal so that neutral/empty sentiment doesn't dilute a strong
        technical signal.
        """

        # Inspect sentiment object to decide availability
        sentiment_available = False
        sentiment_score = 0.0
        try:
            if sentiment is not None:
                sentiment_score = float(getattr(sentiment, 'sentiment_score', 0.0) or 0.0)
                news_count = getattr(sentiment, 'news_count', None)
                summary = (getattr(sentiment, 'summary', None) or '').lower()
                articles = getattr(sentiment, 'articles', None)

                # If there are articles or a positive news_count, consider sentiment available
                if (news_count and news_count > 0) or (articles and len(articles) > 0):
                    sentiment_available = True
                # If summary explicitly says 'unavailable' (throttled), treat as unavailable
                elif 'unavailable' in summary:
                    sentiment_available = False
                else:
                    # No articles/news -> treat as unavailable
                    sentiment_available = False
        except Exception:
            sentiment_available = False

        if not sentiment_available:
            technical_weight = 1.0
            sentiment_weight = 0.0
        else:
            technical_weight = 0.7
            sentiment_weight = 0.3

        # Convert technical signal to base score (-1 to 1)
        technical_score_map = {
            SignalType.STRONG_BUY: 1.0,
            SignalType.BUY: 0.5,
            SignalType.HOLD: 0.0,
            SignalType.SELL: -0.5,
            SignalType.STRONG_SELL: -1.0
        }
        base_tech_score = technical_score_map.get(technical_signal, 0)

        # Scale technical score by the reported technical confidence (0-100)
        tech_conf_factor = max(0.0, min(float(technical_confidence) / 100.0, 1.0)) if technical_confidence is not None else 1.0
        technical_score = base_tech_score * tech_conf_factor

        # Combine scores
        combined_score = (technical_score * technical_weight) + ((sentiment_score or 0.0) * sentiment_weight)

        # Determine signal thresholds
        if combined_score >= 0.6:
            final_signal = SignalType.STRONG_BUY
        elif combined_score >= 0.2:
            final_signal = SignalType.BUY
        elif combined_score <= -0.6:
            final_signal = SignalType.STRONG_SELL
        elif combined_score <= -0.2:
            final_signal = SignalType.SELL
        else:
            final_signal = SignalType.HOLD

        # Calculate confidence: if sentiment not available, fall back to technical confidence
        if not sentiment_available:
            confidence = int(max(0, min(int(technical_confidence or 0), 100)))
        else:
            confidence = int(min(abs(combined_score) * 100, 100))

        # Determine risk level using combined score magnitude
        abs_score = abs(combined_score)
        if abs_score > 0.7:
            risk_level = RiskLevel.HIGH
        elif abs_score > 0.4:
            risk_level = RiskLevel.MODERATE
        else:
            risk_level = RiskLevel.LOW

        return final_signal, confidence, risk_level
    
    @staticmethod
    def _calculate_price_targets(
        current_price: float,
        signal: SignalType,
        bb_upper: float,
        bb_lower: float
    ) -> tuple[Optional[float], Optional[float], Optional[float]]:
        """Calculate entry, target, and stop loss prices"""
        
        if signal in [SignalType.STRONG_BUY, SignalType.BUY]:
            entry_price = current_price
            target_price = bb_upper  # Use Bollinger upper band as target
            stop_loss = bb_lower  # Use Bollinger lower band as stop loss
        elif signal in [SignalType.STRONG_SELL, SignalType.SELL]:
            entry_price = current_price
            target_price = bb_lower
            stop_loss = bb_upper
        else:  # HOLD
            entry_price = None
            target_price = None
            stop_loss = None
        
        return (
            round(entry_price, 2) if entry_price else None,
            round(target_price, 2) if target_price else None,
            round(stop_loss, 2) if stop_loss else None
        )
    
    @staticmethod
    def _generate_reasoning(technical, sentiment, combined_signal: SignalType) -> str:
        """Generate human-readable reasoning for the signal"""
        
        reasons = []
        
        # Technical reasoning
        if technical.indicators.rsi < 30:
            reasons.append("RSI shows oversold conditions")
        elif technical.indicators.rsi > 70:
            reasons.append("RSI shows overbought conditions")
        
        if "Bullish" in technical.indicators.macd_interpretation:
            reasons.append("MACD indicates bullish momentum")
        elif "Bearish" in technical.indicators.macd_interpretation:
            reasons.append("MACD indicates bearish momentum")
        
        # Sentiment reasoning
        if sentiment:
            if sentiment.overall_sentiment.value == "positive":
                reasons.append(f"Positive market sentiment ({sentiment.positive_count}/{sentiment.news_count} articles)")
            elif sentiment.overall_sentiment.value == "negative":
                reasons.append(f"Negative market sentiment ({sentiment.negative_count}/{sentiment.news_count} articles)")
        
        # Combined reasoning
        signal_text = combined_signal.value.replace('_', ' ').title()
        
        if reasons:
            return f"{signal_text} signal based on: " + ", ".join(reasons)
        else:
            return f"{signal_text} signal based on technical analysis"
    
    @staticmethod
    def _get_suitable_profiles(risk_level: RiskLevel) -> List[str]:
        """Determine which risk profiles this signal is suitable for"""
        
        if risk_level == RiskLevel.LOW:
            return ["conservative", "moderate", "aggressive"]
        elif risk_level == RiskLevel.MODERATE:
            return ["moderate", "aggressive"]
        else:  # HIGH
            return ["aggressive"]
    
    @staticmethod
    async def get_opportunities(
        user_id: UUID,
        db: Session,
        limit: int = 10
    ) -> OpportunitiesResponse:
        """
        Find trading opportunities based on user's risk profile
        
        Scans popular trading pairs and returns top opportunities
        """
        
        # Get user's risk profile
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        risk_profile = prefs.risk_profile if prefs else "moderate"
        
        # Popular trading pairs to scan
        symbols = [
            "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT",
            "DOGEUSDT", "SOLUSDT", "MATICUSDT", "DOTUSDT", "AVAXUSDT"
        ]
        
        opportunities = []
        
        for symbol in symbols:
            try:
                # Get technical analysis
                technical = await TechnicalService.analyze(symbol)
                
                # Get price data
                price_data = await BinanceService.get_price(symbol)
                current_price = float(price_data.get('price', 0)) if price_data else 0
                
                ticker_data = await BinanceService.get_24h_ticker(symbol)
                price_change_24h = float(ticker_data.get('priceChangePercent', 0)) if ticker_data else 0
                
                # Filter by signal strength
                if technical.signal in [SignalType.STRONG_BUY, SignalType.BUY, SignalType.STRONG_SELL, SignalType.SELL]:
                    _, _, risk_level = InsightsService._combine_signals(
                        technical.signal,
                        technical.confidence,
                        0,  # No sentiment for speed
                        risk_profile
                    )
                    
                    # Filter by user's risk profile
                    suitable_profiles = InsightsService._get_suitable_profiles(risk_level)
                    if risk_profile in suitable_profiles:
                        opportunities.append(MarketOpportunity(
                            symbol=symbol,
                            signal=technical.signal,
                            confidence=technical.confidence,
                            reason=technical.summary[:100],  # Truncate
                            current_price=current_price,
                            price_change_24h=price_change_24h,
                            risk_level=risk_level
                        ))
            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")
                continue
        
        # Sort by confidence
        opportunities.sort(key=lambda x: x.confidence, reverse=True)
        
        return OpportunitiesResponse(
            opportunities=opportunities[:limit],
            based_on_risk_profile=risk_profile,
            total_analyzed=len(symbols),
            timestamp=datetime.utcnow()
        )