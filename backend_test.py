#!/usr/bin/env python3
"""
Backend Testing for Score Zentrale - JTL Endpoints
Tests NEW and REFACTORED JTL endpoints with dynamic schema detection
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from environment
BASE_URL = "https://warm-leads.preview.emergentagent.com"

def test_endpoint(method, endpoint, params=None, data=None, expected_status=200):
    """Test an API endpoint and return response"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        print(f"\n🔍 Testing {method} {endpoint}")
        if params:
            print(f"   Params: {params}")
        
        if method == "GET":
            response = requests.get(url, params=params, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"   Status: {response.status_code}")
        
        # Try to parse JSON
        try:
            json_data = response.json()
            print(f"   Response: {json.dumps(json_data, indent=2)[:500]}...")
        except:
            print(f"   Raw Response: {response.text[:200]}...")
            json_data = None
        
        return {
            'status_code': response.status_code,
            'json': json_data,
            'text': response.text,
            'success': response.status_code == expected_status
        }
        
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
        return {
            'status_code': None,
            'json': None,
            'text': str(e),
            'success': False,
            'error': str(e)
        }

def validate_purchase_expenses_response(response_data):
    """Validate purchase expenses endpoint response structure"""
    if not response_data or not isinstance(response_data, dict):
        return False, "Invalid JSON response"
    
    required_fields = ['ok', 'invoices', 'net', 'gross', 'cost_components', 'debug']
    for field in required_fields:
        if field not in response_data:
            return False, f"Missing required field: {field}"
    
    if not response_data.get('ok'):
        return False, f"Response ok=false: {response_data.get('error', 'Unknown error')}"
    
    # Check cost_components structure
    cost_comp = response_data.get('cost_components', {})
    cost_fields = ['material', 'freight', 'other']
    for field in cost_fields:
        if field not in cost_comp:
            return False, f"Missing cost_components.{field}"
    
    # Check debug structure
    debug = response_data.get('debug', {})
    debug_fields = ['headerTable', 'posTable', 'dateFieldUsed', 'currency', 'source']
    for field in debug_fields:
        if field not in debug:
            return False, f"Missing debug.{field}"
    
    return True, "Valid structure"

def validate_margin_response(response_data):
    """Validate margin endpoint response structure"""
    if not response_data or not isinstance(response_data, dict):
        return False, "Invalid JSON response"
    
    required_fields = ['ok', 'orders', 'revenue_net_wo_ship', 'cost_net', 'margin_net', 'cost_source', 'debug']
    for field in required_fields:
        if field not in response_data:
            return False, f"Missing required field: {field}"
    
    if not response_data.get('ok'):
        return False, f"Response ok=false: {response_data.get('error', 'Unknown error')}"
    
    # Check cost_source structure
    cost_source = response_data.get('cost_source', {})
    if 'from' not in cost_source:
        return False, "Missing cost_source.from"
    
    cost_from = cost_source.get('from', {})
    pct_fields = ['position_pct', 'history_pct', 'article_current_pct']
    for field in pct_fields:
        if field not in cost_from:
            return False, f"Missing cost_source.from.{field}"
    
    return True, "Valid structure"

def validate_shipping_split_response(response_data):
    """Validate shipping split endpoint response structure"""
    if not response_data or not isinstance(response_data, dict):
        return False, "Invalid JSON response"
    
    required_fields = ['ok', 'period', 'orders', 'net_without_shipping', 'net_with_shipping', 
                      'gross_without_shipping', 'gross_with_shipping']
    for field in required_fields:
        if field not in response_data:
            return False, f"Missing required field: {field}"
    
    if not response_data.get('ok'):
        return False, f"Response ok=false: {response_data.get('error', 'Unknown error')}"
    
    return True, "Valid structure"

def validate_timeseries_response(response_data):
    """Validate timeseries endpoint response structure"""
    if not response_data or not isinstance(response_data, dict):
        return False, "Invalid JSON response"
    
    required_fields = ['ok', 'grain', 'rows']
    for field in required_fields:
        if field not in response_data:
            return False, f"Missing required field: {field}"
    
    if not response_data.get('ok'):
        return False, f"Response ok=false: {response_data.get('error', 'Unknown error')}"
    
    if response_data.get('grain') != 'day':
        return False, f"Expected grain='day', got '{response_data.get('grain')}'"
    
    return True, "Valid structure"

