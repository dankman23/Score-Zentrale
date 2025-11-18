#!/usr/bin/env python3
"""
FIBU Backend Testing - Import-Fix Verification
Tests nach Korrektur der Import-Pfade von relativen Pfaden auf Alias-Pfade (@/)
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Base URL aus .env
BASE_URL = "https://buchungslogik.preview.emergentagent.com"

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

if __name__ == "__main__":
    tester = FIBUBackendTester()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)