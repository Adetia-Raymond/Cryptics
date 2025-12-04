from fastapi import FastAPI
from app.config import settings
from fastapi.middleware.cors import CORSMiddleware
import asyncio

# Routers (will fill later)
from app.routers import auth, user, market, watchlist, portfolio, insights

app = FastAPI(title=settings.PROJECT_NAME)

# Allow mobile + web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(market.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)
app.include_router(insights.router)

@app.get("/")
def root():
    return {
        "message": "Cryptics API is running",
        "version": "2.0.0",
        "features": [
            "Authentication & User Management",
            "Real-time Market Data",
            "Portfolio Tracking",
            "Watchlist Management",
            "AI-Powered Trading Signals",  # NEW
            "Technical Analysis",  # NEW
            "Sentiment Analysis"  # NEW
        ],
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Cryptics API",
        "ai_features": "enabled"
    }

@app.on_event("startup")
async def start_binance_ws():
    # The market router will spawn per-symbol/interval background tasks
    # on-demand when clients connect. No global startup streams are created here.
    return

