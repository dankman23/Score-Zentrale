#!/usr/bin/env python3
"""
FIBU Backend Testing - Buchungslogik & Auto-Match Verbesserungen
Tests für die spezifischen APIs aus dem Review Request
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Base URL aus .env
BASE_URL = "https://invoice-sync-7.preview.emergentagent.com"

class FIBUBackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.results = []
        self.errors = []
        
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
        if not success:
            self.errors.append(result)
    
    def make_request(self, method: str, endpoint: str, **kwargs) -> tuple[bool, Any]:
        """Make HTTP request and handle errors"""
        try:
            url = f"{self.base_url}{endpoint}"
            print(f"🔄 {method} {url}")
            
            response = requests.request(method, url, timeout=30, **kwargs)
            
            # Log response status
            print(f"   Status: {response.status_code}")
            
            if response.status_code >= 400:
                print(f"   Error Response: {response.text[:500]}")
                return False, {"error": response.text, "status": response.status_code}
            
            try:
                data = response.json()
                return True, data
            except:
                return True, response.text
                
        except Exception as e:
            print(f"   Exception: {str(e)}")
            return False, {"error": str(e)}

    def test_amazon_settlements_api(self):
        """Test 1: Amazon Settlements API mit Buchungsinformationen"""
        print("\n" + "="*60)
        print("TEST 1: Amazon Settlements API mit Buchungsinformationen")
        print("="*60)
        
        # Test mit Oktober 2025 Daten
        endpoint = "/api/fibu/zahlungen/amazon-settlements?from=2025-10-01&to=2025-10-31&refresh=true"
        
        success, data = self.make_request("GET", endpoint)
        
        if not success:
            self.log_result("Amazon Settlements API", False, f"API call failed: {data}")
            return
        
        # Prüfe Response Structure
        required_fields = ['ok', 'settlements', 'stats']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_result("Amazon Settlements API", False, f"Missing fields: {missing_fields}")
            return
        
        if not data.get('ok'):
            self.log_result("Amazon Settlements API", False, f"API returned ok=false: {data.get('error', 'Unknown error')}")
            return
        
        settlements = data.get('settlements', [])
        stats = data.get('stats', {})
        
        # Prüfe ob Settlements vorhanden
        if len(settlements) == 0:
            self.log_result("Amazon Settlements API", False, "No settlements found for October 2025")
            return
        
        # Prüfe erste Settlement auf Buchungsinformationen
        first_settlement = settlements[0]
        
        # Prüfe ob buchung Feld existiert (das ist das neue Feature!)
        if 'buchung' not in first_settlement:
            self.log_result("Amazon Settlements Buchung", False, "Settlement missing 'buchung' field")
            return
        
        buchung = first_settlement.get('buchung')
        if not buchung:
            self.log_result("Amazon Settlements Buchung", False, "Settlement has null buchung field")
            return
        
        # Prüfe Buchungsfelder
        required_buchung_fields = ['sollKonto', 'habenKonto', 'nettoBetrag', 'mwstBetrag', 'bruttoBetrag', 'buchungstext', 'gegenkontoTyp']
        missing_buchung_fields = [f for f in required_buchung_fields if f not in buchung]
        
        if missing_buchung_fields:
            self.log_result("Amazon Settlements Buchung", False, f"Buchung missing fields: {missing_buchung_fields}")
            return
        
        # Prüfe Buchungslogik für verschiedene AmountTypes
        test_cases = [
            {'amountType': 'Principal', 'expectedSoll': '1815', 'expectedHaben': '69001', 'expectedMwst': 19},
            {'amountType': 'Shipping', 'expectedSoll': '1815', 'expectedHaben': '4800', 'expectedMwst': 19},
            {'amountType': 'Commission', 'expectedSoll': '6770', 'expectedHaben': '1815', 'expectedMwst': 19},
        ]
        
        buchung_tests_passed = 0
        for test_case in test_cases:
            matching_settlements = [s for s in settlements if s.get('amountType') == test_case['amountType']]
            
            if matching_settlements:
                settlement = matching_settlements[0]
                buchung = settlement.get('buchung', {})
                
                soll_ok = buchung.get('sollKonto') == test_case['expectedSoll']
                haben_ok = buchung.get('habenKonto') == test_case['expectedHaben']
                mwst_ok = buchung.get('mwstSatz') == test_case['expectedMwst']
                
                if soll_ok and haben_ok and mwst_ok:
                    buchung_tests_passed += 1
                    print(f"   ✅ {test_case['amountType']}: Soll={buchung.get('sollKonto')}, Haben={buchung.get('habenKonto')}, MwSt={buchung.get('mwstSatz')}%")
                else:
                    print(f"   ❌ {test_case['amountType']}: Expected Soll={test_case['expectedSoll']}, Got={buchung.get('sollKonto')}")
        
        self.log_result("Amazon Settlements API", True, f"API working, {len(settlements)} settlements, {buchung_tests_passed}/{len(test_cases)} buchung tests passed")
        self.log_result("Amazon Settlements Buchung", buchung_tests_passed >= 2, f"Buchungslogik working for {buchung_tests_passed}/{len(test_cases)} amount types")
    
    def test_zahlungen_api_with_buchung(self):
        """Test 2: Zahlungen API mit Buchungsinformationen"""
        print("\n" + "="*60)
        print("TEST 2: Zahlungen API mit Buchungsinformationen")
        print("="*60)
        
        endpoint = "/api/fibu/zahlungen?from=2025-10-01&to=2025-10-31&anbieter=Amazon"
        
        success, data = self.make_request("GET", endpoint)
        
        if not success:
            self.log_result("Zahlungen API", False, f"API call failed: {data}")
            return
        
        if not data.get('ok'):
            self.log_result("Zahlungen API", False, f"API returned ok=false: {data.get('error', 'Unknown error')}")
            return
        
        zahlungen = data.get('zahlungen', [])
        stats = data.get('stats', {})
        
        if len(zahlungen) == 0:
            self.log_result("Zahlungen API", False, "No Amazon payments found for October 2025")
            return
        
        # Prüfe ob Amazon Zahlungen buchung Feld haben
        amazon_zahlungen = [z for z in zahlungen if z.get('anbieter') == 'Amazon']
        
        if not amazon_zahlungen:
            self.log_result("Zahlungen API", False, "No Amazon payments in response despite anbieter=Amazon filter")
            return
        
        # Prüfe erste Amazon Zahlung auf Buchungsinformationen
        first_amazon = amazon_zahlungen[0]
        
        if 'buchung' not in first_amazon:
            self.log_result("Zahlungen Buchung", False, "Amazon payment missing 'buchung' field")
            return
        
        buchung = first_amazon.get('buchung')
        if buchung:
            required_fields = ['sollKonto', 'habenKonto', 'gegenkontoTyp']
            has_all_fields = all(f in buchung for f in required_fields)
            
            if has_all_fields:
                self.log_result("Zahlungen Buchung", True, f"Buchung info present: Soll={buchung.get('sollKonto')}, Haben={buchung.get('habenKonto')}, Typ={buchung.get('gegenkontoTyp')}")
            else:
                self.log_result("Zahlungen Buchung", False, f"Buchung incomplete: {buchung}")
        else:
            self.log_result("Zahlungen Buchung", False, "Amazon payment has null buchung field")
        
        self.log_result("Zahlungen API", True, f"API working, {len(amazon_zahlungen)} Amazon payments found")
    
    def test_alle_rechnungen_api(self):
        """Test 3: Alle Rechnungen API (inkl. cBestellNr)"""
        print("\n" + "="*60)
        print("TEST 3: Alle Rechnungen API (inkl. cBestellNr)")
        print("="*60)
        
        endpoint = "/api/fibu/rechnungen/alle?from=2025-10-01&to=2025-10-31"
        
        success, data = self.make_request("GET", endpoint)
        
        if not success:
            self.log_result("Alle Rechnungen API", False, f"API call failed: {data}")
            return
        
        if not data.get('ok'):
            self.log_result("Alle Rechnungen API", False, f"API returned ok=false: {data.get('error', 'Unknown error')}")
            return
        
        rechnungen = data.get('rechnungen', [])
        stats = data.get('stats', {})
        
        if len(rechnungen) == 0:
            self.log_result("Alle Rechnungen API", False, "No invoices found for October 2025")
            return
        
        # Prüfe verschiedene Rechnungstypen
        normale_rechnungen = [r for r in rechnungen if r.get('quelle') == 'RECHNUNG']
        externe_rechnungen = [r for r in rechnungen if r.get('quelle') == 'EXTERN']
        gutschriften = [r for r in rechnungen if r.get('quelle') == 'GUTSCHRIFT']
        
        # Prüfe externe Rechnungen (XRE-Format)
        xre_rechnungen = [r for r in externe_rechnungen if r.get('belegnummer', '').startswith('XRE-')]
        
        # Prüfe cBestellNr Feld
        rechnungen_mit_bestellnr = [r for r in rechnungen if r.get('cBestellNr')]
        
        # Prüfe Herkunft bei externen Rechnungen
        amazon_externe = [r for r in externe_rechnungen if 'Amazon' in str(r.get('herkunft', ''))]
        
        self.log_result("Alle Rechnungen API", True, f"API working, {len(rechnungen)} total invoices")
        self.log_result("Externe Rechnungen", len(externe_rechnungen) > 0, f"{len(externe_rechnungen)} externe Rechnungen, {len(xre_rechnungen)} XRE-Format")
        self.log_result("cBestellNr Feld", len(rechnungen_mit_bestellnr) > 0, f"{len(rechnungen_mit_bestellnr)} Rechnungen mit cBestellNr")
        self.log_result("Amazon Herkunft", len(amazon_externe) > 0, f"{len(amazon_externe)} Amazon externe Rechnungen")
        
        # Zeige Beispiel externe Rechnung
        if externe_rechnungen:
            beispiel = externe_rechnungen[0]
            print(f"   Beispiel externe Rechnung: {beispiel.get('belegnummer')} - Herkunft: {beispiel.get('herkunft')} - cBestellNr: {beispiel.get('cBestellNr')}")
    
    def test_auto_match_api(self):
        """Test 4: Auto-Match mit verbesserter Logik"""
        print("\n" + "="*60)
        print("TEST 4: Auto-Match mit verbesserter Logik")
        print("="*60)
        
        endpoint = "/api/fibu/auto-match"
        payload = {
            "zeitraum": "2025-10-01_2025-10-31",
            "dryRun": True
        }
        
        success, data = self.make_request("POST", endpoint, json=payload)
        
        if not success:
            self.log_result("Auto-Match API", False, f"API call failed: {data}")
            return
        
        if not data.get('ok'):
            self.log_result("Auto-Match API", False, f"API returned ok=false: {data.get('error', 'Unknown error')}")
            return
        
        matched = data.get('matched', [])
        stats = data.get('stats', {})
        by_method = stats.get('byMethod', {})
        
        # Prüfe neue Matching-Methoden
        expected_methods = ['amazonOrderIdXRE', 'auNummerDirekt', 'auNummerBetragDatum']
        found_methods = []
        
        for method in expected_methods:
            if method in by_method and by_method[method] > 0:
                found_methods.append(method)
                print(f"   ✅ {method}: {by_method[method]} matches")
            else:
                print(f"   ⚠️  {method}: {by_method.get(method, 0)} matches")
        
        total_matched = stats.get('matched', 0)
        total_zahlungen = stats.get('totalZahlungen', 0)
        
        self.log_result("Auto-Match API", True, f"API working, {total_matched}/{total_zahlungen} payments matched")
        self.log_result("Auto-Match Methoden", len(found_methods) >= 1, f"New methods working: {found_methods}")
        
        # Zeige Statistiken
        print(f"   Total Zahlungen: {total_zahlungen}")
        print(f"   Total Matched: {total_matched}")
        print(f"   Match Rate: {(total_matched/total_zahlungen*100):.1f}%" if total_zahlungen > 0 else "   Match Rate: 0%")
        
        # Zeige alle Methoden
        for method, count in by_method.items():
            if count > 0:
                print(f"   {method}: {count}")
    
    def test_mongodb_collections(self):
        """Test 5: Prüfe ob MongoDB Collections existieren"""
        print("\n" + "="*60)
        print("TEST 5: MongoDB Collections Check")
        print("="*60)
        
        # Test über API-Aufrufe ob Collections befüllt sind
        collections_to_check = [
            ("/api/fibu/zahlungen/amazon-settlements?from=2025-10-01&to=2025-10-01&refresh=false", "fibu_amazon_settlements"),
            ("/api/fibu/rechnungen/alle?from=2025-10-01&to=2025-10-01", "fibu_rechnungen_alle"),
        ]
        
        for endpoint, collection_name in collections_to_check:
            success, data = self.make_request("GET", endpoint)
            
            if success and data.get('ok'):
                # Prüfe ob Daten vorhanden
                if 'settlements' in data:
                    count = len(data.get('settlements', []))
                elif 'rechnungen' in data:
                    count = len(data.get('rechnungen', []))
                else:
                    count = 0
                
                self.log_result(f"Collection {collection_name}", count > 0, f"{count} records found")
            else:
                self.log_result(f"Collection {collection_name}", False, f"Could not check collection: {data}")
    
    def run_all_tests(self):
        """Run all FIBU backend tests"""
        print("🚀 Starting FIBU Backend Tests")
        print(f"Base URL: {self.base_url}")
        print("="*80)
        
        # Run tests in order
        self.test_amazon_settlements_api()
        self.test_zahlungen_api_with_buchung()
        self.test_alle_rechnungen_api()
        self.test_auto_match_api()
        self.test_mongodb_collections()
        
        # Summary
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.errors:
            print("\n🔥 FAILED TESTS:")
            for error in self.errors:
                print(f"   ❌ {error['test']}: {error['details']}")
        
        print("\n📋 ALL TEST RESULTS:")
        for result in self.results:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}: {result['details']}")
        
        return failed_tests == 0

def test_fibu_zahlungen_api():
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