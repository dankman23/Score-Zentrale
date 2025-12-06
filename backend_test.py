#!/usr/bin/env python3
"""
JTL Customer Import Backend Testing
Tests the JTL customer import functionality comprehensively
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://customer-hub-78.preview.emergentagent.com"
TIMEOUT = 300  # 5 minutes for import

def log(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_jtl_customer_sync():
    """Test JTL Customer Sync Daily API"""
    log("🔄 Testing JTL Customer Sync Daily API...")
    
    try:
        # Test POST /api/coldleads/jtl-customers/sync-daily
        url = f"{BASE_URL}/api/coldleads/jtl-customers/sync-daily"
        log(f"POST {url}")
        
        start_time = time.time()
        response = requests.post(url, timeout=TIMEOUT)
        duration = time.time() - start_time
        
        log(f"Response Status: {response.status_code}")
        log(f"Response Time: {duration:.2f}s")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}")
            log(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            log("❌ FAILED: Invalid JSON response")
            log(f"Response: {response.text}")
            return False
        
        # Validate response structure
        required_fields = ['ok', 'new_customers', 'updated', 'unchanged', 'total', 'duration']
        for field in required_fields:
            if field not in data:
                log(f"❌ FAILED: Missing field '{field}' in response")
                return False
        
        if not data['ok']:
            log(f"❌ FAILED: API returned ok=false")
            log(f"Error: {data.get('error', 'Unknown error')}")
            return False
        
        # Log results
        log(f"✅ JTL Customer Sync completed successfully!")
        log(f"   New customers: {data['new_customers']}")
        log(f"   Updated: {data['updated']}")
        log(f"   Unchanged: {data['unchanged']}")
        log(f"   Total processed: {data['total']}")
        log(f"   Duration: {data['duration']}ms ({data['duration']/1000:.1f}s)")
        
        # Validate that some customers were processed
        if data['total'] == 0:
            log("⚠️  WARNING: No customers were processed - this might indicate a database issue")
            return False
        
        # Check if we have a reasonable number of customers (at least 1000+ as mentioned in requirements)
        if data['total'] < 1000:
            log(f"⚠️  WARNING: Only {data['total']} customers processed, expected 1000+")
        
        return True
        
    except requests.exceptions.Timeout:
        log(f"❌ FAILED: Request timed out after {TIMEOUT}s")
        return False
    except requests.exceptions.RequestException as e:
        log(f"❌ FAILED: Request error: {e}")
        return False
    except Exception as e:
        log(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_customers_list_api():
    """Test Customers List API"""
    log("🔄 Testing Customers List API...")
    
    try:
        # Test GET /api/customers/list
        url = f"{BASE_URL}/api/customers/list"
        log(f"GET {url}")
        
        response = requests.get(url, timeout=30)
        
        log(f"Response Status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {response.status_code}")
            log(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            log("❌ FAILED: Invalid JSON response")
            log(f"Response: {response.text}")
            return False
        
        # Validate response structure
        if not data.get('ok'):
            log(f"❌ FAILED: API returned ok=false")
            log(f"Error: {data.get('error', 'Unknown error')}")
            return False
        
        if 'customers' not in data:
            log("❌ FAILED: Missing 'customers' field in response")
            return False
        
        customers = data['customers']
        log(f"✅ Customers List API working - returned {len(customers)} customers")
        
        if len(customers) == 0:
            log("⚠️  WARNING: No customers returned - might be expected if sync hasn't run yet")
            return True
        
        # Validate customer structure
        sample_customer = customers[0]
        required_fields = ['company_name', 'jtl_customer', 'total_revenue', 'total_orders']
        
        for field in required_fields:
            if field not in sample_customer:
                log(f"❌ FAILED: Missing field '{field}' in customer object")
                return False
        
        # Validate JTL customer data
        jtl_customer = sample_customer.get('jtl_customer', {})
        if 'kKunde' not in sample_customer and 'kKunde' not in jtl_customer:
            log("❌ FAILED: Missing 'kKunde' field in customer")
            return False
        
        # Log sample customer data
        log(f"✅ Sample customer validation passed:")
        log(f"   Company: {sample_customer.get('company_name', 'N/A')}")
        log(f"   kKunde: {sample_customer.get('kKunde') or jtl_customer.get('kKunde', 'N/A')}")
        log(f"   Total Revenue: {sample_customer.get('total_revenue', 0)}")
        log(f"   Total Orders: {sample_customer.get('total_orders', 0)}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log(f"❌ FAILED: Request error: {e}")
        return False
    except Exception as e:
        log(f"❌ FAILED: Unexpected error: {e}")
        return False

def test_database_consistency():
    """Test database consistency by checking for imported JTL customers"""
    log("🔄 Testing database consistency...")
    
    try:
        # Use the customers list API to check for JTL imported customers
        url = f"{BASE_URL}/api/customers/list?limit=10"
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            log(f"❌ FAILED: Could not fetch customers for consistency check")
            return False
        
        data = response.json()
        if not data.get('ok') or 'customers' not in data:
            log(f"❌ FAILED: Invalid response for consistency check")
            return False
        
        customers = data['customers']
        
        # Check for customers with imported_from_jtl flag or JTL customer data
        jtl_customers = []
        for customer in customers:
            if (customer.get('customer_source') == 'jtl' or 
                customer.get('jtl_customer', {}).get('kKunde')):
                jtl_customers.append(customer)
        
        if len(jtl_customers) == 0:
            log("⚠️  WARNING: No JTL customers found in database - sync might not have completed")
            return False
        
        log(f"✅ Database consistency check passed:")
        log(f"   Found {len(jtl_customers)} JTL customers out of {len(customers)} total")
        
        # Validate JTL customer structure
        sample_jtl = jtl_customers[0]
        jtl_data = sample_jtl.get('jtl_customer', {})
        
        required_jtl_fields = ['kKunde']
        for field in required_jtl_fields:
            if field not in jtl_data and field not in sample_jtl:
                log(f"❌ FAILED: Missing JTL field '{field}' in customer")
                return False
        
        log(f"   Sample JTL customer kKunde: {jtl_data.get('kKunde') or sample_jtl.get('kKunde')}")
        
        return True
        
    except Exception as e:
        log(f"❌ FAILED: Database consistency check error: {e}")
        return False

def main():
    """Main test execution"""
    log("🚀 Starting JTL Customer Import Backend Testing")
    log(f"Base URL: {BASE_URL}")
    
    tests = [
        ("JTL Customer Sync Daily", test_jtl_customer_sync),
        ("Customers List API", test_customers_list_api),
        ("Database Consistency", test_database_consistency)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        log(f"\n{'='*60}")
        log(f"Running: {test_name}")
        log('='*60)
        
        try:
            result = test_func()
            results[test_name] = result
            
            if result:
                log(f"✅ {test_name}: PASSED")
            else:
                log(f"❌ {test_name}: FAILED")
                
        except Exception as e:
            log(f"❌ {test_name}: EXCEPTION - {e}")
            results[test_name] = False
    
    # Summary
    log(f"\n{'='*60}")
    log("TEST SUMMARY")
    log('='*60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{test_name}: {status}")
    
    log(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        log("🎉 All tests passed!")
        return 0
    else:
        log("💥 Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())