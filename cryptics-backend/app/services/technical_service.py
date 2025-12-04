# app/services/technical_service.py
import pandas as pd
import numpy as np
from ta.momentum import RSIIndicator
from ta.trend import MACD, SMAIndicator
from ta.volatility import BollingerBands
from ta.volume import VolumeWeightedAveragePrice
from typing import Dict, List
from datetime import datetime

from app.services.binance_service import BinanceService
from app.schemas.insights_schema import SignalType, TechnicalIndicators, TechnicalAnalysisResponse

class TechnicalService:
    """Service for technical analysis calculations"""
    
    @staticmethod
    async def analyze(symbol: str, interval: str = "1h", limit: int = 100) -> TechnicalAnalysisResponse:
        """
        Perform comprehensive technical analysis on a symbol
        
        Args:
            symbol: Trading pair (e.g., BTCUSDT)
            interval: Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
            limit: Number of candles to analyze
            
        Returns:
            TechnicalAnalysisResponse with all indicators and signals
        """
        
        # Fetch OHLCV data from Binance
        klines = await TechnicalService._fetch_klines(symbol, interval, limit)
        
        if not klines or len(klines) < 50:
            raise Exception(f"Insufficient data for {symbol}")
        
        # Convert to DataFrame
        df = pd.DataFrame(klines, columns=[
            'timestamp', 'open', 'high', 'low', 'close', 'volume',
            'close_time', 'quote_volume', 'trades', 'taker_buy_base',
            'taker_buy_quote', 'ignore'
        ])
        
        # Convert to numeric
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col])
        
        # Calculate indicators
        indicators = TechnicalService._calculate_indicators(df)
        
        # Generate signal
        signal, confidence = TechnicalService._generate_signal(indicators, df)
        
        # Generate summary
        summary = TechnicalService._generate_summary(signal, indicators)
        
        return TechnicalAnalysisResponse(
            symbol=symbol,
            signal=signal,
            confidence=confidence,
            indicators=indicators,
            summary=summary,
            timestamp=datetime.utcnow()
        )
    
    @staticmethod
    async def _fetch_klines(symbol: str, interval: str, limit: int) -> List:
        """Fetch klines from Binance API"""
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.binance.com/api/v3/klines",
                    params={
                        "symbol": symbol,
                        "interval": interval,
                        "limit": limit
                    }
                )
                return response.json()
        except Exception as e:
            print(f"Error fetching klines: {e}")
            return []
    
    @staticmethod
    def _calculate_indicators(df: pd.DataFrame) -> TechnicalIndicators:
        """Calculate all technical indicators"""
        
        # RSI
        rsi_indicator = RSIIndicator(close=df['close'], window=14)
        rsi_value = rsi_indicator.rsi().iloc[-1]
        
        if rsi_value > 70:
            rsi_signal = "Overbought - potential sell signal"
        elif rsi_value < 30:
            rsi_signal = "Oversold - potential buy signal"
        else:
            rsi_signal = "Neutral"
        
        # MACD
        macd_indicator = MACD(close=df['close'])
        macd_value = macd_indicator.macd().iloc[-1]
        macd_signal_value = macd_indicator.macd_signal().iloc[-1]
        macd_histogram = macd_value - macd_signal_value
        
        if macd_value > macd_signal_value and macd_histogram > 0:
            macd_interpretation = "Bullish - MACD above signal line"
        elif macd_value < macd_signal_value and macd_histogram < 0:
            macd_interpretation = "Bearish - MACD below signal line"
        else:
            macd_interpretation = "Neutral"
        
        # Bollinger Bands
        bollinger = BollingerBands(close=df['close'], window=20, window_dev=2)
        bb_upper = bollinger.bollinger_hband().iloc[-1]
        bb_middle = bollinger.bollinger_mavg().iloc[-1]
        bb_lower = bollinger.bollinger_lband().iloc[-1]
        current_price = df['close'].iloc[-1]
        
        bb_position_pct = ((current_price - bb_lower) / (bb_upper - bb_lower)) * 100
        if bb_position_pct > 80:
            bb_position = "Near upper band - potential resistance"
        elif bb_position_pct < 20:
            bb_position = "Near lower band - potential support"
        else:
            bb_position = "Middle range"
        
        # Moving Averages
        sma_20 = SMAIndicator(close=df['close'], window=20).sma_indicator().iloc[-1]
        sma_50 = SMAIndicator(close=df['close'], window=50).sma_indicator().iloc[-1]
        
        if sma_20 > sma_50:
            sma_trend = "Bullish - Short MA above Long MA"
        elif sma_20 < sma_50:
            sma_trend = "Bearish - Short MA below Long MA"
        else:
            sma_trend = "Neutral"
        
        # Volume Analysis
        volume_sma = SMAIndicator(close=df['volume'], window=20).sma_indicator().iloc[-1]
        current_volume = df['volume'].iloc[-1]
        volume_ratio = (current_volume / volume_sma) if volume_sma > 0 else 1.0
        
        return TechnicalIndicators(
            rsi=round(rsi_value, 2),
            rsi_signal=rsi_signal,
            macd=round(macd_value, 4),
            macd_signal=round(macd_signal_value, 4),
            macd_histogram=round(macd_histogram, 4),
            macd_interpretation=macd_interpretation,
            bollinger_upper=round(bb_upper, 2),
            bollinger_middle=round(bb_middle, 2),
            bollinger_lower=round(bb_lower, 2),
            bollinger_position=bb_position,
            sma_20=round(sma_20, 2),
            sma_50=round(sma_50, 2),
            sma_trend=sma_trend,
            volume_sma=round(volume_sma, 2),
            volume_ratio=round(volume_ratio, 2)
        )
    
    @staticmethod
    def _generate_signal(indicators: TechnicalIndicators, df: pd.DataFrame) -> tuple[SignalType, int]:
        """Generate trading signal based on indicators"""
        
        bullish_signals = 0
        bearish_signals = 0
        total_signals = 0
        
        # RSI analysis
        total_signals += 1
        if indicators.rsi < 30:
            bullish_signals += 1
        elif indicators.rsi > 70:
            bearish_signals += 1
        
        # MACD analysis
        total_signals += 1
        if indicators.macd > indicators.macd_signal and indicators.macd_histogram > 0:
            bullish_signals += 1
        elif indicators.macd < indicators.macd_signal and indicators.macd_histogram < 0:
            bearish_signals += 1
        
        # Moving Average analysis
        total_signals += 1
        if indicators.sma_20 > indicators.sma_50:
            bullish_signals += 1
        elif indicators.sma_20 < indicators.sma_50:
            bearish_signals += 1
        
        # Bollinger Bands analysis
        current_price = df['close'].iloc[-1]
        total_signals += 1
        if current_price < indicators.bollinger_lower:
            bullish_signals += 1
        elif current_price > indicators.bollinger_upper:
            bearish_signals += 1
        
        # Calculate confidence
        if bullish_signals > bearish_signals:
            confidence = int((bullish_signals / total_signals) * 100)
            if bullish_signals >= 3:
                signal = SignalType.STRONG_BUY
            else:
                signal = SignalType.BUY
        elif bearish_signals > bullish_signals:
            confidence = int((bearish_signals / total_signals) * 100)
            if bearish_signals >= 3:
                signal = SignalType.STRONG_SELL
            else:
                signal = SignalType.SELL
        else:
            confidence = 50
            signal = SignalType.HOLD
        
        return signal, confidence
    
    @staticmethod
    def _generate_summary(signal: SignalType, indicators: TechnicalIndicators) -> str:
        """Generate human-readable summary"""
        
        summary_parts = [f"Signal: {signal.value}"]
        
        # RSI
        if indicators.rsi < 30:
            summary_parts.append("RSI indicates oversold conditions")
        elif indicators.rsi > 70:
            summary_parts.append("RSI indicates overbought conditions")
        
        # MACD
        if "Bullish" in indicators.macd_interpretation:
            summary_parts.append("MACD shows bullish momentum")
        elif "Bearish" in indicators.macd_interpretation:
            summary_parts.append("MACD shows bearish momentum")
        
        # Trend
        if "Bullish" in indicators.sma_trend:
            summary_parts.append("Uptrend confirmed by moving averages")
        elif "Bearish" in indicators.sma_trend:
            summary_parts.append("Downtrend confirmed by moving averages")
        
        # Volume
        if indicators.volume_ratio > 1.5:
            summary_parts.append("High volume activity detected")
        
        return ". ".join(summary_parts) + "."