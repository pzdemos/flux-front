#!/usr/bin/env bash
set -euo pipefail

SERVER="root@121.43.33.235"
REMOTE_DIR="/var/www/flux-front"
APP_NAME="flux-front"

echo "==> Building $APP_NAME..."
npm run build

echo "==> Deploying to $SERVER:$REMOTE_DIR..."
rsync -avz --delete dist/ "$SERVER:$REMOTE_DIR/"

echo "==> Done! https://admin.haoaiganfan.top"
