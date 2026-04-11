#!/bin/bash
# AccaBiz Deployment Script
# Usage: ./deploy.sh [frontend|backend|all]

set -e

TARGET=${1:-all}
DEPLOY_BASE="/home/orgajyzd/projects/accabiz"
PUBLIC_HTML="/home/orgajyzd/public_html"

echo "=== AccaBiz Deployment ==="
echo "Target: $TARGET"
echo ""

# ---- Frontend ----
if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
  echo "[1/3] Building frontend (static export)..."
  cd frontend
  npm run build
  cd ..

  echo "[2/3] Deploying frontend to $PUBLIC_HTML..."
  mkdir -p "$PUBLIC_HTML"
  cp -R frontend/out/* "$PUBLIC_HTML/"
  cp frontend/.htaccess "$PUBLIC_HTML/"

  echo "[3/3] Setting permissions..."
  find "$PUBLIC_HTML" -type d -exec chmod 755 {} \;
  find "$PUBLIC_HTML" -type f -exec chmod 644 {} \;

  echo "Frontend deployed."
fi

# ---- Backend ----
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
  echo "[1/3] Building backend..."
  cd backend
  npm run build
  cd ..

  echo "[2/3] Deploying backend to $DEPLOY_BASE/backend..."
  mkdir -p "$DEPLOY_BASE/backend"
  cp -R backend/dist/* "$DEPLOY_BASE/backend/"
  cp backend/package.json "$DEPLOY_BASE/backend/"
  cp backend/ecosystem.config.js "$DEPLOY_BASE/backend/"
  cp -R backend/prisma "$DEPLOY_BASE/backend/"

  # Install production dependencies only
  cd "$DEPLOY_BASE/backend"
  npm install --omit=dev
  npx prisma generate

  echo "[3/3] Restarting backend with PM2..."
  pm2 restart ecosystem.config.js --env production 2>/dev/null || pm2 start ecosystem.config.js --env production

  echo "Backend deployed."
fi

echo ""
echo "=== Deployment Complete ==="
