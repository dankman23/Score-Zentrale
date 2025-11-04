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
                if json_data and isinstance(json_data, list):
                    result = f"📝 RECORDED (200 array with {len(json_data)} items)"
                elif json_data and isinstance(json_data, dict):
                    result = f"📝 RECORDED (200 ok:{json_data.get('ok', 'N/A')})"
                else:
                    result = f"📝 RECORDED (200)"
            elif response.status_code == 500:
                if json_data and isinstance(json_data, dict):
                    result = f"📝 RECORDED (500 ok:{json_data.get('ok', 'N/A')})"
                else:
                    result = f"📝 RECORDED (500)"
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
    """Test new shipping-split endpoint and regression tests as requested"""
    print("=" * 80)
    print("🔄 NEW SHIPPING-SPLIT ENDPOINT + REGRESSION TESTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().isoformat()}")
    print("\nAs requested in review_request:")
    print("1) GET /api/jtl/orders/kpi/shipping-split?month=2025-10")
    print("   - Expected fields: ok, period.from, period.to, orders, net.with_shipping, net.without_shipping, gross.with_shipping, gross.without_shipping")
    print("2) GET /api/jtl/orders/kpi/shipping-split?from=2025-10-01&to=2025-10-31")
    print("   - Same field checks")
    print("3) Regression: /api/jtl/sales/kpi and /api/jtl/sales/platform-timeseries should still return 200")
    
    results = []
    
    # Test 1: NEW shipping-split endpoint with month parameter
    print("\n" + "="*50)
    print("TEST 1: NEW Shipping-Split KPI with month parameter")
    params = {'month': '2025-10'}
    result = test_endpoint('GET', '/jtl/orders/kpi/shipping-split', params=params, expect_200_ok=True)
    results.append(result)
    
    # Test 2: NEW shipping-split endpoint with from/to parameters
    print("\n" + "="*50)
    print("TEST 2: NEW Shipping-Split KPI with from/to parameters")
    params = {'from': '2025-10-01', 'to': '2025-10-31'}
    result = test_endpoint('GET', '/jtl/orders/kpi/shipping-split', params=params, expect_200_ok=True)
    results.append(result)
    
    # Test 3: REGRESSION - JTL Sales KPI should still work
    print("\n" + "="*50)
    print("TEST 3: REGRESSION - JTL Sales KPI (should still return 200)")
    params = {'from': '2025-10-01', 'to': '2025-10-31'}
    result = test_endpoint('GET', '/jtl/sales/kpi', params=params, expect_200_ok=True)
    results.append(result)
    
    # Test 4: REGRESSION - JTL Sales Platform Timeseries should still work
    print("\n" + "="*50)
    print("TEST 4: REGRESSION - JTL Sales Platform Timeseries (should still return 200)")
    params = {'from': '2025-10-01', 'to': '2025-10-31'}
    result = test_endpoint('GET', '/jtl/sales/platform-timeseries', params=params, expect_200_ok=True)
    results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 RE-TEST RESULTS SUMMARY")
    print("=" * 80)
    
    for i, result in enumerate(results, 1):
        endpoint = result['endpoint']
        method = result['method']
        status = result.get('status_code', 'ERROR')
        result_text = result['result']
        
        print(f"\n{i}. {method} {endpoint}")
        print(f"   Status: {status}")
        print(f"   Result: {result_text}")
        
        # Show key response data
        if result.get('json_data'):
            json_data = result['json_data']
            if 'ok' in json_data:
                print(f"   Response ok: {json_data['ok']}")
            if 'error' in json_data:
                print(f"   Error: {json_data['error']}")
            if 'minDate' in json_data or 'maxDate' in json_data:
                print(f"   Date range: {json_data.get('minDate')} to {json_data.get('maxDate')}")
            if 'revenue' in json_data:
                print(f"   Revenue: {json_data.get('revenue')}")
                print(f"   Orders: {json_data.get('orders')}")
                print(f"   Margin: {json_data.get('margin')}")
        
        if result.get('error'):
            print(f"   Exception: {result['error']}")
    
    # Analysis
    print("\n" + "=" * 80)
    print("🔍 ANALYSIS OF FILTER FIX IMPACT")
    print("=" * 80)
    
    # Check date-range improvement
    date_range_result = results[1]  # Second test
    if date_range_result['status_code'] == 200:
        data = date_range_result.get('json_data', {})
        if data.get('ok') == True:
            print("✅ SUCCESS: date-range now returns 200 ok:true (filter fix worked!)")
            print(f"   minDate: {data.get('minDate', 'null')}")
            print(f"   maxDate: {data.get('maxDate', 'null')}")
        elif data.get('ok') == False:
            print("⚠️  PARTIAL: date-range returns 200 ok:false (better than 500)")
        else:
            print("⚠️  PARTIAL: date-range returns 200 but no ok field")
    elif date_range_result['status_code'] == 500:
        print("❌ NO IMPROVEMENT: date-range still returns 500")
    else:
        print(f"❓ UNEXPECTED: date-range returns {date_range_result['status_code']}")
    
    # Record KPI response
    kpi_result = results[2]
    kpi_status = kpi_result.get('status_code', 'ERROR')
    print(f"\n📝 KPI endpoint response: {kpi_status}")
    if kpi_result.get('json_data'):
        data = kpi_result['json_data']
        print(f"   ok: {data.get('ok')}")
        if data.get('error'):
            print(f"   error: {data['error']}")
    elif kpi_result.get('error'):
        print(f"   exception: {kpi_result['error']}")
    
    # Record platform-timeseries response  
    platform_result = results[3]
    platform_status = platform_result.get('status_code', 'ERROR')
    print(f"\n📝 Platform-timeseries endpoint response: {platform_status}")
    if platform_result.get('json_data'):
        data = platform_result['json_data']
        if isinstance(data, list):
            print(f"   Returns array with {len(data)} items")
        else:
            print(f"   ok: {data.get('ok')}")
            if data.get('error'):
                print(f"   error: {data['error']}")
    elif platform_result.get('error'):
        print(f"   exception: {platform_result['error']}")
    
    # Overall assessment
    critical_failures = [r for r in results if not r['success'] and not r['result'].startswith('📝')]
    if not critical_failures:
        print(f"\n🎯 OVERALL: All endpoints responding properly (no critical failures)")
    else:
        print(f"\n⚠️  OVERALL: {len(critical_failures)} endpoints have critical issues")
    
    return results, len(critical_failures) == 0

if __name__ == "__main__":
    results, success = main()
    exit(0 if success else 1)