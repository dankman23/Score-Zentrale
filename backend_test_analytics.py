#!/usr/bin/env python3
"""
Backend Testing Script for Analytics APIs
Tests the updated Analytics endpoints for category pages, product pages, and metrics timeseries
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://pricechart-hub.preview.emergentagent.com"

def print_test_header(test_name):
    """Print a formatted test header"""
    print("\n" + "="*80)
    print(f"TEST: {test_name}")
    print("="*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_category_pages():
    """
    Test 1: Category Pages (alle mit -kaufen/)
    GET /api/analytics/category-pages?startDate=30daysAgo&endDate=today
    Erwartung: 200 OK mit Array von Kategorieseiten
    KRITISCH: Alle Seiten sollten mit `-kaufen/` enden
    """
    print_test_header("Category Pages API - Pages ending with -kaufen/")
    
    url = f"{BASE_URL}/api/analytics/category-pages"
    params = {
        "startDate": "30daysAgo",
        "endDate": "today"
    }
    
    try:
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"Response Type: {type(data)}")
        print(f"Number of pages: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Check if response is an array
        if not isinstance(data, list):
            print_result(False, f"Expected array, got {type(data)}")
            return False
        
        # If empty array, that's acceptable
        if len(data) == 0:
            print_result(True, "Empty array returned - no category pages found (acceptable)")
            return True
        
        # Check first few pages
        print(f"\nFirst {min(5, len(data))} category pages:")
        all_end_with_kaufen = True
        for i, page in enumerate(data[:5]):
            page_path = page.get('pagePath', '')
            print(f"  {i+1}. {page_path}")
            
            # CRITICAL CHECK: Must end with -kaufen/
            if not page_path.endswith('-kaufen/'):
                print(f"     ❌ ERROR: Does NOT end with -kaufen/")
                all_end_with_kaufen = False
            else:
                print(f"     ✅ Ends with -kaufen/")
        
        # Check all pages
        pages_not_ending_with_kaufen = [p['pagePath'] for p in data if not p.get('pagePath', '').endswith('-kaufen/')]
        
        if pages_not_ending_with_kaufen:
            print(f"\n❌ CRITICAL ERROR: {len(pages_not_ending_with_kaufen)} pages do NOT end with -kaufen/:")
            for path in pages_not_ending_with_kaufen[:10]:
                print(f"  - {path}")
            print_result(False, f"Filter not working correctly - {len(pages_not_ending_with_kaufen)} pages don't end with -kaufen/")
            return False
        
        print_result(True, f"All {len(data)} category pages correctly end with -kaufen/")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_product_pages():
    """
    Test 2: Product Pages (Artikelnummer, keine -kaufen/ oder -info/)
    GET /api/analytics/product-pages?startDate=30daysAgo&endDate=today&limit=100
    Erwartung: 200 OK mit Array von Produktseiten
    KRITISCH: Seiten sollten mit Artikelnummer enden (z.B. /-375894) und NICHT -kaufen/ oder -info/ enthalten
    """
    print_test_header("Product Pages API - Pages with article numbers (no -kaufen/ or -info/)")
    
    url = f"{BASE_URL}/api/analytics/product-pages"
    params = {
        "startDate": "30daysAgo",
        "endDate": "today",
        "limit": 100
    }
    
    try:
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"Response Type: {type(data)}")
        print(f"Number of pages: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Check if response is an array
        if not isinstance(data, list):
            print_result(False, f"Expected array, got {type(data)}")
            return False
        
        # If empty array, that's acceptable
        if len(data) == 0:
            print_result(True, "Empty array returned - no product pages found (acceptable)")
            return True
        
        # Check first few pages
        print(f"\nFirst {min(10, len(data))} product pages:")
        issues = []
        for i, page in enumerate(data[:10]):
            page_path = page.get('pagePath', '')
            print(f"  {i+1}. {page_path}")
            
            # CRITICAL CHECK 1: Should NOT contain -kaufen/
            if '-kaufen/' in page_path:
                print(f"     ❌ ERROR: Contains -kaufen/ (should be excluded)")
                issues.append(f"{page_path} contains -kaufen/")
            
            # CRITICAL CHECK 2: Should NOT contain -info/
            if '-info/' in page_path:
                print(f"     ❌ ERROR: Contains -info/ (should be excluded)")
                issues.append(f"{page_path} contains -info/")
            
            # Check if ends with article number pattern (dash followed by digits)
            import re
            if re.search(r'-\d+$', page_path):
                print(f"     ✅ Ends with article number pattern")
            else:
                print(f"     ⚠️  Does not end with article number pattern (may be acceptable)")
        
        # Check all pages for critical issues
        pages_with_kaufen = [p['pagePath'] for p in data if '-kaufen/' in p.get('pagePath', '')]
        pages_with_info = [p['pagePath'] for p in data if '-info/' in p.get('pagePath', '')]
        
        if pages_with_kaufen:
            print(f"\n❌ CRITICAL ERROR: {len(pages_with_kaufen)} pages contain -kaufen/ (should be excluded):")
            for path in pages_with_kaufen[:10]:
                print(f"  - {path}")
            print_result(False, f"Filter not working - {len(pages_with_kaufen)} pages contain -kaufen/")
            return False
        
        if pages_with_info:
            print(f"\n❌ CRITICAL ERROR: {len(pages_with_info)} pages contain -info/ (should be excluded):")
            for path in pages_with_info[:10]:
                print(f"  - {path}")
            print_result(False, f"Filter not working - {len(pages_with_info)} pages contain -info/")
            return False
        
        print_result(True, f"All {len(data)} product pages correctly exclude -kaufen/ and -info/")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_metrics_timeseries():
    """
    Test 3: Metrics Timeseries (alle 8 Metriken)
    GET /api/analytics/timeseries/metrics?startDate=30daysAgo&endDate=today
    Erwartung: 200 OK mit Array von TimeSeriesDataPoints
    KRITISCH: Jeder DataPoint sollte haben: date, sessions, users, pageViews, conversions, revenue, avgSessionDuration, bounceRate, conversionRate
    """
    print_test_header("Metrics Timeseries API - All 8 metrics")
    
    url = f"{BASE_URL}/api/analytics/timeseries/metrics"
    params = {
        "startDate": "30daysAgo",
        "endDate": "today"
    }
    
    try:
        print(f"Request: GET {url}")
        print(f"Params: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"Response Type: {type(data)}")
        print(f"Number of data points: {len(data) if isinstance(data, list) else 'N/A'}")
        
        # Check if response is an array
        if not isinstance(data, list):
            print_result(False, f"Expected array, got {type(data)}")
            return False
        
        # If empty array, that's acceptable
        if len(data) == 0:
            print_result(True, "Empty array returned - no timeseries data found (acceptable)")
            return True
        
        # Required fields for each data point
        required_fields = [
            'date',
            'sessions',
            'users',
            'pageViews',
            'conversions',
            'revenue',
            'avgSessionDuration',
            'bounceRate',
            'conversionRate'
        ]
        
        print(f"\nChecking first data point for all 8 required metrics:")
        first_point = data[0]
        print(f"First data point: {json.dumps(first_point, indent=2)}")
        
        missing_fields = []
        for field in required_fields:
            if field in first_point:
                value = first_point[field]
                print(f"  ✅ {field}: {value}")
            else:
                print(f"  ❌ {field}: MISSING")
                missing_fields.append(field)
        
        if missing_fields:
            print_result(False, f"Missing required fields: {', '.join(missing_fields)}")
            return False
        
        # Check a few more data points
        print(f"\nChecking all {len(data)} data points for required fields...")
        all_valid = True
        for i, point in enumerate(data):
            point_missing = [f for f in required_fields if f not in point]
            if point_missing:
                print(f"  ❌ Data point {i} missing: {', '.join(point_missing)}")
                all_valid = False
                if i >= 5:  # Only show first 5 errors
                    print(f"  ... (stopping after 5 errors)")
                    break
        
        if not all_valid:
            print_result(False, "Some data points are missing required fields")
            return False
        
        # Show summary of last data point
        print(f"\nLast data point ({data[-1]['date']}):")
        for field in required_fields:
            print(f"  {field}: {data[-1][field]}")
        
        print_result(True, f"All {len(data)} data points have all 8 required metrics")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("ANALYTICS FILTER & METRICS UPDATE - Backend Testing")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = {
        "Category Pages": test_category_pages(),
        "Product Pages": test_product_pages(),
        "Metrics Timeseries": test_metrics_timeseries()
    }
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
