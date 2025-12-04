# CI/CD Pipeline for Cryptics

This repository includes automated CI/CD pipeline using GitHub Actions.

## 🚀 Features

### Continuous Integration
- **Backend Testing**: Automated Python tests with PostgreSQL and Redis
- **Frontend Testing**: Next.js build verification and dependency checks  
- **Mobile Testing**: Expo project validation and consistency checks

### Continuous Deployment
- **VPS Deployment**: Automated deployment to production server
- **Health Checks**: Automatic service health verification
- **Zero Downtime**: Rolling updates with PM2 and systemd

## 📋 Prerequisites

### GitHub Secrets Required
Add these secrets in GitHub repository settings:

```
VPS_HOST=your.vps.ip.address
VPS_USER=root
VPS_SSH_KEY=your-private-ssh-key
VPS_DOMAIN=yourdomain.com (optional)
```

### VPS Setup Required
1. **Backend Service** (systemd)
2. **Frontend Process** (PM2)  
3. **Database** (PostgreSQL)
4. **Cache** (Redis)
5. **Web Server** (Nginx)

## 🔄 Workflow Triggers

### CI Pipeline (`ci-cd.yml`)
- Runs on: `push` to `main`/`develop`, `pull_request` to `main`
- Tests: Backend, Frontend, Mobile
- Matrix: Multiple Node.js/Python versions

### Deployment (`deploy-vps.yml`) 
- Runs on: `push` to `main` (after CI passes)
- Deploys to: Production VPS
- Includes: Database migrations, service restarts, health checks

## 📊 Pipeline Status

Check the [Actions tab](../../actions) for pipeline status and logs.

## 🛠️ Local Development

```bash
# Backend
cd cryptics-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend  
cd cryptics-frontend/cryptics
npm install
npm run dev --workspace=web

# Mobile
cd cryptics-frontend/cryptics/apps/mobile
npm run start
```

## 🔧 Configuration

### Backend Environment
Copy `cryptics-backend/.env.example` to `.env` and configure:
- Database URL
- Redis URL  
- JWT secrets
- API keys

### Frontend Environment
Configure in `cryptics-frontend/cryptics/apps/web/.env.local`:
- `NEXT_PUBLIC_API_URL`

## 📝 Deployment Process

1. **Push to `main`** → Triggers CI/CD
2. **CI Tests** → Backend, Frontend, Mobile  
3. **Deploy** → VPS deployment (if CI passes)
4. **Health Check** → Verify services
5. **Notification** → Success/failure status

## 🚨 Troubleshooting

### Common Issues
- **Build failures**: Check Node.js/Python versions
- **Test failures**: Verify environment variables
- **Deployment failures**: Check VPS connectivity and services

### Debug Commands
```bash
# Check service status
sudo systemctl status cryptics-backend
pm2 status cryptics-frontend

# View logs
sudo journalctl -u cryptics-backend -f
pm2 logs cryptics-frontend

# Manual deployment test
cd /var/www/cryptics-backend
git pull origin main
sudo systemctl restart cryptics-backend
```

## 📈 Monitoring

- **Service Health**: Automated endpoint checks
- **Process Monitoring**: PM2 dashboard
- **System Monitoring**: Server resource usage
- **Error Tracking**: Application logs and alerts