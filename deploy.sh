#!/usr/bin/env bash

# TDPCS-Apt VPS Zero-Downtime Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 [1/5] Pulling latest changes from Git repository..."
git pull origin main

echo "📦 [2/5] Installing dependencies..."
npm install --production=false

echo "🏗️ [3/5] Compiling Next.js production build..."
npm run build

echo "🔄 [4/5] Reloading application with PM2 (zero downtime)..."
pm2 reload ecosystem.config.js --update-env

echo "💾 [5/5] Saving PM2 state..."
pm2 save

echo "✅ Deployment completed successfully! TDPCS-Apt is live."
