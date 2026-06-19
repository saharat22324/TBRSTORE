#!/bin/bash
# deploy-docker.sh - Deploy TBR System ใช้ Docker

set -e

echo "🐳 TBR System - Docker Deployment"
echo "===================================="

# Check Docker installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install from: https://www.docker.com"
    exit 1
fi

# Build image
echo "📦 Building Docker image..."
docker build -t tbr-system:latest .

# Stop old container if exists
if docker ps -a --format '{{.Names}}' | grep -q '^tbr-system$'; then
    echo "🛑 Stopping old container..."
    docker stop tbr-system || true
    docker rm tbr-system || true
fi

# Run new container
echo "🚀 Starting new container..."
docker run -d \
  --name tbr-system \
  --restart always \
  -p 8080:8080 \
  -v $(pwd):/app \
  tbr-system:latest

echo ""
echo "✅ SUCCESS!"
echo ""
echo "📍 Access at: http://localhost:8080"
echo "📍 Or: http://[server-ip]:8080"
echo ""
echo "📋 Useful commands:"
echo "  - View logs: docker logs -f tbr-system"
echo "  - Stop: docker stop tbr-system"
echo "  - Start: docker start tbr-system"
echo ""
