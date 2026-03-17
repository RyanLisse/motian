#!/bin/bash
# Mission initialization script

# Install dependencies (includes react-force-graph-3d and three)
pnpm install

# Verify environment setup
if [ ! -f ".env.local" ]; then
  echo "WARNING: .env.local not found - some tests may fail"
fi

echo "Mission environment ready"
