#!/usr/bin/env python3
"""
Final Backend API Testing for Score Zentrale MVP
Tests all backend endpoints with unique data
"""

import requests
import json
import os
import uuid
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://warm-leads.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_get_kpis():
    """Test GET /api/kpis endpoint"""
    print("\n=== Testing GET /api/kpis ===")
    try:
        response = requests.get(f"{API_BASE}/kpis")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ KPIs endpoint responded successfully")
            
            # Check required structure
            required_checks = [
                ('jtl.totals.revenue', lambda d: 'jtl' in d and 'totals' in d['jtl'] and 'revenue' in d['jtl']['totals']),
                ('jtl.series[0].date', lambda d: 'jtl' in d and 'series' in d['jtl'] and len(d['jtl']['series']) > 0 and 'date' in d['jtl']['series'][0]),
                ('ads.campaigns Array', lambda d: 'ads' in d and 'campaigns' in d['ads'] and isinstance(d['ads']['campaigns'], list)),
                ('ga4.totals.users', lambda d: 'ga4' in d and 'totals' in d['ga4'] and 'users' in d['ga4']['totals'])
            ]
            
            all_passed = True
            for check_name, check_func in required_checks:
                if check_func(data):
                    print(f"✅ {check_name}: Found")
                else:
                    print(f"❌ {check_name}: Missing")
                    all_passed = False
            
            if all_passed:
                print("✅ All required KPI structure elements present")
                return True
            else:
                print("❌ KPI structure validation failed")
                return False
        else:
            print(f"❌ KPIs endpoint failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ KPIs test failed with exception: {str(e)}")
        return False

def test_prospects_flow():
    """Test POST and GET /api/prospects endpoints with unique data"""
    print("\n=== Testing Prospects Flow ===")
    
    # Generate unique data
    unique_id = str(uuid.uuid4())[:8]
    unique_domain = f"test-{unique_id}.example.com"
    
    # Test POST /api/prospects
    print("\n--- Testing POST /api/prospects ---")
    try:
        prospect_data = {
            "name": f"Test GmbH {unique_id}",
            "website": f"https://{unique_domain}",
            "region": "NRW", 
            "industry": "Metall",
            "size": "11-50"
        }
        
        response = requests.post(f"{API_BASE}/prospects", json=prospect_data)
        print(f"POST Status Code: {response.status_code}")
        
        if response.status_code == 200:
            created_prospect = response.json()
            
            # Check if it's a duplicate response
            if 'duplicate' in created_prospect:
                print("❌ Unexpected duplicate response for unique data")
                return False
                
            print("✅ Prospect created successfully")
            
            # Check for UUID id and no _id
            if 'id' in created_prospect and '_id' not in created_prospect:
                print(f"✅ Prospect has UUID id: {created_prospect['id']}")
                print(f"✅ No _id field present")
            else:
                print(f"❌ ID structure issue - id present: {'id' in created_prospect}, _id present: {'_id' in created_prospect}")
                return False
                
            # Verify data integrity
            if (created_prospect.get('name') == prospect_data['name'] and 
                created_prospect.get('website') == prospect_data['website'] and
                created_prospect.get('region') == prospect_data['region']):
                print("✅ Prospect data integrity verified")
            else:
                print("❌ Prospect data integrity failed")
                return False
                
        else:
            print(f"❌ POST prospects failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST prospects test failed: {str(e)}")
        return False
    
    # Test GET /api/prospects
    print("\n--- Testing GET /api/prospects ---")
    try:
        response = requests.get(f"{API_BASE}/prospects")
        print(f"GET Status Code: {response.status_code}")
        
        if response.status_code == 200:
            prospects = response.json()
            print(f"✅ Retrieved {len(prospects)} prospects")
            
            # Check if our created prospect is in the list
            test_prospect_found = False
            for prospect in prospects:
                if prospect.get('name') == f"Test GmbH {unique_id}":
                    test_prospect_found = True
                    if 'id' in prospect and '_id' not in prospect:
                        print("✅ Retrieved prospect has correct ID structure")
                    else:
                        print(f"❌ Retrieved prospect ID issue - id: {'id' in prospect}, _id: {'_id' in prospect}")
                        return False
                    break
            
            if test_prospect_found:
                print("✅ Created prospect found in list")
                return True
            else:
                print("❌ Created prospect not found in list")
                return False
                
        else:
            print(f"❌ GET prospects failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET prospects test failed: {str(e)}")
        return False

