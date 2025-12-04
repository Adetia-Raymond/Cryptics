# 🚀 Cryptics CI/CD & VPS Deployment

Automated deployment pipeline untuk project Cryptics dengan backend FastAPI dan frontend React Native/Next.js.

## 📋 Overview

- **Backend**: FastAPI + PostgreSQL + Redis  
- **Frontend Web**: Next.js + TypeScript
- **Frontend Mobile**: React Native + Expo
- **VPS**: Ubuntu dengan automated deployment
- **CI/CD**: GitHub Actions dengan testing & deployment

## 🌐 VPS Information

- **Backend API**: http://137.184.91.178/
- **API Docs**: http://137.184.91.178/docs
- **Status**: Ready untuk CI/CD deployment

## 🔧 Required GitHub Secrets

Untuk mengaktifkan CI/CD, owner perlu menambahkan secrets:

```
VPS_HOST: 137.184.91.178
VPS_USER: root
VPS_SSH_KEY: [SSH private key dari VPS]
VPS_DOMAIN: 137.184.91.178
```

## 🚀 Deployment Flow

1. **Push ke `main` branch** → Trigger deployment
2. **GitHub Actions** connect ke VPS via SSH
3. **Pull latest code** & install dependencies  
4. **Restart services** (backend + frontend)
5. **Health check** & notification

## ✅ Features

- ✅ Automated testing (backend + frontend)
- ✅ Code quality checks (linting, formatting)
- ✅ Security scanning
- ✅ Dependency updates via Dependabot  
- ✅ Zero-downtime deployment
- ✅ Health monitoring

## 📝 Usage

Setelah setup secrets, setiap push ke main akan otomatis:
1. Run tests
2. Deploy ke VPS
3. Restart services  
4. Verify deployment

**Ready untuk production! 🎉**