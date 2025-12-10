#!/bin/bash

while true; do
  CURRENT_HOUR=$(date +%H)
  
  if [ "$CURRENT_HOUR" = "01" ]; then
    echo "[$(date)] Starting shopping feed sync..."
    /usr/bin/node /app/scripts/import-shopping-feed.js
    echo "[$(date)] Shopping feed sync completed"
    # Sleep for 1 hour to avoid running multiple times in the same hour
    sleep 3600
  else
    # Check every 5 minutes
    sleep 300
  fi
done
