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
BASE_URL = "https://bizanalytics-11.preview.emergentagent.com"

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
    """Run all JTL endpoint tests"""
    print("🚀 Starting JTL Backend Testing")
    print(f"Base URL: {BASE_URL}")
    
    # Test date ranges
    from_date = "2025-11-01"
    to_date = "2025-11-30"
    single_date = "2025-11-03"
    
    test_results = []
    
    # 1. NEW: Purchase Expenses
    print("\n" + "="*60)
    print("1. Testing NEW: Purchase Expenses Endpoint")
    print("="*60)
    
    try:
        result = test_endpoint("GET", "/api/jtl/purchase/expenses", 
                             params={"from": from_date, "to": to_date})
        
        if result['success'] and result['json']:
            is_valid, msg = validate_purchase_expenses_response(result['json'])
            if is_valid:
                print("   ✅ PASS: Purchase expenses endpoint working correctly")
                data = result['json']
                print(f"   📊 Invoices: {data.get('invoices')}")
                print(f"   💰 Net: {data.get('net')}, Gross: {data.get('gross')}")
                print(f"   🏗️  Material: {data.get('cost_components', {}).get('material')}")
                print(f"   🚚 Freight: {data.get('cost_components', {}).get('freight')}")
                print(f"   📋 Source: {data.get('debug', {}).get('source')}")
                test_results.append(("Purchase Expenses", True, "Working correctly"))
            else:
                print(f"   ❌ FAIL: Invalid response structure - {msg}")
                test_results.append(("Purchase Expenses", False, f"Invalid structure: {msg}"))
        else:
            error_msg = result.get('error', f"HTTP {result['status_code']}")
            print(f"   ❌ FAIL: {error_msg}")
            test_results.append(("Purchase Expenses", False, error_msg))
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {str(e)}")
        test_results.append(("Purchase Expenses", False, f"Exception: {str(e)}"))
    
    # 2. NEW: Gross Profit Margin
    print("\n" + "="*60)
    print("2. Testing NEW: Gross Profit Margin Endpoint")
    print("="*60)
    
    try:
        result = test_endpoint("GET", "/api/jtl/orders/kpi/margin", 
                             params={"from": from_date, "to": to_date})
        
        if result['success'] and result['json']:
            is_valid, msg = validate_margin_response(result['json'])
            if is_valid:
                print("   ✅ PASS: Margin endpoint working correctly")
                data = result['json']
                print(f"   📊 Orders: {data.get('orders')}")
                print(f"   💰 Revenue (net w/o ship): {data.get('revenue_net_wo_ship')}")
                print(f"   💸 Cost (net): {data.get('cost_net')}")
                print(f"   📈 Margin (net): {data.get('margin_net')}")
                cost_from = data.get('cost_source', {}).get('from', {})
                print(f"   🔄 Cost Sources - Position: {cost_from.get('position_pct')}%, History: {cost_from.get('history_pct')}%, Article: {cost_from.get('article_current_pct')}%")
                test_results.append(("Gross Profit Margin", True, "Working correctly"))
            else:
                print(f"   ❌ FAIL: Invalid response structure - {msg}")
                test_results.append(("Gross Profit Margin", False, f"Invalid structure: {msg}"))
        else:
            error_msg = result.get('error', f"HTTP {result['status_code']}")
            print(f"   ❌ FAIL: {error_msg}")
            test_results.append(("Gross Profit Margin", False, error_msg))
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {str(e)}")
        test_results.append(("Gross Profit Margin", False, f"Exception: {str(e)}"))
    
    # 3. REFACTORED: Shipping Split
    print("\n" + "="*60)
    print("3. Testing REFACTORED: Shipping Split Endpoint")
    print("="*60)
    
    try:
        result = test_endpoint("GET", "/api/jtl/orders/kpi/shipping-split", 
                             params={"from": "2025-10-01", "to": "2025-10-31"})
        
        if result['success'] and result['json']:
            is_valid, msg = validate_shipping_split_response(result['json'])
            if is_valid:
                print("   ✅ PASS: Shipping split endpoint working correctly")
                data = result['json']
                print(f"   📊 Orders: {data.get('orders')}")
                print(f"   💰 Net w/o shipping: {data.get('net_without_shipping')}")
                print(f"   💰 Net w/ shipping: {data.get('net_with_shipping')}")
                print(f"   💰 Gross w/o shipping: {data.get('gross_without_shipping')}")
                print(f"   💰 Gross w/ shipping: {data.get('gross_with_shipping')}")
                test_results.append(("Shipping Split", True, "Working correctly"))
            else:
                print(f"   ❌ FAIL: Invalid response structure - {msg}")
                test_results.append(("Shipping Split", False, f"Invalid structure: {msg}"))
        else:
            error_msg = result.get('error', f"HTTP {result['status_code']}")
            print(f"   ❌ FAIL: {error_msg}")
            test_results.append(("Shipping Split", False, error_msg))
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {str(e)}")
        test_results.append(("Shipping Split", False, f"Exception: {str(e)}"))
    
    # 4. REFACTORED: Timeseries
    print("\n" + "="*60)
    print("4. Testing REFACTORED: Timeseries Endpoint")
    print("="*60)
    
    try:
        result = test_endpoint("GET", "/api/jtl/orders/timeseries", 
                             params={"from": "2025-11-01", "to": "2025-11-03"})
        
        if result['success'] and result['json']:
            is_valid, msg = validate_timeseries_response(result['json'])
            if is_valid:
                print("   ✅ PASS: Timeseries endpoint working correctly")
                data = result['json']
                print(f"   📊 Grain: {data.get('grain')}")
                print(f"   📅 Rows count: {len(data.get('rows', []))}")
                if data.get('rows'):
                    first_row = data['rows'][0]
                    print(f"   📈 Sample row: {first_row.get('date')} - Orders: {first_row.get('orders')}, Net: {first_row.get('net')}")
                test_results.append(("Timeseries", True, "Working correctly"))
            else:
                print(f"   ❌ FAIL: Invalid response structure - {msg}")
                test_results.append(("Timeseries", False, f"Invalid structure: {msg}"))
        else:
            error_msg = result.get('error', f"HTTP {result['status_code']}")
            print(f"   ❌ FAIL: {error_msg}")
            test_results.append(("Timeseries", False, error_msg))
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {str(e)}")
        test_results.append(("Timeseries", False, f"Exception: {str(e)}"))
    
    # 5. REFACTORED: Diagnostics Day
    print("\n" + "="*60)
    print("5. Testing REFACTORED: Diagnostics Day Endpoint")
    print("="*60)
    
    try:
        result = test_endpoint("GET", "/api/jtl/orders/diag/day", 
                             params={"date": single_date})
        
        if result['success'] and result['json']:
            is_valid, msg = validate_diag_day_response(result['json'])
            if is_valid:
                print("   ✅ PASS: Diagnostics day endpoint working correctly")
                data = result['json']
                totals = data.get('totals', {})
                print(f"   📊 Date: {data.get('date')}")
                print(f"   📊 Total Orders: {totals.get('orders')}")
                print(f"   💰 Total Net: {totals.get('net')}")
                print(f"   💰 Total Gross: {totals.get('gross')}")
                print(f"   📋 Rows count: {len(data.get('rows', []))}")
                test_results.append(("Diagnostics Day", True, "Working correctly"))
            else:
                print(f"   ❌ FAIL: Invalid response structure - {msg}")
                test_results.append(("Diagnostics Day", False, f"Invalid structure: {msg}"))
        else:
            error_msg = result.get('error', f"HTTP {result['status_code']}")
            print(f"   ❌ FAIL: {error_msg}")
            test_results.append(("Diagnostics Day", False, error_msg))
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {str(e)}")
        test_results.append(("Diagnostics Day", False, f"Exception: {str(e)}"))
    
    # Summary
    print("\n" + "="*60)
    print("📋 TEST SUMMARY")
    print("="*60)
    
    passed = 0
    failed = 0
    
    for test_name, success, message in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print(f"\n📊 Results: {passed} passed, {failed} failed out of {len(test_results)} tests")
    
    if failed > 0:
        print("\n⚠️  Some tests failed. Check the detailed output above for error messages.")
        sys.exit(1)
    else:
        print("\n🎉 All tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()