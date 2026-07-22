#!/usr/bin/env bash
# FLUX 前端部署脚本
# 用法: ./deploy.sh [branch]
set -euo pipefail

BRANCH="${1:-main}"
SERVER="root@121.43.33.235"
REMOTE_DIR="/var/www/flux-front"
APP_NAME="flux-front"

echo "==> Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo "==> Building $APP_NAME..."
npm run build

echo "==> Deploying to $SERVER:$REMOTE_DIR..."
rsync -avz --delete dist/ "$SERVER:$REMOTE_DIR/"

echo "==> Done! https://admin.haoaiganfan.top"
