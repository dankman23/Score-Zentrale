#!/usr/bin/env python3
"""
DACH-Crawler Backend API Testing
Comprehensive testing of the 3 new DACH-Crawler endpoints
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://jt-article-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_icon} {test_name}: {status}")
    if details:
        print(f"    {details}")
    print()

def test_dach_stats_endpoint():
    """
    Test 1: GET /api/coldleads/dach/stats (Dashboard-Statistiken)
    Expected: 200 OK with complete stats structure
    """
    print("=" * 60)
    print("TEST 1: GET /api/coldleads/dach/stats (Dashboard Statistics)")
    print("=" * 60)
    
    try:
        url = f"{API_BASE}/coldleads/dach/stats"
        response = requests.get(url, timeout=30)
        
        log_test("HTTP Status", "PASS" if response.status_code == 200 else "FAIL", 
                f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("Response Body", "INFO", response.text[:500])
            return False
            
        data = response.json()
        
        # Check main structure
        required_fields = ['ok', 'stats', 'country_breakdown', 'top_industries', 'last_updated']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            log_test("Response Structure", "FAIL", f"Missing fields: {missing_fields}")
            return False
        else:
            log_test("Response Structure", "PASS", "All required top-level fields present")
        
        # Check stats object
        stats = data.get('stats', {})
        required_stats = ['total_regions', 'completed_regions', 'pending_regions', 
                         'total_companies_found', 'coverage_percentage', 'dach_prospects_in_db']
        missing_stats = [field for field in required_stats if field not in stats]
        
        if missing_stats:
            log_test("Stats Fields", "FAIL", f"Missing stats fields: {missing_stats}")
            return False
        else:
            log_test("Stats Fields", "PASS", "All required stats fields present")
        
        # Check expected initial values
        total_regions = stats.get('total_regions')
        completed_regions = stats.get('completed_regions')
        
        log_test("Total Regions", "PASS" if total_regions == 47 else "WARN", 
                f"Expected: 47, Got: {total_regions}")
        log_test("Completed Regions", "PASS" if completed_regions == 0 else "INFO", 
                f"Initial expected: 0, Got: {completed_regions}")
        
        # Check country breakdown
        country_breakdown = data.get('country_breakdown', {})
        required_countries = ['DE', 'AT', 'CH']
        missing_countries = [country for country in required_countries if country not in country_breakdown]
        
        if missing_countries:
            log_test("Country Breakdown", "FAIL", f"Missing countries: {missing_countries}")
            return False
        else:
            log_test("Country Breakdown", "PASS", "All DACH countries present")
        
        # Check country structure
        for country in required_countries:
            country_data = country_breakdown[country]
            required_country_fields = ['regions_completed', 'total_regions', 'companies_found']
            missing_country_fields = [field for field in required_country_fields if field not in country_data]
            
            if missing_country_fields:
                log_test(f"Country {country} Fields", "FAIL", f"Missing: {missing_country_fields}")
                return False
        
        log_test("Country Structure", "PASS", "All countries have required fields")
        
        # Log sample data
        log_test("Sample Data", "INFO", 
                f"Total regions: {total_regions}, Completed: {completed_regions}, "
                f"Companies found: {stats.get('total_companies_found')}, "
                f"Coverage: {stats.get('coverage_percentage')}%")
        
        return True
        
    except Exception as e:
        log_test("Exception", "FAIL", str(e))
        return False

def test_dach_status_endpoint():
    """
    Test 2: GET /api/coldleads/dach/status (Progress-Anzeige)
    Expected: 200 OK with stats and progress array
    """
    print("=" * 60)
    print("TEST 2: GET /api/coldleads/dach/status (Progress Display)")
    print("=" * 60)
    
    try:
        url = f"{API_BASE}/coldleads/dach/status"
        response = requests.get(url, timeout=30)
        
        log_test("HTTP Status", "PASS" if response.status_code == 200 else "FAIL", 
                f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("Response Body", "INFO", response.text[:500])
            return False
            
        data = response.json()
        
        # Check main structure
        required_fields = ['ok', 'stats', 'progress']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            log_test("Response Structure", "FAIL", f"Missing fields: {missing_fields}")
            return False
        else:
            log_test("Response Structure", "PASS", "All required fields present")
        
        # Check stats object
        stats = data.get('stats', {})
        required_stats = ['total_regions', 'completed', 'in_progress', 'pending', 'failed', 'total_companies_found']
        missing_stats = [field for field in required_stats if field not in stats]
        
        if missing_stats:
            log_test("Stats Fields", "FAIL", f"Missing stats fields: {missing_stats}")
            return False
        else:
            log_test("Stats Fields", "PASS", "All required stats fields present")
        
        # Check progress array
        progress = data.get('progress', [])
        log_test("Progress Array", "PASS", f"Progress array length: {len(progress)}")
        
        # Initially should be empty
        if len(progress) == 0:
            log_test("Initial Progress", "PASS", "Progress array empty as expected initially")
        else:
            log_test("Initial Progress", "INFO", f"Found {len(progress)} existing progress entries")
            # Check first entry structure if exists
            if progress:
                first_entry = progress[0]
                required_progress_fields = ['country', 'region', 'industry', 'status', 'companies_found', 'last_updated']
                missing_progress_fields = [field for field in required_progress_fields if field not in first_entry]
                
                if missing_progress_fields:
                    log_test("Progress Entry Structure", "FAIL", f"Missing: {missing_progress_fields}")
                    return False
                else:
                    log_test("Progress Entry Structure", "PASS", "Progress entries have required fields")
        
        # Test with query parameters
        log_test("Testing Query Parameters", "INFO", "Testing country=DE filter")
        
        url_with_params = f"{API_BASE}/coldleads/dach/status?country=DE"
        response_filtered = requests.get(url_with_params, timeout=30)
        
        if response_filtered.status_code == 200:
            filtered_data = response_filtered.json()
            log_test("Country Filter", "PASS", f"Filtered response OK, progress entries: {len(filtered_data.get('progress', []))}")
        else:
            log_test("Country Filter", "WARN", f"Filter failed with status: {response_filtered.status_code}")
        
        # Test industry filter
        url_industry = f"{API_BASE}/coldleads/dach/status?industry=Metallverarbeitung"
        response_industry = requests.get(url_industry, timeout=30)
        
        if response_industry.status_code == 200:
            industry_data = response_industry.json()
            log_test("Industry Filter", "PASS", f"Industry filter OK, progress entries: {len(industry_data.get('progress', []))}")
        else:
            log_test("Industry Filter", "WARN", f"Industry filter failed with status: {response_industry.status_code}")
        
        return True
        
    except Exception as e:
        log_test("Exception", "FAIL", str(e))
        return False

def test_dach_crawl_endpoint():
    """
    Test 3: POST /api/coldleads/dach/crawl (Haupt-Crawling)
    Expected: 200 OK with crawl results (empty due to missing Google API keys)
    """
    print("=" * 60)
    print("TEST 3: POST /api/coldleads/dach/crawl (Main Crawling)")
    print("=" * 60)
    
    try:
        url = f"{API_BASE}/coldleads/dach/crawl"
        
        # Test payload as specified in requirements
        payload = {
            "country": "DE",
            "region": "Nordrhein-Westfalen", 
            "industry": "Metallverarbeitung",
            "limit": 10
        }
        
        log_test("Request Payload", "INFO", json.dumps(payload, indent=2))
        
        response = requests.post(url, json=payload, timeout=60)
        
        log_test("HTTP Status", "PASS" if response.status_code == 200 else "FAIL", 
                f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("Response Body", "INFO", response.text[:500])
            return False
            
        data = response.json()
        
        # Check main structure
        required_fields = ['ok', 'count', 'prospects', 'progress', 'nextRegion']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            log_test("Response Structure", "FAIL", f"Missing fields: {missing_fields}")
            return False
        else:
            log_test("Response Structure", "PASS", "All required fields present")
        
        # Check ok field
        ok_status = data.get('ok')
        log_test("OK Status", "PASS" if ok_status else "FAIL", f"ok: {ok_status}")
        
        # Check count and prospects (should be 0 due to missing Google API keys)
        count = data.get('count', -1)
        prospects = data.get('prospects', [])
        
        log_test("Count Field", "PASS", f"Count: {count}")
        log_test("Prospects Array", "PASS", f"Prospects length: {len(prospects)}")
        
        # With USE_MOCK_COLDLEADS=true or missing API keys, expect count=0
        if count == 0 and len(prospects) == 0:
            log_test("Mock Mode Behavior", "PASS", "Empty results as expected (Google API not configured)")
        else:
            log_test("Mock Mode Behavior", "INFO", f"Got {count} prospects - API might be configured")
        
        # Check progress object
        progress = data.get('progress', {})
        required_progress_fields = ['country', 'region', 'industry', 'status', 'companies_found']
        missing_progress_fields = [field for field in required_progress_fields if field not in progress]
        
        if missing_progress_fields:
            log_test("Progress Object", "FAIL", f"Missing progress fields: {missing_progress_fields}")
            return False
        else:
            log_test("Progress Object", "PASS", "Progress object has required fields")
        
        # Check progress values
        progress_country = progress.get('country')
        progress_region = progress.get('region')
        progress_industry = progress.get('industry')
        progress_status = progress.get('status')
        
        log_test("Progress Values", "PASS" if all([
            progress_country == "DE",
            progress_region == "Nordrhein-Westfalen", 
            progress_industry == "Metallverarbeitung",
            progress_status == "completed"
        ]) else "FAIL", 
        f"Country: {progress_country}, Region: {progress_region}, Industry: {progress_industry}, Status: {progress_status}")
        
        # Check nextRegion
        next_region = data.get('nextRegion')
        if next_region:
            log_test("Next Region", "PASS", f"Next region: {next_region}")
        else:
            log_test("Next Region", "INFO", "No next region (end of sequence or null)")
        
        return True
        
    except Exception as e:
        log_test("Exception", "FAIL", str(e))
        return False

def test_dach_crawl_error_handling():
    """
    Test 4: Error-Handling for POST /api/coldleads/dach/crawl
    Test various invalid inputs
    """
    print("=" * 60)
    print("TEST 4: POST /api/coldleads/dach/crawl (Error Handling)")
    print("=" * 60)
    
    url = f"{API_BASE}/coldleads/dach/crawl"
    
    # Test 1: Missing region
    try:
        payload = {
            "country": "DE",
            "industry": "Metallverarbeitung",
            "limit": 10
        }
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 400:
            log_test("Missing Region", "PASS", f"400 Bad Request as expected")
            data = response.json()
            if 'error' in data:
                log_test("Error Message", "PASS", f"Error: {data['error']}")
        else:
            log_test("Missing Region", "FAIL", f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        log_test("Missing Region Test", "FAIL", str(e))
    
    # Test 2: Missing industry
    try:
        payload = {
            "country": "DE",
            "region": "Bayern",
            "limit": 10
        }
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 400:
            log_test("Missing Industry", "PASS", f"400 Bad Request as expected")
            data = response.json()
            if 'error' in data:
                log_test("Error Message", "PASS", f"Error: {data['error']}")
        else:
            log_test("Missing Industry", "FAIL", f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        log_test("Missing Industry Test", "FAIL", str(e))
    
    # Test 3: Invalid country
    try:
        payload = {
            "country": "FR",  # Invalid - only DE/AT/CH allowed
            "region": "Paris",
            "industry": "Metallverarbeitung",
            "limit": 10
        }
        
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 400:
            log_test("Invalid Country", "PASS", f"400 Bad Request as expected")
            data = response.json()
            if 'error' in data:
                log_test("Error Message", "PASS", f"Error: {data['error']}")
        else:
            log_test("Invalid Country", "FAIL", f"Expected 400, got {response.status_code}")
            
    except Exception as e:
        log_test("Invalid Country Test", "FAIL", str(e))
    
    return True

def test_mongodb_integration():
    """
    Test 5: MongoDB Integration Check
    Verify that crawl progress is stored in MongoDB
    """
    print("=" * 60)
    print("TEST 5: MongoDB Integration Check")
    print("=" * 60)
    
    try:
        # First, perform a crawl to ensure data is stored
        crawl_url = f"{API_BASE}/coldleads/dach/crawl"
        payload = {
            "country": "DE",
            "region": "Bayern",
            "industry": "Schreinerei",
            "limit": 5
        }
        
        log_test("Performing Test Crawl", "INFO", "Crawling Bayern/Schreinerei to create MongoDB entry")
        
        crawl_response = requests.post(crawl_url, json=payload, timeout=60)
        
        if crawl_response.status_code != 200:
            log_test("Test Crawl", "FAIL", f"Crawl failed with status {crawl_response.status_code}")
            return False
        
        log_test("Test Crawl", "PASS", "Crawl completed successfully")
        
        # Wait a moment for MongoDB write
        time.sleep(2)
        
        # Now check if the progress entry exists via status endpoint
        status_url = f"{API_BASE}/coldleads/dach/status?country=DE&industry=Schreinerei"
        status_response = requests.get(status_url, timeout=30)
        
        if status_response.status_code != 200:
            log_test("Status Check", "FAIL", f"Status check failed with {status_response.status_code}")
            return False
        
        status_data = status_response.json()
        progress_entries = status_data.get('progress', [])
        
        # Look for our specific entry
        found_entry = None
        for entry in progress_entries:
            if (entry.get('country') == 'DE' and 
                entry.get('region') == 'Bayern' and 
                entry.get('industry') == 'Schreinerei'):
                found_entry = entry
                break
        
        if found_entry:
            log_test("MongoDB Entry Found", "PASS", f"Found progress entry for Bayern/Schreinerei")
            
            # Check required fields
            required_fields = ['country', 'region', 'industry', 'status', 'companies_found', 'last_updated']
            missing_fields = [field for field in required_fields if field not in found_entry]
            
            if missing_fields:
                log_test("Entry Fields", "FAIL", f"Missing fields: {missing_fields}")
                return False
            else:
                log_test("Entry Fields", "PASS", "All required fields present in MongoDB entry")
            
            log_test("Entry Details", "INFO", 
                    f"Status: {found_entry.get('status')}, "
                    f"Companies: {found_entry.get('companies_found')}, "
                    f"Updated: {found_entry.get('last_updated')}")
        else:
            log_test("MongoDB Entry Found", "FAIL", "Progress entry not found in MongoDB")
            return False
        
        # Check stats endpoint reflects the new data
        stats_url = f"{API_BASE}/coldleads/dach/stats"
        stats_response = requests.get(stats_url, timeout=30)
        
        if stats_response.status_code == 200:
            stats_data = stats_response.json()
            completed_regions = stats_data.get('stats', {}).get('completed_regions', 0)
            log_test("Stats Update", "PASS" if completed_regions > 0 else "INFO", 
                    f"Completed regions in stats: {completed_regions}")
        else:
            log_test("Stats Update", "WARN", f"Stats check failed with {stats_response.status_code}")
        
        return True
        
    except Exception as e:
        log_test("MongoDB Integration Exception", "FAIL", str(e))
        return False

def run_comprehensive_dach_tests():
    """
    Run all DACH-Crawler tests in the specified order
    """
    print("🚀 STARTING COMPREHENSIVE DACH-CRAWLER BACKEND TESTING")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    test_results = []
    
    # Test sequence as specified in requirements
    print("\n📊 Test Sequence: Test 1 → Test 2 → Test 3 → Test 2 (again) → Test 1 (again) → Test 4 → Test 5")
    print()
    
    # Test 1: Stats endpoint (initial)
    result1 = test_dach_stats_endpoint()
    test_results.append(("GET /api/coldleads/dach/stats (initial)", result1))
    
    # Test 2: Status endpoint (initial)
    result2 = test_dach_status_endpoint()
    test_results.append(("GET /api/coldleads/dach/status (initial)", result2))
    
    # Test 3: Crawl endpoint
    result3 = test_dach_crawl_endpoint()
    test_results.append(("POST /api/coldleads/dach/crawl", result3))
    
    # Test 2 again: Status endpoint (after crawl)
    print("🔄 RE-TESTING STATUS ENDPOINT AFTER CRAWL")
    result2b = test_dach_status_endpoint()
    test_results.append(("GET /api/coldleads/dach/status (after crawl)", result2b))
    
    # Test 1 again: Stats endpoint (after crawl)
    print("🔄 RE-TESTING STATS ENDPOINT AFTER CRAWL")
    result1b = test_dach_stats_endpoint()
    test_results.append(("GET /api/coldleads/dach/stats (after crawl)", result1b))
    
    # Test 4: Error handling
    result4 = test_dach_crawl_error_handling()
    test_results.append(("POST /api/coldleads/dach/crawl (error handling)", result4))
    
    # Test 5: MongoDB integration
    result5 = test_mongodb_integration()
    test_results.append(("MongoDB Integration Check", result5))
    
    # Summary
    print("=" * 80)
    print("📋 COMPREHENSIVE TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print()
    print(f"📊 FINAL SCORE: {passed}/{len(test_results)} tests passed")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! DACH-Crawler backend is working correctly.")
    else:
        print(f"⚠️  {failed} test(s) failed. Please review the issues above.")
    
    print("=" * 80)
    
    return failed == 0

if __name__ == "__main__":
    success = run_comprehensive_dach_tests()
    exit(0 if success else 1)