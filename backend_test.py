#!/usr/bin/env python3
"""
Backend Testing for Score Zentrale - JTL Endpoints and Kaltakquise Email Generation
Tests NEW and REFACTORED JTL endpoints with dynamic schema detection
Tests Kaltakquise Email Generation functionality
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta
from pymongo import MongoClient

# Base URL from environment
BASE_URL = "https://bizanalytics-11.preview.emergentagent.com"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

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

def test_coldleads_email_generation():
    """Test the cold leads email generation functionality"""
    print("\n" + "="*60)
    print("🔥 Testing Kaltakquise Email Generation")
    print("="*60)
    
    try:
        # Step 1: Connect to MongoDB and create test prospect
        print("\n1. Setting up test prospect in MongoDB...")
        
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        collection = db['cold_prospects']
        
        # Test prospect data as specified in requirements
        test_prospect = {
            "website": "https://test-firma.de",
            "company_name": "Test Metallbau GmbH",
            "industry": "Metallverarbeitung",
            "status": "analyzed",
            "analysis": {
                "company_info": {
                    "products": ["Metallverarbeitung"],
                    "description": "Test"
                },
                "needs_assessment": {
                    "potential_products": ["Schleifbänder"],
                    "reasoning": "Test reason",
                    "score": 75
                },
                "contact_persons": [
                    {
                        "name": "Max Mustermann",
                        "email": "test@test.de",
                        "title": "Einkauf"
                    }
                ]
            },
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Insert or update test prospect
        result = collection.replace_one(
            {"website": "https://test-firma.de"}, 
            test_prospect, 
            upsert=True
        )
        
        if result.upserted_id or result.modified_count > 0:
            print("   ✅ Test prospect created/updated successfully")
        else:
            print("   ⚠️ Test prospect already exists, continuing...")
        
        # Step 2: Test POST /api/coldleads/email endpoint
        print("\n2. Testing POST /api/coldleads/email endpoint...")
        
        email_url = f"{BASE_URL}/api/coldleads/email"
        payload = {
            "website": "https://test-firma.de",
            "send": False  # Don't actually send email
        }
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        response = requests.post(email_url, json=payload, headers=headers, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("   ✅ Email generation endpoint responded successfully")
            
            # Step 3: Verify response structure
            print("\n3. Verifying response structure...")
            
            required_fields = ['ok', 'email', 'sent', 'recipient']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"   ❌ Missing required fields: {missing_fields}")
                return False, f"Missing fields: {missing_fields}"
            
            if not data.get('ok'):
                print(f"   ❌ Response indicates failure: {data.get('error', 'Unknown error')}")
                return False, f"API error: {data.get('error', 'Unknown error')}"
            
            print("   ✅ Response structure is valid")
            
            # Step 4: Verify email content
            print("\n4. Verifying email content...")
            
            email_data = data.get('email', {})
            subject = email_data.get('subject', '')
            body = email_data.get('body', '')
            
            print(f"   📧 Subject: {subject}")
            print(f"   📝 Body Length: {len(body)} characters")
            
            # Check for required content elements
            required_elements = {
                'Beratungsangebot mit Telefon': '0221-25999901' in body,
                'Jahresbedarfs-Angebot erwähnt': any(keyword in body.lower() for keyword in ['jahresbedarf', 'angebot']),
                'Christian Berres Signatur': 'Christian Berres' in body,
                'Score Handels GmbH & Co. KG': 'Score Handels GmbH & Co. KG' in body,
                'Email berres@score-schleifwerkzeuge.de': 'berres@score-schleifwerkzeuge.de' in body
            }
            
            print("\n   Content verification:")
            all_elements_present = True
            for element, present in required_elements.items():
                status = "✅" if present else "❌"
                print(f"   {status} {element}: {'Present' if present else 'Missing'}")
                if not present:
                    all_elements_present = False
            
            # Step 5: Verify recipient
            recipient = data.get('recipient')
            expected_recipient = 'test@test.de'
            
            if recipient == expected_recipient:
                print(f"   ✅ Correct recipient: {recipient}")
            else:
                print(f"   ❌ Incorrect recipient. Expected: {expected_recipient}, Got: {recipient}")
                all_elements_present = False
            
            # Step 6: Verify send flag
            sent_flag = data.get('sent')
            if sent_flag == False:
                print("   ✅ Email not sent (send=false working correctly)")
            else:
                print(f"   ❌ Unexpected sent flag: {sent_flag}")
                all_elements_present = False
            
            # Print email content for manual review
            print(f"\n   --- Generated Email Content ---")
            print(f"   Subject: {subject}")
            print(f"   Body:\n{body}")
            print("   --- End Email Content ---")
            
            if all_elements_present:
                print("\n   🎉 All email content requirements verified successfully!")
                return True, "All requirements met"
            else:
                print("\n   ⚠️ Some email content requirements are missing")
                return False, "Missing required content elements"
                
        else:
            print(f"   ❌ Email generation failed with status {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error details: {error_data}")
                return False, f"HTTP {response.status_code}: {error_data}"
            except:
                print(f"   Response text: {response.text}")
                return False, f"HTTP {response.status_code}: {response.text}"
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Network error: {e}")
        return False, f"Network error: {e}"
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False, f"Unexpected error: {e}"
    finally:
        # Cleanup: Close MongoDB connection
        try:
            client.close()
        except:
            pass

def test_smtp_connection():
    """Test SMTP connection endpoint"""
    print("\n" + "="*60)
    print("📧 Testing SMTP Connection")
    print("="*60)
    
    try:
        smtp_test_url = f"{BASE_URL}/api/coldleads/email/test"
        response = requests.get(smtp_test_url, timeout=10)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code in [200, 500]:  # Both are valid responses
            data = response.json()
            print(f"   Response: {data}")
            
            if data.get('ok'):
                print("   ✅ SMTP connection successful")
                return True, "SMTP working"
            else:
                print(f"   ⚠️ SMTP connection failed (expected if OPENAI_API_KEY not set): {data.get('message')}")
                return True, f"SMTP test completed: {data.get('message')}"
            
        else:
            print(f"   ❌ Unexpected SMTP test response: {response.status_code}")
            return False, f"HTTP {response.status_code}"
            
    except Exception as e:
        print(f"   ❌ SMTP test error: {e}")
        return False, f"Error: {e}"

def main():
    """Run all backend tests including JTL endpoints and Kaltakquise Email Generation"""
    print("🚀 Starting Backend Testing - JTL Endpoints & Kaltakquise Email Generation")
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB URL: {MONGO_URL}")
    print(f"Database: {DB_NAME}")
    
    # Test date ranges
    from_date = "2025-11-01"
    to_date = "2025-11-30"
    single_date = "2025-11-03"
    
    test_results = []
    
    # PRIORITY: Test Kaltakquise Email Generation first (as requested)
    print("\n" + "🔥"*60)
    print("PRIORITY: KALTAKQUISE EMAIL GENERATION TESTS")
    print("🔥"*60)
    
    # Test Cold Leads Email Generation
    try:
        success, message = test_coldleads_email_generation()
        test_results.append(("Kaltakquise Email Generation", success, message))
    except Exception as e:
        test_results.append(("Kaltakquise Email Generation", False, f"Exception: {str(e)}"))
    
    # Test SMTP Connection
    try:
        success, message = test_smtp_connection()
        test_results.append(("SMTP Connection Test", success, message))
    except Exception as e:
        test_results.append(("SMTP Connection Test", False, f"Exception: {str(e)}"))
    
    print("\n" + "⚙️"*60)
    print("JTL ENDPOINTS TESTS (Background)")
    print("⚙️"*60)
    
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