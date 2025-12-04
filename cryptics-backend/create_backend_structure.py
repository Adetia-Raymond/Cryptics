import os

# Folder structure definition
structure = {
    "app": {
        "main.py": "",
        "config.py": "",
        "database.py": "",
        "redis_client.py": "",
        "utils": {
            "security.py": "",
            "jwt.py": ""
        },
        "routers": {
            "auth.py": "",
            "user.py": "",
            "market.py": "",
            "analytics.py": "",
            "ai.py": ""
        },
        "services": {
            "binance_service.py": "",
            "analytics_service.py": "",
            "ai_service.py": "",
            "cache_service.py": ""
        },
        "models": {
            "user.py": "",
            "tokens.py": "",
            "watchlist.py": "",
            "portfolio.py": "",
            "insights.py": ""
        },
        "schemas": {
            "user_schema.py": "",
            "auth_schema.py": "",
            "market_schema.py": ""
        }
    },
    ".env": ""
}

# Function to create folders & files recursively
def create_structure(base_path, structure_dict):
    for name, content in structure_dict.items():
        path = os.path.join(base_path, name)

        if isinstance(content, dict):
            # Create folder
            os.makedirs(path, exist_ok=True)
            print(f"[DIR]  {path}")
            # Recursively create sub-items
            create_structure(path, content)
        else:
            # Create file
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[FILE] {path}")

# --- Run ---
if __name__ == "__main__":
    base = os.getcwd()
    print(f"Creating backend structure in: {base}")
    create_structure(base, structure)
    print("\n✅ All backend folders and files created successfully!")
