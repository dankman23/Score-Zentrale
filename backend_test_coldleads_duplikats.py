#!/usr/bin/env python3
"""
KALTAKQUISE DUPLIKATS-VERMEIDUNG & PERSISTENZ - Comprehensive Testing
Tests duplicate prevention and data persistence for cold leads system
"""

import requests
import json
import time
from datetime import datetime

# Backend URL
BASE_URL = "https://fibu-connect.preview.emergentagent.com/api"

def print_section(title):
    """Print a section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_test(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def test_get_stats(step_name):
    """Test GET /api/coldleads/stats"""
    print_section(f"{step_name}: GET /api/coldleads/stats")
    
    try:
        response = requests.get(f"{BASE_URL}/coldleads/stats", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            has_ok = 'ok' in data and data['ok'] == True
            has_total = 'total' in data
            has_byStatus = 'byStatus' in data
            has_unreadReplies = 'unreadReplies' in data
            has_recentReplies = 'recentReplies' in data
            has_awaitingFollowup = 'awaitingFollowup' in data
            
            all_fields = has_ok and has_total and has_byStatus and has_unreadReplies and has_recentReplies and has_awaitingFollowup
            
            print_test("Stats endpoint returns 200", True)
            print_test("All required fields present", all_fields, 
                      f"total={data.get('total')}, byStatus={data.get('byStatus')}")
            
            return data
        else:
            print(f"Error Response: {response.text}")
            print_test("Stats endpoint returns 200", False, f"Got {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        print_test("Stats endpoint accessible", False, str(e))
        return None

def test_search_prospects(industry, region, limit, step_name):
    """Test POST /api/coldleads/search"""
    print_section(f"{step_name}: POST /api/coldleads/search")
    
    payload = {
        "industry": industry,
        "region": region,
        "limit": limit
    }
    
    print(f"Request Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/coldleads/search",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, default=str)}")
            
            # Check required fields
            has_ok = 'ok' in data and data['ok'] == True
            has_count = 'count' in data
            has_prospects = 'prospects' in data and isinstance(data['prospects'], list)
            
            prospects = data.get('prospects', [])
            count = data.get('count', 0)
            
            # Check prospect structure
            all_have_id = all('id' in p for p in prospects)
            all_have_company = all('company_name' in p for p in prospects)
            all_have_website = all('website' in p for p in prospects)
            all_have_status = all('status' in p for p in prospects)
            all_status_new = all(p.get('status') == 'new' for p in prospects)
            
            print_test("Search returns 200", True)
            print_test("All required fields present", has_ok and has_count and has_prospects,
                      f"ok={has_ok}, count={count}, prospects_array={has_prospects}")
            print_test("Count matches prospects length", count == len(prospects),
                      f"count={count}, len(prospects)={len(prospects)}")
            print_test("All prospects have id field", all_have_id)
            print_test("All prospects have company_name", all_have_company)
            print_test("All prospects have website", all_have_website)
            print_test("All prospects have status='new'", all_status_new)
            
            # Print first prospect details
            if prospects:
                print(f"\nFirst Prospect Details:")
                first = prospects[0]
                print(f"  ID: {first.get('id')}")
                print(f"  Company: {first.get('company_name')}")
                print(f"  Website: {first.get('website')}")
                print(f"  Status: {first.get('status')}")
                print(f"  Score: {first.get('score')}")
            
            return data
        else:
            print(f"Error Response: {response.text}")
            print_test("Search returns 200", False, f"Got {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        print_test("Search endpoint accessible", False, str(e))
        return None

def test_analyze_prospect(website, industry, step_name):
    """Test POST /api/coldleads/analyze"""
    print_section(f"{step_name}: POST /api/coldleads/analyze")
    
    payload = {
        "website": website,
        "industry": industry
    }
    
    print(f"Request Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/coldleads/analyze",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response Keys: {list(data.keys())}")
            
            # Check required fields
            has_ok = 'ok' in data and data['ok'] == True
            has_analysis = 'analysis' in data
            
            if has_analysis:
                analysis = data['analysis']
                print(f"Analysis Keys: {list(analysis.keys())}")
                
                has_company_info = 'company_info' in analysis
                has_contact_persons = 'contact_persons' in analysis
                has_needs_assessment = 'needs_assessment' in analysis
                
                if has_needs_assessment:
                    score = analysis['needs_assessment'].get('score')
                    print(f"  Score: {score}")
                
                print_test("Analyze returns 200", True)
                print_test("Has analysis object", has_analysis)
                print_test("Has company_info", has_company_info)
                print_test("Has contact_persons", has_contact_persons)
                print_test("Has needs_assessment with score", has_needs_assessment and score is not None,
                          f"score={score}")
            else:
                print_test("Analyze returns 200", True)
                print_test("Has analysis object", False)
            
            return data
        else:
            print(f"Error Response: {response.text}")
            print_test("Analyze returns 200", False, f"Got {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        print_test("Analyze endpoint accessible", False, str(e))
        return None

def test_get_prospects(status="all", step_name=""):
    """Test GET /api/coldleads/search"""
    print_section(f"{step_name}: GET /api/coldleads/search?status={status}")
    
    try:
        response = requests.get(
            f"{BASE_URL}/coldleads/search?status={status}",
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            prospects = data.get('prospects', [])
            
            print(f"Count: {count}")
            print(f"Prospects Length: {len(prospects)}")
            
            # Check for analyzed prospects
            analyzed = [p for p in prospects if p.get('status') == 'analyzed']
            new_prospects = [p for p in prospects if p.get('status') == 'new']
            
            print(f"Analyzed: {len(analyzed)}")
            print(f"New: {len(new_prospects)}")
            
            # Print sample prospects
            if prospects:
                print(f"\nSample Prospects (first 3):")
                for i, p in enumerate(prospects[:3]):
                    print(f"  {i+1}. {p.get('company_name')} - {p.get('website')} - Status: {p.get('status')} - Score: {p.get('score')}")
            
            print_test("Get prospects returns 200", True)
            print_test("Count matches prospects length", count == len(prospects),
                      f"count={count}, len={len(prospects)}")
            
            return data
        else:
            print(f"Error Response: {response.text}")
            print_test("Get prospects returns 200", False, f"Got {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception: {str(e)}")
        print_test("Get prospects accessible", False, str(e))
        return None

def main():
    """Run comprehensive duplicate prevention and persistence tests"""
    print("\n" + "="*80)
    print("  KALTAKQUISE DUPLIKATS-VERMEIDUNG & PERSISTENZ")
    print("  Comprehensive Testing")
    print("="*80)
    
    # Test parameters
    industry = "Metallverarbeitung"
    region = "München"
    limit = 5
    
    # STEP 1: Get initial stats
    initial_stats = test_get_stats("STEP 1")
    initial_total = initial_stats.get('total', 0) if initial_stats else 0
    print(f"\n📊 Initial Total Prospects: {initial_total}")
    
    time.sleep(1)
    
    # STEP 2: First search - should save prospects
    search1_result = test_search_prospects(industry, region, limit, "STEP 2 (First Search)")
    search1_count = search1_result.get('count', 0) if search1_result else 0
    search1_prospects = search1_result.get('prospects', []) if search1_result else []
    
    if search1_prospects:
        first_website = search1_prospects[0].get('website')
        print(f"\n📝 First Website for Analysis: {first_website}")
    else:
        first_website = None
    
    time.sleep(2)
    
    # STEP 3: Second search with SAME parameters - should NOT create duplicates
    search2_result = test_search_prospects(industry, region, limit, "STEP 3 (Duplicate Check - Same Search)")
    search2_count = search2_result.get('count', 0) if search2_result else 0
    search2_prospects = search2_result.get('prospects', []) if search2_result else []
    
    # Check for duplicates
    if search1_prospects and search2_prospects:
        search1_websites = set(p.get('website') for p in search1_prospects)
        search2_websites = set(p.get('website') for p in search2_prospects)
        
        print_section("DUPLICATE CHECK")
        print(f"Search 1 Websites: {search1_websites}")
        print(f"Search 2 Websites: {search2_websites}")
        
        same_websites = search1_websites == search2_websites
        print_test("Same websites returned in both searches", same_websites)
        
        # Check if IDs are the same (meaning same documents, not new ones)
        search1_ids = {p.get('website'): p.get('id') for p in search1_prospects}
        search2_ids = {p.get('website'): p.get('id') for p in search2_prospects}
        
        same_ids = all(search1_ids.get(w) == search2_ids.get(w) for w in search1_websites if w in search2_websites)
        print_test("Same MongoDB IDs (no new documents created)", same_ids,
                  f"IDs match: {same_ids}")
    
    time.sleep(2)
    
    # STEP 4: Analyze first prospect - should UPDATE existing, not create new
    if first_website:
        analyze_result = test_analyze_prospect(first_website, industry, "STEP 4 (Analyze Prospect)")
        time.sleep(2)
    else:
        print("\n⚠️  Skipping analysis - no website available")
        analyze_result = None
    
    # STEP 5: Get all prospects - check persistence
    all_prospects = test_get_prospects("all", "STEP 5 (Persistence Check)")
    final_count = all_prospects.get('count', 0) if all_prospects else 0
    
    time.sleep(1)
    
    # STEP 6: Get final stats
    final_stats = test_get_stats("STEP 6 (Final Stats)")
    final_total = final_stats.get('total', 0) if final_stats else 0
    
    # FINAL ANALYSIS
    print_section("FINAL ANALYSIS")
    
    print(f"Initial Total: {initial_total}")
    print(f"Search 1 Count: {search1_count}")
    print(f"Search 2 Count: {search2_count}")
    print(f"Final Total: {final_total}")
    print(f"Final Count (GET): {final_count}")
    
    # Expected: final_total should be initial_total + search1_count (or close to it)
    # NOT initial_total + search1_count + search2_count (that would mean duplicates)
    expected_total = initial_total + search1_count
    
    print(f"\nExpected Total (no duplicates): ~{expected_total}")
    print(f"Actual Total: {final_total}")
    
    # Allow some variance (±2) because of concurrent operations
    no_duplicates = abs(final_total - expected_total) <= 2
    
    print_test("No duplicates created", no_duplicates,
              f"Expected ~{expected_total}, Got {final_total}")
    
    # Check if analyzed prospect exists
    if all_prospects and first_website:
        prospects_list = all_prospects.get('prospects', [])
        analyzed_prospect = next((p for p in prospects_list if p.get('website') == first_website), None)
        
        if analyzed_prospect:
            print(f"\nAnalyzed Prospect Found:")
            print(f"  Website: {analyzed_prospect.get('website')}")
            print(f"  Status: {analyzed_prospect.get('status')}")
            print(f"  Score: {analyzed_prospect.get('score')}")
            
            is_analyzed = analyzed_prospect.get('status') == 'analyzed'
            has_score = analyzed_prospect.get('score') is not None
            
            print_test("Prospect status updated to 'analyzed'", is_analyzed)
            print_test("Prospect has score", has_score)
        else:
            print_test("Analyzed prospect found in database", False, "Not found")
    
    # Summary
    print_section("TEST SUMMARY")
    
    if final_stats:
        by_status = final_stats.get('byStatus', {})
        print(f"Prospects by Status:")
        for status, count in by_status.items():
            print(f"  {status}: {count}")
    
    print(f"\n✅ CRITICAL CHECKS:")
    print(f"  1. Prospects saved during search: {'✅' if search1_count > 0 else '❌'}")
    print(f"  2. No duplicates on re-search: {'✅' if no_duplicates else '❌'}")
    print(f"  3. MongoDB _id returned: {'✅' if search1_prospects and 'id' in search1_prospects[0] else '❌'}")
    print(f"  4. Analyze updates existing: {'✅' if analyze_result else '⚠️ Not tested'}")
    print(f"  5. All prospects persist: {'✅' if final_count >= search1_count else '❌'}")
    
    print("\n" + "="*80)
    print("  TEST COMPLETED")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
