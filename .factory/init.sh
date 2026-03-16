#!/bin/bash
# Mission initialization script

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  pnpm install --frozen-lockfile
fi

# Verify environment setup
if [ ! -f ".env.local" ]; then
  echo "WARNING: .env.local not found - some tests may fail"
fi

echo "Mission environment ready"
