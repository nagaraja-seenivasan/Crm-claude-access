#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== CRM Rule Builder ==="

# Kill any existing processes on our ports
kill_port() {
  local pid
  pid=$(lsof -t -i :"$1" 2>/dev/null) && kill "$pid" 2>/dev/null && echo "Stopped process on port $1"
}
kill_port 3000
kill_port 4200

# Install deps if node_modules missing
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install --prefix "$ROOT/backend"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "$ROOT/frontend"
fi

# Build backend
echo "Building backend..."
npm run build --prefix "$ROOT/backend"

# Start backend
echo "Starting backend on http://localhost:3000 ..."
node -r source-map-support/register "$ROOT/backend/dist/index.js" > /tmp/crm-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo -n "Waiting for backend"
for i in $(seq 1 20); do
  if curl -s http://localhost:3000/rules > /dev/null 2>&1; then
    echo " ready!"
    break
  fi
  echo -n "."
  sleep 1
done

# Start frontend
echo "Starting frontend on http://localhost:4200 ..."
npm start --prefix "$ROOT/frontend" > /tmp/crm-frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:3000"
echo "  Explorer → http://localhost:3000/explorer"
echo "  Frontend → http://localhost:4200"
echo ""
echo "Logs: /tmp/crm-backend.log  /tmp/crm-frontend.log"
echo "Stop with: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Waiting for frontend to compile (this takes ~30s)..."
wait $FRONTEND_PID
