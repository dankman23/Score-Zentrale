#!/usr/bin/env python3
"""
Kaltakquise Extended Features Backend Test
Tests new cold leads features: stats, inbox, replied filter
"""

import requests
import json
import time
import os
from datetime import datetime

# Get base URL - use internal localhost since we're inside the container
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

def log_test(step, message):
    """Log test step with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"\n[{timestamp}] {step}: {message}")

def log_response(response):
    """Log response details"""
    print(f"  Status: {response.status_code}")
    try:
        data = response.json()
        print(f"  Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data
    except:
        print(f"  Response (text): {response.text[:500]}")
        return None

def test_coldleads_stats():
    """
    Test GET /api/coldleads/stats
    Expected: 200 OK with unreadReplies, recentReplies, awaitingFollowup, byStatus, total
    """
    print("="*80)
    print("TEST 1: GET /api/coldleads/stats")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/coldleads/stats",
            timeout=10
        )
        
        data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert data is not None, "No JSON response"
        assert data.get('ok') == True, f"API returned ok=false: {data.get('error')}"
        
        # Prüfe Pflichtfelder
        assert 'unreadReplies' in data, "Missing 'unreadReplies' field"
        assert 'recentReplies' in data, "Missing 'recentReplies' field"
        assert 'awaitingFollowup' in data, "Missing 'awaitingFollowup' field"
        assert 'byStatus' in data, "Missing 'byStatus' field"
        assert 'total' in data, "Missing 'total' field"
        
        # Prüfe Datentypen
        assert isinstance(data['unreadReplies'], int), f"unreadReplies should be int, got {type(data['unreadReplies'])}"
        assert isinstance(data['recentReplies'], int), f"recentReplies should be int, got {type(data['recentReplies'])}"
        assert isinstance(data['awaitingFollowup'], int), f"awaitingFollowup should be int, got {type(data['awaitingFollowup'])}"
        assert isinstance(data['byStatus'], dict), f"byStatus should be dict, got {type(data['byStatus'])}"
        assert isinstance(data['total'], int), f"total should be int, got {type(data['total'])}"
        
        print(f"\n  ✅ TEST 1 PASSED")
        print(f"  - unreadReplies: {data['unreadReplies']}")
        print(f"  - recentReplies: {data['recentReplies']}")
        print(f"  - awaitingFollowup: {data['awaitingFollowup']}")
        print(f"  - byStatus: {data['byStatus']}")
        print(f"  - total: {data['total']}")
        
        return True, data
        
    except AssertionError as e:
        print(f"\n  ❌ TEST 1 FAILED: {e}")
        return False, None
    except Exception as e:
        print(f"\n  ❌ TEST 1 ERROR: {e}")
        return False, None

def test_coldleads_search_all():
    """
    Test GET /api/coldleads/search?status=all
    Expected: 200 OK with ok, count, prospects array (with history, hasReply, lastReplyAt)
    """
    print("\n" + "="*80)
    print("TEST 2: GET /api/coldleads/search?status=all")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/coldleads/search?status=all",
            timeout=10
        )
        
        data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert data is not None, "No JSON response"
        assert data.get('ok') == True, f"API returned ok=false: {data.get('error')}"
        
        # Prüfe Pflichtfelder
        assert 'count' in data, "Missing 'count' field"
        assert 'prospects' in data, "Missing 'prospects' field"
        assert isinstance(data['prospects'], list), f"prospects should be list, got {type(data['prospects'])}"
        
        # Wenn Prospects vorhanden, prüfe Struktur
        if len(data['prospects']) > 0:
            first = data['prospects'][0]
            assert 'id' in first, "Missing 'id' in prospect"
            assert 'company_name' in first, "Missing 'company_name' in prospect"
            assert 'website' in first, "Missing 'website' in prospect"
            assert 'industry' in first, "Missing 'industry' in prospect"
            assert 'region' in first, "Missing 'region' in prospect"
            assert 'status' in first, "Missing 'status' in prospect"
            assert 'score' in first, "Missing 'score' in prospect"
            
            # NEU: Prüfe neue Felder
            assert 'history' in first, "Missing 'history' field (NEW)"
            assert 'hasReply' in first, "Missing 'hasReply' field (NEW)"
            assert 'lastReplyAt' in first, "Missing 'lastReplyAt' field (NEW)"
            
            assert isinstance(first['history'], list), f"history should be list, got {type(first['history'])}"
            assert isinstance(first['hasReply'], bool), f"hasReply should be bool, got {type(first['hasReply'])}"
            
            print(f"\n  ✅ TEST 2 PASSED")
            print(f"  - count: {data['count']}")
            print(f"  - prospects: {len(data['prospects'])} items")
            print(f"  - First prospect: {first['company_name']}")
            print(f"  - Has history field: ✅")
            print(f"  - Has hasReply field: ✅")
            print(f"  - Has lastReplyAt field: ✅")
        else:
            print(f"\n  ✅ TEST 2 PASSED (No prospects in DB yet)")
            print(f"  - count: 0")
            print(f"  - prospects: []")
        
        return True, data
        
    except AssertionError as e:
        print(f"\n  ❌ TEST 2 FAILED: {e}")
        return False, None
    except Exception as e:
        print(f"\n  ❌ TEST 2 ERROR: {e}")
        return False, None

def test_coldleads_search_replied():
    """
    Test GET /api/coldleads/search?status=replied
    Expected: 200 OK with only prospects where hasReply=true
    """
    print("\n" + "="*80)
    print("TEST 3: GET /api/coldleads/search?status=replied")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/coldleads/search?status=replied",
            timeout=10
        )
        
        data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert data is not None, "No JSON response"
        assert data.get('ok') == True, f"API returned ok=false: {data.get('error')}"
        
        # Prüfe Pflichtfelder
        assert 'count' in data, "Missing 'count' field"
        assert 'prospects' in data, "Missing 'prospects' field"
        assert isinstance(data['prospects'], list), f"prospects should be list, got {type(data['prospects'])}"
        
        # Wenn Prospects vorhanden, prüfe dass alle hasReply=true haben
        if len(data['prospects']) > 0:
            for p in data['prospects']:
                assert 'hasReply' in p, f"Missing 'hasReply' in prospect {p.get('id')}"
                assert p['hasReply'] == True, f"Expected hasReply=true for replied filter, got {p['hasReply']} for {p.get('company_name')}"
            
            print(f"\n  ✅ TEST 3 PASSED")
            print(f"  - count: {data['count']}")
            print(f"  - All prospects have hasReply=true: ✅")
            print(f"  - Sample: {data['prospects'][0]['company_name']}")
        else:
            print(f"\n  ✅ TEST 3 PASSED (No replied prospects yet)")
            print(f"  - count: 0")
            print(f"  - prospects: []")
            print(f"  - This is expected if no replies have been received")
        
        return True, data
        
    except AssertionError as e:
        print(f"\n  ❌ TEST 3 FAILED: {e}")
        return False, None
    except Exception as e:
        print(f"\n  ❌ TEST 3 ERROR: {e}")
        return False, None

def test_coldleads_inbox():
    """
    Test GET /api/coldleads/inbox
    Expected: 200 OK OR 500 with clear error (IMAP may not be configured)
    """
    print("\n" + "="*80)
    print("TEST 4: GET /api/coldleads/inbox")
    print("="*80)
    
    try:
        print("  ⏳ Fetching inbox (IMAP connection - may take a few seconds)...")
        
        response = requests.get(
            f"{API_BASE}/coldleads/inbox",
            timeout=30  # Longer timeout for IMAP
        )
        
        data = log_response(response)
        
        # Validierung - 200 oder 500 sind beide OK
        assert response.status_code in [200, 500], f"Expected 200 or 500, got {response.status_code}"
        assert data is not None, "No JSON response"
        
        if response.status_code == 200:
            # Erfolgreiche IMAP-Verbindung
            assert data.get('ok') == True, f"API returned ok=false: {data.get('error')}"
            
            # Prüfe Pflichtfelder
            assert 'total' in data, "Missing 'total' field"
            assert 'matched' in data, "Missing 'matched' field"
            assert 'unmatched' in data, "Missing 'unmatched' field"
            assert 'replies' in data, "Missing 'replies' field"
            
            assert isinstance(data['total'], int), f"total should be int, got {type(data['total'])}"
            assert isinstance(data['matched'], int), f"matched should be int, got {type(data['matched'])}"
            assert isinstance(data['unmatched'], int), f"unmatched should be int, got {type(data['unmatched'])}"
            assert isinstance(data['replies'], list), f"replies should be list, got {type(data['replies'])}"
            
            print(f"\n  ✅ TEST 4 PASSED (IMAP working)")
            print(f"  - total emails: {data['total']}")
            print(f"  - matched: {data['matched']}")
            print(f"  - unmatched: {data['unmatched']}")
            print(f"  - replies: {len(data['replies'])} items")
            
        else:  # 500
            # IMAP-Fehler ist akzeptabel
            assert data.get('ok') == False, "Expected ok=false for 500 error"
            assert 'error' in data, "Missing 'error' field in 500 response"
            
            error_msg = data['error']
            print(f"\n  ✅ TEST 4 PASSED (IMAP not configured - expected)")
            print(f"  - Status: 500 (acceptable)")
            print(f"  - Error message: {error_msg}")
            print(f"  - This is OK if IMAP credentials are not configured")
        
        return True, data
        
    except AssertionError as e:
        print(f"\n  ❌ TEST 4 FAILED: {e}")
        return False, None
    except Exception as e:
        print(f"\n  ❌ TEST 4 ERROR: {e}")
        return False, None

def run_all_tests():
    """
    Run all Kaltakquise extended features tests
    """
    print("\n" + "="*80)
    print("KALTAKQUISE ERWEITERTE FEATURES - BACKEND TESTING")
    print("="*80)
    print("\nTesting 4 new endpoints:")
    print("  1. GET /api/coldleads/stats")
    print("  2. GET /api/coldleads/search?status=all")
    print("  3. GET /api/coldleads/search?status=replied")
    print("  4. GET /api/coldleads/inbox")
    print("="*80)
    
    results = []
    
    # Test 1: Stats
    success, data = test_coldleads_stats()
    results.append(("GET /api/coldleads/stats", success))
    
    # Test 2: Search all
    success, data = test_coldleads_search_all()
    results.append(("GET /api/coldleads/search?status=all", success))
    
    # Test 3: Search replied
    success, data = test_coldleads_search_replied()
    results.append(("GET /api/coldleads/search?status=replied", success))
    
    # Test 4: Inbox
    success, data = test_coldleads_inbox()
    results.append(("GET /api/coldleads/inbox", success))
    
    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("FINAL TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for endpoint, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"  {status}: {endpoint}")
    
    print("\n" + "="*80)
    if passed == total:
        print(f"🎉 ALL {total}/{total} TESTS PASSED!")
        print("="*80)
        return True
    else:
        print(f"⚠️  {passed}/{total} TESTS PASSED, {total-passed} FAILED")
        print("="*80)
        return False

if __name__ == "__main__":
    try:
        success = run_all_tests()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
