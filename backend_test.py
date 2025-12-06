#!/usr/bin/env python3
"""
Backend Testing für verbesserte Hauptkategorie-Logik
Test der neuen Produktkategorien-Erkennung die echte Produktnamen erkennt
"""

import requests
import json
import time
import sys
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://customer-hub-78.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_debug_kategorie_endpoint():
    """
    Test 1: Debug-Endpoint /api/debug/test-kategorie?kKunde=100000 (GET)
    Sollte jetzt echte Produktkategorien zurückgeben, keine Zahlen oder "x-Set"
    """
    print("\n" + "="*80)
    print("TEST 1: Debug-Endpoint Produktkategorien-Erkennung")
    print("="*80)
    
    try:
        # Test mit verschiedenen Kunden-IDs
        test_customers = [100000, 100001, 100002, 100003, 100004]
        
        for kKunde in test_customers:
            print(f"\n🔍 Testing kKunde={kKunde}...")
            
            response = requests.get(f"{API_BASE}/debug/test-kategorie", 
                                  params={"kKunde": kKunde}, 
                                  timeout=30)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Response OK: {data.get('ok', False)}")
                
                kategorien = data.get('kategorien', [])
                print(f"📊 Kategorien gefunden: {len(kategorien)}")
                
                if kategorien:
                    print("\n📋 Erkannte Kategorien:")
                    expected_categories = [
                        'Schleifscheibe', 'Fächerscheibe', 'Trennscheibe', 
                        'Schleifband', 'Fräser', 'Bohrer', 'Schleifpapier', 
                        'Vlies', 'Polierscheibe', 'Fiberscheibe', 
                        'Schruppscheibe', 'Lamellenscheibe'
                    ]
                    
                    valid_categories = []
                    invalid_categories = []
                    
                    for kat in kategorien:
                        kategorie = kat.get('kategorie', '')
                        umsatz = kat.get('total_umsatz', 0)
                        print(f"  - {kategorie}: {umsatz:.2f} EUR")
                        
                        # Prüfe ob es eine echte Produktkategorie ist
                        if kategorie in expected_categories:
                            valid_categories.append(kategorie)
                        else:
                            # Prüfe auf unerwünschte Muster (Zahlen, Sets)
                            if (kategorie.endswith('er') and any(c.isdigit() for c in kategorie)) or \
                               'Set' in kategorie or \
                               kategorie.isdigit() or \
                               len(kategorie) <= 3:
                                invalid_categories.append(kategorie)
                            else:
                                valid_categories.append(kategorie)
                    
                    print(f"\n✅ Gültige Produktkategorien: {len(valid_categories)}")
                    print(f"❌ Ungültige Kategorien (Zahlen/Sets): {len(invalid_categories)}")
                    
                    if invalid_categories:
                        print(f"⚠️  Problematische Kategorien: {invalid_categories}")
                        return False
                    
                    if valid_categories:
                        print(f"🎯 Erkannte echte Produktkategorien: {valid_categories}")
                        return True
                    else:
                        print("⚠️  Keine gültigen Produktkategorien gefunden")
                        
                else:
                    print("ℹ️  Keine Kategorien für diesen Kunden")
                    
            else:
                print(f"❌ Error {response.status_code}: {response.text}")
                return False
                
        return True
        
    except Exception as e:
        print(f"❌ Exception in test_debug_kategorie_endpoint: {str(e)}")
        return False

def test_mini_import():
    """
    Test 2: Mini-Import (50-100 Kunden) testen
    Starte einen Import und prüfe die Logs, Hauptkategorien sollten echte Produktnamen sein
    """
    print("\n" + "="*80)
    print("TEST 2: Mini-Import Test - JTL Customer Sync")
    print("="*80)
    
    try:
        print("🚀 Starting JTL Customer Sync (limited test)...")
        
        # Starte den Import
        response = requests.post(f"{API_BASE}/coldleads/jtl-customers/sync-daily", 
                               json={}, 
                               timeout=120)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Import Response OK: {data.get('ok', False)}")
            
            # Zeige Import-Statistiken
            new_customers = data.get('new_customers', 0)
            updated = data.get('updated', 0)
            total = data.get('total', 0)
            duration = data.get('duration', 0)
            
            print(f"📊 Import Statistics:")
            print(f"  - Total processed: {total}")
            print(f"  - New customers: {new_customers}")
            print(f"  - Updated: {updated}")
            print(f"  - Duration: {duration}ms ({duration/1000:.1f}s)")
            
            if total > 0:
                print("✅ Import successful - customers processed")
                return True
            else:
                print("⚠️  No customers processed")
                return False
                
        else:
            print(f"❌ Import failed {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception in test_mini_import: {str(e)}")
        return False

