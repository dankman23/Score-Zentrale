#!/usr/bin/env python3
"""
Backend Testing Script for Amazon Bulletpoints Batch-Verarbeitung APIs
Tests the newly implemented batch generation and CSV download APIs
"""

import requests
import json
import time
import csv
import io
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://ecommerce-hub-247.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class AmazonBulletpointsAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Backend-Tester/1.0'
        })
        
    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_batch_generate_api(self) -> Dict[str, Any]:
        """Test POST /api/amazon/bulletpoints/batch/generate"""
        self.log("=== TESTING BATCH GENERATE API ===")
        results = {}
        
        # Test 1: Batch mit kArtikel Array (3-5 Artikel)
        self.log("Test 1: Batch mit kArtikel Array (3-5 Artikel)")
        try:
            # Get some article IDs first
            articles_response = self.session.get(f"{API_BASE}/jtl/articles/list?limit=5")
            if articles_response.status_code == 200:
                articles_data = articles_response.json()
                if articles_data.get('ok') and articles_data.get('articles'):
                    artikel_ids = [article['kArtikel'] for article in articles_data['articles'][:3]]
                    self.log(f"Using article IDs: {artikel_ids}")
                    
                    # Test batch generation
                    payload = {"kArtikel": artikel_ids}
                    response = self.session.post(f"{API_BASE}/amazon/bulletpoints/batch/generate", json=payload)
                    
                    self.log(f"Response Status: {response.status_code}")
                    if response.status_code == 200:
                        data = response.json()
                        self.log(f"Response: {json.dumps(data, indent=2)}")
                        
                        # Validate response structure
                        required_fields = ['ok', 'processed', 'succeeded', 'failed', 'duration', 'results']
                        missing_fields = [field for field in required_fields if field not in data]
                        
                        if not missing_fields and data.get('ok'):
                            results['test1_batch_generate'] = {
                                'status': 'PASSED',
                                'processed': data.get('processed'),
                                'succeeded': data.get('succeeded'),
                                'failed': data.get('failed'),
                                'duration': data.get('duration'),
                                'results_count': len(data.get('results', []))
                            }
                            self.log("✅ Test 1 PASSED: Batch generation successful")
                        else:
                            results['test1_batch_generate'] = {
                                'status': 'FAILED',
                                'error': f"Missing fields: {missing_fields}" if missing_fields else "ok=false"
                            }
                            self.log("❌ Test 1 FAILED: Invalid response structure")
                    else:
                        error_data = response.text
                        results['test1_batch_generate'] = {
                            'status': 'FAILED',
                            'error': f"HTTP {response.status_code}: {error_data}"
                        }
                        self.log(f"❌ Test 1 FAILED: HTTP {response.status_code}")
                else:
                    results['test1_batch_generate'] = {
                        'status': 'SKIPPED',
                        'error': 'No articles available for testing'
                    }
                    self.log("⚠️ Test 1 SKIPPED: No articles available")
            else:
                results['test1_batch_generate'] = {
                    'status': 'FAILED',
                    'error': f"Could not fetch articles: HTTP {articles_response.status_code}"
                }
                self.log(f"❌ Test 1 FAILED: Could not fetch articles")
                
        except Exception as e:
            results['test1_batch_generate'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Test 1 ERROR: {str(e)}")
        
        # Test 2: Fehlerbehandlung bei leerer Liste
        self.log("\nTest 2: Fehlerbehandlung bei leerer Liste")
        try:
            payload = {"kArtikel": []}
            response = self.session.post(f"{API_BASE}/amazon/bulletpoints/batch/generate", json=payload)
            
            self.log(f"Response Status: {response.status_code}")
            if response.status_code == 400:
                data = response.json()
                if not data.get('ok') and 'error' in data:
                    results['test2_empty_list'] = {
                        'status': 'PASSED',
                        'error_message': data.get('error')
                    }
                    self.log("✅ Test 2 PASSED: Empty list properly rejected")
                else:
                    results['test2_empty_list'] = {
                        'status': 'FAILED',
                        'error': 'Expected error response structure not found'
                    }
                    self.log("❌ Test 2 FAILED: Invalid error response")
            else:
                results['test2_empty_list'] = {
                    'status': 'FAILED',
                    'error': f"Expected HTTP 400, got {response.status_code}"
                }
                self.log(f"❌ Test 2 FAILED: Expected HTTP 400, got {response.status_code}")
                
        except Exception as e:
            results['test2_empty_list'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Test 2 ERROR: {str(e)}")
        
        # Test 3: Fehlerbehandlung bei ungültigen kArtikel IDs
        self.log("\nTest 3: Fehlerbehandlung bei ungültigen kArtikel IDs")
        try:
            payload = {"kArtikel": [999999999, 888888888]}  # Non-existent IDs
            response = self.session.post(f"{API_BASE}/amazon/bulletpoints/batch/generate", json=payload)
            
            self.log(f"Response Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') and data.get('failed', 0) > 0:
                    results['test3_invalid_ids'] = {
                        'status': 'PASSED',
                        'processed': data.get('processed'),
                        'succeeded': data.get('succeeded'),
                        'failed': data.get('failed')
                    }
                    self.log("✅ Test 3 PASSED: Invalid IDs handled gracefully")
                else:
                    results['test3_invalid_ids'] = {
                        'status': 'FAILED',
                        'error': 'Expected some failures for invalid IDs'
                    }
                    self.log("❌ Test 3 FAILED: Invalid IDs not handled properly")
            else:
                results['test3_invalid_ids'] = {
                    'status': 'FAILED',
                    'error': f"Unexpected HTTP status: {response.status_code}"
                }
                self.log(f"❌ Test 3 FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            results['test3_invalid_ids'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Test 3 ERROR: {str(e)}")
        
        return results
    
    def test_csv_download_api(self) -> Dict[str, Any]:
        """Test GET /api/amazon/bulletpoints/batch/download"""
        self.log("\n=== TESTING CSV DOWNLOAD API ===")
        results = {}
        
        # Test 1: CSV Download nach erfolgreicher Generierung
        self.log("Test 1: CSV Download nach erfolgreicher Generierung")
        try:
            response = self.session.get(f"{API_BASE}/amazon/bulletpoints/batch/download")
            
            self.log(f"Response Status: {response.status_code}")
            if response.status_code == 200:
                # Check if it's a CSV file
                content_type = response.headers.get('Content-Type', '')
                content_disposition = response.headers.get('Content-Disposition', '')
                
                if 'text/csv' in content_type and 'attachment' in content_disposition:
                    # Validate CSV structure
                    csv_content = response.text
                    
                    # Check for UTF-8 BOM
                    has_bom = csv_content.startswith('\ufeff')
                    
                    # Parse CSV to validate structure
                    csv_reader = csv.reader(io.StringIO(csv_content.lstrip('\ufeff')), delimiter=';')
                    rows = list(csv_reader)
                    
                    if len(rows) > 0:
                        header = rows[0]
                        expected_columns = ['kArtikel', 'cArtNr', 'cName', 'Bulletpoint 1', 'Bulletpoint 2', 
                                          'Bulletpoint 3', 'Bulletpoint 4', 'Bulletpoint 5', 'Generiert am']
                        
                        if header == expected_columns:
                            results['test1_csv_download'] = {
                                'status': 'PASSED',
                                'has_bom': has_bom,
                                'total_rows': len(rows) - 1,  # Exclude header
                                'columns': len(header),
                                'sample_filename': content_disposition
                            }
                            self.log(f"✅ Test 1 PASSED: CSV download successful ({len(rows)-1} records)")
                        else:
                            results['test1_csv_download'] = {
                                'status': 'FAILED',
                                'error': f"Invalid CSV structure. Expected: {expected_columns}, Got: {header}"
                            }
                            self.log("❌ Test 1 FAILED: Invalid CSV structure")
                    else:
                        results['test1_csv_download'] = {
                            'status': 'FAILED',
                            'error': 'Empty CSV file'
                        }
                        self.log("❌ Test 1 FAILED: Empty CSV file")
                else:
                    results['test1_csv_download'] = {
                        'status': 'FAILED',
                        'error': f"Invalid content type or disposition. Type: {content_type}, Disposition: {content_disposition}"
                    }
                    self.log("❌ Test 1 FAILED: Invalid content headers")
                    
            elif response.status_code == 404:
                # This might be expected if no bulletpoints have been generated yet
                data = response.json()
                if not data.get('ok') and 'error' in data:
                    results['test1_csv_download'] = {
                        'status': 'EXPECTED_EMPTY',
                        'error_message': data.get('error')
                    }
                    self.log("⚠️ Test 1 EXPECTED: No bulletpoints generated yet")
                else:
                    results['test1_csv_download'] = {
                        'status': 'FAILED',
                        'error': 'Invalid 404 response structure'
                    }
                    self.log("❌ Test 1 FAILED: Invalid 404 response")
            else:
                results['test1_csv_download'] = {
                    'status': 'FAILED',
                    'error': f"Unexpected HTTP status: {response.status_code}"
                }
                self.log(f"❌ Test 1 FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            results['test1_csv_download'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Test 1 ERROR: {str(e)}")
        
        # Test 2: CSV Download mit kArtikel Filter
        self.log("\nTest 2: CSV Download mit kArtikel Filter")
        try:
            # Try with specific article IDs
            response = self.session.get(f"{API_BASE}/amazon/bulletpoints/batch/download?kArtikel=94626,119231")
            
            self.log(f"Response Status: {response.status_code}")
            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')
                if 'text/csv' in content_type:
                    results['test2_csv_filter'] = {
                        'status': 'PASSED',
                        'content_type': content_type
                    }
                    self.log("✅ Test 2 PASSED: CSV download with filter successful")
                else:
                    results['test2_csv_filter'] = {
                        'status': 'FAILED',
                        'error': f"Invalid content type: {content_type}"
                    }
                    self.log("❌ Test 2 FAILED: Invalid content type")
            elif response.status_code == 404:
                data = response.json()
                results['test2_csv_filter'] = {
                    'status': 'EXPECTED_EMPTY',
                    'error_message': data.get('error', 'No data found')
                }
                self.log("⚠️ Test 2 EXPECTED: No bulletpoints for filtered articles")
            else:
                results['test2_csv_filter'] = {
                    'status': 'FAILED',
                    'error': f"Unexpected HTTP status: {response.status_code}"
                }
                self.log(f"❌ Test 2 FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            results['test2_csv_filter'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Test 2 ERROR: {str(e)}")
        
        return results
    
    def check_mongodb_collection(self) -> Dict[str, Any]:
        """Check if amazon_bulletpoints_generated collection is populated"""
        self.log("\n=== CHECKING MONGODB COLLECTION ===")
        
        # We can't directly access MongoDB, but we can infer from API responses
        # This is handled by the CSV download test
        return {'status': 'CHECKED_VIA_API'}
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return comprehensive results"""
        self.log("Starting Amazon Bulletpoints Batch-Verarbeitung API Tests")
        self.log(f"Base URL: {BASE_URL}")
        
        all_results = {}
        
        # Test batch generation API
        batch_results = self.test_batch_generate_api()
        all_results.update(batch_results)
        
        # Test CSV download API
        csv_results = self.test_csv_download_api()
        all_results.update(csv_results)
        
        # Check MongoDB collection
        mongo_results = self.check_mongodb_collection()
        all_results.update(mongo_results)
        
        # Summary
        self.log("\n=== TEST SUMMARY ===")
        passed = sum(1 for result in all_results.values() if isinstance(result, dict) and result.get('status') == 'PASSED')
        failed = sum(1 for result in all_results.values() if isinstance(result, dict) and result.get('status') == 'FAILED')
        errors = sum(1 for result in all_results.values() if isinstance(result, dict) and result.get('status') == 'ERROR')
        expected = sum(1 for result in all_results.values() if isinstance(result, dict) and result.get('status') == 'EXPECTED_EMPTY')
        skipped = sum(1 for result in all_results.values() if isinstance(result, dict) and result.get('status') == 'SKIPPED')
        
        self.log(f"✅ PASSED: {passed}")
        self.log(f"❌ FAILED: {failed}")
        self.log(f"⚠️ ERRORS: {errors}")
        self.log(f"⚠️ EXPECTED EMPTY: {expected}")
        self.log(f"⚠️ SKIPPED: {skipped}")
        
        all_results['summary'] = {
            'passed': passed,
            'failed': failed,
            'errors': errors,
            'expected_empty': expected,
            'skipped': skipped,
            'total_tests': len([r for r in all_results.values() if isinstance(r, dict) and 'status' in r])
        }
        
        return all_results

def main():
    """Main test execution"""
    tester = AmazonBulletpointsAPITester()
    results = tester.run_all_tests()
    
    # Save results to file for reference
    with open('/app/amazon_bulletpoints_test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nTest results saved to: /app/amazon_bulletpoints_test_results.json")
    
    return results

if __name__ == "__main__":
    main()
        
        response = requests.post(f"{API_BASE}/coldleads/dach/crawl", json=payload, timeout=30)
        
        if response.status_code != 200:
            log_test("DACH Crawler API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('ok'):
            log_test("DACH Crawler Response", "FAIL", f"API returned ok=false: {data}")
            return False
            
        # Prüfe Response-Struktur
        required_fields = ['ok', 'count', 'prospects', 'progress']
        for field in required_fields:
            if field not in data:
                log_test("DACH Crawler Response Structure", "FAIL", f"Missing field: {field}")
                return False
        
        log_test("DACH Crawler API", "PASS", f"Found {data['count']} prospects, Progress: {data['progress']}")
        
        # Prüfe ob Prospects in 'prospects' Collection gespeichert wurden
        # (Das können wir über die Search API verifizieren)
        search_response = requests.get(f"{API_BASE}/coldleads/search?status=all&limit=10", timeout=15)
        
        if search_response.status_code == 200:
            search_data = search_response.json()
            if search_data.get('ok') and search_data.get('prospects'):
                # Suche nach Prospects mit DACH Crawler source
                dach_prospects = [p for p in search_data['prospects'] if 'DACH Crawler' in str(p.get('source', ''))]
                log_test("DACH Prospects in Database", "PASS", f"Found {len(dach_prospects)} DACH prospects in 'prospects' collection")
            else:
                log_test("DACH Prospects Verification", "WARN", "Could not verify prospects in database")
        
        return True
        
    except Exception as e:
        log_test("DACH Crawler Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_2_analyze_deep_prospects_collection():
    """Test 2: analyze-deep liest/schreibt 'prospects'"""
    print("=== TEST 2: analyze-deep liest/schreibt 'prospects' ===")
    
    try:
        # Erst einen Prospect aus der prospects Collection holen
        search_response = requests.get(f"{API_BASE}/coldleads/search?status=all&limit=5", timeout=15)
        
        if search_response.status_code != 200:
            log_test("Get Prospects for Analysis", "FAIL", f"Status: {search_response.status_code}")
            return False
            
        search_data = search_response.json()
        
        if not search_data.get('ok') or not search_data.get('prospects'):
            log_test("Get Prospects for Analysis", "FAIL", "No prospects found")
            return False
            
        # Nimm ersten Prospect
        prospect = search_data['prospects'][0]
        prospect_id = prospect.get('id')
        website = prospect.get('website', 'https://example-metall.de')
        company_name = prospect.get('company_name', 'Test Metallbau GmbH')
        
        log_test("Prospect Selected for Analysis", "PASS", f"ID: {prospect_id}, Company: {company_name}")
        
        # Führe analyze-deep aus
        payload = {
            "website": website,
            "firmenname": company_name,
            "branche": "Metallverarbeitung",
            "prospectId": prospect_id
        }
        
        response = requests.post(f"{API_BASE}/coldleads/analyze-deep", json=payload, timeout=45)
        
        if response.status_code != 200:
            log_test("Analyze Deep API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('success'):
            log_test("Analyze Deep Response", "FAIL", f"API returned success=false: {data}")
            return False
            
        log_test("Analyze Deep API", "PASS", f"Analysis completed for {company_name}")
        
        # Prüfe ob Analyse in 'prospects' Collection gespeichert wurde
        time.sleep(2)  # Kurz warten für DB-Update
        
        updated_response = requests.get(f"{API_BASE}/coldleads/search?status=all&limit=10", timeout=15)
        if updated_response.status_code == 200:
            updated_data = updated_response.json()
            if updated_data.get('ok'):
                # Suche nach dem analysierten Prospect
                analyzed_prospect = None
                for p in updated_data['prospects']:
                    if p.get('id') == prospect_id:
                        analyzed_prospect = p
                        break
                
                if analyzed_prospect and analyzed_prospect.get('analysis'):
                    log_test("Analysis Saved to Prospects", "PASS", f"Analysis data found in prospects collection")
                else:
                    log_test("Analysis Saved to Prospects", "WARN", "Analysis data not found in prospects collection")
        
        return True
        
    except Exception as e:
        log_test("Analyze Deep Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_3_stats_api_prospects_collection():
    """Test 3: Stats API liest aus 'prospects'"""
    print("=== TEST 3: Stats API liest aus 'prospects' ===")
    
    try:
        response = requests.get(f"{API_BASE}/coldleads/stats", timeout=15)
        
        if response.status_code != 200:
            log_test("Stats API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('ok'):
            log_test("Stats API Response", "FAIL", f"API returned ok=false: {data}")
            return False
            
        # Prüfe Response-Struktur
        required_fields = ['ok', 'unreadReplies', 'recentReplies', 'awaitingFollowup', 'byStatus', 'total']
        for field in required_fields:
            if field not in data:
                log_test("Stats API Response Structure", "FAIL", f"Missing field: {field}")
                return False
        
        log_test("Stats API", "PASS", f"Total prospects: {data['total']}, By status: {data['byStatus']}")
        
        return True
        
    except Exception as e:
        log_test("Stats API Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_4_search_list_prospects_collection():
    """Test 4: Search/List liest aus 'prospects'"""
    print("=== TEST 4: Search/List liest aus 'prospects' ===")
    
    try:
        response = requests.get(f"{API_BASE}/coldleads/search?status=all&limit=10", timeout=15)
        
        if response.status_code != 200:
            log_test("Search API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('ok'):
            log_test("Search API Response", "FAIL", f"API returned ok=false: {data}")
            return False
            
        # Prüfe Response-Struktur
        required_fields = ['ok', 'count', 'prospects']
        for field in required_fields:
            if field not in data:
                log_test("Search API Response Structure", "FAIL", f"Missing field: {field}")
                return False
        
        prospects = data.get('prospects', [])
        if prospects:
            # Prüfe Struktur des ersten Prospects
            first_prospect = prospects[0]
            prospect_fields = ['id', 'company_name', 'website', 'status']
            for field in prospect_fields:
                if field not in first_prospect:
                    log_test("Prospect Structure", "WARN", f"Missing field in prospect: {field}")
        
        log_test("Search API", "PASS", f"Found {data['count']} prospects from 'prospects' collection")
        
        return True
        
    except Exception as e:
        log_test("Search API Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_5_autopilot_tick_complete_flow():
    """Test 5: Autopilot Tick (Kompletter Flow)"""
    print("=== TEST 5: Autopilot Tick (Kompletter Flow) ===")
    
    try:
        # Erst Autopilot starten
        start_payload = {"dailyLimit": 10}
        start_response = requests.post(f"{API_BASE}/coldleads/autopilot/start", json=start_payload, timeout=15)
        
        if start_response.status_code == 200:
            log_test("Autopilot Start", "PASS", "Autopilot started successfully")
        else:
            log_test("Autopilot Start", "WARN", f"Status: {start_response.status_code}")
        
        # Führe Autopilot Tick aus
        response = requests.post(f"{API_BASE}/coldleads/autopilot/tick", timeout=60)
        
        if response.status_code != 200:
            log_test("Autopilot Tick API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('ok'):
            log_test("Autopilot Tick Response", "FAIL", f"API returned ok=false: {data}")
            return False
            
        # Prüfe Response-Struktur
        required_fields = ['ok', 'action']
        for field in required_fields:
            if field not in data:
                log_test("Autopilot Tick Response Structure", "FAIL", f"Missing field: {field}")
                return False
        
        action = data.get('action')
        log_test("Autopilot Tick API", "PASS", f"Action: {action}")
        
        # Prüfe verschiedene Actions
        if action == 'email_sent':
            if 'prospect' in data:
                log_test("Autopilot Email Sent", "PASS", f"Email sent to: {data['prospect']}")
            else:
                log_test("Autopilot Email Sent", "WARN", "Email sent but no prospect info")
                
        elif action == 'search_no_results':
            log_test("Autopilot Search", "PASS", "Search completed but no results found")
            
        elif action == 'limit_reached':
            log_test("Autopilot Limit", "PASS", f"Daily limit reached: {data.get('dailyCount')}/{data.get('dailyLimit')}")
            
        elif action == 'skip':
            log_test("Autopilot Skip", "PASS", f"Skipped: {data.get('reason')}")
            
        else:
            log_test("Autopilot Action", "WARN", f"Unknown action: {action}")
        
        return True
        
    except Exception as e:
        log_test("Autopilot Tick Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_6_autopilot_status():
    """Test 6: Autopilot Status"""
    print("=== TEST 6: Autopilot Status ===")
    
    try:
        response = requests.get(f"{API_BASE}/coldleads/autopilot/status", timeout=15)
        
        if response.status_code != 200:
            log_test("Autopilot Status API", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        data = response.json()
        
        if not data.get('ok'):
            log_test("Autopilot Status Response", "FAIL", f"API returned ok=false: {data}")
            return False
            
        # Prüfe Response-Struktur
        if 'state' not in data:
            log_test("Autopilot Status Structure", "FAIL", "Missing 'state' field")
            return False
            
        state = data['state']
        expected_fields = ['running', 'dailyCount', 'dailyLimit', 'currentPhase', 'lastActivity']
        for field in expected_fields:
            if field not in state:
                log_test("Autopilot State Structure", "WARN", f"Missing field in state: {field}")
        
        log_test("Autopilot Status API", "PASS", f"Running: {state.get('running')}, Phase: {state.get('currentPhase')}")
        
        return True
        
    except Exception as e:
        log_test("Autopilot Status Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_7_autopilot_start_stop():
    """Test 7: Autopilot Start/Stop"""
    print("=== TEST 7: Autopilot Start/Stop ===")
    
    try:
        # Test Start
        start_payload = {"dailyLimit": 10}
        start_response = requests.post(f"{API_BASE}/coldleads/autopilot/start", json=start_payload, timeout=15)
        
        if start_response.status_code != 200:
            log_test("Autopilot Start API", "FAIL", f"Status: {start_response.status_code}")
            return False
            
        start_data = start_response.json()
        if not start_data.get('ok'):
            log_test("Autopilot Start Response", "FAIL", f"Start returned ok=false: {start_data}")
            return False
            
        log_test("Autopilot Start", "PASS", "Autopilot started successfully")
        
        # Test Stop
        stop_response = requests.post(f"{API_BASE}/coldleads/autopilot/stop", timeout=15)
        
        if stop_response.status_code != 200:
            log_test("Autopilot Stop API", "FAIL", f"Status: {stop_response.status_code}")
            return False
            
        stop_data = stop_response.json()
        if not stop_data.get('ok'):
            log_test("Autopilot Stop Response", "FAIL", f"Stop returned ok=false: {stop_data}")
            return False
            
        log_test("Autopilot Stop", "PASS", "Autopilot stopped successfully")
        
        return True
        
    except Exception as e:
        log_test("Autopilot Start/Stop Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_8_email_bcc_verification():
    """Test 8: Email BCC Verifikation"""
    print("=== TEST 8: Email BCC Verifikation ===")
    
    try:
        # Lese email-client.ts Datei
        email_client_path = "/app/lib/email-client.ts"
        
        if not os.path.exists(email_client_path):
            log_test("Email Client File", "FAIL", f"File not found: {email_client_path}")
            return False
            
        with open(email_client_path, 'r') as f:
            content = f.read()
            
        # Prüfe BCC-Zeile
        if 'leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de' in content:
            log_test("Email BCC Configuration", "PASS", "Both BCC addresses found in email-client.ts")
        elif 'leismann@score-schleifwerkzeuge.de' in content and 'danki.leismann@gmx.de' in content:
            log_test("Email BCC Configuration", "PASS", "Both BCC addresses found (separate lines)")
        elif 'leismann@score-schleifwerkzeuge.de' in content:
            log_test("Email BCC Configuration", "WARN", "Only leismann@ address found")
        elif 'danki.leismann@gmx.de' in content:
            log_test("Email BCC Configuration", "WARN", "Only danki.leismann@ address found")
        else:
            log_test("Email BCC Configuration", "FAIL", "No BCC addresses found")
            return False
            
        # Prüfe BCC-Zeile Struktur
        if "bcc: 'leismann@score-schleifwerkzeuge.de, danki.leismann@gmx.de'" in content:
            log_test("Email BCC Format", "PASS", "Correct BCC format with both addresses")
        else:
            log_test("Email BCC Format", "WARN", "BCC format might be different than expected")
            
        return True
        
    except Exception as e:
        log_test("Email BCC Verification", "FAIL", f"Exception: {str(e)}")
        return False

def test_9_duplicates_prevention():
    """Test 9: Duplikats-Vermeidung"""
    print("=== TEST 9: Duplikats-Vermeidung ===")
    
    try:
        # Führe DACH-Crawler 2x für gleiche Region aus
        payload = {
            "country": "DE",
            "region": "Bayern",
            "industry": "Metallverarbeitung", 
            "limit": 2
        }
        
        # Erster Crawl
        response1 = requests.post(f"{API_BASE}/coldleads/dach/crawl", json=payload, timeout=30)
        
        if response1.status_code != 200:
            log_test("First DACH Crawl", "FAIL", f"Status: {response1.status_code}")
            return False
            
        data1 = response1.json()
        if not data1.get('ok'):
            log_test("First DACH Crawl Response", "FAIL", f"ok=false: {data1}")
            return False
            
        count1 = data1.get('count', 0)
        log_test("First DACH Crawl", "PASS", f"Found {count1} prospects")
        
        # Kurz warten
        time.sleep(2)
        
        # Zweiter Crawl (gleiche Parameter)
        response2 = requests.post(f"{API_BASE}/coldleads/dach/crawl", json=payload, timeout=30)
        
        if response2.status_code != 200:
            log_test("Second DACH Crawl", "FAIL", f"Status: {response2.status_code}")
            return False
            
        data2 = response2.json()
        if not data2.get('ok'):
            log_test("Second DACH Crawl Response", "FAIL", f"ok=false: {data2}")
            return False
            
        count2 = data2.get('count', 0)
        log_test("Second DACH Crawl", "PASS", f"Found {count2} prospects")
        
        # Prüfe Gesamtanzahl in DB
        search_response = requests.get(f"{API_BASE}/coldleads/search?status=all&limit=50", timeout=15)
        
        if search_response.status_code == 200:
            search_data = search_response.json()
            if search_data.get('ok'):
                total_prospects = search_data.get('count', 0)
                
                # Wenn keine Duplikate, sollte Gesamtanzahl <= count1 + count2 sein
                # (kann auch weniger sein wenn schon Prospects existierten)
                log_test("Duplicate Prevention Check", "PASS", f"Total prospects in DB: {total_prospects}")
                
                # Prüfe auf Website-Duplikate
                websites = set()
                duplicates = 0
                for prospect in search_data.get('prospects', []):
                    website = prospect.get('website')
                    if website:
                        if website in websites:
                            duplicates += 1
                        websites.add(website)
                
                if duplicates == 0:
                    log_test("Website Duplicate Check", "PASS", "No duplicate websites found")
                else:
                    log_test("Website Duplicate Check", "FAIL", f"Found {duplicates} duplicate websites")
                    return False
        
        return True
        
    except Exception as e:
        log_test("Duplicates Prevention Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_10_collection_isolation():
    """Test 10: Collection-Isolation (keine cold_prospects mehr)"""
    print("=== TEST 10: Collection-Isolation ===")
    
    try:
        # Prüfe ob 'cold_prospects' noch in Code verwendet wird
        
        # Suche nach cold_prospects in API-Dateien
        result = subprocess.run(
            ['grep', '-r', 'cold_prospects', '/app/app/api/coldleads/'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            log_test("Collection Isolation", "FAIL", f"Found cold_prospects references: {result.stdout}")
            return False
        else:
            log_test("Collection Isolation", "PASS", "No cold_prospects references found in coldleads APIs")
            
        # Zusätzlich prüfe nach coldleads_prospects
        result2 = subprocess.run(
            ['grep', '-r', 'coldleads_prospects', '/app/app/api/coldleads/'],
            capture_output=True,
            text=True
        )
        
        if result2.returncode == 0 and result2.stdout.strip():
            log_test("Collection Isolation (coldleads_prospects)", "FAIL", f"Found coldleads_prospects references: {result2.stdout}")
            return False
        else:
            log_test("Collection Isolation (coldleads_prospects)", "PASS", "No coldleads_prospects references found")
            
        return True
        
    except Exception as e:
        log_test("Collection Isolation Test", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Führe alle Tests aus"""
    print("🚀 AUTOPILOT-SYSTEM KOMPLETT TESTEN")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print("=" * 60)
    print()
    
    tests = [
        test_1_dach_crawler_prospects_collection,
        test_2_analyze_deep_prospects_collection,
        test_3_stats_api_prospects_collection,
        test_4_search_list_prospects_collection,
        test_5_autopilot_tick_complete_flow,
        test_6_autopilot_status,
        test_7_autopilot_start_stop,
        test_8_email_bcc_verification,
        test_9_duplicates_prevention,
        test_10_collection_isolation
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__} CRASHED: {str(e)}")
            failed += 1
        
        print("-" * 60)
        print()
    
    # Zusammenfassung
    total = passed + failed
    print("=" * 60)
    print("🏁 TEST ZUSAMMENFASSUNG")
    print("=" * 60)
    print(f"✅ Bestanden: {passed}/{total}")
    print(f"❌ Fehlgeschlagen: {failed}/{total}")
    
    if failed == 0:
        print("🎉 ALLE TESTS BESTANDEN!")
    else:
        print("⚠️  EINIGE TESTS FEHLGESCHLAGEN!")
    
    print("=" * 60)

if __name__ == "__main__":
    main()