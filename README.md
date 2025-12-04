# Cryptics

Monorepo for the Cryptics project (backend + frontend).

Overview
- `cryptics-backend/`: FastAPI backend with Redis integration.
- `cryptics-frontend/cryptics/`: TurboRepo monorepo containing `apps/mobile` and `apps/web`.

Quick start (developer)
1. Install dependencies for backend and frontend as needed (see each package's README).
2. Use environment variables for secrets (do not commit `.env` files).

Notes
- Sensitive values should be stored in environment variables (the code references `JWT_SECRET`, `HUGGINGFACE_API_KEY`, `CRYPTOPANIC_API_KEY`, etc.).
- `dump.rdb` and local env files are in `.gitignore` and should not be pushed.

Repository maintained by: Adetia-Raymond
