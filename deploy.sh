#!/bin/bash
# Usage: bash deploy.sh
# Requires: VPS_HOST and VPS_USER set below, or passed as env vars

VPS_HOST="${VPS_HOST:-YOUR_VPS_IP}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="${VPS_PATH:-/root/kalon-store}"

echo "Deploying to $VPS_USER@$VPS_HOST..."

ssh "$VPS_USER@$VPS_HOST" "
  set -e
  cd $VPS_PATH
  git pull origin main
  cd server && npm install --omit=dev
  pm2 restart sillage --update-env || pm2 restart all
  echo 'Deploy complete.'
"
