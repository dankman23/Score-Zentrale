#!/bin/bash
# Cursor-Import mit 500er Batches

for i in {1..100}; do
  echo "Batch $i..."
  curl -s -X POST http://localhost:3000/api/jtl/articles/import/continue \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 500}' \
    --max-time 90 | jq '{imported, totalInDb, finished}'
  
  # Prüfe ob fertig
  if [ $? -ne 0 ]; then
    echo "Fehler - stoppe"
    break
  fi
  
  # 3 Sekunden Pause
  sleep 3
done

echo "Import-Loop beendet"
