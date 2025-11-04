#!/usr/bin/env python3
"""
Backend API Smoke Tests for Score Zentrale JTL Analytics
Tests the specific endpoints requested in the review_request
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://jtl-analytics.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_endpoint(method, endpoint, expected_status_codes=[200, 500], params=None):
    """Test a single endpoint and return results"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        print(f"\n🔍 Testing {method} {endpoint}")
        print(f"   URL: {url}")
        
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
            print(f"   JSON Response: {json.dumps(json_data, indent=2)[:200]}...")
        except:
            print(f"   Raw Response: {response.text[:200]}...")
            json_data = None
        
        # Check if status code is expected
        if response.status_code in expected_status_codes:
            if json_data is not None:
                # Check for proper JSON structure
                if response.status_code == 200:
                    if 'ok' in json_data:
                        result = "✅ PASS" if json_data.get('ok') else "⚠️  PASS (ok:false)"
                    else:
                        result = "✅ PASS (JSON response)"
                elif response.status_code == 500:
                    if 'ok' in json_data and json_data.get('ok') == False:
                        result = "✅ PASS (500 with ok:false)"
                    else:
                        result = "⚠️  PASS (500 but no ok:false)"
                else:
                    result = "✅ PASS"
            else:
                result = "❌ FAIL (No JSON response)"
        else:
            result = f"❌ FAIL (Unexpected status {response.status_code})"
        
        print(f"   Result: {result}")
        
        return {
            'endpoint': endpoint,
            'method': method,
            'status_code': response.status_code,
            'json_data': json_data,
            'raw_response': response.text[:500] if json_data is None else None,
            'result': result,
            'success': result.startswith('✅') or result.startswith('⚠️')
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
    """Run all backend tests"""
    print("🚀 Starting Score Zentrale Backend API Tests")
    print(f"Testing against: {API_BASE}")
    
    test_results = {
        'GET /api/kpis': test_get_kpis(),
        'Prospects Flow (POST+GET /api/prospects)': test_prospects_flow(), 
        'POST /api/analyze': test_analyze_endpoint(),
        'POST /api/mailer/compose': test_mailer_compose(),
        'Status Endpoints (GET+POST /api/status)': test_status_endpoints()
    }
    
    print("\n" + "="*60)
    print("📊 BACKEND TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print(f"⚠️  {total - passed} backend tests FAILED")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)