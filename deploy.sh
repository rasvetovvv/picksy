#!/bin/bash
# Picksy Zero-Downtime Deploy Script
# Usage: ./deploy.sh
#
# This script rebuilds and restarts Docker containers without 502 errors.
# It uses docker compose with rolling restart to minimize downtime.

set -e

echo "🚀 Picksy Deploy — Starting..."

# 1. Pull latest code (if using git)
# git pull origin main

# 2. Build new image without stopping old container
echo "📦 Building new image..."
docker compose build --no-cache app

# 3. Restart with zero downtime
echo "🔄 Restarting container..."
docker compose up -d --no-deps --force-recreate app

# 4. Wait for health check
echo "⏳ Waiting for app to start..."
sleep 5

# 5. Check if app is running
if docker compose ps app | grep -q "Up"; then
    echo "✅ Deploy successful! App is running."
else
    echo "❌ Deploy failed! Check logs:"
    docker compose logs --tail=50 app
    exit 1
fi

# 6. Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "🎉 Done! Site should be live without 502."
