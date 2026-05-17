#!/bin/bash

set -e

LOCAL_IP=$(ipconfig.exe | grep -i "IPv4" | grep -E "192\\.|10\\.|172\\." | awk '{print $NF}' | head -n 1 | tr -d '\r')

echo "------------------------------------------------"
echo "  BMW ERP SYSTEM - STARTING ENGINES"
echo "------------------------------------------------"
echo "LOCAL IP DETECTED: ${LOCAL_IP:-unknown}"

echo "Starting Fastify Backend on port 4000..."
(
  cd services/api
  npm run dev
) &

echo "Starting Vite Frontend on port 5173..."
(
  cd apps/dashboard
  npm run dev -- --host
) &

echo "Initializing Global Tunnel..."
cloudflared tunnel --url http://localhost:5173 &

echo "------------------------------------------------"
echo "  CONNECTIVITY ACCESS POINTS:"
echo "------------------------------------------------"
echo "1. DEVELOPMENT (PC 1): http://localhost:5173"
if [ -n "$LOCAL_IP" ]; then
  echo "2. LOCAL OFFICE (PC 2): http://${LOCAL_IP}:5173"
else
  echo "2. LOCAL OFFICE (PC 2): <check your LAN IP>"
fi
echo "3. REMOTE GLOBAL (PC 3): (Check Cloudflare output for URL)"
echo "------------------------------------------------"

wait
