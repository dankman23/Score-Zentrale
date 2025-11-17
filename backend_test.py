#!/usr/bin/env python3
"""
Backend Test Suite for FIBU Zahlungen API
Testing FIBU Zahlungen API endpoints according to review request requirements.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Get base URL from environment
BASE_URL = "https://payment-view-fix.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_fibu_zahlungen_api():
    """
    Test FIBU Zahlungen API according to review request requirements.
    
    CRITICAL BACKEND TESTING REQUIRED:
    
    API to Test: GET /api/fibu/zahlungen?from=2025-10-01&to=2025-10-31
    
    Test Requirements:
    1. Data Structure Test - Verify all zahlungen have correct field names:
       - datum (not zahlungsdatum)
       - anbieter (not zahlungsanbieter)
       - betrag (number)
       - waehrung (string)
       - verwendungszweck (string)
       - gegenkonto (string)
       - istZugeordnet (boolean)
       - zugeordneteRechnung (nullable string)
       - zugeordnetesKonto (nullable string)
    
    2. Stats Verification - Check stats object contains:
       - gesamt (total count)
       - gesamtsumme (total amount)
       - anbieter object with breakdown per provider (Amazon, PayPal, Commerzbank, Postbank, Mollie)
    
    3. Provider Breakdown - Verify that for October 2025:
       - Amazon should have ~8000+ transactions
       - PayPal should have ~250+ transactions
       - Commerzbank should have ~165 transactions
       - Postbank should have 0 transactions
       - Mollie should have 0 transactions
    
    4. Date Filtering - Test with different date ranges
    
    Expected Behavior:
    - All zahlungen should have properly formatted datum field (ISO string)
    - betrag should be numeric (can be positive or negative)
    - Response should contain both zahlungen array and stats object
    - API should return within 5 seconds for 1-month range
    """
    
    print("=" * 80)
    print("TESTING FIBU ZAHLUNGEN API - CRITICAL BACKEND TESTING")
    print("=" * 80)
    
    # Test 1: Main API Data Structure Test - October 2025
    print("\n🔍 TEST 1: Main API Data Structure Test - October 2025")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-31"
        print(f"Testing: {url}")
        
        start_time = datetime.now()
        response = requests.get(url, timeout=10)
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds()
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response_time:.2f} seconds")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zahlungen = data.get('zahlungen', [])
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 FIBU ZAHLUNGEN STATS (October 2025):")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Gesamtsumme: €{stats.get('gesamtsumme', 0):.2f}")
                print(f"   - From: {data.get('from')}")
                print(f"   - To: {data.get('to')}")
                
                # Test Response Time (should be within 5 seconds)
                if response_time <= 5.0:
                    print(f"✅ PERFORMANCE: Response time {response_time:.2f}s within 5s limit")
                else:
                    print(f"❌ PERFORMANCE: Response time {response_time:.2f}s exceeds 5s limit")
                
                # Test Stats Structure
                required_stats_fields = ['gesamt', 'gesamtsumme', 'anbieter']
                missing_stats_fields = [field for field in required_stats_fields if field not in stats]
                
                if not missing_stats_fields:
                    print(f"✅ STATS STRUCTURE: All required fields present")
                else:
                    print(f"❌ STATS STRUCTURE: Missing fields: {missing_stats_fields}")
                
                # Test Provider Breakdown
                anbieter = stats.get('anbieter', {})
                expected_providers = ['Amazon', 'PayPal', 'Commerzbank', 'Postbank', 'Mollie']
                
                print(f"📊 PROVIDER BREAKDOWN:")
                for provider in expected_providers:
                    provider_stats = anbieter.get(provider, {})
                    anzahl = provider_stats.get('anzahl', 0)
                    summe = provider_stats.get('summe', 0)
                    print(f"   - {provider}: {anzahl} transactions, €{summe:.2f}")
                
                # Verify expected provider counts for October 2025
                amazon_count = anbieter.get('Amazon', {}).get('anzahl', 0)
                paypal_count = anbieter.get('PayPal', {}).get('anzahl', 0)
                commerzbank_count = anbieter.get('Commerzbank', {}).get('anzahl', 0)
                postbank_count = anbieter.get('Postbank', {}).get('anzahl', 0)
                mollie_count = anbieter.get('Mollie', {}).get('anzahl', 0)
                
                if amazon_count >= 8000:
                    print(f"✅ AMAZON: {amazon_count} transactions (expected 8000+)")
                else:
                    print(f"❌ AMAZON: {amazon_count} transactions (expected 8000+)")
                
                if paypal_count >= 250:
                    print(f"✅ PAYPAL: {paypal_count} transactions (expected 250+)")
                else:
                    print(f"❌ PAYPAL: {paypal_count} transactions (expected 250+)")
                
                if commerzbank_count >= 165:
                    print(f"✅ COMMERZBANK: {commerzbank_count} transactions (expected ~165)")
                else:
                    print(f"❌ COMMERZBANK: {commerzbank_count} transactions (expected ~165)")
                
                if postbank_count == 0:
                    print(f"✅ POSTBANK: {postbank_count} transactions (expected 0)")
                else:
                    print(f"⚠️  POSTBANK: {postbank_count} transactions (expected 0)")
                
                if mollie_count == 0:
                    print(f"✅ MOLLIE: {mollie_count} transactions (expected 0)")
                else:
                    print(f"⚠️  MOLLIE: {mollie_count} transactions (expected 0)")
                
                # Test Zahlungen Data Structure
                if zahlungen:
                    sample = zahlungen[0]
                    required_fields = [
                        'datum', 'anbieter', 'betrag', 'waehrung', 'verwendungszweck', 
                        'gegenkonto', 'istZugeordnet', 'zugeordneteRechnung', 'zugeordnetesKonto'
                    ]
                    
                    print(f"\n🔍 ZAHLUNGEN DATA STRUCTURE TEST:")
                    print(f"   Testing sample transaction: {sample.get('zahlungId', 'N/A')}")
                    
                    # Check all required fields are present
                    missing_fields = [field for field in required_fields if field not in sample]
                    if not missing_fields:
                        print(f"✅ FIELD PRESENCE: All required fields present")
                    else:
                        print(f"❌ FIELD PRESENCE: Missing fields: {missing_fields}")
                    
                    # Check field types and values
                    field_tests = []
                    
                    # datum should be string (ISO format)
                    if isinstance(sample.get('datum'), str):
                        field_tests.append(("datum", "✅", f"string: {sample.get('datum')}"))
                    else:
                        field_tests.append(("datum", "❌", f"not string: {type(sample.get('datum'))}"))
                    
                    # anbieter should be string (not zahlungsanbieter)
                    if 'anbieter' in sample and isinstance(sample.get('anbieter'), str):
                        field_tests.append(("anbieter", "✅", f"string: {sample.get('anbieter')}"))
                    else:
                        field_tests.append(("anbieter", "❌", f"missing or not string"))
                    
                    # betrag should be number
                    if isinstance(sample.get('betrag'), (int, float)):
                        field_tests.append(("betrag", "✅", f"number: {sample.get('betrag')}"))
                    else:
                        field_tests.append(("betrag", "❌", f"not number: {type(sample.get('betrag'))}"))
                    
                    # waehrung should be string
                    if isinstance(sample.get('waehrung'), str):
                        field_tests.append(("waehrung", "✅", f"string: {sample.get('waehrung')}"))
                    else:
                        field_tests.append(("waehrung", "❌", f"not string: {type(sample.get('waehrung'))}"))
                    
                    # verwendungszweck should be string
                    if isinstance(sample.get('verwendungszweck'), str):
                        field_tests.append(("verwendungszweck", "✅", f"string: {sample.get('verwendungszweck')[:50]}..."))
                    else:
                        field_tests.append(("verwendungszweck", "❌", f"not string: {type(sample.get('verwendungszweck'))}"))
                    
                    # gegenkonto should be string
                    if isinstance(sample.get('gegenkonto'), str):
                        field_tests.append(("gegenkonto", "✅", f"string: {sample.get('gegenkonto')[:30]}..."))
                    else:
                        field_tests.append(("gegenkonto", "❌", f"not string: {type(sample.get('gegenkonto'))}"))
                    
                    # istZugeordnet should be boolean
                    if isinstance(sample.get('istZugeordnet'), bool):
                        field_tests.append(("istZugeordnet", "✅", f"boolean: {sample.get('istZugeordnet')}"))
                    else:
                        field_tests.append(("istZugeordnet", "❌", f"not boolean: {type(sample.get('istZugeordnet'))}"))
                    
                    # zugeordneteRechnung should be nullable string
                    zugeordnete_rechnung = sample.get('zugeordneteRechnung')
                    if zugeordnete_rechnung is None or isinstance(zugeordnete_rechnung, str):
                        field_tests.append(("zugeordneteRechnung", "✅", f"nullable string: {zugeordnete_rechnung}"))
                    else:
                        field_tests.append(("zugeordneteRechnung", "❌", f"not nullable string: {type(zugeordnete_rechnung)}"))
                    
                    # zugeordnetesKonto should be nullable string
                    zugeordnetes_konto = sample.get('zugeordnetesKonto')
                    if zugeordnetes_konto is None or isinstance(zugeordnetes_konto, str):
                        field_tests.append(("zugeordnetesKonto", "✅", f"nullable string: {zugeordnetes_konto}"))
                    else:
                        field_tests.append(("zugeordnetesKonto", "❌", f"not nullable string: {type(zugeordnetes_konto)}"))
                    
                    # Print field test results
                    for field, status, details in field_tests:
                        print(f"   {status} {field}: {details}")
                    
                    # Check for forbidden field names
                    forbidden_fields = ['zahlungsdatum', 'zahlungsanbieter']
                    found_forbidden = [field for field in forbidden_fields if field in sample]
                    if not found_forbidden:
                        print(f"✅ FIELD NAMES: No forbidden field names found")
                    else:
                        print(f"❌ FIELD NAMES: Found forbidden fields: {found_forbidden}")
                
                else:
                    print(f"❌ NO DATA: No zahlungen found in response")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 2: Date Filtering Test - Different Date Ranges
    print("\n🔍 TEST 2: Date Filtering Test - Different Date Ranges")
    print("-" * 60)
    
    try:
        # Test with smaller date range (1 week)
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-07"
        print(f"Testing 1-week range: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zahlungen = data.get('zahlungen', [])
                
                print(f"✅ SUCCESS: 1-week range response OK")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Gesamtsumme: €{stats.get('gesamtsumme', 0):.2f}")
                print(f"   - From: {data.get('from')}")
                print(f"   - To: {data.get('to')}")
                
                # Verify date filtering works
                if zahlungen:
                    # Check if all transactions are within date range
                    start_date = datetime.strptime("2025-10-01", "%Y-%m-%d")
                    end_date = datetime.strptime("2025-10-07", "%Y-%m-%d")
                    
                    date_violations = []
                    for zahlung in zahlungen[:10]:  # Check first 10
                        try:
                            zahlung_date = datetime.strptime(zahlung.get('datum', '')[:10], "%Y-%m-%d")
                            if not (start_date <= zahlung_date <= end_date):
                                date_violations.append(zahlung.get('datum'))
                        except:
                            date_violations.append(f"Invalid date: {zahlung.get('datum')}")
                    
                    if not date_violations:
                        print(f"✅ DATE FILTERING: All transactions within date range")
                    else:
                        print(f"❌ DATE FILTERING: Found violations: {date_violations[:3]}")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 3: Provider Filtering Test
    print("\n🔍 TEST 3: Provider Filtering Test")
    print("-" * 60)
    
    try:
        # Test filtering by specific provider (Amazon)
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-31&anbieter=Amazon"
        print(f"Testing Amazon filter: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zahlungen = data.get('zahlungen', [])
                
                print(f"✅ SUCCESS: Amazon filter response OK")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Gesamtsumme: €{stats.get('gesamtsumme', 0):.2f}")
                
                # Verify only Amazon transactions returned
                if zahlungen:
                    non_amazon = [z for z in zahlungen[:10] if z.get('anbieter') != 'Amazon']
                    if not non_amazon:
                        print(f"✅ PROVIDER FILTERING: Only Amazon transactions returned")
                    else:
                        print(f"❌ PROVIDER FILTERING: Found non-Amazon transactions: {[z.get('anbieter') for z in non_amazon]}")
                
                # Verify stats only show Amazon
                anbieter_stats = stats.get('anbieter', {})
                if len(anbieter_stats) == 1 and 'Amazon' in anbieter_stats:
                    print(f"✅ PROVIDER STATS: Only Amazon in stats")
                else:
                    print(f"❌ PROVIDER STATS: Multiple providers in stats: {list(anbieter_stats.keys())}")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 4: Response Structure Validation
    print("\n🔍 TEST 4: Response Structure Validation")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-31&limit=100"
        print(f"Testing response structure: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Test top-level structure
            required_top_fields = ['ok', 'from', 'to', 'stats', 'zahlungen']
            missing_top_fields = [field for field in required_top_fields if field not in data]
            
            if not missing_top_fields:
                print(f"✅ TOP LEVEL: All required fields present")
            else:
                print(f"❌ TOP LEVEL: Missing fields: {missing_top_fields}")
            
            # Test stats structure
            stats = data.get('stats', {})
            required_stats_fields = ['gesamt', 'gesamtsumme', 'anbieter']
            missing_stats_fields = [field for field in required_stats_fields if field not in stats]
            
            if not missing_stats_fields:
                print(f"✅ STATS STRUCTURE: All required fields present")
            else:
                print(f"❌ STATS STRUCTURE: Missing fields: {missing_stats_fields}")
            
            # Test anbieter structure
            anbieter = stats.get('anbieter', {})
            if anbieter:
                sample_provider = list(anbieter.keys())[0]
                provider_stats = anbieter[sample_provider]
                required_provider_fields = ['anzahl', 'summe']
                missing_provider_fields = [field for field in required_provider_fields if field not in provider_stats]
                
                if not missing_provider_fields:
                    print(f"✅ PROVIDER STRUCTURE: All required fields present")
                else:
                    print(f"❌ PROVIDER STRUCTURE: Missing fields: {missing_provider_fields}")
            
            # Test zahlungen array structure
            zahlungen = data.get('zahlungen', [])
            if zahlungen:
                print(f"✅ ZAHLUNGEN ARRAY: {len(zahlungen)} transactions returned")
                
                # Verify limit works
                if len(zahlungen) <= 100:
                    print(f"✅ LIMIT: Returned {len(zahlungen)} transactions (limit=100)")
                else:
                    print(f"❌ LIMIT: Returned {len(zahlungen)} transactions (exceeds limit=100)")
            else:
                print(f"❌ ZAHLUNGEN ARRAY: Empty array returned")
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    print("\n" + "=" * 80)
    print("FIBU ZAHLUNGEN API TESTING COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    test_fibu_zahlungen_api()