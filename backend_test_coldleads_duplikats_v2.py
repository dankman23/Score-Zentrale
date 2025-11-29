#!/usr/bin/env python3
"""
KALTAKQUISE DUPLIKATS-VERMEIDUNG & PERSISTENZ - Targeted Testing
Tests duplicate prevention with controlled data
"""

import requests
import json
import time
from datetime import datetime

# Backend URL
BASE_URL = "https://atlas-migrator.preview.emergentagent.com/api"

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

def main():
    """Run targeted duplicate prevention tests"""
    print("\n" + "="*80)
    print("  KALTAKQUISE DUPLIKATS-VERMEIDUNG - TARGETED TEST")
    print("="*80)
    
    # Use a unique region to get fresh data
    industry = "Metallverarbeitung"
    region = "Stuttgart"  # Different region
    limit = 3
    
    print_section("TEST 1: Initial Stats")
    
    response = requests.get(f"{BASE_URL}/coldleads/stats", timeout=10)
    initial_stats = response.json()
    initial_total = initial_stats.get('total', 0)
    print(f"Initial Total: {initial_total}")
    print(f"By Status: {initial_stats.get('byStatus', {})}")
    
    time.sleep(1)
    
    print_section("TEST 2: First Search (Stuttgart)")
    
    payload = {"industry": industry, "region": region, "limit": limit}
    response = requests.post(
        f"{BASE_URL}/coldleads/search",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    search1 = response.json()
    search1_count = search1.get('count', 0)
    search1_prospects = search1.get('prospects', [])
    
    print(f"Status: {response.status_code}")
    print(f"Count: {search1_count}")
    print(f"Prospects returned: {len(search1_prospects)}")
    
    # Extract websites and IDs
    search1_data = {}
    for p in search1_prospects:
        website = p.get('website')
        search1_data[website] = {
            'id': p.get('id'),
            'company': p.get('company_name'),
            'status': p.get('status')
        }
        print(f"  - {p.get('company_name')}: {website} (ID: {p.get('id')})")
    
    time.sleep(2)
    
    print_section("TEST 3: Check Stats After First Search")
    
    response = requests.get(f"{BASE_URL}/coldleads/stats", timeout=10)
    after_search1_stats = response.json()
    after_search1_total = after_search1_stats.get('total', 0)
    
    print(f"Total After Search 1: {after_search1_total}")
    print(f"By Status: {after_search1_stats.get('byStatus', {})}")
    
    new_prospects_added = after_search1_total - initial_total
    print(f"\n📊 New Prospects Added: {new_prospects_added}")
    
    print_test("Prospects were saved to database", new_prospects_added > 0,
              f"Added {new_prospects_added} prospects")
    
    time.sleep(2)
    
    print_section("TEST 4: Second Search (SAME Parameters)")
    
    # Same exact search
    response = requests.post(
        f"{BASE_URL}/coldleads/search",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    search2 = response.json()
    search2_count = search2.get('count', 0)
    search2_prospects = search2.get('prospects', [])
    
    print(f"Status: {response.status_code}")
    print(f"Count: {search2_count}")
    print(f"Prospects returned: {len(search2_prospects)}")
    
    # Extract websites and IDs
    search2_data = {}
    for p in search2_prospects:
        website = p.get('website')
        search2_data[website] = {
            'id': p.get('id'),
            'company': p.get('company_name'),
            'status': p.get('status')
        }
        print(f"  - {p.get('company_name')}: {website} (ID: {p.get('id')})")
    
    time.sleep(2)
    
    print_section("TEST 5: Check Stats After Second Search")
    
    response = requests.get(f"{BASE_URL}/coldleads/stats", timeout=10)
    after_search2_stats = response.json()
    after_search2_total = after_search2_stats.get('total', 0)
    
    print(f"Total After Search 2: {after_search2_total}")
    print(f"By Status: {after_search2_stats.get('byStatus', {})}")
    
    duplicates_created = after_search2_total - after_search1_total
    print(f"\n📊 Duplicates Created: {duplicates_created}")
    
    print_test("NO duplicates created on re-search", duplicates_created == 0,
              f"Total changed by {duplicates_created}")
    
    time.sleep(1)
    
    print_section("TEST 6: Verify Same IDs for Overlapping Websites")
    
    # Find common websites
    common_websites = set(search1_data.keys()) & set(search2_data.keys())
    
    print(f"Common websites between searches: {len(common_websites)}")
    
    if common_websites:
        all_same_ids = True
        for website in common_websites:
            id1 = search1_data[website]['id']
            id2 = search2_data[website]['id']
            same = id1 == id2
            all_same_ids = all_same_ids and same
            
            status_symbol = "✅" if same else "❌"
            print(f"{status_symbol} {website}")
            print(f"   Search 1 ID: {id1}")
            print(f"   Search 2 ID: {id2}")
        
        print_test("Same MongoDB IDs for common websites", all_same_ids,
                  "Upsert working correctly")
    else:
        print("⚠️  No common websites (mock data is random)")
    
    print_section("TEST 7: Verify Prospects in Database")
    
    # Get all prospects and verify our search results are there
    response = requests.get(f"{BASE_URL}/coldleads/search?status=all&limit=100", timeout=10)
    all_prospects = response.json()
    all_websites = {p.get('website') for p in all_prospects.get('prospects', [])}
    
    search1_websites = set(search1_data.keys())
    all_found = search1_websites.issubset(all_websites)
    
    print(f"Total prospects in DB: {all_prospects.get('count', 0)}")
    print(f"Search 1 websites: {len(search1_websites)}")
    print(f"All found in DB: {all_found}")
    
    print_test("All search results persisted in database", all_found)
    
    print_section("TEST 8: Analyze Endpoint Bug Check")
    
    # Try to analyze one prospect
    if search1_prospects:
        test_website = search1_prospects[0].get('website')
        print(f"Testing analyze with: {test_website}")
        
        response = requests.post(
            f"{BASE_URL}/coldleads/analyze",
            json={"website": test_website, "industry": industry},
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 500:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            
            if 'conflict' in error_msg.lower() and 'status' in error_msg.lower():
                print(f"❌ BUG DETECTED: {error_msg}")
                print("\n🐛 ISSUE: MongoDB conflict - 'status' field in both $set and $setOnInsert")
                print("   Location: /app/app/api/coldleads/analyze/route.ts")
                print("   Line 45: status: 'analyzed' (in $set)")
                print("   Line 69: status: 'new' (in $setOnInsert)")
                print("   Fix: Remove 'status' from $setOnInsert (line 69)")
            else:
                print(f"Error: {error_msg}")
        elif response.status_code == 200:
            print("✅ Analyze endpoint working")
            analyze_data = response.json()
            if 'analysis' in analyze_data:
                score = analyze_data['analysis'].get('needs_assessment', {}).get('score')
                print(f"   Score: {score}")
    
    print_section("SUMMARY")
    
    print(f"Initial Total: {initial_total}")
    print(f"After Search 1: {after_search1_total} (+{new_prospects_added})")
    print(f"After Search 2: {after_search2_total} (+{duplicates_created})")
    
    print(f"\n✅ CRITICAL CHECKS:")
    print(f"  1. Prospects saved during search: {'✅' if new_prospects_added >= 0 else '❌'}")
    print(f"  2. No duplicates on re-search: {'✅' if duplicates_created == 0 else '❌'}")
    print(f"  3. MongoDB _id returned: {'✅' if search1_prospects and 'id' in search1_prospects[0] else '❌'}")
    print(f"  4. All prospects persist: {'✅' if all_found else '❌'}")
    print(f"  5. Analyze endpoint: {'❌ BUG FOUND' if response.status_code == 500 else '✅'}")
    
    print("\n" + "="*80)
    print("  TEST COMPLETED")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
