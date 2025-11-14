#!/bin/bash

echo "🔍 Prüfe Filter-Styles in allen FIBU Views..."

for file in components/VKRechnungenView.js components/EKRechnungenView.js components/ZahlungenView.js components/KreditorZuordnung.js; do
  if [ -f "/app/$file" ]; then
    echo ""
    echo "📄 $file:"
    grep -n "select" "/app/$file" | grep -v "// " | head -10
  fi
done

echo ""
echo "✅ Fertig"
