#!/bin/bash

# Amazon 1814
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1814","bezeichnung":"Amazon Pay (Zahlungskonto, Stand 12/2025)","beschreibung":"Amazon Pay / Amazon Payments - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# PayPal 1801
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1801","bezeichnung":"PayPal (Zahlungskonto, Stand 12/2025)","beschreibung":"PayPal Geschäftskonto - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# Commerzbank 1802
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1802","bezeichnung":"Commerzbank (Zahlungskonto, Stand 12/2025)","beschreibung":"Commerzbank Girokonto - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# Postbank 1701
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1701","bezeichnung":"Postbank (Zahlungskonto, Stand 12/2025)","beschreibung":"Postbank Girokonto - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# eBay 1810
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1810","bezeichnung":"eBay Managed Payments (Zahlungskonto, Stand 12/2025)","beschreibung":"eBay Managed Payments - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# Mollie 1840
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1840","bezeichnung":"Mollie (Zahlungskonto, Stand 12/2025)","beschreibung":"Mollie Payment Service - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""

# Otto 1820
curl -X POST http://localhost:3000/api/fibu/kontenplan \
  -H "Content-Type: application/json" \
  -d '{"kontonummer":"1820","bezeichnung":"Otto Payment (Zahlungskonto, Stand 12/2025)","beschreibung":"Otto Payment - Automatisches Zahlungskonto","belegpflicht":false,"istAktiv":true}'

echo ""
echo "Alle Zahlungskonten aktualisiert!"
