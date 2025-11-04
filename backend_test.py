#!/usr/bin/env python3
"""
JTL Endpoints Re-test After Filter Fix
Tests specific JTL endpoints as requested in review_request
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://jtl-analytics.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_endpoint(method, endpoint, params=None, expect_200_ok=None):
    """Test a single endpoint and return detailed results"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        print(f"\n🔍 Testing {method} {endpoint}")
        print(f"   URL: {url}")
        if params:
            print(f"   Params: {params}")
        
        if method.upper() == 'GET':
            response = requests.get(url, params=params, timeout=30)
        elif method.upper() == 'POST':
            response = requests.post(url, json=params or {}, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"   Status: {response.status_code}")
        
        # Try to parse JSON
        try:
            json_data = response.json()
            print(f"   JSON Response: {json.dumps(json_data, indent=2)}")
        except:
            print(f"   Raw Response: {response.text}")
            json_data = None
        
        # Analyze result based on expectations
        if expect_200_ok is True:
            # Expect 200 with ok:true
            if response.status_code == 200 and json_data and json_data.get('ok') == True:
                result = "✅ PASS (200 ok:true as expected)"
            elif response.status_code == 200 and json_data and json_data.get('ok') == False:
                result = "⚠️  PARTIAL (200 ok:false - better than 500)"
            elif response.status_code == 200 and json_data:
                result = "⚠️  PARTIAL (200 but no ok field)"
            elif response.status_code == 500:
                result = "❌ FAIL (Still returning 500)"
            else:
                result = f"❌ FAIL (Unexpected: {response.status_code})"
        elif expect_200_ok is False:
            # Just record the response, may still be 500
            if response.status_code == 200:
                result = f"📝 RECORDED (200 ok:{json_data.get('ok', 'N/A') if json_data else 'N/A'})"
            elif response.status_code == 500:
                result = f"📝 RECORDED (500 ok:{json_data.get('ok', 'N/A') if json_data else 'N/A'})"
            else:
                result = f"📝 RECORDED ({response.status_code})"
        else:
            # General test - just check if it responds properly
            if response.status_code in [200, 500] and json_data:
                result = f"✅ PASS ({response.status_code} with JSON)"
            else:
                result = f"❌ FAIL ({response.status_code})"
        
        print(f"   Result: {result}")
        
        return {
            'endpoint': endpoint,
            'method': method,
            'status_code': response.status_code,
            'json_data': json_data,
            'raw_response': response.text if json_data is None else None,
            'result': result,
            'success': result.startswith('✅') or result.startswith('⚠️') or result.startswith('📝')
        }
        
    except requests.exceptions.Timeout:
        print(f"   Result: ❌ FAIL (Timeout)")
        return {
            'endpoint': endpoint,
            'method': method,
            'error': 'Timeout',
            'result': '❌ FAIL (Timeout)',
            'success': False
        }
    except Exception as e:
        print(f"   Result: ❌ FAIL (Exception: {str(e)})")
        return {
            'endpoint': endpoint,
            'method': method,
            'error': str(e),
            'result': f'❌ FAIL (Exception: {str(e)})',
            'success': False
        }

def main():
    """Run JTL backend smoke tests as requested"""
    print("=" * 80)
    print("🚀 BACKEND API SMOKE TESTS - Score Zentrale JTL Analytics")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    # Test cases as requested in review_request
    test_cases = [
        # Basic routing tests
        ('GET', '/', [200]),
        ('GET', '/root', [200]),
        
        # JTL endpoints - main focus
        ('GET', '/jtl/ping', [200, 500]),
        ('GET', '/jtl/sales/date-range', [200, 500]),
        ('GET', '/jtl/sales/kpi', [200, 500], {'from': '2025-10-01', 'to': '2025-10-31'}),
        ('GET', '/jtl/sales/timeseries', [200, 500], {'from': '2025-10-01', 'to': '2025-10-31'}),
        ('GET', '/jtl/sales/platform-timeseries', [200, 500], {'from': '2025-10-01', 'to': '2025-10-31'}),
        
        # Prospects endpoint
        ('GET', '/prospects', [200, 500]),
    ]
    
    results = []
    
    for test_case in test_cases:
        if len(test_case) == 3:
            method, endpoint, expected_codes = test_case
            params = None
        else:
            method, endpoint, expected_codes, params = test_case
            
        result = test_endpoint(method, endpoint, expected_codes, params)
        results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r['success'])
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    print("\n📋 DETAILED RESULTS:")
    for result in results:
        status = result['result']
        endpoint = result['endpoint']
        method = result['method']
        print(f"  {status} - {method} {endpoint}")
        
        if 'status_code' in result:
            print(f"    Status Code: {result['status_code']}")
        
        if result.get('json_data'):
            # Show key fields from JSON response
            json_data = result['json_data']
            if 'ok' in json_data:
                print(f"    JSON ok field: {json_data['ok']}")
            if 'error' in json_data:
                print(f"    Error: {json_data['error']}")
        
        if result.get('error'):
            print(f"    Error: {result['error']}")
    
    # Check for routing failures (404s)
    routing_failures = [r for r in results if r.get('status_code') == 404]
    if routing_failures:
        print(f"\n🚨 ROUTING FAILURES DETECTED ({len(routing_failures)} endpoints returned 404):")
        for failure in routing_failures:
            print(f"  - {failure['method']} {failure['endpoint']}")
            if failure.get('raw_response'):
                print(f"    Response: {failure['raw_response'][:200]}...")
    
    # Check for unhandled errors (non-JSON 500s)
    unhandled_errors = [r for r in results if r.get('status_code') == 500 and not r.get('json_data')]
    if unhandled_errors:
        print(f"\n🚨 UNHANDLED ERRORS DETECTED ({len(unhandled_errors)} endpoints returned non-JSON 500s):")
        for error in unhandled_errors:
            print(f"  - {error['method']} {error['endpoint']}")
            if error.get('raw_response'):
                print(f"    Response: {error['raw_response'][:200]}...")
    
    print(f"\n🎯 OVERALL RESULT: {'✅ ALL TESTS PASSED' if passed == total else f'❌ {total - passed} TESTS FAILED'}")
    
    return results, passed == total

if __name__ == "__main__":
    results, success = main()
    exit(0 if success else 1)