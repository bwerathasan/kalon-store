#!/bin/bash
# Usage: bash deploy.sh
# Requires: VPS_HOST and VPS_USER set below, or passed as env vars

VPS_HOST="${VPS_HOST:-YOUR_VPS_IP}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="${VPS_PATH:-/var/www/kalon}"

echo "Deploying to $VPS_USER@$VPS_HOST..."

ssh "$VPS_USER@$VPS_HOST" "
  set -e
  cd $VPS_PATH
  git fetch origin main
  git reset --hard origin/main
  cd server && npm ci --omit=dev
  pm2 restart kalon --update-env
  pm2 save
  echo 'Deploy complete.'
"
