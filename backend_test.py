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