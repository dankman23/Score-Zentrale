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
            # Expect 200 with ok:true OR 200 with array (for timeseries endpoints)
            if response.status_code == 200 and json_data:
                if isinstance(json_data, list):
                    result = "✅ PASS (200 array as expected)"
                elif json_data.get('ok') == True:
                    result = "✅ PASS (200 ok:true as expected)"
                elif json_data.get('ok') == False:
                    result = "⚠️  PARTIAL (200 ok:false - better than 500)"
                else:
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
    print("📊 SHIPPING-SPLIT + REGRESSION TEST RESULTS")
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
            
            # Handle array responses (like platform-timeseries)
            if isinstance(json_data, list):
                print(f"   Array response with {len(json_data)} items")
                if len(json_data) > 0:
                    print(f"   First item: {json_data[0]}")
            else:
                # Handle object responses
                if 'ok' in json_data:
                    print(f"   Response ok: {json_data['ok']}")
                if 'error' in json_data:
                    print(f"   Error: {json_data['error']}")
                
                # Shipping-split specific fields
                if 'period' in json_data:
                    period = json_data['period']
                    print(f"   Period: {period.get('from')} to {period.get('to')}")
                if 'orders' in json_data:
                    print(f"   Orders: {json_data.get('orders')}")
                if 'net' in json_data:
                    net = json_data['net']
                    print(f"   Net with shipping: {net.get('with_shipping')}")
                    print(f"   Net without shipping: {net.get('without_shipping')}")
                if 'gross' in json_data:
                    gross = json_data['gross']
                    print(f"   Gross with shipping: {gross.get('with_shipping')}")
                    print(f"   Gross without shipping: {gross.get('without_shipping')}")
                
                # Sales KPI fields
                if 'revenue' in json_data:
                    print(f"   Revenue: {json_data.get('revenue')}")
                    print(f"   Orders: {json_data.get('orders')}")
                    print(f"   Margin: {json_data.get('margin')}")
        
        if result.get('error'):
            print(f"   Exception: {result['error']}")
    
    # Analysis
    print("\n" + "=" * 80)
    print("🔍 ANALYSIS OF NEW ENDPOINT + REGRESSION")
    print("=" * 80)
    
    # Check shipping-split endpoint (Test 1 & 2)
    shipping_split_month = results[0]
    shipping_split_range = results[1]
    
    def validate_shipping_split_response(result, test_name):
        if result['status_code'] == 200:
            data = result.get('json_data', {})
            if data.get('ok') == True:
                # Check required fields
                required_fields = ['period', 'orders', 'net', 'gross']
                missing_fields = [f for f in required_fields if f not in data]
                if not missing_fields:
                    period = data.get('period', {})
                    net = data.get('net', {})
                    gross = data.get('gross', {})
                    if ('from' in period and 'to' in period and 
                        'with_shipping' in net and 'without_shipping' in net and
                        'with_shipping' in gross and 'without_shipping' in gross):
                        print(f"✅ {test_name}: All required fields present and valid")
                        return True
                    else:
                        print(f"❌ {test_name}: Missing sub-fields in period/net/gross")
                        return False
                else:
                    print(f"❌ {test_name}: Missing required fields: {missing_fields}")
                    return False
            else:
                print(f"❌ {test_name}: Returns ok:false")
                return False
        else:
            print(f"❌ {test_name}: Returns {result['status_code']} instead of 200")
            return False
    
    shipping_month_valid = validate_shipping_split_response(shipping_split_month, "Shipping-split (month)")
    shipping_range_valid = validate_shipping_split_response(shipping_split_range, "Shipping-split (from/to)")
    
    # Check regression tests (Test 3 & 4)
    sales_kpi_result = results[2]
    platform_timeseries_result = results[3]
    
    print(f"\n📝 REGRESSION - Sales KPI: {sales_kpi_result.get('status_code', 'ERROR')}")
    if sales_kpi_result.get('json_data', {}).get('ok') == True:
        print("✅ Sales KPI regression test PASSED")
        sales_kpi_valid = True
    else:
        print("❌ Sales KPI regression test FAILED")
        sales_kpi_valid = False
    
    print(f"\n📝 REGRESSION - Platform Timeseries: {platform_timeseries_result.get('status_code', 'ERROR')}")
    if platform_timeseries_result.get('status_code') == 200:
        data = platform_timeseries_result.get('json_data')
        if isinstance(data, list):
            print(f"✅ Platform Timeseries regression test PASSED (returns array with {len(data)} items)")
            platform_timeseries_valid = True
        elif data and isinstance(data, dict) and data.get('ok') == True:
            print("✅ Platform Timeseries regression test PASSED (returns ok:true)")
            platform_timeseries_valid = True
        else:
            print("❌ Platform Timeseries regression test FAILED (unexpected response format)")
            platform_timeseries_valid = False
    else:
        print("❌ Platform Timeseries regression test FAILED")
        platform_timeseries_valid = False
    
    # Overall assessment
    all_tests_passed = (shipping_month_valid and shipping_range_valid and 
                       sales_kpi_valid and platform_timeseries_valid)
    
    if all_tests_passed:
        print(f"\n🎯 OVERALL: All tests PASSED - New endpoint working + No regressions")
    else:
        failed_tests = []
        if not shipping_month_valid: failed_tests.append("Shipping-split (month)")
        if not shipping_range_valid: failed_tests.append("Shipping-split (from/to)")
        if not sales_kpi_valid: failed_tests.append("Sales KPI regression")
        if not platform_timeseries_valid: failed_tests.append("Platform Timeseries regression")
        print(f"\n⚠️  OVERALL: {len(failed_tests)} test(s) FAILED: {', '.join(failed_tests)}")
    
    return results, all_tests_passed

if __name__ == "__main__":
    results, success = main()
    exit(0 if success else 1)