def validate_diag_day_response(response_data):
    """Validate diagnostics day endpoint response structure"""
    if not response_data or not isinstance(response_data, dict):
        return False, "Invalid JSON response"
    
    required_fields = ['ok', 'totals', 'rows']
    for field in required_fields:
        if field not in response_data:
            return False, f"Missing required field: {field}"
    
    if not response_data.get('ok'):
        return False, f"Response ok=false: {response_data.get('error', 'Unknown error')}"
    
    # Check totals structure
    totals = response_data.get('totals', {})
    totals_fields = ['orders', 'net', 'gross']
    for field in totals_fields:
        if field not in totals:
            return False, f"Missing totals.{field}"
    
    return True, "Valid structure"

def main():
    """Test JTL Orders diagnostics and KPI endpoints as requested"""
    print("=" * 80)
    print("🔄 JTL ORDERS DIAGNOSTICS AND KPI TESTING")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().isoformat()}")
    print("\nAs requested in review_request:")
    print("1) GET /api/jtl/orders/diag/day?date=2025-11-03")
    print("   - Expected: 200 ok:true; check presence of totals.orders, totals.gross, rows array")
    print("2) GET /api/jtl/orders/kpi/shipping-split?from=2025-11-03&to=2025-11-03")
    print("   - Expected: 200 ok:true and flat fields: orders, net_without_shipping, net_with_shipping, gross_without_shipping, gross_with_shipping")
    print("3) Sanity: GET /api/jtl/orders/timeseries?from=2025-11-01&to=2025-11-03")
    print("   - Expected: 200 ok:true with grain and rows array")
    
    results = []
    
    # Test 1: Orders diagnostics for specific day
    print("\n" + "="*50)
    print("TEST 1: Orders Diagnostics for 2025-11-03")
    params = {'date': '2025-11-03'}
    result = test_endpoint('GET', '/jtl/orders/diag/day', params=params, expect_200_ok=True)
    results.append(result)
    
    # Test 2: Orders KPI shipping-split for specific day
    print("\n" + "="*50)
    print("TEST 2: Orders KPI Shipping-Split for 2025-11-03")
    params = {'from': '2025-11-03', 'to': '2025-11-03'}
    result = test_endpoint('GET', '/jtl/orders/kpi/shipping-split', params=params, expect_200_ok=True)
    results.append(result)
    
    # Test 3: Sanity check - Orders timeseries
    print("\n" + "="*50)
    print("TEST 3: SANITY - Orders Timeseries (2025-11-01 to 2025-11-03)")
    params = {'from': '2025-11-01', 'to': '2025-11-03'}
    result = test_endpoint('GET', '/jtl/orders/timeseries', params=params, expect_200_ok=True)
    results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 JTL ORDERS DIAGNOSTICS AND KPI TEST RESULTS")
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
            
            # Handle object responses
            if 'ok' in json_data:
                print(f"   Response ok: {json_data['ok']}")
            if 'error' in json_data:
                print(f"   Error: {json_data['error']}")
            
            # Orders diagnostics specific fields
            if 'totals' in json_data:
                totals = json_data['totals']
                print(f"   Totals orders: {totals.get('orders')}")
                print(f"   Totals gross: {totals.get('gross')}")
            if 'rows' in json_data and isinstance(json_data['rows'], list):
                print(f"   Rows array length: {len(json_data['rows'])}")
            
            # Shipping-split flat fields
            if 'net_without_shipping' in json_data:
                print(f"   Orders: {json_data.get('orders')}")
                print(f"   Net without shipping: {json_data.get('net_without_shipping')}")
                print(f"   Net with shipping: {json_data.get('net_with_shipping')}")
                print(f"   Gross without shipping: {json_data.get('gross_without_shipping')}")
                print(f"   Gross with shipping: {json_data.get('gross_with_shipping')}")
            
            # Timeseries fields
            if 'grain' in json_data:
                print(f"   Grain: {json_data.get('grain')}")
                if 'rows' in json_data and isinstance(json_data['rows'], list):
                    print(f"   Rows array length: {len(json_data['rows'])}")
        
        if result.get('error'):
            print(f"   Exception: {result['error']}")
    
    # Analysis
    print("\n" + "=" * 80)
    print("🔍 ANALYSIS OF JTL ORDERS ENDPOINTS")
    print("=" * 80)
    
    # Test 1: Orders diagnostics validation
    diag_result = results[0]
    def validate_diag_response(result, test_name):
        if result['status_code'] == 200:
            data = result.get('json_data', {})
            if data.get('ok') == True:
                # Check required fields: totals.orders, totals.gross, rows array
                if 'totals' in data and 'rows' in data:
                    totals = data['totals']
                    if 'orders' in totals and 'gross' in totals and isinstance(data['rows'], list):
                        print(f"✅ {test_name}: All required fields present (totals.orders, totals.gross, rows array)")
                        print(f"   Captured totals: orders={totals.get('orders')}, gross={totals.get('gross')}")
                        return True, totals
                    else:
                        print(f"❌ {test_name}: Missing required fields in totals or rows not array")
                        return False, None
                else:
                    print(f"❌ {test_name}: Missing totals or rows fields")
                    return False, None
            else:
                print(f"❌ {test_name}: Returns ok:false - {data.get('error', 'No error message')}")
                return False, None
        else:
            print(f"❌ {test_name}: Returns {result['status_code']} instead of 200")
            return False, None
    
    diag_valid, diag_totals = validate_diag_response(diag_result, "Orders Diagnostics")
    
    # Test 2: Shipping-split validation
    shipping_result = results[1]
    def validate_shipping_split_response(result, test_name):
        if result['status_code'] == 200:
            data = result.get('json_data', {})
            if data.get('ok') == True:
                # Check flat fields: orders, net_without_shipping, net_with_shipping, gross_without_shipping, gross_with_shipping
                required_fields = ['orders', 'net_without_shipping', 'net_with_shipping', 'gross_without_shipping', 'gross_with_shipping']
                missing_fields = [f for f in required_fields if f not in data]
                if not missing_fields:
                    print(f"✅ {test_name}: All required flat fields present")
                    print(f"   Captured values: orders={data.get('orders')}, net_without_shipping={data.get('net_without_shipping')}, net_with_shipping={data.get('net_with_shipping')}, gross_without_shipping={data.get('gross_without_shipping')}, gross_with_shipping={data.get('gross_with_shipping')}")
                    return True, data
                else:
                    print(f"❌ {test_name}: Missing required fields: {missing_fields}")
                    return False, None
            else:
                print(f"❌ {test_name}: Returns ok:false - {data.get('error', 'No error message')}")
                return False, None
        else:
            print(f"❌ {test_name}: Returns {result['status_code']} instead of 200")
            return False, None
    
    shipping_valid, shipping_data = validate_shipping_split_response(shipping_result, "Shipping-Split KPI")
    
    # Test 3: Timeseries validation
    timeseries_result = results[2]
    def validate_timeseries_response(result, test_name):
        if result['status_code'] == 200:
            data = result.get('json_data', {})
            if data.get('ok') == True:
                # Check grain and rows array
                if 'grain' in data and 'rows' in data and isinstance(data['rows'], list):
                    print(f"✅ {test_name}: Required fields present (grain and rows array)")
                    print(f"   Captured: grain={data.get('grain')}, rows count={len(data['rows'])}")
                    return True, data
                else:
                    print(f"❌ {test_name}: Missing grain or rows fields, or rows not array")
                    return False, None
            else:
                print(f"❌ {test_name}: Returns ok:false - {data.get('error', 'No error message')}")
                return False, None
        else:
            print(f"❌ {test_name}: Returns {result['status_code']} instead of 200")
            return False, None
    
    timeseries_valid, timeseries_data = validate_timeseries_response(timeseries_result, "Orders Timeseries")
    
    # Overall assessment
    all_tests_passed = diag_valid and shipping_valid and timeseries_valid
    
    if all_tests_passed:
        print(f"\n🎯 OVERALL: All 3 tests PASSED - Orders diagnostics and KPI endpoints working correctly")
    else:
        failed_tests = []
        if not diag_valid: failed_tests.append("Orders Diagnostics")
        if not shipping_valid: failed_tests.append("Shipping-Split KPI")
        if not timeseries_valid: failed_tests.append("Orders Timeseries")
        print(f"\n⚠️  OVERALL: {len(failed_tests)} test(s) FAILED: {', '.join(failed_tests)}")
    
    return results, all_tests_passed

if __name__ == "__main__":
    results, success = main()
    exit(0 if success else 1)