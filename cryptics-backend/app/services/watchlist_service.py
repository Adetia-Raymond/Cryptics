# app/services/watchlist_service.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Dict
from fastapi import HTTPException
from uuid import UUID
import json

from app.models.watchlist import Watchlist, Alert, UserPreferences
from app.schemas.watchlist_schema import (
    WatchlistItemCreate, WatchlistItemUpdate,
    AlertCreate, AlertUpdate,
    UserPreferencesUpdate,
    TimeframeEnum, RiskProfileEnum
)
from app.core.redis_cache import cache_get, cache_set, cache_delete
from app.services.binance_service import BinanceService

class WatchlistService:
    
    @staticmethod
    async def add_to_watchlist(db: Session, user_id: UUID, data: WatchlistItemCreate) -> Watchlist:
        """Add a symbol to user's watchlist"""
        # Verify symbol exists
        symbol_info = await BinanceService.get_symbol_info(data.symbol)
        if not symbol_info:
            raise HTTPException(status_code=400, detail=f"Symbol {data.symbol} not found on Binance")
        
        # Check for duplicates
        existing = db.query(Watchlist).filter(
            and_(
                Watchlist.user_id == user_id,
                Watchlist.symbol == data.symbol
            )
        ).first()
        
        if existing:
            if not existing.is_active:
                existing.is_active = True
                existing.notes = data.notes
                db.commit()
                db.refresh(existing)
                return existing
            raise HTTPException(status_code=400, detail=f"{data.symbol} already in watchlist")
        
        # Create new
        watchlist_item = Watchlist(
            user_id=user_id,
            symbol=data.symbol,
            notes=data.notes
        )
        db.add(watchlist_item)
        db.commit()
        db.refresh(watchlist_item)
        
        await cache_delete(f"watchlist:{user_id}")
        return watchlist_item
    
    @staticmethod
    async def get_watchlist(db: Session, user_id: UUID, include_market_data: bool = True) -> List[Dict]:
        """Get user's watchlist with optional market data"""
        cache_key = f"watchlist:{user_id}:{include_market_data}"
        
        # Check cache
        cached = await cache_get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Query DB
        items = db.query(Watchlist).filter(
            and_(
                Watchlist.user_id == user_id,
                Watchlist.is_active == True
            )
        ).order_by(Watchlist.created_at.desc()).all()
        
        result = []
        for item in items:
            item_dict = {
                "id": str(item.id),
                "symbol": item.symbol,
                "notes": item.notes,
                "is_active": item.is_active,
                "created_at": item.created_at.isoformat(),
                "updated_at": item.updated_at.isoformat() if item.updated_at else None
            }
            
            if include_market_data:
                price_data = await BinanceService.get_price(item.symbol)
                ticker_data = await BinanceService.get_24h_ticker(item.symbol)
                
                if price_data:
                    item_dict["current_price"] = float(price_data.get("price", 0))
                if ticker_data:
                    item_dict["price_change_24h"] = float(ticker_data.get("priceChangePercent", 0))
                    item_dict["volume_24h"] = float(ticker_data.get("volume", 0))
                    item_dict["high_24h"] = float(ticker_data.get("highPrice", 0))
                    item_dict["low_24h"] = float(ticker_data.get("lowPrice", 0))
            
            result.append(item_dict)
        
        await cache_set(cache_key, json.dumps(result), expire_seconds=60)
        return result
    
    @staticmethod
    async def update_watchlist_item(db: Session, user_id: UUID, item_id: UUID, data: WatchlistItemUpdate) -> Watchlist:
        """Update a watchlist item"""
        item = db.query(Watchlist).filter(
            and_(Watchlist.id == item_id, Watchlist.user_id == user_id)
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Watchlist item not found")
        
        if data.notes is not None:
            item.notes = data.notes
        if data.is_active is not None:
            item.is_active = data.is_active
        
        db.commit()
        db.refresh(item)
        
        await cache_delete(f"watchlist:{user_id}")
        return item
    
    @staticmethod
    async def remove_from_watchlist(db: Session, user_id: UUID, item_id: UUID):
        """Remove a symbol from watchlist"""
        item = db.query(Watchlist).filter(
            and_(Watchlist.id == item_id, Watchlist.user_id == user_id)
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Watchlist item not found")
        
        item.is_active = False
        db.commit()
        
        await cache_delete(f"watchlist:{user_id}")
    
    # ==================== ALERTS ====================
    
    @staticmethod
    async def create_alert(db: Session, user_id: UUID, data: AlertCreate) -> Alert:
        """Create a price/indicator alert"""
        symbol_info = await BinanceService.get_symbol_info(data.symbol)
        if not symbol_info:
            raise HTTPException(status_code=400, detail=f"Symbol {data.symbol} not found")
        
        alert = Alert(
            user_id=user_id,
            symbol=data.symbol,
            alert_type=data.alert_type,
            threshold=data.threshold,
            message=data.message,
            is_recurring=data.is_recurring
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert
    
    @staticmethod
    def get_alerts(db: Session, user_id: UUID, active_only: bool = True) -> List[Alert]:
        """Get user's alerts"""
        query = db.query(Alert).filter(Alert.user_id == user_id)
        if active_only:
            query = query.filter(Alert.is_active == True)
        return query.order_by(Alert.created_at.desc()).all()
    
    @staticmethod
    def update_alert(db: Session, user_id: UUID, alert_id: UUID, data: AlertUpdate) -> Alert:
        """Update an alert"""
        alert = db.query(Alert).filter(
            and_(Alert.id == alert_id, Alert.user_id == user_id)
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        if data.is_active is not None:
            alert.is_active = data.is_active
        if data.threshold is not None:
            alert.threshold = data.threshold
        if data.message is not None:
            alert.message = data.message
        
        db.commit()
        db.refresh(alert)
        return alert
    
    @staticmethod
    def delete_alert(db: Session, user_id: UUID, alert_id: UUID):
        """Delete an alert"""
        alert = db.query(Alert).filter(
            and_(Alert.id == alert_id, Alert.user_id == user_id)
        ).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        db.delete(alert)
        db.commit()
    
    # ==================== PREFERENCES ====================
    
    @staticmethod
    def get_preferences(db: Session, user_id: UUID) -> UserPreferences:
        """Get user preferences, create default if not exists"""
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        
        if not prefs:
            prefs = UserPreferences(
                user_id=user_id,
                default_timeframe=TimeframeEnum.ONE_HOUR,
                default_chart_type="candlestick",
                risk_profile=RiskProfileEnum.MODERATE,
                max_position_size_percent=10.0
            )
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
        
        return prefs
    
    @staticmethod
    async def update_preferences(db: Session, user_id: UUID, data: UserPreferencesUpdate) -> UserPreferences:
        """Update user preferences"""
        prefs = WatchlistService.get_preferences(db, user_id)
        
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prefs, field, value)
        
        db.commit()
        db.refresh(prefs)
        
        await cache_delete(f"preferences:{user_id}")
        return prefs