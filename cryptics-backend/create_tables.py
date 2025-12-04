# create_tables.py
"""
Run this script to create the new tables in your database

Usage:
    python create_tables.py
"""

from app.database import engine, Base
from app.models.user import User
from app.models.watchlist import Watchlist, Alert, UserPreferences, FilterPreset
from app.models.portfolio import Transaction

def create_tables():
    """Create all tables that don't exist yet"""
    print("🔧 Creating database tables...")
    
    try:
        Base.metadata.create_all(bind=engine)
        
        print("✅ Tables created successfully!\n")
        print("📋 Created tables:")
        print("   - watchlist")
        print("   - alerts")
        print("   - user_preferences")
        print("   - filter_presets")
        print("   - transactions")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    return True

def verify_tables():
    """Verify tables were created"""
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("\n📊 All tables in database:")
    for table in sorted(tables):
        print(f"   - {table}")
    
    # Check for required tables
    required = ['users', 'watchlist', 'alerts', 'user_preferences', 'filter_presets', 'transactions']
    missing = [t for t in required if t not in tables]
    
    if missing:
        print(f"\n⚠️  Missing tables: {', '.join(missing)}")
        return False
    
    print("\n✅ All required tables present!")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("  CRYPTICS DATABASE SETUP")
    print("=" * 60)
    print()
    
    if create_tables():
        verify_tables()
    
    print("\n" + "=" * 60)
    print("Next steps:")
    print("  1. Update your main.py to include new routers")
    print("  2. Test endpoints with the test script")
    print("=" * 60)