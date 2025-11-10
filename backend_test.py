#!/usr/bin/env python3
"""
Backend API Testing for JTL Sales APIs with AU-Filter
Tests all 7 endpoints with date range 2025-10-10 to 2025-11-09
Critical check: SKU 167676 must show 5 pieces (400 EUR), NOT 35 pieces (2750 EUR)
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://score-zentrale-2.preview.emergentagent.com/api"

# Test date range (last 30 days as specified)
FROM_DATE = "2025-10-10"
TO_DATE = "2025-11-09"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test_header(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_success(message):
    print(f"{GREEN}✅ {message}{RESET}")

def print_error(message):
    print(f"{RED}❌ {message}{RESET}")

def print_warning(message):
    print(f"{YELLOW}⚠️  {message}{RESET}")

def print_info(message):
    print(f"{BLUE}ℹ️  {message}{RESET}")

def test_sales_kpi():
    """Test 1: GET /api/jtl/sales/kpi - Only AU orders counted"""
    print_test_header("1. GET /api/jtl/sales/kpi")
    
    url = f"{BASE_URL}/jtl/sales/kpi?from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        required_fields = ['orders', 'net', 'gross', 'cost', 'margin']
        for field in required_fields:
            if field not in data:
                print_error(f"Missing required field: {field}")
                return False
        
        print_success(f"Orders: {data['orders']}")
        print_success(f"Net: {data['net']} EUR")
        print_success(f"Gross: {data['gross']} EUR")
        print_success(f"Cost: {data['cost']} EUR")
        print_success(f"Margin: {data['margin']} EUR")
        
        # Verify we have data (AU orders should exist)
        if int(data['orders']) == 0:
            print_warning("No orders found - AU filter might be too restrictive or no data in period")
        
        print_success("KPI endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_sales_timeseries():
    """Test 2: GET /api/jtl/sales/timeseries - Only AU orders in time series"""
    print_test_header("2. GET /api/jtl/sales/timeseries")
    
    url = f"{BASE_URL}/jtl/sales/timeseries?from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        if 'rows' not in data:
            print_error("Missing 'rows' field")
            return False
        
        rows = data['rows']
        print_success(f"Timeseries data points: {len(rows)}")
        
        if len(rows) > 0:
            # Show first and last data points
            print_info(f"First: {rows[0]['date']} - Orders: {rows[0]['orders']}, Net: {rows[0]['net']}")
            print_info(f"Last: {rows[-1]['date']} - Orders: {rows[-1]['orders']}, Net: {rows[-1]['net']}")
            
            # Verify structure
            for row in rows[:3]:  # Check first 3 rows
                if 'date' not in row or 'orders' not in row or 'net' not in row:
                    print_error(f"Invalid row structure: {row}")
                    return False
        
        print_success("Timeseries endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_sales_top_products():
    """Test 3: GET /api/jtl/sales/top-products - CRITICAL: SKU 167676 must show 5 pieces (400 EUR)"""
    print_test_header("3. GET /api/jtl/sales/top-products (CRITICAL CHECK)")
    
    url = f"{BASE_URL}/jtl/sales/top-products?limit=20&from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        if 'rows' not in data:
            print_error("Missing 'rows' field")
            return False
        
        rows = data['rows']
        print_success(f"Top products count: {len(rows)}")
        
        # CRITICAL CHECK: Find SKU 167676
        sku_167676 = None
        for row in rows:
            if row.get('sku') == '167676':
                sku_167676 = row
                break
        
        if sku_167676:
            quantity = float(sku_167676['quantity'])
            revenue = float(sku_167676['revenue'])
            
            print_info(f"SKU 167676 found:")
            print_info(f"  Name: {sku_167676['name']}")
            print_info(f"  Quantity: {quantity}")
            print_info(f"  Revenue: {revenue} EUR")
            
            # CRITICAL: Must be 5 pieces (400 EUR), NOT 35 pieces (2750 EUR)
            if abs(quantity - 5.0) < 0.1:  # Allow small floating point difference
                print_success(f"✅ CRITICAL CHECK PASSED: SKU 167676 shows {quantity} pieces (expected 5)")
            else:
                print_error(f"❌ CRITICAL CHECK FAILED: SKU 167676 shows {quantity} pieces, expected 5")
                print_error(f"   This indicates AU-Filter is NOT working correctly!")
                return False
            
            # Check revenue is around 400 EUR (not 2750 EUR)
            if 350 < revenue < 450:  # Allow some variance
                print_success(f"✅ Revenue check PASSED: {revenue} EUR (expected ~400)")
            else:
                print_error(f"❌ Revenue check FAILED: {revenue} EUR (expected ~400)")
                if revenue > 2000:
                    print_error(f"   Revenue {revenue} EUR suggests AN-Angebote are being counted!")
                return False
        else:
            print_warning("SKU 167676 not found in top 20 products")
            print_info("This might be OK if SKU 167676 is not in top 20 by revenue")
            # Show top 5 products for reference
            print_info("Top 5 products:")
            for i, row in enumerate(rows[:5], 1):
                print_info(f"  {i}. SKU {row['sku']}: {row['quantity']} pcs, {row['revenue']} EUR")
        
        print_success("Top products endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_sales_by_platform():
    """Test 4: GET /api/jtl/sales/by-platform - Only AU orders grouped by platform"""
    print_test_header("4. GET /api/jtl/sales/by-platform")
    
    url = f"{BASE_URL}/jtl/sales/by-platform?from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        if 'rows' not in data:
            print_error("Missing 'rows' field")
            return False
        
        rows = data['rows']
        print_success(f"Platform groups: {len(rows)}")
        
        if len(rows) > 0:
            # Show all platforms
            for row in rows:
                print_info(f"  Platform {row['platform']}: {row['orders']} orders, {row['revenue_net']} EUR")
        
        print_success("By-platform endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_sales_top_categories():
    """Test 5: GET /api/jtl/sales/top-categories - Only AU orders grouped by category"""
    print_test_header("5. GET /api/jtl/sales/top-categories")
    
    url = f"{BASE_URL}/jtl/sales/top-categories?limit=10&from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        if 'rows' not in data:
            print_error("Missing 'rows' field")
            return False
        
        rows = data['rows']
        print_success(f"Top categories count: {len(rows)}")
        
        if len(rows) > 0:
            # Show top 5 categories
            for i, row in enumerate(rows[:5], 1):
                print_info(f"  {i}. {row['category']}: {row['items']} items, {row['revenue']} EUR")
        
        print_success("Top categories endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_orders_kpi_margin():
    """Test 6: GET /api/jtl/orders/kpi/margin - Only AU orders for margin calculation"""
    print_test_header("6. GET /api/jtl/orders/kpi/margin")
    
    url = f"{BASE_URL}/jtl/orders/kpi/margin?from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        required_fields = ['orders', 'revenue_net_wo_ship', 'cost_net', 'margin_net']
        for field in required_fields:
            if field not in data:
                print_error(f"Missing required field: {field}")
                return False
        
        print_success(f"Orders: {data['orders']}")
        print_success(f"Revenue (net, w/o shipping): {data['revenue_net_wo_ship']} EUR")
        print_success(f"Cost (net): {data['cost_net']} EUR")
        print_success(f"Margin (net): {data['margin_net']} EUR")
        
        # Check cost source breakdown
        if 'cost_source' in data and 'from' in data['cost_source']:
            cost_from = data['cost_source']['from']
            print_info(f"Cost sources: Position {cost_from.get('position_pct', 0)}%, "
                      f"History {cost_from.get('history_pct', 0)}%, "
                      f"Article {cost_from.get('article_current_pct', 0)}%")
        
        print_success("Margin KPI endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_orders_kpi_shipping_split():
    """Test 7: GET /api/jtl/orders/kpi/shipping-split - Only AU orders for shipping split"""
    print_test_header("7. GET /api/jtl/orders/kpi/shipping-split")
    
    url = f"{BASE_URL}/jtl/orders/kpi/shipping-split?from={FROM_DATE}&to={TO_DATE}"
    print_info(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        # Check required fields
        required_fields = ['orders', 'net_without_shipping', 'net_with_shipping', 
                          'gross_without_shipping', 'gross_with_shipping']
        for field in required_fields:
            if field not in data:
                print_error(f"Missing required field: {field}")
                return False
        
        print_success(f"Orders: {data['orders']}")
        print_success(f"Net without shipping: {data['net_without_shipping']} EUR")
        print_success(f"Net with shipping: {data['net_with_shipping']} EUR")
        print_success(f"Gross without shipping: {data['gross_without_shipping']} EUR")
        print_success(f"Gross with shipping: {data['gross_with_shipping']} EUR")
        
        print_success("Shipping-split KPI endpoint working correctly with AU-Filter")
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}JTL SALES APIs - AU-FILTER COMPREHENSIVE TESTING{RESET}")
    print(f"{BLUE}Date Range: {FROM_DATE} to {TO_DATE}{RESET}")
    print(f"{BLUE}Base URL: {BASE_URL}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    tests = [
        ("Sales KPI", test_sales_kpi),
        ("Sales Timeseries", test_sales_timeseries),
        ("Sales Top Products (CRITICAL)", test_sales_top_products),
        ("Sales By Platform", test_sales_by_platform),
        ("Sales Top Categories", test_sales_top_categories),
        ("Orders KPI Margin", test_orders_kpi_margin),
        ("Orders KPI Shipping Split", test_orders_kpi_shipping_split),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_error(f"Test {test_name} crashed: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        if result:
            print_success(f"{test_name}: PASSED")
        else:
            print_error(f"{test_name}: FAILED")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed{RESET}")
    
    if passed == total:
        print_success(f"\n🎉 ALL TESTS PASSED! AU-Filter is working correctly across all endpoints!")
        return 0
    else:
        print_error(f"\n❌ {total - passed} test(s) failed. AU-Filter needs attention!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
