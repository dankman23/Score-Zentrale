#!/usr/bin/env python3
"""
Prospects Flow Backend Test - Quick verification after catch-all changes
Tests the specific Prospects flow as requested in review_request
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://account-hub-34.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_prospects_flow():
    """Test the complete Prospects flow as requested"""
    print("=" * 80)
    print("🚀 PROSPECTS FLOW TEST - After Catch-All Changes")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    results = []
    
    # Step 1: GET /api/prospects -> expect 200 array
    print("\n🔍 Step 1: GET /api/prospects (expect 200 array)")
    try:
        url = f"{API_BASE}/prospects"
        response = requests.get(url, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    print(f"   ✅ SUCCESS: Got array with {len(data)} items")
                    results.append({"step": 1, "success": True, "message": f"GET /api/prospects returned array with {len(data)} items"})
                else:
                    print(f"   ❌ FAIL: Expected array, got {type(data)}")
                    results.append({"step": 1, "success": False, "message": f"Expected array, got {type(data)}"})
            except Exception as e:
                print(f"   ❌ FAIL: Invalid JSON response: {e}")
                results.append({"step": 1, "success": False, "message": f"Invalid JSON: {e}"})
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            results.append({"step": 1, "success": False, "message": f"Expected 200, got {response.status_code}"})
    except Exception as e:
        print(f"   ❌ FAIL: Request failed: {e}")
        results.append({"step": 1, "success": False, "message": f"Request failed: {e}"})
    
    # Step 2: POST /api/prospects with specific data -> expect 200 with UUID id and no _id
    print("\n🔍 Step 2: POST /api/prospects with Test GmbH data")
    test_prospect = {
        "name": "Test GmbH",
        "website": "https://test.de",
        "region": "DE",
        "industry": "Metall",
        "size": "11-50",
        "keywords": "Bänder"
    }
    
    try:
        url = f"{API_BASE}/prospects"
        response = requests.post(url, json=test_prospect, timeout=30)
        print(f"   URL: {url}")
        print(f"   Payload: {json.dumps(test_prospect, indent=2)}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                
                # Check for UUID id
                if 'id' in data and isinstance(data['id'], str) and len(data['id']) == 36:
                    print(f"   ✅ SUCCESS: Got UUID id: {data['id']}")
                    
                    # Check no _id field
                    if '_id' not in data:
                        print(f"   ✅ SUCCESS: No _id field present")
                        results.append({"step": 2, "success": True, "message": f"POST created prospect with UUID {data['id']}, no _id field", "prospect_id": data['id']})
                    else:
                        print(f"   ❌ FAIL: _id field present: {data['_id']}")
                        results.append({"step": 2, "success": False, "message": "_id field present in response"})
                else:
                    print(f"   ❌ FAIL: Invalid or missing id field")
                    results.append({"step": 2, "success": False, "message": "Invalid or missing id field"})
            except Exception as e:
                print(f"   ❌ FAIL: Invalid JSON response: {e}")
                results.append({"step": 2, "success": False, "message": f"Invalid JSON: {e}"})
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            results.append({"step": 2, "success": False, "message": f"Expected 200, got {response.status_code}"})
    except Exception as e:
        print(f"   ❌ FAIL: Request failed: {e}")
        results.append({"step": 2, "success": False, "message": f"Request failed: {e}"})
    
    # Step 3: GET /api/prospects again -> ensure it contains Test GmbH
    print("\n🔍 Step 3: GET /api/prospects (verify Test GmbH is present)")
    try:
        url = f"{API_BASE}/prospects"
        response = requests.get(url, timeout=30)
        print(f"   URL: {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    # Look for Test GmbH
                    test_gmbh_found = False
                    for prospect in data:
                        if prospect.get('name') == 'Test GmbH':
                            test_gmbh_found = True
                            print(f"   ✅ SUCCESS: Found Test GmbH in prospects list")
                            print(f"   Test GmbH data: {json.dumps(prospect, indent=2)}")
                            
                            # Verify no _id field in list items
                            if '_id' not in prospect:
                                print(f"   ✅ SUCCESS: No _id field in list item")
                                results.append({"step": 3, "success": True, "message": "Test GmbH found in prospects list, no _id field"})
                            else:
                                print(f"   ❌ FAIL: _id field present in list item")
                                results.append({"step": 3, "success": False, "message": "_id field present in list item"})
                            break
                    
                    if not test_gmbh_found:
                        print(f"   ❌ FAIL: Test GmbH not found in prospects list")
                        print(f"   Available prospects: {[p.get('name', 'No name') for p in data]}")
                        results.append({"step": 3, "success": False, "message": "Test GmbH not found in prospects list"})
                else:
                    print(f"   ❌ FAIL: Expected array, got {type(data)}")
                    results.append({"step": 3, "success": False, "message": f"Expected array, got {type(data)}"})
            except Exception as e:
                print(f"   ❌ FAIL: Invalid JSON response: {e}")
                results.append({"step": 3, "success": False, "message": f"Invalid JSON: {e}"})
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            results.append({"step": 3, "success": False, "message": f"Expected 200, got {response.status_code}"})
    except Exception as e:
        print(f"   ❌ FAIL: Request failed: {e}")
        results.append({"step": 3, "success": False, "message": f"Request failed: {e}"})
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 PROSPECTS FLOW TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r['success'])
    total = len(results)
    
    print(f"Total Steps: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    print("\n📋 STEP RESULTS:")
    for result in results:
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"  Step {result['step']}: {status} - {result['message']}")
    
    overall_success = passed == total
    print(f"\n🎯 OVERALL RESULT: {'✅ PROSPECTS FLOW WORKING' if overall_success else f'❌ PROSPECTS FLOW FAILED ({total - passed} steps failed)'}")
    
    return results, overall_success

if __name__ == "__main__":
    results, success = test_prospects_flow()
    exit(0 if success else 1)