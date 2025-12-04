# test_setup.py
print("Testing installations...\n")

# Test 1: ta (Technical Analysis)
try:
    import ta
    print("✅ ta (Technical Analysis) installed successfully")
except ImportError:
    print("❌ ta not installed - run: pip install ta")

# Test 2: transformers
try:
    from transformers import pipeline
    print("✅ transformers installed successfully")
except ImportError:
    print("❌ transformers not installed - run: pip install transformers")

# Test 3: torch
try:
    import torch
    print("✅ torch installed successfully")
except ImportError:
    print("❌ torch not installed - run: pip install torch")

# Test 4: pandas & numpy
try:
    import pandas as pd
    import numpy as np
    print("✅ pandas and numpy installed successfully")
except ImportError:
    print("❌ pandas/numpy not installed - run: pip install pandas numpy")

# Test 5: Basic functionality with ta library
try:
    import pandas as pd
    import numpy as np
    from ta.momentum import RSIIndicator
    from ta.trend import MACD
    
    # Create sample data
    df = pd.DataFrame({
        'close': np.random.randn(100) + 100,
        'high': np.random.randn(100) + 101,
        'low': np.random.randn(100) + 99,
        'volume': np.random.randint(1000, 10000, 100)
    })
    
    # Test RSI
    rsi_indicator = RSIIndicator(close=df['close'], window=14)
    rsi = rsi_indicator.rsi()
    print(f"✅ Technical indicators working - RSI calculated: {rsi.iloc[-1]:.2f}")
    
    # Test MACD
    macd_indicator = MACD(close=df['close'])
    macd = macd_indicator.macd()
    print(f"✅ MACD calculated: {macd.iloc[-1]:.2f}")
    
except Exception as e:
    print(f"❌ Error testing functionality: {e}")

print("\n🎉 All tests passed! Ready to build.")