#!/bin/bash
echo "🧹 Killing old servers..."
pkill -f "http.server"
pkill -f "sim-server.js"
pkill -f node

echo "🧼 Clearing local data..."
rm -rf ~/uav_testdash/data 2>/dev/null
rm -rf ~/.cache 2>/dev/null

echo "✅ Done. Ready to restart."
echo "Run these again:"
echo "  node sim-server.js"
echo "  python3 -m http.server 8000"