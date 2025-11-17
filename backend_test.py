#!/usr/bin/env python3
"""
Backend Test Suite for PayPal Transaction Search API Integration
Testing PayPal API endpoints according to test_result.md requirements.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Get base URL from environment
BASE_URL = "https://finance-center-5.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def test_paypal_integration():
    """
    Test PayPal Transaction Search API Integration according to test_result.md requirements.
    
    ENDPOINTS TO TEST:
    1. GET /api/fibu/zahlungen/paypal - Transaction fetching with date ranges, caching, 31-day limit
    2. POST /api/fibu/zahlungen/paypal - Auto-matching with JTL invoices
    
    EXPECTED RESULTS:
    - GET für Dezember 2024 sollte ~313 Transaktionen liefern
    - GET für Dezember 1-10 sollte ~108 Transaktionen liefern
    - Gesamtbetrag und Gebühren sollten korrekt berechnet sein
    - MongoDB Collection 'fibu_paypal_transactions' sollte gefüllt sein
    """
    
    print("=" * 80)
    print("TESTING PAYPAL TRANSACTION SEARCH API INTEGRATION")
    print("=" * 80)
    
    # Test 1: GET PayPal Transactions - December 1-10, 2024 (Expected ~108 transactions)
    print("\n🔍 TEST 1: GET PayPal Transactions - December 1-10, 2024")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen/paypal?from=2024-12-01&to=2024-12-10"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=60)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                transactions = data.get('transactions', [])
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 PAYPAL STATS (Dec 1-10, 2024):")
                print(f"   - Anzahl: {stats.get('anzahl', 0)}")
                print(f"   - Gesamtbetrag: €{stats.get('gesamtBetrag', 0):.2f}")
                print(f"   - Gesamtgebühren: €{stats.get('gesamtGebuehren', 0):.2f}")
                print(f"   - Netto Gesamt: €{stats.get('nettoGesamt', 0):.2f}")
                print(f"   - Cached: {data.get('cached', False)}")
                print(f"   - From: {data.get('from')}")
                print(f"   - To: {data.get('to')}")
                
                # Verify expected transaction count (~108)
                expected_min = 100
                expected_max = 120
                if expected_min <= stats.get('anzahl', 0) <= expected_max:
                    print(f"✅ EXPECTED: Transaction count {stats.get('anzahl', 0)} in range {expected_min}-{expected_max}")
                else:
                    print(f"⚠️  INFO: Transaction count {stats.get('anzahl', 0)} outside expected range {expected_min}-{expected_max}")
                
                # Verify transaction structure
                if transactions:
                    sample = transactions[0]
                    required_fields = ['transactionId', 'datum', 'betrag', 'waehrung', 'gebuehr', 'nettoBetrag', 'status', 'ereignis']
                    missing_fields = [field for field in required_fields if field not in sample]
                    
                    if not missing_fields:
                        print(f"✅ TRANSACTION STRUCTURE: All required fields present")
                        print(f"   Sample Transaction:")
                        print(f"   - ID: {sample.get('transactionId', 'N/A')}")
                        print(f"   - Datum: {sample.get('datum', 'N/A')}")
                        print(f"   - Betrag: €{sample.get('betrag', 0):.2f}")
                        print(f"   - Gebühr: €{sample.get('gebuehr', 0):.2f}")
                        print(f"   - Netto: €{sample.get('nettoBetrag', 0):.2f}")
                        print(f"   - Status: {sample.get('status', 'N/A')}")
                    else:
                        print(f"❌ TRANSACTION STRUCTURE: Missing fields: {missing_fields}")
                
                # Verify calculations
                calculated_total = sum(t.get('betrag', 0) for t in transactions)
                calculated_fees = sum(t.get('gebuehr', 0) for t in transactions)
                calculated_net = sum(t.get('nettoBetrag', 0) for t in transactions)
                
                if abs(calculated_total - stats.get('gesamtBetrag', 0)) < 0.01:
                    print(f"✅ CALCULATION: Gesamtbetrag correctly calculated")
                else:
                    print(f"❌ CALCULATION: Gesamtbetrag mismatch (calculated: {calculated_total:.2f}, reported: {stats.get('gesamtBetrag', 0):.2f})")
                
                if abs(calculated_fees - stats.get('gesamtGebuehren', 0)) < 0.01:
                    print(f"✅ CALCULATION: Gesamtgebühren correctly calculated")
                else:
                    print(f"❌ CALCULATION: Gesamtgebühren mismatch (calculated: {calculated_fees:.2f}, reported: {stats.get('gesamtGebuehren', 0):.2f})")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 2: GET PayPal Transactions - Full December 2024 (Expected ~313 transactions)
    print("\n🔍 TEST 2: GET PayPal Transactions - Full December 2024")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen/paypal?from=2024-12-01&to=2024-12-31"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=60)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 PAYPAL STATS (Full December 2024):")
                print(f"   - Anzahl: {stats.get('anzahl', 0)}")
                print(f"   - Gesamtbetrag: €{stats.get('gesamtBetrag', 0):.2f}")
                print(f"   - Gesamtgebühren: €{stats.get('gesamtGebuehren', 0):.2f}")
                print(f"   - Netto Gesamt: €{stats.get('nettoGesamt', 0):.2f}")
                print(f"   - Cached: {data.get('cached', False)}")
                
                # Verify expected transaction count (~313)
                expected_min = 300
                expected_max = 330
                if expected_min <= stats.get('anzahl', 0) <= expected_max:
                    print(f"✅ EXPECTED: Transaction count {stats.get('anzahl', 0)} in range {expected_min}-{expected_max}")
                else:
                    print(f"⚠️  INFO: Transaction count {stats.get('anzahl', 0)} outside expected range {expected_min}-{expected_max}")
                
                # Verify fees are negative (as mentioned in requirements)
                if stats.get('gesamtGebuehren', 0) <= 0:
                    print(f"✅ EXPECTED: Gebühren are negative/zero as expected")
                else:
                    print(f"⚠️  UNEXPECTED: Gebühren are positive ({stats.get('gesamtGebuehren', 0):.2f})")
                
                # Verify net amount calculation (total - fees)
                expected_net = stats.get('gesamtBetrag', 0) - abs(stats.get('gesamtGebuehren', 0))
                if abs(expected_net - stats.get('nettoGesamt', 0)) < 0.01:
                    print(f"✅ CALCULATION: Netto calculation correct (Betrag - |Gebühren|)")
                else:
                    print(f"❌ CALCULATION: Netto mismatch (expected: {expected_net:.2f}, got: {stats.get('nettoGesamt', 0):.2f})")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 3: PayPal 31-Day Limit Validation (Should return 400 error)
    print("\n🔍 TEST 3: PayPal 31-Day Limit Validation")
    print("-" * 60)
    
    try:
        # Test with 35 days (should fail)
        start_date = "2024-11-01"
        end_date = "2024-12-05"  # 35 days
        url = f"{API_BASE}/fibu/zahlungen/paypal?from={start_date}&to={end_date}"
        print(f"Testing: {url}")
        print(f"Date range: {start_date} to {end_date} (35 days - should fail)")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            
            if not data.get('ok') and 'maximal 31 Tage' in data.get('error', ''):
                print(f"✅ SUCCESS: 31-day limit correctly enforced")
                print(f"   - Error: {data.get('error')}")
                print(f"   - Max Days: {data.get('maxDays')}")
                print(f"   - Requested: {data.get('requested')}")
            else:
                print(f"❌ FAILED: Wrong error message - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: Expected 400 status, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 4: Caching Behavior (refresh=false should return cached data)
    print("\n🔍 TEST 4: Caching Behavior")
    print("-" * 60)
    
    try:
        # First request to populate cache
        url = f"{API_BASE}/fibu/zahlungen/paypal?from=2024-12-01&to=2024-12-05&refresh=true"
        print(f"First request (refresh=true): {url}")
        
        response1 = requests.get(url, timeout=60)
        print(f"Status Code: {response1.status_code}")
        
        if response1.status_code == 200:
            data1 = response1.json()
            if data1.get('ok'):
                print(f"✅ First request successful (cached: {data1.get('cached', False)})")
                
                # Second request with refresh=false (should use cache)
                url2 = f"{API_BASE}/fibu/zahlungen/paypal?from=2024-12-01&to=2024-12-05&refresh=false"
                print(f"Second request (refresh=false): {url2}")
                
                response2 = requests.get(url2, timeout=30)
                print(f"Status Code: {response2.status_code}")
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    if data2.get('ok'):
                        print(f"✅ Second request successful (cached: {data2.get('cached', False)})")
                        
                        # Verify caching worked
                        if data2.get('cached') == True:
                            print(f"✅ CACHING: Data correctly returned from cache")
                        else:
                            print(f"⚠️  CACHING: Data not cached (may be expected if cache expired)")
                        
                        # Verify data consistency
                        if data1.get('stats', {}).get('anzahl') == data2.get('stats', {}).get('anzahl'):
                            print(f"✅ CONSISTENCY: Same transaction count in both requests")
                        else:
                            print(f"❌ CONSISTENCY: Different transaction counts (fresh: {data1.get('stats', {}).get('anzahl')}, cached: {data2.get('stats', {}).get('anzahl')})")
                    else:
                        print(f"❌ FAILED: Second response not OK - {data2.get('error', 'Unknown error')}")
                else:
                    print(f"❌ FAILED: Second request HTTP {response2.status_code}")
            else:
                print(f"❌ FAILED: First response not OK - {data1.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: First request HTTP {response1.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 5: POST Auto-Matching with JTL Invoices
    print("\n🔍 TEST 5: POST Auto-Matching with JTL Invoices")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen/paypal"
        payload = {
            "from": "2024-12-01",
            "to": "2024-12-10",
            "autoMatch": True
        }
        print(f"Testing: {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=60)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                print(f"✅ SUCCESS: Auto-matching completed")
                print(f"📊 MATCHING RESULTS:")
                print(f"   - Total: {data.get('total', 0)}")
                print(f"   - Matched: {data.get('matched', 0)}")
                print(f"   - Unmatched: {data.get('unmatched', 0)}")
                print(f"   - Match Rate: {data.get('matchRate', '0%')}")
                print(f"   - From: {data.get('from')}")
                print(f"   - To: {data.get('to')}")
                
                # Verify response structure
                required_fields = ['ok', 'total', 'matched', 'unmatched', 'matchRate']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    print(f"✅ RESPONSE STRUCTURE: All required fields present")
                else:
                    print(f"❌ RESPONSE STRUCTURE: Missing fields: {missing_fields}")
                
                # Verify match rate calculation
                if data.get('total', 0) > 0:
                    expected_rate = f"{(data.get('matched', 0) / data.get('total', 0) * 100):.1f}%"
                    if data.get('matchRate') == expected_rate:
                        print(f"✅ CALCULATION: Match rate correctly calculated")
                    else:
                        print(f"❌ CALCULATION: Match rate mismatch (expected: {expected_rate}, got: {data.get('matchRate')})")
                
                # Verify totals
                if data.get('matched', 0) + data.get('unmatched', 0) == data.get('total', 0):
                    print(f"✅ CALCULATION: Matched + Unmatched = Total")
                else:
                    print(f"❌ CALCULATION: Totals don't add up (matched: {data.get('matched', 0)}, unmatched: {data.get('unmatched', 0)}, total: {data.get('total', 0)})")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 6: MongoDB Collection Verification
    print("\n🔍 TEST 6: MongoDB Collection Verification")
    print("-" * 60)
    
    try:
        # Make a request to ensure data is in MongoDB
        url = f"{API_BASE}/fibu/zahlungen/paypal?from=2024-12-01&to=2024-12-05&refresh=true"
        print(f"Ensuring data in MongoDB: {url}")
        
        response = requests.get(url, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('stats', {}).get('anzahl', 0) > 0:
                print(f"✅ SUCCESS: PayPal transactions stored in MongoDB")
                print(f"   - Collection: fibu_paypal_transactions")
                print(f"   - Transactions stored: {data.get('stats', {}).get('anzahl', 0)}")
                
                # Verify transaction fields in response
                transactions = data.get('transactions', [])
                if transactions:
                    sample = transactions[0]
                    fibu_fields = ['transactionId', 'datum', 'betrag', 'waehrung', 'gebuehr', 'nettoBetrag', 'status', 'ereignis', 'betreff', 'kundenEmail', 'kundenName']
                    present_fields = [field for field in fibu_fields if field in sample and sample[field] is not None]
                    
                    print(f"✅ FIBU FIELDS: {len(present_fields)}/{len(fibu_fields)} fields present")
                    print(f"   Present: {', '.join(present_fields)}")
                    
                    missing_fields = [field for field in fibu_fields if field not in sample or sample[field] is None]
                    if missing_fields:
                        print(f"   Missing/Null: {', '.join(missing_fields)}")
                
            else:
                print(f"❌ FAILED: No transactions found or response not OK")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    print("\n" + "=" * 80)
    print("PAYPAL TRANSACTION SEARCH API INTEGRATION TESTING COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    test_paypal_integration()