def test_customer_data_validation():
    """
    Test 3: Kunden-Daten validieren
    Prüfe ob `hauptartikel` jetzt sinnvolle Werte hat
    """
    print("\n" + "="*80)
    print("TEST 3: Customer Data Validation - Hauptartikel Check")
    print("="*80)
    
    try:
        print("🔍 Loading customer list to validate hauptartikel...")
        
        # Lade Kunden-Liste
        response = requests.get(f"{API_BASE}/customers/list", 
                              params={"limit": 20, "filter": "all"}, 
                              timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Customer List Response OK: {data.get('ok', False)}")
            
            customers = data.get('customers', [])
            print(f"📊 Customers loaded: {len(customers)}")
            
            if not customers:
                print("⚠️  No customers found")
                return False
            
            # Analysiere hauptartikel Werte
            expected_categories = [
                'Schleifscheibe', 'Fächerscheibe', 'Trennscheibe', 
                'Schleifband', 'Fräser', 'Bohrer', 'Schleifpapier', 
                'Vlies', 'Polierscheibe', 'Fiberscheibe', 
                'Schruppscheibe', 'Lamellenscheibe'
            ]
            
            customers_with_hauptartikel = 0
            valid_hauptartikel = 0
            invalid_hauptartikel = 0
            hauptartikel_values = {}
            
            print("\n📋 Customer Hauptartikel Analysis:")
            
            for i, customer in enumerate(customers[:10]):  # Zeige nur erste 10
                kKunde = customer.get('kKunde', 'N/A')
                company_name = customer.get('company_name', 'N/A')
                hauptartikel = customer.get('hauptartikel')
                
                print(f"  {i+1}. kKunde={kKunde}, {company_name[:30]}...")
                
                if hauptartikel:
                    customers_with_hauptartikel += 1
                    print(f"     🎯 Hauptartikel: '{hauptartikel}'")
                    
                    # Zähle Häufigkeit
                    hauptartikel_values[hauptartikel] = hauptartikel_values.get(hauptartikel, 0) + 1
                    
                    # Validiere Kategorie
                    if hauptartikel in expected_categories:
                        valid_hauptartikel += 1
                        print(f"     ✅ Valid product category")
                    else:
                        # Prüfe auf problematische Muster
                        if (hauptartikel.endswith('er') and any(c.isdigit() for c in hauptartikel)) or \
                           'Set' in hauptartikel or \
                           hauptartikel.isdigit() or \
                           len(hauptartikel) <= 3:
                            invalid_hauptartikel += 1
                            print(f"     ❌ Invalid category (number/set pattern)")
                        else:
                            valid_hauptartikel += 1
                            print(f"     ⚠️  Unknown but potentially valid category")
                else:
                    print(f"     ⚪ No hauptartikel")
            
            print(f"\n📊 Hauptartikel Summary:")
            print(f"  - Customers with hauptartikel: {customers_with_hauptartikel}/{len(customers)}")
            print(f"  - Valid categories: {valid_hauptartikel}")
            print(f"  - Invalid categories: {invalid_hauptartikel}")
            
            if hauptartikel_values:
                print(f"\n🏷️  Most common hauptartikel:")
                sorted_values = sorted(hauptartikel_values.items(), key=lambda x: x[1], reverse=True)
                for kategorie, count in sorted_values[:5]:
                    print(f"    - {kategorie}: {count} customers")
            
            # Erfolg wenn mehr gültige als ungültige Kategorien
            success = valid_hauptartikel > invalid_hauptartikel and customers_with_hauptartikel > 0
            
            if success:
                print("✅ Customer data validation successful - hauptartikel contains real product names")
            else:
                print("❌ Customer data validation failed - too many invalid hauptartikel values")
                
            return success
            
        else:
            print(f"❌ Customer list failed {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception in test_customer_data_validation: {str(e)}")
        return False

def test_jtl_customer_sync():
    """Test JTL Customer Sync Daily API"""
    log("🔄 Testing JTL Customer Sync Daily API...")
    
    try:
        # Test POST /api/coldleads/jtl-customers/sync-daily
        url = f"{BASE_URL}/api/coldleads/jtl-customers/sync-daily"
        log(f"POST {url}")
        
        start_time = time.time()
        response = requests.post(url, timeout=TIMEOUT)
        duration = time.time() - start_time
        
        log(f"Response Status: {response.status_code}")
        log(f"Response Time: {duration:.2f}s")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}")
            log(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            log("❌ FAILED: Invalid JSON response")
            log(f"Response: {response.text}")
            return False
        
        # Validate response structure
        required_fields = ['ok', 'new_customers', 'updated', 'unchanged', 'total', 'duration']
        for field in required_fields:
            if field not in data:
                log(f"❌ FAILED: Missing field '{field}' in response")
                return False
        
        if not data['ok']:
            log(f"❌ FAILED: API returned ok=false")
            log(f"Error: {data.get('error', 'Unknown error')}")
            return False
        
        # Log results
        log(f"✅ JTL Customer Sync completed successfully!")
        log(f"   New customers: {data['new_customers']}")
        log(f"   Updated: {data['updated']}")
        log(f"   Unchanged: {data['unchanged']}")
        log(f"   Total processed: {data['total']}")
        log(f"   Duration: {data['duration']}ms ({data['duration']/1000:.1f}s)")
        
        # Validate that some customers were processed
        if data['total'] == 0:
            log("⚠️  WARNING: No customers were processed - this might indicate a database issue")
            return False
        
        # Check if we have a reasonable number of customers (at least 1000+ as mentioned in requirements)
        if data['total'] < 1000:
            log(f"⚠️  WARNING: Only {data['total']} customers processed, expected 1000+")
        
        return True
        
    except requests.exceptions.Timeout:
        log(f"❌ FAILED: Request timed out after {TIMEOUT}s")
        return False
    except requests.exceptions.RequestException as e:
        log(f"❌ FAILED: Request error: {e}")
        return False
    except Exception as e:
        log(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_customers_list_api():
    """Test Customers List API"""
    log("🔄 Testing Customers List API...")
    
    try:
        # Test GET /api/customers/list
        url = f"{BASE_URL}/api/customers/list"
        log(f"GET {url}")
        
        response = requests.get(url, timeout=30)
        
        log(f"Response Status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}")
            log(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            log("❌ FAILED: Invalid JSON response")
            log(f"Response: {response.text}")
            return False
        
        # Validate response structure
        if not data.get('ok'):
            log(f"❌ FAILED: API returned ok=false")
            log(f"Error: {data.get('error', 'Unknown error')}")
            return False
        
        if 'customers' not in data:
            log("❌ FAILED: Missing 'customers' field in response")
            return False
        
        customers = data['customers']
        log(f"✅ Customers List API working - returned {len(customers)} customers")
        
        if len(customers) == 0:
            log("⚠️  WARNING: No customers returned - might be expected if sync hasn't run yet")
            return True
        
        # Validate customer structure
        sample_customer = customers[0]
        required_fields = ['company_name', 'jtl_customer', 'total_revenue', 'total_orders']
        
        for field in required_fields:
            if field not in sample_customer:
                log(f"❌ FAILED: Missing field '{field}' in customer object")
                return False
        
        # Validate JTL customer data
        jtl_customer = sample_customer.get('jtl_customer', {})
        if 'kKunde' not in sample_customer and 'kKunde' not in jtl_customer:
            log("❌ FAILED: Missing 'kKunde' field in customer")
            return False
        
        # Log sample customer data
        log(f"✅ Sample customer validation passed:")
        log(f"   Company: {sample_customer.get('company_name', 'N/A')}")
        log(f"   kKunde: {sample_customer.get('kKunde') or jtl_customer.get('kKunde', 'N/A')}")
        log(f"   Total Revenue: {sample_customer.get('total_revenue', 0)}")
        log(f"   Total Orders: {sample_customer.get('total_orders', 0)}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log(f"❌ FAILED: Request error: {e}")
        return False
    except Exception as e:
        log(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_database_consistency():
    """Test database consistency by checking for imported JTL customers"""
    log("🔄 Testing database consistency...")
    
    try:
        # Use the customers list API to check for JTL imported customers
        url = f"{BASE_URL}/api/customers/list?limit=10"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            log(f"❌ FAILED: Could not fetch customers for consistency check")
            return False
        
        data = response.json()
        if not data.get('ok') or 'customers' not in data:
            log(f"❌ FAILED: Invalid response for consistency check")
            return False
        
        customers = data['customers']
        
        # Check for customers with imported_from_jtl flag or JTL customer data
        jtl_customers = []
        for customer in customers:
            if (customer.get('customer_source') == 'jtl' or 
                customer.get('jtl_customer', {}).get('kKunde')):
                jtl_customers.append(customer)
        
        if len(jtl_customers) == 0:
            log("⚠️  WARNING: No JTL customers found in database - sync might not have completed")
            return False
        
        log(f"✅ Database consistency check passed:")
        log(f"   Found {len(jtl_customers)} JTL customers out of {len(customers)} total")
        
        # Validate JTL customer structure
        sample_jtl = jtl_customers[0]
        jtl_data = sample_jtl.get('jtl_customer', {})
        
        required_jtl_fields = ['kKunde']
        for field in required_jtl_fields:
            if field not in jtl_data and field not in sample_jtl:
                log(f"❌ FAILED: Missing JTL field '{field}' in customer")
                return False
        
        log(f"   Sample JTL customer kKunde: {jtl_data.get('kKunde') or sample_jtl.get('kKunde')}")
        
        return True
        
    except Exception as e:
        log(f"❌ FAILED: Database consistency check error: {e}")
        return False

def main():
    """Main test execution"""
    log("🚀 Starting JTL Customer Import Backend Testing")
    log(f"Base URL: {BASE_URL}")
    
    tests = [
        ("JTL Customer Sync Daily", test_jtl_customer_sync),
        ("Customers List API", test_customers_list_api),
        ("Database Consistency", test_database_consistency)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        log(f"\n{'='*60}")
        log(f"Running: {test_name}")
        log('='*60)
        
        try:
            result = test_func()
            results[test_name] = result
            
            if result:
                log(f"✅ {test_name}: PASSED")
            else:
                log(f"❌ {test_name}: FAILED")
                
        except Exception as e:
            log(f"❌ {test_name}: EXCEPTION - {e}")
            results[test_name] = False
    
    # Summary
    log(f"\n{'='*60}")
    log("TEST SUMMARY")
    log('='*60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{test_name}: {status}")
    
    log(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        log("🎉 All tests passed!")
        return 0
    else:
        log("💥 Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())