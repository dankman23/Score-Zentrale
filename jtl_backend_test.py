#!/usr/bin/env python3
"""
JTL Sales & Orders Backend API Test
Comprehensive testing of all JTL endpoints with date range 2025-11-01 to 2025-11-03
"""

import requests
import json
from datetime import datetime

# Use internal localhost since we're inside the container
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

# Test date range (known working period with 195 orders)
DATE_FROM = "2025-11-01"
DATE_TO = "2025-11-03"

def log_test(step, message):
    """Log test step with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"\n[{timestamp}] {step}: {message}")

def log_response(response, show_full=False):
    """Log response details"""
    print(f"  Status: {response.status_code}")
    try:
        data = response.json()
        if show_full or response.status_code != 200:
            print(f"  Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        else:
            # Show abbreviated response for 200 OK
            print(f"  Response keys: {list(data.keys())}")
            if 'ok' in data:
                print(f"  ok: {data['ok']}")
            # Show sample values
            for key in ['orders', 'net', 'gross', 'revenue', 'margin']:
                if key in data:
                    print(f"  {key}: {data[key]}")
        return data
    except:
        print(f"  Response (text): {response.text[:500]}")
        return None

def test_endpoint(name, url, expected_fields=None, expect_array=False):
    """Generic endpoint test"""
    log_test(name, url)
    
    try:
        response = requests.get(url, timeout=30)
        data = log_response(response)
        
        # Check status code
        if response.status_code == 404:
            print(f"  ⚠️  404 - Endpoint not found")
            return {'status': 404, 'data': None}
        
        if response.status_code == 500:
            error_msg = data.get('error', 'Unknown error') if data else 'No error message'
            print(f"  ⚠️  500 - Server error: {error_msg}")
            return {'status': 500, 'error': error_msg, 'data': data}
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert data is not None, "No JSON response"
        
        # Check for ok field if present
        if 'ok' in data:
            assert data['ok'] == True, f"API returned ok=false: {data.get('error')}"
        
        # Check expected fields
        if expected_fields:
            for field in expected_fields:
                assert field in data, f"Missing expected field: {field}"
                print(f"  ✓ Field '{field}' present")
        
        # Check if array expected
        if expect_array:
            if 'rows' in data:
                assert isinstance(data['rows'], list), "Expected 'rows' to be an array"
                print(f"  ✓ Array 'rows' with {len(data['rows'])} items")
            elif 'values' in data:
                assert isinstance(data['values'], list), "Expected 'values' to be an array"
                print(f"  ✓ Array 'values' with {len(data['values'])} items")
            else:
                assert isinstance(data, list), "Expected response to be an array"
                print(f"  ✓ Array with {len(data)} items")
        
        print(f"  ✅ PASSED")
        return {'status': 200, 'data': data}
        
    except AssertionError as e:
        print(f"  ❌ FAILED: {e}")
        return {'status': 'failed', 'error': str(e), 'data': data if 'data' in locals() else None}
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        return {'status': 'error', 'error': str(e)}

def main():
    """Run all JTL backend tests"""
    
    print("="*80)
    print("JTL SALES & ORDERS BACKEND API TEST")
    print(f"Date Range: {DATE_FROM} to {DATE_TO}")
    print("="*80)
    
    results = {}
    
    # ========================================================================
    # 1. SALES KPI APIs
    # ========================================================================
    print("\n" + "="*80)
    print("1. SALES KPI APIs")
    print("="*80)
    
    results['sales_kpi'] = test_endpoint(
        "Sales KPI",
        f"{API_BASE}/jtl/sales/kpi?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'orders', 'net', 'gross']
    )
    
    results['sales_kpi_with_fees'] = test_endpoint(
        "Sales KPI with Platform Fees",
        f"{API_BASE}/jtl/sales/kpi/with_platform_fees?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'net', 'platform_fees']
    )
    
    # ========================================================================
    # 2. SALES TIMESERIES APIs
    # ========================================================================
    print("\n" + "="*80)
    print("2. SALES TIMESERIES APIs")
    print("="*80)
    
    results['sales_timeseries'] = test_endpoint(
        "Sales Timeseries",
        f"{API_BASE}/jtl/sales/timeseries?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'rows'],
        expect_array=True
    )
    
    results['sales_timeseries_with_fees'] = test_endpoint(
        "Sales Timeseries with Platform Fees",
        f"{API_BASE}/jtl/sales/timeseries/with_platform_fees?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'rows'],
        expect_array=True
    )
    
    # ========================================================================
    # 3. SALES PRODUCTS & FILTERS
    # ========================================================================
    print("\n" + "="*80)
    print("3. SALES PRODUCTS & FILTERS")
    print("="*80)
    
    results['top_products'] = test_endpoint(
        "Top Products",
        f"{API_BASE}/jtl/sales/top-products?limit=10&from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'rows'],
        expect_array=True
    )
    
    results['date_range'] = test_endpoint(
        "Date Range",
        f"{API_BASE}/jtl/sales/date-range",
        expected_fields=['ok', 'minDate', 'maxDate']
    )
    
    results['filter_warengruppen'] = test_endpoint(
        "Filter Warengruppen",
        f"{API_BASE}/jtl/sales/filters/warengruppen",
        expected_fields=['ok', 'values'],
        expect_array=True
    )
    
    results['filter_hersteller'] = test_endpoint(
        "Filter Hersteller",
        f"{API_BASE}/jtl/sales/filters/hersteller",
        expected_fields=['ok', 'values'],
        expect_array=True
    )
    
    results['filter_lieferanten'] = test_endpoint(
        "Filter Lieferanten",
        f"{API_BASE}/jtl/sales/filters/lieferanten",
        expected_fields=['ok', 'values'],
        expect_array=True
    )
    
    # ========================================================================
    # 4. ORDERS APIs
    # ========================================================================
    print("\n" + "="*80)
    print("4. ORDERS APIs")
    print("="*80)
    
    results['orders_shipping_split'] = test_endpoint(
        "Orders Shipping Split",
        f"{API_BASE}/jtl/orders/kpi/shipping-split?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'orders', 'net_without_shipping', 'net_with_shipping', 
                        'gross_without_shipping', 'gross_with_shipping']
    )
    
    results['orders_margin'] = test_endpoint(
        "Orders Margin",
        f"{API_BASE}/jtl/orders/kpi/margin?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok', 'revenue_net_wo_ship', 'cost_net', 'margin_net', 'cost_source']
    )
    
    # ========================================================================
    # 5. PURCHASE APIs
    # ========================================================================
    print("\n" + "="*80)
    print("5. PURCHASE APIs")
    print("="*80)
    
    results['purchase_orders'] = test_endpoint(
        "Purchase Orders",
        f"{API_BASE}/jtl/purchase/orders?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok']
    )
    
    results['purchase_expenses'] = test_endpoint(
        "Purchase Expenses",
        f"{API_BASE}/jtl/purchase/expenses?from={DATE_FROM}&to={DATE_TO}",
        expected_fields=['ok']
    )
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = 0
    failed = 0
    errors_500 = 0
    errors_404 = 0
    
    for name, result in results.items():
        status = result.get('status')
        if status == 200:
            print(f"  ✅ {name}: PASSED")
            passed += 1
        elif status == 500:
            print(f"  ⚠️  {name}: 500 ERROR - {result.get('error', 'Unknown')[:80]}")
            errors_500 += 1
        elif status == 404:
            print(f"  ⚠️  {name}: 404 NOT FOUND")
            errors_404 += 1
        else:
            print(f"  ❌ {name}: FAILED - {result.get('error', 'Unknown')[:80]}")
            failed += 1
    
    print("\n" + "="*80)
    print(f"Total: {len(results)} endpoints")
    print(f"  ✅ Passed: {passed}")
    print(f"  ❌ Failed: {failed}")
    print(f"  ⚠️  500 Errors: {errors_500}")
    print(f"  ⚠️  404 Not Found: {errors_404}")
    print("="*80)
    
    # Show detailed errors for 500s
    if errors_500 > 0:
        print("\n" + "="*80)
        print("500 ERROR DETAILS")
        print("="*80)
        for name, result in results.items():
            if result.get('status') == 500:
                print(f"\n{name}:")
                print(f"  Error: {result.get('error', 'Unknown')}")
                if result.get('data'):
                    data = result['data']
                    if 'sql_error' in data:
                        print(f"  SQL Error: {data['sql_error']}")
    
    return passed == len(results)

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
