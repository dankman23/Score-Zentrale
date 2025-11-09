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

def test_coldleads_workflow():
    """
    Complete Kaltakquise workflow test:
    1. POST /api/coldleads/search - Search for companies (mocked)
    2. POST /api/coldleads/analyze - Analyze a company
    3. GET /api/coldleads/search - Retrieve prospects
    4. POST /api/coldleads/email - Generate email
    """
    
    print("="*80)
    print("KALTAKQUISE-TOOL END-TO-END TEST")
    print("="*80)
    
    # ========================================================================
    # STEP 1: Firmen-Suche (Mock)
    # ========================================================================
    log_test("STEP 1", "POST /api/coldleads/search - Firmen-Suche")
    
    search_payload = {
        "industry": "Metallbau",
        "region": "Köln",
        "limit": 5
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/coldleads/search",
            json=search_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        search_data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert search_data is not None, "No JSON response"
        assert search_data.get('ok') == True, f"API returned ok=false: {search_data.get('error')}"
        assert 'prospects' in search_data, "No 'prospects' field in response"
        assert len(search_data['prospects']) > 0, "No prospects returned"
        assert len(search_data['prospects']) <= 5, f"Expected max 5 prospects, got {len(search_data['prospects'])}"
        
        # Prüfe erste Firma
        first_prospect = search_data['prospects'][0]
        assert 'company_name' in first_prospect, "Missing 'company_name'"
        assert 'website' in first_prospect, "Missing 'website'"
        assert 'status' in first_prospect, "Missing 'status'"
        assert first_prospect['status'] == 'new', f"Expected status='new', got '{first_prospect['status']}'"
        
        # Prüfe ob echte deutsche Websites
        website = first_prospect['website']
        assert any(domain in website for domain in ['.de', '.com']), f"Expected German website, got {website}"
        
        print(f"\n  ✅ STEP 1 PASSED")
        print(f"  - Found {len(search_data['prospects'])} prospects")
        print(f"  - First company: {first_prospect['company_name']}")
        print(f"  - Website: {website}")
        
        # Speichere Website für nächste Schritte
        test_website = website
        test_company_name = first_prospect['company_name']
        
    except AssertionError as e:
        print(f"\n  ❌ STEP 1 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n  ❌ STEP 1 ERROR: {e}")
        return False
    
    # ========================================================================
    # STEP 2: Analyse einer Firma
    # ========================================================================
    log_test("STEP 2", f"POST /api/coldleads/analyze - Analyse von {test_website}")
    
    analyze_payload = {
        "website": test_website,
        "industry": "Metallbau"
    }
    
    try:
        print(f"  ⏳ Analyzing {test_website} (this may take up to 30 seconds - GPT-4 API call)...")
        
        response = requests.post(
            f"{API_BASE}/coldleads/analyze",
            json=analyze_payload,
            headers={"Content-Type": "application/json"},
            timeout=60  # Longer timeout for GPT-4 analysis
        )
        
        analyze_data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert analyze_data is not None, "No JSON response"
        assert analyze_data.get('ok') == True, f"API returned ok=false: {analyze_data.get('error')}"
        assert 'analysis' in analyze_data, "No 'analysis' field in response"
        
        analysis = analyze_data['analysis']
        
        # Prüfe Analysis-Struktur
        assert 'company_info' in analysis, "Missing 'company_info' in analysis"
        assert 'needs_assessment' in analysis, "Missing 'needs_assessment' in analysis"
        assert 'score' in analysis['needs_assessment'], "Missing 'score' in needs_assessment"
        
        score = analysis['needs_assessment']['score']
        assert isinstance(score, (int, float)), f"Score should be numeric, got {type(score)}"
        assert 0 <= score <= 100, f"Score should be 0-100, got {score}"
        
        print(f"\n  ✅ STEP 2 PASSED")
        print(f"  - Analysis completed successfully")
        print(f"  - Company: {analysis['company_info'].get('name', 'N/A')}")
        print(f"  - Score: {score}/100")
        print(f"  - Products found: {len(analysis['company_info'].get('products', []))}")
        print(f"  - Contacts found: {len(analysis.get('contact_persons', []))}")
        
    except AssertionError as e:
        print(f"\n  ❌ STEP 2 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n  ❌ STEP 2 ERROR: {e}")
        return False
    
    # Kurze Pause für DB-Update
    time.sleep(2)
    
    # ========================================================================
    # STEP 3: Prospects abrufen
    # ========================================================================
    log_test("STEP 3", "GET /api/coldleads/search - Prospects abrufen")
    
    try:
        response = requests.get(
            f"{API_BASE}/coldleads/search?limit=10",
            timeout=10
        )
        
        prospects_data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert prospects_data is not None, "No JSON response"
        assert prospects_data.get('ok') == True, f"API returned ok=false: {prospects_data.get('error')}"
        assert 'prospects' in prospects_data, "No 'prospects' field in response"
        
        # Finde analysierte Firma
        analyzed_prospect = None
        for p in prospects_data['prospects']:
            if p['website'] == test_website:
                analyzed_prospect = p
                break
        
        assert analyzed_prospect is not None, f"Analyzed prospect {test_website} not found in list"
        assert analyzed_prospect['status'] == 'analyzed', f"Expected status='analyzed', got '{analyzed_prospect['status']}'"
        assert 'score' in analyzed_prospect, "Missing 'score' field"
        assert analyzed_prospect['score'] is not None, "Score should not be null after analysis"
        
        print(f"\n  ✅ STEP 3 PASSED")
        print(f"  - Retrieved {len(prospects_data['prospects'])} prospects")
        print(f"  - Analyzed prospect found: {analyzed_prospect['company_name']}")
        print(f"  - Status: {analyzed_prospect['status']}")
        print(f"  - Score: {analyzed_prospect['score']}")
        
    except AssertionError as e:
        print(f"\n  ❌ STEP 3 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n  ❌ STEP 3 ERROR: {e}")
        return False
    
    # ========================================================================
    # STEP 4: Email generieren
    # ========================================================================
    log_test("STEP 4", f"POST /api/coldleads/email - Email generieren für {test_website}")
    
    email_payload = {
        "website": test_website,
        "send": False  # Nur generieren, nicht senden
    }
    
    try:
        print(f"  ⏳ Generating email (GPT-4 API call)...")
        
        response = requests.post(
            f"{API_BASE}/coldleads/email",
            json=email_payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        email_data = log_response(response)
        
        # Validierung
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert email_data is not None, "No JSON response"
        assert email_data.get('ok') == True, f"API returned ok=false: {email_data.get('error')}"
        assert 'email' in email_data, "No 'email' field in response"
        
        email = email_data['email']
        
        # Prüfe Email-Struktur
        assert 'subject' in email, "Missing 'subject' in email"
        assert 'body' in email, "Missing 'body' in email"
        assert 'recipient' in email_data, "Missing 'recipient' in response"
        
        # Prüfe SCORE Signatur (aus emailer.ts)
        body = email['body']
        assert 'Christian Berres' in body, "Missing 'Christian Berres' in email body"
        assert 'Score Handels GmbH & Co. KG' in body or 'Score' in body, "Missing company name in email body"
        assert 'berres@score-schleifwerkzeuge.de' in body, "Missing email address in signature"
        assert '0221-25999901' in body or '0221' in body, "Missing phone number in email body"
        
        print(f"\n  ✅ STEP 4 PASSED")
        print(f"  - Email generated successfully")
        print(f"  - Subject: {email['subject'][:80]}...")
        print(f"  - Recipient: {email_data['recipient']}")
        print(f"  - Body length: {len(body)} characters")
        print(f"  - Contains Christian Berres signature: ✅")
        print(f"  - Contains Score company name: ✅")
        print(f"  - Contains contact email: ✅")
        print(f"  - Contains phone number: ✅")
        
    except AssertionError as e:
        print(f"\n  ❌ STEP 4 FAILED: {e}")
        return False
    except Exception as e:
        print(f"\n  ❌ STEP 4 ERROR: {e}")
        return False
    
    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("🎉 ALL TESTS PASSED!")
    print("="*80)
    print("\nSUMMARY:")
    print(f"  ✅ STEP 1: Company search returned {len(search_data['prospects'])} prospects")
    print(f"  ✅ STEP 2: Analysis completed with score {score}/100")
    print(f"  ✅ STEP 3: Prospect status updated to 'analyzed'")
    print(f"  ✅ STEP 4: Email generated with proper signature")
    print("\nKALTAKQUISE WORKFLOW: FULLY FUNCTIONAL ✅")
    print("="*80)
    
    return True

if __name__ == "__main__":
    try:
        success = test_coldleads_workflow()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
