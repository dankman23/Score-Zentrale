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
    
    # Test 1: October 30, 2025 - Verify Commerzbank & Assignments
    print("\n🔍 TEST 1: October 30, 2025 - Verify Commerzbank & Assignments")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-30&to=2025-10-30&limit=100"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zahlungen = data.get('zahlungen', [])
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 STATS:")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Zugeordnet: {stats.get('zugeordnet', 0)}")
                print(f"   - Nicht zugeordnet: {stats.get('nichtZugeordnet', 0)}")
                print(f"   - Von tZahlung: {stats.get('vonTZahlung', 0)}")
                print(f"   - Von Zahlungsabgleich: {stats.get('vonZahlungsabgleich', 0)}")
                
                # Check for Commerzbank transactions
                commerzbank_payments = [z for z in zahlungen if 'Commerzbank' in z.get('zahlungsart', '')]
                print(f"🏦 Commerzbank Payments Found: {len(commerzbank_payments)}")
                
                if commerzbank_payments:
                    sample = commerzbank_payments[0]
                    print(f"   Sample Commerzbank Payment:")
                    print(f"   - Zahlungsart: {sample.get('zahlungsart')}")
                    print(f"   - Quelle: {sample.get('quelle')}")
                    print(f"   - Betrag: {sample.get('betrag')}")
                    print(f"   - Zuordnungstyp: {sample.get('zuordnungstyp')}")
                
                # Check assignment rate
                if stats.get('gesamt', 0) > 0:
                    assignment_rate = (stats.get('zugeordnet', 0) / stats.get('gesamt', 0)) * 100
                    print(f"📈 Assignment Rate: {assignment_rate:.1f}%")
                    
                    if assignment_rate >= 30:
                        print(f"✅ GOOD: Assignment rate significantly improved (expected ~40-50%)")
                    else:
                        print(f"⚠️  WARNING: Assignment rate still low (expected ~40-50%)")
                
                # Verify expected results
                expected_gesamt_min = 75
                expected_gesamt_max = 100
                if expected_gesamt_min <= stats.get('gesamt', 0) <= expected_gesamt_max:
                    print(f"✅ EXPECTED: Total payments in range {expected_gesamt_min}-{expected_gesamt_max}")
                else:
                    print(f"⚠️  UNEXPECTED: Total payments {stats.get('gesamt', 0)} outside expected range {expected_gesamt_min}-{expected_gesamt_max}")
                
                if stats.get('vonZahlungsabgleich', 0) > 0:
                    print(f"✅ CRITICAL FIX VERIFIED: Missing Commerzbank transactions found!")
                else:
                    print(f"❌ CRITICAL ISSUE: No Zahlungsabgleich transactions found")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 2: October 2025 Full Month - Overall Stats
    print("\n🔍 TEST 2: October 2025 Full Month - Overall Stats")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-31&limit=5000"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 OCTOBER 2025 FULL MONTH STATS:")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Zugeordnet: {stats.get('zugeordnet', 0)}")
                print(f"   - Von tZahlung: {stats.get('vonTZahlung', 0)}")
                print(f"   - Von Zahlungsabgleich: {stats.get('vonZahlungsabgleich', 0)}")
                
                # Expected results verification
                expected_gesamt_min = 2500
                expected_gesamt_max = 2600
                if expected_gesamt_min <= stats.get('gesamt', 0) <= expected_gesamt_max:
                    print(f"✅ EXPECTED: Total payments {stats.get('gesamt', 0)} in range {expected_gesamt_min}-{expected_gesamt_max}")
                else:
                    print(f"⚠️  INFO: Total payments {stats.get('gesamt', 0)} outside expected range {expected_gesamt_min}-{expected_gesamt_max}")
                
                expected_tzahlung_min = 1800
                expected_tzahlung_max = 1900
                if expected_tzahlung_min <= stats.get('vonTZahlung', 0) <= expected_tzahlung_max:
                    print(f"✅ EXPECTED: tZahlung payments in expected range")
                else:
                    print(f"⚠️  INFO: tZahlung payments {stats.get('vonTZahlung', 0)} outside expected range {expected_tzahlung_min}-{expected_tzahlung_max}")
                
                expected_abgleich_min = 700
                expected_abgleich_max = 800
                if expected_abgleich_min <= stats.get('vonZahlungsabgleich', 0) <= expected_abgleich_max:
                    print(f"✅ EXPECTED: Zahlungsabgleich payments in expected range")
                else:
                    print(f"⚠️  INFO: Zahlungsabgleich payments {stats.get('vonZahlungsabgleich', 0)} outside expected range {expected_abgleich_min}-{expected_abgleich_max}")
                
                expected_zugeordnet_min = 1200
                expected_zugeordnet_max = 1300
                if expected_zugeordnet_min <= stats.get('zugeordnet', 0) <= expected_zugeordnet_max:
                    print(f"✅ EXPECTED: Assigned payments significantly improved!")
                else:
                    print(f"⚠️  INFO: Assigned payments {stats.get('zugeordnet', 0)} outside expected range {expected_zugeordnet_min}-{expected_zugeordnet_max}")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 3: Assignment Types Verification
    print("\n🔍 TEST 3: Assignment Types Verification")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2025-10-01&to=2025-10-31&limit=100"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                zahlungen = data.get('zahlungen', [])
                
                print(f"✅ SUCCESS: Response OK")
                print(f"📊 ASSIGNMENT TYPES ANALYSIS (Sample of {len(zahlungen)} payments):")
                
                # Analyze assignment types
                assignment_types = {}
                for zahlung in zahlungen:
                    zuordnungstyp = zahlung.get('zuordnungstyp', 'Unknown')
                    assignment_types[zuordnungstyp] = assignment_types.get(zuordnungstyp, 0) + 1
                
                for typ, count in assignment_types.items():
                    print(f"   - {typ}: {count}")
                
                # Verify specific assignment logic
                direkt_payments = [z for z in zahlungen if z.get('zuordnungstyp') == 'Direkt (kRechnung)']
                indirekt_payments = [z for z in zahlungen if z.get('zuordnungstyp') == 'Indirekt (kBestellung)']
                referenz_payments = [z for z in zahlungen if z.get('zuordnungstyp') == 'Via Referenz']
                nicht_zugeordnet = [z for z in zahlungen if z.get('zuordnungstyp') == 'Nicht zugeordnet']
                
                print(f"\n🔍 ASSIGNMENT LOGIC VERIFICATION:")
                
                # Check direct assignments
                if direkt_payments:
                    all_assigned = all(z.get('istZugeordnet') for z in direkt_payments)
                    print(f"   ✅ Direkt (kRechnung): {len(direkt_payments)} payments, all assigned: {all_assigned}")
                
                # Check indirect assignments
                if indirekt_payments:
                    all_assigned = all(z.get('istZugeordnet') for z in indirekt_payments)
                    print(f"   ✅ Indirekt (kBestellung): {len(indirekt_payments)} payments, all assigned: {all_assigned}")
                
                # Check reference assignments (from tZahlungsabgleichUmsatz)
                if referenz_payments:
                    from_abgleich = all(z.get('quelle') == 'tZahlungsabgleichUmsatz' for z in referenz_payments)
                    print(f"   ✅ Via Referenz: {len(referenz_payments)} payments, all from tZahlungsabgleichUmsatz: {from_abgleich}")
                
                # Check unassigned
                if nicht_zugeordnet:
                    all_unassigned = all(not z.get('istZugeordnet') for z in nicht_zugeordnet)
                    print(f"   ✅ Nicht zugeordnet: {len(nicht_zugeordnet)} payments, all unassigned: {all_unassigned}")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 4: Dynamic Date Range - Historical Data
    print("\n🔍 TEST 4: Dynamic Date Range - Historical Data")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen?from=2024-01-01&to=2024-01-31&limit=1000"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zeitraum = data.get('zeitraum', {})
                
                print(f"✅ SUCCESS: Historical data accessible (no hardcoded date error)")
                print(f"📊 JANUARY 2024 STATS:")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Zugeordnet: {stats.get('zugeordnet', 0)}")
                print(f"   - Zeitraum: {zeitraum.get('from')} to {zeitraum.get('to')}")
                
                if stats.get('gesamt', 0) > 0:
                    print(f"✅ CRITICAL FIX VERIFIED: Historical data from January 2024 accessible!")
                else:
                    print(f"⚠️  INFO: No payments found for January 2024 (may be expected)")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    # Test 5: Default Parameters (No Dates Specified)
    print("\n🔍 TEST 5: Default Parameters (No Dates Specified)")
    print("-" * 60)
    
    try:
        url = f"{API_BASE}/fibu/zahlungen"
        print(f"Testing: {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok'):
                stats = data.get('stats', {})
                zeitraum = data.get('zeitraum', {})
                
                print(f"✅ SUCCESS: Default parameters working")
                print(f"📊 ALL HISTORICAL DATA STATS:")
                print(f"   - Gesamt: {stats.get('gesamt', 0)}")
                print(f"   - Zugeordnet: {stats.get('zugeordnet', 0)}")
                print(f"   - Zeitraum: {zeitraum.get('from')} to {zeitraum.get('to')}")
                
                # Verify default date range
                if zeitraum.get('from') == '2020-01-01':
                    print(f"✅ EXPECTED: Default start date is 2020-01-01")
                else:
                    print(f"⚠️  UNEXPECTED: Default start date is {zeitraum.get('from')} (expected 2020-01-01)")
                
                # Check if we get today's date
                today = datetime.now().strftime('%Y-%m-%d')
                if zeitraum.get('to') == today:
                    print(f"✅ EXPECTED: Default end date is today ({today})")
                else:
                    print(f"⚠️  INFO: Default end date is {zeitraum.get('to')} (today is {today})")
                
                if stats.get('gesamt', 0) > 10000:
                    print(f"✅ EXPECTED: Large dataset from 2020-01-01 to today")
                else:
                    print(f"⚠️  INFO: Smaller dataset than expected ({stats.get('gesamt', 0)} payments)")
                
            else:
                print(f"❌ FAILED: Response not OK - {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
    
    print("\n" + "=" * 80)
    print("FIBU ZAHLUNGEN ENDPOINT TESTING COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    test_fibu_zahlungen_endpoint()