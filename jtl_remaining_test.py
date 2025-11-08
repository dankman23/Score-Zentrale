#!/usr/bin/env python3
"""
JTL Remaining Endpoints Test
Tests the endpoints that failed due to server restart
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"
DATE_FROM = "2025-11-01"
DATE_TO = "2025-11-03"

def log_test(step, message):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"\n[{timestamp}] {step}: {message}")

def test_endpoint(name, url):
    log_test(name, url)
    
    try:
        response = requests.get(url, timeout=30)
        print(f"  Status: {response.status_code}")
        
        try:
            data = response.json()
            print(f"  Response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
            
            if response.status_code == 200:
                print(f"  ✅ PASSED")
                return {'status': 200, 'data': data}
            elif response.status_code == 500:
                print(f"  ⚠️  500 ERROR")
                return {'status': 500, 'data': data}
            elif response.status_code == 404:
                print(f"  ⚠️  404 NOT FOUND")
                return {'status': 404, 'data': data}
        except:
            print(f"  Response (text): {response.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        return {'status': 'error', 'error': str(e)}
    
    time.sleep(2)  # Delay between requests

def main():
    print("="*80)
    print("JTL REMAINING ENDPOINTS TEST")
    print("="*80)
    
    # Test date-range first (it failed with wrong field name)
    print("\n1. Date Range (re-test)")
    result = test_endpoint(
        "Date Range",
        f"{API_BASE}/jtl/sales/date-range"
    )
    if result and result.get('data'):
        data = result['data']
        print(f"\n  Actual fields: {list(data.keys())}")
        if 'min' in data:
            print(f"  min: {data['min']}")
        if 'max' in data:
            print(f"  max: {data['max']}")
    
    time.sleep(3)
    
    # Test Orders endpoints
    print("\n2. Orders Shipping Split")
    result = test_endpoint(
        "Orders Shipping Split",
        f"{API_BASE}/jtl/orders/kpi/shipping-split?from={DATE_FROM}&to={DATE_TO}"
    )
    
    time.sleep(3)
    
    print("\n3. Orders Margin")
    result = test_endpoint(
        "Orders Margin",
        f"{API_BASE}/jtl/orders/kpi/margin?from={DATE_FROM}&to={DATE_TO}"
    )
    
    time.sleep(3)
    
    # Test Purchase endpoints
    print("\n4. Purchase Orders")
    result = test_endpoint(
        "Purchase Orders",
        f"{API_BASE}/jtl/purchase/orders?from={DATE_FROM}&to={DATE_TO}"
    )
    
    time.sleep(3)
    
    print("\n5. Purchase Expenses")
    result = test_endpoint(
        "Purchase Expenses",
        f"{API_BASE}/jtl/purchase/expenses?from={DATE_FROM}&to={DATE_TO}"
    )
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
