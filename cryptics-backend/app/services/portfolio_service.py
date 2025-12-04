# app/services/portfolio_service.py
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Dict, Optional
from fastapi import HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from uuid import UUID

from app.models.portfolio import Transaction
from app.schemas.portfolio_schema import (
    TransactionCreate, HoldingResponse,
    PortfolioSummaryResponse, PerformanceMetrics,
    PortfolioAnalytics, RiskMetrics, PortfolioAllocation,
    TransactionTypeEnum
)
from app.services.binance_service import BinanceService
from app.core.redis_cache import cache_delete

class PortfolioService:
    
    @staticmethod
    async def add_transaction(db: Session, user_id: UUID, data: TransactionCreate) -> Transaction:
        """Record a buy/sell transaction"""
        symbol_info = await BinanceService.get_symbol_info(data.symbol)
        if not symbol_info:
            raise HTTPException(status_code=400, detail=f"Symbol {data.symbol} not found")
        
        # Calculate total
        if data.transaction_type == TransactionTypeEnum.BUY:
            total = (data.quantity * data.price) + data.fee
        else:  # SELL
            total = (data.quantity * data.price) - data.fee
        
        transaction = Transaction(
            user_id=user_id,
            symbol=data.symbol,
            transaction_type=data.transaction_type,
            quantity=data.quantity,
            price=data.price,
            fee=data.fee,
            total=total,
            notes=data.notes,
            executed_at=data.executed_at or datetime.utcnow()
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        await cache_delete(f"portfolio:{user_id}")
        return transaction
    
    @staticmethod
    def get_transactions(
        db: Session,
        user_id: UUID,
        symbol: Optional[str] = None,
        transaction_type: Optional[TransactionTypeEnum] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict:
        """Get transaction history with filters"""
        query = db.query(Transaction).filter(Transaction.user_id == user_id)
        
        if symbol:
            query = query.filter(Transaction.symbol == symbol.upper())
        if transaction_type:
            query = query.filter(Transaction.transaction_type == transaction_type)
        if start_date:
            query = query.filter(Transaction.executed_at >= start_date)
        if end_date:
            query = query.filter(Transaction.executed_at <= end_date)
        
        total = query.count()
        transactions = query.order_by(Transaction.executed_at.desc()).limit(limit).offset(offset).all()
        
        return {
            "transactions": transactions,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    
    @staticmethod
    async def get_holdings(db: Session, user_id: UUID) -> List[HoldingResponse]:
        """Calculate current holdings from transactions"""
        transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id
        ).order_by(Transaction.executed_at).all()
        
        if not transactions:
            return []
        
        # Calculate holdings per symbol
        holdings_data = defaultdict(lambda: {
            'quantity': 0.0,
            'total_cost': 0.0
        })
        
        for tx in transactions:
            if tx.transaction_type == TransactionTypeEnum.BUY:
                holdings_data[tx.symbol]['quantity'] += tx.quantity
                holdings_data[tx.symbol]['total_cost'] += tx.total
            elif tx.transaction_type == TransactionTypeEnum.SELL:
                holdings_data[tx.symbol]['quantity'] -= tx.quantity
                # Reduce cost basis proportionally
                if holdings_data[tx.symbol]['quantity'] > 0:
                    cost_reduction = (tx.quantity / (holdings_data[tx.symbol]['quantity'] + tx.quantity)) * holdings_data[tx.symbol]['total_cost']
                    holdings_data[tx.symbol]['total_cost'] -= cost_reduction
        
        # Get current prices and calculate
        holdings = []
        total_portfolio_value = 0.0
        
        for symbol, data in holdings_data.items():
            if data['quantity'] <= 0.000001:
                continue
            
            price_data = await BinanceService.get_price(symbol)
            current_price = float(price_data.get('price', 0)) if price_data else 0
            
            current_value = data['quantity'] * current_price
            average_buy_price = data['total_cost'] / data['quantity'] if data['quantity'] > 0 else 0
            cost_basis = data['total_cost']
            unrealized_pnl = current_value - cost_basis
            unrealized_pnl_percent = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0
            
            total_portfolio_value += current_value
            
            holdings.append(HoldingResponse(
                symbol=symbol,
                total_quantity=round(data['quantity'], 8),
                average_buy_price=round(average_buy_price, 8),
                current_price=round(current_price, 8),
                current_value=round(current_value, 2),
                cost_basis=round(cost_basis, 2),
                unrealized_pnl=round(unrealized_pnl, 2),
                unrealized_pnl_percent=round(unrealized_pnl_percent, 2),
                allocation_percent=0.0
            ))
        
        # Calculate allocation
        for holding in holdings:
            holding.allocation_percent = round(
                (holding.current_value / total_portfolio_value * 100) if total_portfolio_value > 0 else 0, 2
            )
        
        holdings.sort(key=lambda x: x.current_value, reverse=True)
        return holdings
    
    @staticmethod
    async def get_portfolio_summary(db: Session, user_id: UUID) -> PortfolioSummaryResponse:
        """Get complete portfolio summary"""
        holdings = await PortfolioService.get_holdings(db, user_id)
        
        total_value = sum(h.current_value for h in holdings)
        total_cost = sum(h.cost_basis for h in holdings)
        total_pnl = total_value - total_cost
        total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
        
        return PortfolioSummaryResponse(
            total_value=round(total_value, 2),
            total_cost=round(total_cost, 2),
            total_pnl=round(total_pnl, 2),
            total_pnl_percent=round(total_pnl_percent, 2),
            holdings=holdings,
            cash_balance=0.0
        )
    
    @staticmethod
    async def get_performance(db: Session, user_id: UUID, period: str = "30d") -> PerformanceMetrics:
        """Calculate portfolio performance over a period"""
        end_date = datetime.utcnow()
        
        if period == "24h":
            start_date = end_date - timedelta(days=1)
        elif period == "7d":
            start_date = end_date - timedelta(days=7)
        elif period == "30d":
            start_date = end_date - timedelta(days=30)
        elif period == "90d":
            start_date = end_date - timedelta(days=90)
        else:  # "all"
            start_date = db.query(func.min(Transaction.executed_at)).filter(
                Transaction.user_id == user_id
            ).scalar() or end_date
        
        transactions = db.query(Transaction).filter(
            and_(
                Transaction.user_id == user_id,
                Transaction.executed_at >= start_date
            )
        ).all()
        
        current_summary = await PortfolioService.get_portfolio_summary(db, user_id)
        ending_value = current_summary.total_value
        
        period_pnl = sum(
            tx.total * (-1 if tx.transaction_type == TransactionTypeEnum.BUY else 1)
            for tx in transactions
        )
        starting_value = ending_value - period_pnl
        
        absolute_return = ending_value - starting_value
        percent_return = (absolute_return / starting_value * 100) if starting_value > 0 else 0
        
        best_asset = max(current_summary.holdings, key=lambda x: x.unrealized_pnl_percent, default=None)
        worst_asset = min(current_summary.holdings, key=lambda x: x.unrealized_pnl_percent, default=None)
        
        total_fees = sum(tx.fee for tx in transactions)
        
        return PerformanceMetrics(
            period=period,
            start_date=start_date,
            end_date=end_date,
            starting_value=round(starting_value, 2),
            ending_value=round(ending_value, 2),
            absolute_return=round(absolute_return, 2),
            percent_return=round(percent_return, 2),
            best_performing_asset=best_asset.symbol if best_asset else None,
            best_performance_percent=best_asset.unrealized_pnl_percent if best_asset else None,
            worst_performing_asset=worst_asset.symbol if worst_asset else None,
            worst_performance_percent=worst_asset.unrealized_pnl_percent if worst_asset else None,
            total_transactions=len(transactions),
            total_fees_paid=round(total_fees, 2)
        )
    
    @staticmethod
    async def get_analytics(db: Session, user_id: UUID) -> PortfolioAnalytics:
        """Get advanced portfolio analytics"""
        summary = await PortfolioService.get_portfolio_summary(db, user_id)
        holdings = summary.holdings
        
        if not holdings:
            raise HTTPException(status_code=404, detail="No holdings found")
        
        allocation = [
            PortfolioAllocation(
                symbol=h.symbol,
                value=h.current_value,
                percent=h.allocation_percent,
                quantity=h.total_quantity
            )
            for h in holdings
        ]
        
        # Calculate HHI for concentration
        hhi = sum((h.allocation_percent / 100) ** 2 for h in holdings)
        
        volatility = sum(abs(h.unrealized_pnl_percent) for h in holdings) / len(holdings) if holdings else 0
        max_drawdown = min(h.unrealized_pnl for h in holdings)
        max_drawdown_percent = min(h.unrealized_pnl_percent for h in holdings)
        
        risk_metrics = RiskMetrics(
            volatility=round(volatility, 2),
            sharpe_ratio=None,
            max_drawdown=round(max_drawdown, 2),
            max_drawdown_percent=round(max_drawdown_percent, 2),
            concentration_risk=round(hhi, 4)
        )
        
        diversification_score = round((1 - hhi) * 100, 2)
        top_holdings = holdings[:5]
        
        return PortfolioAnalytics(
            allocation=allocation,
            risk_metrics=risk_metrics,
            top_holdings=top_holdings,
            diversification_score=diversification_score
        )