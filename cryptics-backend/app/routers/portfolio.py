# app/routers/portfolio.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.utils.jwt import get_current_user
from app.models.user import User
from app.schemas.portfolio_schema import (
    TransactionCreate, TransactionResponse,
    HoldingResponse, PortfolioSummaryResponse,
    PerformanceMetrics, PortfolioAnalytics,
    TransactionTypeEnum, TransactionHistoryResponse
)
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

# ==================== TRANSACTIONS ====================

@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def add_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a buy or sell transaction"""
    return await PortfolioService.add_transaction(db, current_user.id, data)


@router.get("/transactions", response_model=TransactionHistoryResponse)
async def get_transactions(
    symbol: Optional[str] = Query(None, description="Filter by symbol"),
    transaction_type: Optional[TransactionTypeEnum] = Query(None, description="Filter by type"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(50, ge=1, le=500, description="Number of results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transaction history with filters"""
    result = PortfolioService.get_transactions(
        db=db,
        user_id=current_user.id,
        symbol=symbol,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )
    return TransactionHistoryResponse(**result)


# ==================== HOLDINGS ====================

@router.get("/holdings", response_model=List[HoldingResponse])
async def get_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current portfolio holdings"""
    return await PortfolioService.get_holdings(db, current_user.id)


@router.get("/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete portfolio summary"""
    return await PortfolioService.get_portfolio_summary(db, current_user.id)


# ==================== PERFORMANCE ====================

@router.get("/performance", response_model=PerformanceMetrics)
async def get_performance(
    period: str = Query("30d", regex="^(24h|7d|30d|90d|all)$", description="Time period"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get portfolio performance metrics over time"""
    return await PortfolioService.get_performance(db, current_user.id, period)


# ==================== ANALYTICS ====================

@router.get("/analytics", response_model=PortfolioAnalytics)
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get advanced portfolio analytics"""
    return await PortfolioService.get_analytics(db, current_user.id)


# ==================== QUICK STATS ====================

@router.get("/stats")
async def get_quick_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get quick portfolio statistics for dashboard"""
    summary = await PortfolioService.get_portfolio_summary(db, current_user.id)
    performance = await PortfolioService.get_performance(db, current_user.id, "24h")
    
    return {
        "total_value": summary.total_value,
        "total_pnl": summary.total_pnl,
        "total_pnl_percent": summary.total_pnl_percent,
        "change_24h": performance.absolute_return,
        "change_24h_percent": performance.percent_return,
        "holdings_count": len(summary.holdings),
        "top_holding": summary.holdings[0].symbol if summary.holdings else None
    }