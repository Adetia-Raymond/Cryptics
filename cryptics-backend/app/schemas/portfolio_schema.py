# app/schemas/portfolio_schema.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

# ==================== ENUMS ====================
class TransactionTypeEnum(str, Enum):
    BUY = "buy"
    SELL = "sell"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"

# ==================== TRANSACTION ====================
class TransactionCreate(BaseModel):
    symbol: str = Field(..., description="Trading pair (e.g., BTCUSDT)")
    transaction_type: TransactionTypeEnum
    quantity: float = Field(..., gt=0, description="Amount of asset")
    price: float = Field(..., gt=0, description="Price per unit")
    fee: Optional[float] = Field(0, ge=0, description="Transaction fee")
    notes: Optional[str] = Field(None, max_length=500)
    executed_at: Optional[datetime] = Field(None, description="Execution time, defaults to now")
    
    @validator('symbol')
    def validate_symbol(cls, v):
        return v.upper().strip()
    
    @validator('quantity', 'price', 'fee')
    def round_to_8_decimals(cls, v):
        return round(v, 8)

class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    symbol: str
    transaction_type: TransactionTypeEnum
    quantity: float
    price: float
    fee: float
    total: float
    notes: Optional[str]
    executed_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# ==================== HOLDINGS ====================
class HoldingResponse(BaseModel):
    symbol: str
    total_quantity: float
    average_buy_price: float
    current_price: float
    current_value: float
    cost_basis: float
    unrealized_pnl: float
    unrealized_pnl_percent: float
    allocation_percent: float

class PortfolioSummaryResponse(BaseModel):
    total_value: float
    total_cost: float
    total_pnl: float
    total_pnl_percent: float
    holdings: List[HoldingResponse]
    cash_balance: float = 0.0

# ==================== PERFORMANCE ====================
class PerformanceMetrics(BaseModel):
    period: str
    start_date: datetime
    end_date: datetime
    starting_value: float
    ending_value: float
    absolute_return: float
    percent_return: float
    best_performing_asset: Optional[str] = None
    best_performance_percent: Optional[float] = None
    worst_performing_asset: Optional[str] = None
    worst_performance_percent: Optional[float] = None
    total_transactions: int
    total_fees_paid: float

# ==================== ANALYTICS ====================
class PortfolioAllocation(BaseModel):
    symbol: str
    value: float
    percent: float
    quantity: float

class RiskMetrics(BaseModel):
    volatility: float = Field(..., description="Portfolio volatility")
    sharpe_ratio: Optional[float] = Field(None, description="Risk-adjusted return")
    max_drawdown: float = Field(..., description="Maximum loss from peak")
    max_drawdown_percent: float
    concentration_risk: float = Field(..., description="HHI index")
    
class PortfolioAnalytics(BaseModel):
    allocation: List[PortfolioAllocation]
    risk_metrics: RiskMetrics
    top_holdings: List[HoldingResponse]
    diversification_score: float = Field(..., ge=0, le=100)

# ==================== TRANSACTION HISTORY ====================
class TransactionHistoryResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    limit: int
    offset: int