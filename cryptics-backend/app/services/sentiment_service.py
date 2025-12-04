# app/services/sentiment_service.py
from typing import List, Dict
from datetime import datetime
import json
from transformers import pipeline
from app.services.news_service import NewsService
from app.schemas.insights_schema import SentimentType, SentimentAnalysisResponse, NewsArticle
from app.core.redis_cache import cache_get, cache_set

class SentimentService:
    """Service for sentiment analysis using FinBERT"""
    
    # Load FinBERT model (lazy loading)
    _sentiment_analyzer = None
    
    @classmethod
    def _get_analyzer(cls):
        """Lazy load the sentiment analyzer"""
        if cls._sentiment_analyzer is None:
            print("Loading FinBERT model...")
            cls._sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="ProsusAI/finbert",
                tokenizer="ProsusAI/finbert"
            )
            print("FinBERT model loaded successfully")
        return cls._sentiment_analyzer
    
    @staticmethod
    async def analyze_sentiment(symbol: str, limit: int = 10) -> SentimentAnalysisResponse:
        """
        Analyze sentiment for a cryptocurrency using news articles
        
        Args:
            symbol: Crypto symbol (e.g., BTCUSDT)
            limit: Number of articles to analyze
            
        Returns:
            SentimentAnalysisResponse with aggregated sentiment
        """
        
        # Check cache (15 minutes)
        cache_key = f"sentiment:{symbol}:{limit}"
        cached = await cache_get(cache_key)
        if cached:
            data = json.loads(cached)
            return SentimentAnalysisResponse(**data)
        
        # Fetch news
        news_articles = await NewsService.get_news(symbol=symbol, limit=limit)
        
        if not news_articles:
            # No news available - possibly due to upstream throttle; check throttle flag
            throttled = await cache_get("cryptopanic:throttled")
            if throttled:
                summary = "Sentiment unavailable: external news API quota exceeded. Using neutral fallback."
                resp = SentimentService._create_neutral_response(symbol)
                resp.summary = summary
                return resp
            # otherwise return neutral
            return SentimentService._create_neutral_response(symbol)
        
        # Analyze each article
        analyzer = SentimentService._get_analyzer()
        analyzed_articles = []
        
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        total_score = 0.0
        
        for article in news_articles:
            title = article.get("title", "")
            
            if not title:
                continue
            
            try:
                # Truncate title if too long (FinBERT max is 512 tokens)
                if len(title) > 500:
                    title = title[:500]
                
                # Analyze sentiment
                result = analyzer(title)[0]
                label = result['label'].lower()
                score = result['score']
                
                # Map FinBERT labels to our sentiment types
                if label == 'positive':
                    sentiment = SentimentType.POSITIVE
                    sentiment_score = score
                    positive_count += 1
                elif label == 'negative':
                    sentiment = SentimentType.NEGATIVE
                    sentiment_score = -score
                    negative_count += 1
                else:  # neutral
                    sentiment = SentimentType.NEUTRAL
                    sentiment_score = 0.0
                    neutral_count += 1
                
                total_score += sentiment_score
                
                analyzed_articles.append(NewsArticle(
                    title=article.get("title", ""),
                    source=article.get("source", "Unknown"),
                    published_at=datetime.fromisoformat(article.get("published_at", datetime.utcnow().isoformat()).replace('Z', '+00:00')),
                    url=article.get("url"),
                    sentiment=sentiment,
                    sentiment_score=round(sentiment_score, 2)
                ))
                
            except Exception as e:
                print(f"Error analyzing article: {e}")
                continue
        
        # Calculate overall sentiment
        if analyzed_articles:
            avg_score = total_score / len(analyzed_articles)
            
            if avg_score > 0.2:
                overall_sentiment = SentimentType.POSITIVE
            elif avg_score < -0.2:
                overall_sentiment = SentimentType.NEGATIVE
            else:
                overall_sentiment = SentimentType.NEUTRAL
        else:
            overall_sentiment = SentimentType.NEUTRAL
            avg_score = 0.0
        
        # Generate summary
        summary = SentimentService._generate_summary(
            overall_sentiment,
            positive_count,
            negative_count,
            neutral_count
        )
        
        response = SentimentAnalysisResponse(
            symbol=symbol,
            overall_sentiment=overall_sentiment,
            sentiment_score=round(avg_score, 2),
            news_count=len(analyzed_articles),
            positive_count=positive_count,
            negative_count=negative_count,
            neutral_count=neutral_count,
            articles=analyzed_articles[:10],  # Limit to top 10
            summary=summary,
            timestamp=datetime.utcnow()
        )
        
        # Cache for 15 minutes
        await cache_set(cache_key, response.json(), expire_seconds=900)
        
        return response
    
    @staticmethod
    def _create_neutral_response(symbol: str) -> SentimentAnalysisResponse:
        """Create a neutral response when no news is available"""
        return SentimentAnalysisResponse(
            symbol=symbol,
            overall_sentiment=SentimentType.NEUTRAL,
            sentiment_score=0.0,
            news_count=0,
            positive_count=0,
            negative_count=0,
            neutral_count=0,
            articles=[],
            summary="No recent news available for sentiment analysis",
            timestamp=datetime.utcnow()
        )
    
    @staticmethod
    def _generate_summary(
        overall_sentiment: SentimentType,
        positive_count: int,
        negative_count: int,
        neutral_count: int
    ) -> str:
        """Generate human-readable summary of sentiment"""
        
        total = positive_count + negative_count + neutral_count
        
        if total == 0:
            return "No news analyzed"
        
        pos_pct = (positive_count / total) * 100
        neg_pct = (negative_count / total) * 100
        
        if overall_sentiment == SentimentType.POSITIVE:
            return f"Market sentiment is positive. {positive_count} out of {total} articles show positive sentiment ({pos_pct:.0f}%)."
        elif overall_sentiment == SentimentType.NEGATIVE:
            return f"Market sentiment is negative. {negative_count} out of {total} articles show negative sentiment ({neg_pct:.0f}%)."
        else:
            return f"Market sentiment is neutral. Mixed signals with {positive_count} positive and {negative_count} negative articles."