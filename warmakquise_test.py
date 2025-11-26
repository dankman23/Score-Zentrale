#!/usr/bin/env python3
"""
Backend API Testing for Warmakquise (Warm Leads) nach neuem Score-System
Tests all leads endpoints with new scoring logic
Critical checks:
- No leads with lastOrder < 120 days (< 4 months)
- Top score should be < 100 (max ~90)
- Notes persist after re-import
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from environment
BASE_URL = "https://biz-insights-14.preview.emergentagent.com/api"

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

def test_leads_import():
    """Test 1: POST /api/leads/import with parameters"""
    print_test_header("1. POST /api/leads/import")
    
    url = f"{BASE_URL}/leads/import"
    print_info(f"URL: {url}")
    
    # Test parameters as specified
    params = {
        "minInactiveMonths": 4,
        "maxInactiveMonths": 24,
        "minOrders": 2,
        "minRevenue": 1000
    }
    
    print_info(f"Parameters: {json.dumps(params, indent=2)}")
    
    try:
        response = requests.post(url, json=params, timeout=60)
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
        if 'imported' not in data or 'count' not in data:
            print_error(f"Missing required fields. Got: {data}")
            return False
        
        imported = data['imported']
        count = data['count']
        
        print_success(f"Import successful: ok=true")
        print_success(f"Imported: {imported}")
        print_success(f"Count: {count}")
        
        # Verify we got some leads
        if imported > 0 and count > 0:
            print_success(f"✅ Import returned leads (imported={imported}, count={count})")
        else:
            print_warning(f"No leads imported. This might be OK if no customers match criteria.")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_leads_get_sorted():
    """Test 2: GET /api/leads?limit=20&sort=warmScore&order=desc"""
    print_test_header("2. GET /api/leads (sorted by warmScore)")
    
    url = f"{BASE_URL}/leads?limit=20&sort=warmScore&order=desc"
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
        print_success(f"Retrieved {len(rows)} leads")
        
        if len(rows) == 0:
            print_warning("No leads found. Import might have failed or no matching customers.")
            return True
        
        # CRITICAL CHECK 1: Top score should be < 100 (max ~90)
        top_score = rows[0].get('warmScore', 0)
        print_info(f"Top warmScore: {top_score}")
        
        if top_score < 100:
            print_success(f"✅ CRITICAL CHECK PASSED: Top score {top_score} < 100")
        else:
            print_error(f"❌ CRITICAL CHECK FAILED: Top score {top_score} >= 100 (expected < 100)")
            return False
        
        # CRITICAL CHECK 2: All customers should have lastOrder between 120-730 days (4-24 months)
        print_info("\nChecking lastOrder dates (must be 120-730 days ago)...")
        now = datetime.now()
        min_days = 120  # 4 months
        max_days = 730  # 24 months
        
        invalid_leads = []
        for i, lead in enumerate(rows[:10], 1):  # Check first 10
            last_order = lead.get('lastOrder')
            score = lead.get('warmScore', 0)
            name = lead.get('name', 'Unknown')
            
            if last_order:
                last_order_date = datetime.fromisoformat(last_order.replace('Z', '+00:00'))
                days_ago = (now - last_order_date).days
                
                print_info(f"  {i}. {name[:30]:30s} | Score: {score:3d} | Last Order: {days_ago:4d} days ago")
                
                # CRITICAL: No leads with lastOrder < 120 days
                if days_ago < min_days:
                    invalid_leads.append({
                        'name': name,
                        'days_ago': days_ago,
                        'score': score,
                        'reason': f'Too recent (< {min_days} days)'
                    })
                elif days_ago > max_days:
                    print_warning(f"    Lead has lastOrder > {max_days} days ago (might be OK with low score)")
        
        if invalid_leads:
            print_error(f"\n❌ CRITICAL CHECK FAILED: Found {len(invalid_leads)} leads with lastOrder < {min_days} days:")
            for lead in invalid_leads:
                print_error(f"  - {lead['name']}: {lead['days_ago']} days ago (score: {lead['score']})")
            return False
        else:
            print_success(f"✅ CRITICAL CHECK PASSED: No leads with lastOrder < {min_days} days")
        
        # Check score distribution
        scores = [lead.get('warmScore', 0) for lead in rows]
        avg_score = sum(scores) / len(scores) if scores else 0
        print_info(f"\nScore distribution: Min={min(scores)}, Max={max(scores)}, Avg={avg_score:.1f}")
        
        if 70 <= max(scores) <= 90:
            print_success(f"✅ Score distribution looks realistic (top score in 70-90 range)")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_leads_filter_high_score():
    """Test 3: GET /api/leads?minScore=80"""
    print_test_header("3. GET /api/leads?minScore=80")
    
    url = f"{BASE_URL}/leads?minScore=80"
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
        
        rows = data.get('rows', [])
        print_success(f"Retrieved {len(rows)} leads with score >= 80")
        
        if len(rows) > 0:
            # Verify all have score >= 80
            invalid = [lead for lead in rows if lead.get('warmScore', 0) < 80]
            if invalid:
                print_error(f"Found {len(invalid)} leads with score < 80")
                return False
            
            print_success(f"✅ All {len(rows)} leads have score >= 80")
            
            # Check if they're in sweet spot (120-365 days)
            now = datetime.now()
            sweet_spot_count = 0
            for lead in rows[:5]:  # Check first 5
                last_order = lead.get('lastOrder')
                if last_order:
                    last_order_date = datetime.fromisoformat(last_order.replace('Z', '+00:00'))
                    days_ago = (now - last_order_date).days
                    if 120 <= days_ago <= 365:
                        sweet_spot_count += 1
                    print_info(f"  {lead.get('name', 'Unknown')[:30]:30s} | Score: {lead.get('warmScore'):3d} | {days_ago:4d} days ago")
            
            if sweet_spot_count > 0:
                print_success(f"✅ {sweet_spot_count}/{min(5, len(rows))} high-score leads in sweet spot (120-365 days)")
        else:
            print_warning("No leads with score >= 80 found. This might be OK depending on data.")
        
        return True
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        return False

def test_leads_add_note():
    """Test 4: POST /api/leads/:id/note"""
    print_test_header("4. POST /api/leads/:id/note")
    
    # First get a lead to add note to
    try:
        get_url = f"{BASE_URL}/leads?limit=1"
        response = requests.get(get_url, timeout=30)
        
        if response.status_code != 200:
            print_error("Failed to get leads for note test")
            return False
        
        data = response.json()
        rows = data.get('rows', [])
        
        if len(rows) == 0:
            print_warning("No leads available to test note functionality")
            return True
        
        lead = rows[0]
        lead_id = lead.get('id')
        lead_name = lead.get('name', 'Unknown')
        
        print_info(f"Testing with lead: {lead_name} (ID: {lead_id})")
        
        # Add a note
        note_url = f"{BASE_URL}/leads/{lead_id}/note"
        note_text = f"Test note added at {datetime.now().isoformat()}"
        note_payload = {"text": note_text, "by": "test_agent"}
        
        print_info(f"Adding note: {note_text}")
        
        response = requests.post(note_url, json=note_payload, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        print_success(f"Note added successfully (modified: {data.get('modified', 0)})")
        
        # Verify note was saved by fetching the lead again
        verify_url = f"{BASE_URL}/leads?limit=50"
        response = requests.get(verify_url, timeout=30)
        data = response.json()
        
        updated_lead = None
        for l in data.get('rows', []):
            if l.get('id') == lead_id:
                updated_lead = l
                break
        
        if updated_lead:
            notes = updated_lead.get('notes', [])
            if len(notes) > 0 and any(note_text in str(n) for n in notes):
                print_success(f"✅ Note verified in database (total notes: {len(notes)})")
                return True
            else:
                print_error(f"Note not found in database. Notes: {notes}")
                return False
        else:
            print_error("Could not find lead after adding note")
            return False
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_leads_change_status():
    """Test 5: POST /api/leads/:id/status"""
    print_test_header("5. POST /api/leads/:id/status")
    
    # First get a lead to change status
    try:
        get_url = f"{BASE_URL}/leads?limit=1"
        response = requests.get(get_url, timeout=30)
        
        if response.status_code != 200:
            print_error("Failed to get leads for status test")
            return False
        
        data = response.json()
        rows = data.get('rows', [])
        
        if len(rows) == 0:
            print_warning("No leads available to test status functionality")
            return True
        
        lead = rows[0]
        lead_id = lead.get('id')
        lead_name = lead.get('name', 'Unknown')
        old_status = lead.get('status', 'open')
        
        print_info(f"Testing with lead: {lead_name} (ID: {lead_id})")
        print_info(f"Current status: {old_status}")
        
        # Change status to 'called'
        status_url = f"{BASE_URL}/leads/{lead_id}/status"
        new_status = "called"
        status_payload = {"status": new_status}
        
        print_info(f"Changing status to: {new_status}")
        
        response = requests.post(status_url, json=status_payload, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_error(f"Expected 200, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_error(f"Response ok=false: {data.get('error', 'Unknown error')}")
            return False
        
        print_success(f"Status changed successfully (modified: {data.get('modified', 0)})")
        
        # Verify status was saved
        verify_url = f"{BASE_URL}/leads?limit=50"
        response = requests.get(verify_url, timeout=30)
        data = response.json()
        
        updated_lead = None
        for l in data.get('rows', []):
            if l.get('id') == lead_id:
                updated_lead = l
                break
        
        if updated_lead:
            current_status = updated_lead.get('status')
            if current_status == new_status:
                print_success(f"✅ Status verified in database: {current_status}")
                return True
            else:
                print_error(f"Status mismatch. Expected: {new_status}, Got: {current_status}")
                return False
        else:
            print_error("Could not find lead after changing status")
            return False
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_leads_reimport_preserves_notes():
    """Test 6: Re-import test - verify notes are preserved"""
    print_test_header("6. Re-Import Test (Notes Preservation)")
    
    try:
        # Step 1: Get a lead and add a unique note
        get_url = f"{BASE_URL}/leads?limit=1"
        response = requests.get(get_url, timeout=30)
        
        if response.status_code != 200:
            print_error("Failed to get leads for re-import test")
            return False
        
        data = response.json()
        rows = data.get('rows', [])
        
        if len(rows) == 0:
            print_warning("No leads available to test re-import functionality")
            return True
        
        lead = rows[0]
        lead_id = lead.get('id')
        lead_name = lead.get('name', 'Unknown')
        kKunde = lead.get('kKunde')
        
        print_info(f"Testing with lead: {lead_name} (ID: {lead_id}, kKunde: {kKunde})")
        
        # Add a unique note
        unique_note = f"UNIQUE_TEST_NOTE_{datetime.now().timestamp()}"
        note_url = f"{BASE_URL}/leads/{lead_id}/note"
        note_payload = {"text": unique_note, "by": "reimport_test"}
        
        print_info(f"Adding unique note: {unique_note}")
        
        response = requests.post(note_url, json=note_payload, timeout=30)
        if response.status_code != 200 or not response.json().get('ok'):
            print_error("Failed to add note")
            return False
        
        print_success("Note added successfully")
        
        # Step 2: Run import again
        print_info("\nRunning re-import...")
        import_url = f"{BASE_URL}/leads/import"
        params = {
            "minInactiveMonths": 4,
            "maxInactiveMonths": 24,
            "minOrders": 2,
            "minRevenue": 1000
        }
        
        response = requests.post(import_url, json=params, timeout=60)
        if response.status_code != 200:
            print_error(f"Re-import failed: {response.status_code}")
            return False
        
        data = response.json()
        if not data.get('ok'):
            print_error(f"Re-import failed: {data.get('error')}")
            return False
        
        print_success(f"Re-import completed (imported: {data.get('imported', 0)})")
        
        # Step 3: Verify note still exists
        print_info("\nVerifying note preservation...")
        verify_url = f"{BASE_URL}/leads?limit=100"
        response = requests.get(verify_url, timeout=30)
        data = response.json()
        
        updated_lead = None
        for l in data.get('rows', []):
            if l.get('kKunde') == kKunde:
                updated_lead = l
                break
        
        if not updated_lead:
            print_error(f"Could not find lead with kKunde={kKunde} after re-import")
            return False
        
        notes = updated_lead.get('notes', [])
        note_found = any(unique_note in str(note) for note in notes)
        
        if note_found:
            print_success(f"✅ CRITICAL CHECK PASSED: Note preserved after re-import!")
            print_info(f"   Lead now has {len(notes)} note(s)")
            return True
        else:
            print_error(f"❌ CRITICAL CHECK FAILED: Note NOT preserved after re-import")
            print_error(f"   Expected to find: {unique_note}")
            print_error(f"   Found notes: {notes}")
            return False
        
    except Exception as e:
        print_error(f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}WARMAKQUISE (WARM LEADS) - COMPREHENSIVE TESTING{RESET}")
    print(f"{BLUE}Testing new Score System with critical checks{RESET}")
    print(f"{BLUE}Base URL: {BASE_URL}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    tests = [
        ("POST /api/leads/import", test_leads_import),
        ("GET /api/leads (sorted by warmScore)", test_leads_get_sorted),
        ("GET /api/leads?minScore=80", test_leads_filter_high_score),
        ("POST /api/leads/:id/note", test_leads_add_note),
        ("POST /api/leads/:id/status", test_leads_change_status),
        ("Re-Import Test (Notes Preservation)", test_leads_reimport_preserves_notes),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_error(f"Test {test_name} crashed: {str(e)}")
            import traceback
            traceback.print_exc()
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
    
    # Critical checks summary
    print(f"\n{BLUE}CRITICAL CHECKS:{RESET}")
    print_info("1. No leads with lastOrder < 120 days (< 4 months)")
    print_info("2. Top score < 100 (expected max ~90)")
    print_info("3. Notes preserved after re-import")
    
    if passed == total:
        print_success(f"\n🎉 ALL TESTS PASSED! Warmakquise scoring system working correctly!")
        return 0
    else:
        print_error(f"\n❌ {total - passed} test(s) failed. Warmakquise needs attention!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
