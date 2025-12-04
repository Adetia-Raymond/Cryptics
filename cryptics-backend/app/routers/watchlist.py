# app/routers/watchlist.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.utils.jwt import get_current_user
from app.models.user import User
from app.schemas.watchlist_schema import (
    WatchlistItemCreate, WatchlistItemUpdate, WatchlistItemResponse,
    AlertCreate, AlertUpdate, AlertResponse,
    UserPreferencesUpdate, UserPreferencesResponse
)
from app.services.watchlist_service import WatchlistService

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])

# ==================== USER PREFERENCES (MUST BE BEFORE /{item_id}) ====================

@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get your personalized preferences"""
    return WatchlistService.get_preferences(db, current_user.id)


@router.patch("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update your preferences"""
    return await WatchlistService.update_preferences(db, current_user.id, data)


# ==================== ALERTS (MUST BE BEFORE /{item_id}) ====================

@router.post("/alerts", response_model=AlertResponse, status_code=201)
async def create_alert(
    data: AlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a price or indicator alert"""
    return await WatchlistService.create_alert(db, current_user.id, data)


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    active_only: bool = Query(True, description="Only return active alerts"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all your alerts"""
    return WatchlistService.get_alerts(db, current_user.id, active_only)


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: str,
    data: AlertUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an alert (enable/disable, change threshold, etc.)"""
    from uuid import UUID
    return WatchlistService.update_alert(db, current_user.id, UUID(alert_id), data)


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an alert"""
    from uuid import UUID
    WatchlistService.delete_alert(db, current_user.id, UUID(alert_id))


# ==================== WATCHLIST (/{item_id} ROUTES MUST BE LAST) ====================

@router.post("/", response_model=WatchlistItemResponse, status_code=201)
async def add_to_watchlist(
    data: WatchlistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a trading pair to your watchlist"""
    return await WatchlistService.add_to_watchlist(db, current_user.id, data)


@router.get("/", response_model=List[dict])
async def get_watchlist(
    include_market_data: bool = Query(True, description="Include current price and 24h data"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get your watchlist with optional real-time market data"""
    return await WatchlistService.get_watchlist(db, current_user.id, include_market_data)


@router.patch("/{item_id}", response_model=WatchlistItemResponse)
async def update_watchlist_item(
    item_id: str,
    data: WatchlistItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update notes or active status for a watchlist item"""
    from uuid import UUID
    return await WatchlistService.update_watchlist_item(db, current_user.id, UUID(item_id), data)


@router.delete("/{item_id}", status_code=204)
async def remove_from_watchlist(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a symbol from your watchlist"""
    from uuid import UUID
    await WatchlistService.remove_from_watchlist(db, current_user.id, UUID(item_id))