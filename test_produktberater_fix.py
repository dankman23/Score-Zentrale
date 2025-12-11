#!/usr/bin/env python3
"""
Test für Produktberater Fix - Prüft ob Produkte aus articles Collection gefunden werden
"""

import requests
import json

BASE_URL = "https://biz-insight-5.preview.emergentagent.com"

def test_product_matching():
    """Testet ob die Produktsuche jetzt funktioniert"""
    
    print("🔧 PRODUKTBERATER FIX TEST")
    print("=" * 50)
    
    # Test mit Klingspor-spezifischer Anfrage
    payload = {
        "message": "Ich brauche Klingspor Schleifbänder für Edelstahl",
        "session_id": "test-fix-123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/produktberater/chat", 
                               json=payload, 
                               timeout=60)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API Response erfolgreich")
            
            if 'products' in data:
                products_count = len(data['products'])
                print(f"✅ Anzahl gefundener Produkte: {products_count}")
                
                if products_count > 0:
                    print("🎉 PRODUKTSUCHE FUNKTIONIERT JETZT!")
                    
                    for i, product in enumerate(data['products'][:3]):  # Zeige erste 3
                        print(f"\nProdukt {i+1}:")
                        print(f"  - Titel: {product.get('title', 'N/A')}")
                        print(f"  - Marke: {product.get('brand', 'N/A')}")
                        print(f"  - Preis: {product.get('price', 'N/A')}")
                        print(f"  - Artikel-Nr: {product.get('mpn', 'N/A')}")
                        print(f"  - Verfügbarkeit: {product.get('availability', 'N/A')}")
                    
                    return True
                else:
                    print("⚠️ Immer noch keine Produkte gefunden")
                    return False
            else:
                print("❌ Keine 'products' in Response")
                return False
        else:
            print(f"❌ API Fehler: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Fehler: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_product_matching()
    
    if success:
        print("\n🎯 FIX ERFOLGREICH!")
        print("Die Produktsuche funktioniert jetzt mit der articles Collection.")
    else:
        print("\n❌ FIX NICHT ERFOLGREICH!")
        print("Die Produktsuche funktioniert immer noch nicht.")