def test_analyze_endpoint():
    """Test POST /api/analyze endpoint"""
    print("\n=== Testing POST /api/analyze ===")
    try:
        unique_id = str(uuid.uuid4())[:8]
        analyze_data = {
            "name": f"Analyze Test GmbH {unique_id}",
            "website": f"https://analyze-{unique_id}.example", 
            "industry": "Metallbearbeitung"
        }
        
        response = requests.post(f"{API_BASE}/analyze", json=analyze_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analyze endpoint responded successfully")
            
            # Check required fields
            required_fields = ['productGroups', 'materials', 'hypotheses']
            all_present = True
            
            for field in required_fields:
                if field in result:
                    print(f"✅ {field}: Present ({len(result[field])} items)")
                else:
                    print(f"❌ {field}: Missing")
                    all_present = False
            
            if all_present:
                print("✅ All required analyze response fields present")
                return True
            else:
                print("❌ Analyze response structure validation failed")
                return False
                
        else:
            print(f"❌ Analyze endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Analyze test failed: {str(e)}")
        return False

def test_mailer_compose():
    """Test POST /api/mailer/compose endpoint"""
    print("\n=== Testing POST /api/mailer/compose ===")
    try:
        mailer_data = {
            "company": "Test GmbH",
            "contactRole": "Einkauf",
            "industry": "Metall",
            "useCases": ["Schweißnaht", "Flächenschliff"],
            "hypotheses": ["Bänder 50×2000 K80"]
        }
        
        response = requests.post(f"{API_BASE}/mailer/compose", json=mailer_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Mailer compose endpoint responded successfully")
            
            # Check required fields
            required_fields = ['subject', 'text', 'html']
            all_present = True
            
            for field in required_fields:
                if field in result and result[field]:
                    print(f"✅ {field}: Present (length: {len(result[field])})")
                else:
                    print(f"❌ {field}: Missing or empty")
                    all_present = False
            
            if all_present:
                print("✅ All required mailer response fields present")
                return True
            else:
                print("❌ Mailer response structure validation failed")
                return False
                
        else:
            print(f"❌ Mailer compose failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Mailer compose test failed: {str(e)}")
        return False

def test_status_endpoints():
    """Test GET and POST /api/status endpoints"""
    print("\n=== Testing Status Endpoints ===")
    
    # Test POST /api/status
    print("\n--- Testing POST /api/status ---")
    try:
        unique_id = str(uuid.uuid4())[:8]
        status_data = {"client_name": f"qa-{unique_id}"}
        
        response = requests.post(f"{API_BASE}/status", json=status_data)
        print(f"POST Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ POST status endpoint responded successfully")
            
            if 'id' in result and 'client_name' in result and result['client_name'] == f"qa-{unique_id}":
                print(f"✅ Status record created with id: {result['id']}")
            else:
                print("❌ Status record structure invalid")
                return False
                
        else:
            print(f"❌ POST status failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ POST status test failed: {str(e)}")
        return False
    
    # Test GET /api/status
    print("\n--- Testing GET /api/status ---")
    try:
        response = requests.get(f"{API_BASE}/status")
        print(f"GET Status Code: {response.status_code}")
        
        if response.status_code == 200:
            statuses = response.json()
            print(f"✅ Retrieved {len(statuses)} status records")
            
            # Check if our created status is in the list
            qa_status_found = False
            for status in statuses:
                if status.get('client_name') == f"qa-{unique_id}":
                    qa_status_found = True
                    if 'id' in status and '_id' not in status:
                        print("✅ Status record has correct ID structure")
                    else:
                        print(f"❌ Status record ID issue")
                        return False
                    break
            
            if qa_status_found:
                print("✅ Created status record found in list")
                return True
            else:
                print("❌ Created status record not found")
                return False
                
        else:
            print(f"❌ GET status failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET status test failed: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting Score Zentrale Backend API Tests (Final)")
    print(f"Testing against: {API_BASE}")
    
    test_results = {
        'GET /api/kpis': test_get_kpis(),
        'Prospects Flow (POST+GET /api/prospects)': test_prospects_flow(), 
        'POST /api/analyze': test_analyze_endpoint(),
        'POST /api/mailer/compose': test_mailer_compose(),
        'Status Endpoints (GET+POST /api/status)': test_status_endpoints()
    }
    
    print("\n" + "="*60)
    print("📊 BACKEND TEST RESULTS SUMMARY")
    print("="*60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print(f"⚠️  {total - passed} backend tests FAILED")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)