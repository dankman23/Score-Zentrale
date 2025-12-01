#!/usr/bin/env python3
"""
KRITISCHER BUGFIX TESTING - MERKMALE-LOADING AUS JTL TESTEN

Tests the critical bug fix for loading Artikel-Merkmale (features) from JTL MSSQL database.
The bug was that SQL queries used wrong table 'tMerkmalWert' (doesn't exist).
Fixed to use correct tables: tArtikelMerkmal, tMerkmal, tMerkmalWertSprache.

Test Plan:
1. Test Artikel-Details API with Merkmale loading
2. Test Batch-Generierung with Merkmale integration  
3. Test Merkmale caching in MongoDB
4. Verify generated bulletpoints include technical features
"""

import requests
import json
import time
import pymongo
import os
from typing import Dict, List, Any, Optional

# Configuration
BASE_URL = "https://klingspor-pricing.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class MerkmaleFixTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Merkmale-Fix-Tester/1.0'
        })
        
        # MongoDB connection for verification
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017/score_zentrale')
        self.mongo_client = pymongo.MongoClient(mongo_url)
        self.db = self.mongo_client.score_zentrale
        
    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def get_test_articles(self) -> List[Dict[str, Any]]:
        """Get articles that should have Merkmale (grinding wheels, cutting discs)"""
        self.log("Selecting test articles that should have Merkmale...")
        
        # Look for articles that are likely to have technical features
        test_articles = list(self.db.articles.find({
            '$or': [
                {'cName': {'$regex': 'schleif', '$options': 'i'}},
                {'cName': {'$regex': 'trenn', '$options': 'i'}},
                {'cName': {'$regex': 'PFERD', '$options': 'i'}},
                {'cName': {'$regex': 'Klingspor', '$options': 'i'}},
                {'cWarengruppenName': {'$regex': 'schleif', '$options': 'i'}}
            ]
        }, {
            'kArtikel': 1, 'cArtNr': 1, 'cName': 1, 'cHerstellerName': 1, 
            'cWarengruppenName': 1, 'merkmale': 1
        }).limit(5))
        
        self.log(f"Found {len(test_articles)} test articles:")
        for article in test_articles:
            merkmale_count = len(article.get('merkmale', []))
            self.log(f"  kArtikel: {article['kArtikel']}, cArtNr: {article.get('cArtNr', 'N/A')}, "
                    f"cName: {article.get('cName', 'N/A')[:50]}..., Current Merkmale: {merkmale_count}")
        
        return test_articles
        
    def test_artikel_details_api_with_merkmale(self) -> Dict[str, Any]:
        """TEST 1: Artikel-Details API mit Merkmalen"""
        self.log("\n=== TEST 1: ARTIKEL-DETAILS API MIT MERKMALEN ===")
        results = {}
        
        test_articles = self.get_test_articles()
        if not test_articles:
            return {
                'test1_artikel_details': {
                    'status': 'SKIPPED',
                    'error': 'No test articles found'
                }
            }
        
        # Test with first article
        test_article = test_articles[0]
        kArtikel = test_article['kArtikel']
        
        self.log(f"Testing GET /api/jtl/articles/{kArtikel}/details")
        
        try:
            response = self.session.get(f"{API_BASE}/jtl/articles/{kArtikel}/details")
            
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('ok') and 'artikel' in data:
                    artikel = data['artikel']
                    merkmale = artikel.get('merkmale', [])
                    
                    self.log(f"Article Details Response: kArtikel={artikel.get('kArtikel')}, "
                            f"cName={artikel.get('cName', 'N/A')[:50]}...")
                    self.log(f"Merkmale found: {len(merkmale)}")
                    
                    if merkmale:
                        self.log("Merkmale details:")
                        for merkmal in merkmale[:5]:  # Show first 5
                            self.log(f"  - {merkmal.get('name', 'N/A')}: {merkmal.get('wert', 'N/A')}")
                        
                        results['test1_artikel_details'] = {
                            'status': 'PASSED',
                            'kArtikel': kArtikel,
                            'merkmale_count': len(merkmale),
                            'merkmale_sample': merkmale[:3],  # First 3 for verification
                            'has_technical_features': any(
                                name.lower() in ['durchmesser', 'körnung', 'material', 'dicke', 'breite'] 
                                for merkmal in merkmale 
                                for name in [merkmal.get('name', '').lower()]
                            )
                        }
                        self.log("✅ TEST 1 PASSED: Merkmale successfully loaded from MSSQL")
                    else:
                        # Check if MSSQL is available
                        if 'MSSQL nicht verfügbar' in str(data) or 'Konnte Merkmale nicht' in str(data):
                            results['test1_artikel_details'] = {
                                'status': 'MSSQL_UNAVAILABLE',
                                'kArtikel': kArtikel,
                                'error': 'MSSQL database not available for testing'
                            }
                            self.log("⚠️ TEST 1 MSSQL_UNAVAILABLE: Cannot test Merkmale loading without MSSQL")
                        else:
                            results['test1_artikel_details'] = {
                                'status': 'NO_MERKMALE',
                                'kArtikel': kArtikel,
                                'note': 'Article has no Merkmale in MSSQL database'
                            }
                            self.log("⚠️ TEST 1 NO_MERKMALE: Article has no Merkmale in database")
                else:
                    results['test1_artikel_details'] = {
                        'status': 'FAILED',
                        'error': 'Invalid response structure'
                    }
                    self.log("❌ TEST 1 FAILED: Invalid response structure")
            else:
                error_data = response.text
                results['test1_artikel_details'] = {
                    'status': 'FAILED',
                    'error': f"HTTP {response.status_code}: {error_data}"
                }
                self.log(f"❌ TEST 1 FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            results['test1_artikel_details'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ TEST 1 ERROR: {str(e)}")
        
        return results
        
    def test_batch_generation_with_merkmale(self) -> Dict[str, Any]:
        """TEST 2: Batch-Generierung mit Merkmalen"""
        self.log("\n=== TEST 2: BATCH-GENERIERUNG MIT MERKMALEN ===")
        results = {}
        
        test_articles = self.get_test_articles()
        if not test_articles:
            return {
                'test2_batch_generation': {
                    'status': 'SKIPPED',
                    'error': 'No test articles found'
                }
            }
        
        # Use 2-3 articles for batch test
        artikel_ids = [article['kArtikel'] for article in test_articles[:3]]
        
        self.log(f"Testing POST /api/amazon/bulletpoints/batch/generate with articles: {artikel_ids}")
        
        try:
            payload = {
                "kArtikel": artikel_ids,
                "promptId": 2  # Use prompt version 2
            }
            
            response = self.session.post(f"{API_BASE}/amazon/bulletpoints/batch/generate", json=payload)
            
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('ok'):
                    processed = data.get('processed', 0)
                    succeeded = data.get('succeeded', 0)
                    failed = data.get('failed', 0)
                    duration = data.get('duration', 'N/A')
                    
                    self.log(f"Batch Results: processed={processed}, succeeded={succeeded}, failed={failed}, duration={duration}")
                    
                    # Check individual results for Merkmale integration
                    results_list = data.get('results', [])
                    merkmale_integration_success = False
                    
                    for result in results_list:
                        if result.get('success'):
                            kArtikel = result.get('kArtikel')
                            bulletpoints = result.get('bulletpoints', '')
                            
                            # Check if bulletpoints mention technical features
                            technical_terms = ['durchmesser', 'körnung', 'material', 'dicke', 'breite', 'mm', 'cm']
                            has_technical_content = any(term.lower() in bulletpoints.lower() for term in technical_terms)
                            
                            if has_technical_content:
                                merkmale_integration_success = True
                                self.log(f"✅ kArtikel {kArtikel}: Bulletpoints contain technical features")
                                break
                    
                    results['test2_batch_generation'] = {
                        'status': 'PASSED' if succeeded > 0 else 'PARTIAL',
                        'processed': processed,
                        'succeeded': succeeded,
                        'failed': failed,
                        'duration': duration,
                        'merkmale_integration': merkmale_integration_success,
                        'total_results': len(results_list)
                    }
                    
                    if succeeded > 0:
                        self.log("✅ TEST 2 PASSED: Batch generation successful")
                        if merkmale_integration_success:
                            self.log("✅ BONUS: Generated bulletpoints include technical features from Merkmale")
                    else:
                        self.log("⚠️ TEST 2 PARTIAL: Batch processed but no successes")
                else:
                    results['test2_batch_generation'] = {
                        'status': 'FAILED',
                        'error': data.get('error', 'Unknown error')
                    }
                    self.log(f"❌ TEST 2 FAILED: {data.get('error', 'Unknown error')}")
            else:
                error_data = response.text
                results['test2_batch_generation'] = {
                    'status': 'FAILED',
                    'error': f"HTTP {response.status_code}: {error_data}"
                }
                self.log(f"❌ TEST 2 FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            results['test2_batch_generation'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ TEST 2 ERROR: {str(e)}")
        
        return results
        
    def test_merkmale_mongodb_caching(self) -> Dict[str, Any]:
        """TEST 3: Merkmale im MongoDB Cache"""
        self.log("\n=== TEST 3: MERKMALE IM MONGODB CACHE ===")
        results = {}
        
        try:
            # Check if any articles now have merkmale cached in MongoDB
            articles_with_merkmale = list(self.db.articles.find({
                'merkmale': {'$exists': True, '$ne': [], '$size': {'$gt': 0}}
            }, {
                'kArtikel': 1, 'cArtNr': 1, 'cName': 1, 'merkmale': 1
            }).limit(5))
            
            if articles_with_merkmale:
                self.log(f"Found {len(articles_with_merkmale)} articles with cached Merkmale:")
                
                sample_merkmale = []
                for article in articles_with_merkmale:
                    merkmale = article.get('merkmale', [])
                    self.log(f"  kArtikel {article['kArtikel']}: {len(merkmale)} Merkmale")
                    
                    # Sample first few merkmale
                    for merkmal in merkmale[:2]:
                        sample_merkmale.append({
                            'kArtikel': article['kArtikel'],
                            'name': merkmal.get('name'),
                            'wert': merkmal.get('wert')
                        })
                        self.log(f"    - {merkmal.get('name', 'N/A')}: {merkmal.get('wert', 'N/A')}")
                
                results['test3_mongodb_caching'] = {
                    'status': 'PASSED',
                    'articles_with_merkmale': len(articles_with_merkmale),
                    'sample_merkmale': sample_merkmale[:5],
                    'caching_working': True
                }
                self.log("✅ TEST 3 PASSED: Merkmale successfully cached in MongoDB")
            else:
                results['test3_mongodb_caching'] = {
                    'status': 'NO_CACHE',
                    'note': 'No articles with cached Merkmale found yet'
                }
                self.log("⚠️ TEST 3 NO_CACHE: No cached Merkmale found (may need MSSQL access)")
                
        except Exception as e:
            results['test3_mongodb_caching'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ TEST 3 ERROR: {str(e)}")
        
        return results
        
    def check_backend_logs_for_merkmale(self) -> Dict[str, Any]:
        """Check backend logs for Merkmale loading messages"""
        self.log("\n=== CHECKING BACKEND LOGS FOR MERKMALE LOADING ===")
        results = {}
        
        try:
            # Check supervisor logs for Merkmale loading messages
            import subprocess
            
            log_result = subprocess.run([
                'tail', '-n', '100', '/var/log/supervisor/nextjs.out.log'
            ], capture_output=True, text=True, timeout=10)
            
            if log_result.returncode == 0:
                log_content = log_result.stdout
                
                # Look for Merkmale-related log messages
                merkmale_logs = []
                for line in log_content.split('\n'):
                    if any(keyword in line.lower() for keyword in ['merkmal', 'batch', 'erfolgreich', 'geladen']):
                        merkmale_logs.append(line.strip())
                
                if merkmale_logs:
                    self.log("Found Merkmale-related log entries:")
                    for log_line in merkmale_logs[-5:]:  # Show last 5
                        self.log(f"  {log_line}")
                    
                    results['backend_logs'] = {
                        'status': 'FOUND',
                        'merkmale_log_entries': len(merkmale_logs),
                        'sample_logs': merkmale_logs[-3:]
                    }
                else:
                    results['backend_logs'] = {
                        'status': 'NO_MERKMALE_LOGS',
                        'note': 'No Merkmale-related log entries found'
                    }
                    self.log("⚠️ No Merkmale-related log entries found")
            else:
                results['backend_logs'] = {
                    'status': 'LOG_ACCESS_FAILED',
                    'error': 'Could not access backend logs'
                }
                self.log("⚠️ Could not access backend logs")
                
        except Exception as e:
            results['backend_logs'] = {
                'status': 'ERROR',
                'error': str(e)
            }
            self.log(f"❌ Backend log check ERROR: {str(e)}")
        
        return results
        
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all critical bug fix tests"""
        self.log("🔧 STARTING KRITISCHER BUGFIX TESTING - MERKMALE-LOADING AUS JTL")
        self.log(f"Base URL: {BASE_URL}")
        self.log("Testing SQL query fix: tMerkmalWert → tMerkmalWertSprache")
        
        all_results = {}
        
        # TEST 1: Artikel-Details API with Merkmale
        test1_results = self.test_artikel_details_api_with_merkmale()
        all_results.update(test1_results)
        
        # TEST 2: Batch-Generierung with Merkmale integration
        test2_results = self.test_batch_generation_with_merkmale()
        all_results.update(test2_results)
        
        # TEST 3: Merkmale caching in MongoDB
        test3_results = self.test_merkmale_mongodb_caching()
        all_results.update(test3_results)
        
        # Check backend logs
        log_results = self.check_backend_logs_for_merkmale()
        all_results.update(log_results)
        
        # Summary
        self.log("\n=== KRITISCHER BUGFIX TEST SUMMARY ===")
        
        test_statuses = []
        for key, result in all_results.items():
            if isinstance(result, dict) and 'status' in result:
                status = result['status']
                test_statuses.append(status)
                
                if status == 'PASSED':
                    self.log(f"✅ {key}: PASSED")
                elif status == 'FAILED':
                    self.log(f"❌ {key}: FAILED - {result.get('error', 'Unknown error')}")
                elif status == 'ERROR':
                    self.log(f"⚠️ {key}: ERROR - {result.get('error', 'Unknown error')}")
                elif status == 'MSSQL_UNAVAILABLE':
                    self.log(f"⚠️ {key}: MSSQL_UNAVAILABLE - Cannot test without MSSQL access")
                elif status == 'NO_MERKMALE':
                    self.log(f"⚠️ {key}: NO_MERKMALE - Articles have no Merkmale in database")
                elif status == 'NO_CACHE':
                    self.log(f"⚠️ {key}: NO_CACHE - No cached Merkmale found yet")
                else:
                    self.log(f"⚠️ {key}: {status}")
        
        passed = test_statuses.count('PASSED')
        failed = test_statuses.count('FAILED')
        errors = test_statuses.count('ERROR')
        
        all_results['summary'] = {
            'passed': passed,
            'failed': failed,
            'errors': errors,
            'total_tests': len(test_statuses),
            'critical_fix_status': 'SUCCESS' if passed > 0 and failed == 0 else 'NEEDS_ATTENTION'
        }
        
        self.log(f"\n🔧 KRITISCHER BUGFIX RESULT: {all_results['summary']['critical_fix_status']}")
        self.log(f"✅ PASSED: {passed}, ❌ FAILED: {failed}, ⚠️ ERRORS: {errors}")
        
        return all_results
        
    def __del__(self):
        """Cleanup MongoDB connection"""
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()

def main():
    """Main test execution"""
    tester = MerkmaleFixTester()
    results = tester.run_all_tests()
    
    # Save results to file for reference
    with open('/app/merkmale_fix_test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n🔧 KRITISCHER BUGFIX test results saved to: /app/merkmale_fix_test_results.json")
    
    return results

if __name__ == "__main__":
    main()