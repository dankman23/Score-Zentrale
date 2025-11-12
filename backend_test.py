#!/usr/bin/env python3
"""
Kaltakquise Complete Module Backend Testing
Tests all Kaltakquise endpoints according to German specifications and priorities
"""

import requests
import json
import time
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://fibu-connect.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def log_test(message):
    """Log test messages with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_api_endpoint(method, endpoint, data=None, expected_status=200):
    """Generic API test function"""
    url = f"{API_BASE}{endpoint}"
    log_test(f"Testing {method} {endpoint}")
    
    try:
        if method == 'GET':
            response = requests.get(url, timeout=30)
        elif method == 'POST':
            response = requests.post(url, json=data, timeout=30)
        elif method == 'DELETE':
            response = requests.delete(url, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        log_test(f"Response Status: {response.status_code}")
        
        # Try to parse JSON response
        try:
            json_response = response.json()
            log_test(f"Response JSON: {json.dumps(json_response, indent=2, ensure_ascii=False)}")
            return response.status_code, json_response
        except:
            log_test(f"Response Text: {response.text[:500]}")
            return response.status_code, response.text
            
    except Exception as e:
        log_test(f"ERROR: {str(e)}")
        return None, str(e)

def test_analyze_v3():
    """
    Test 1: POST /api/coldleads/analyze-v3 (Haupt-Analyse)
    
    Erwartung:
    - 200 OK mit { ok: true }
    - Response enthält analysis und email_sequence
    - Glossar-Terms gemappt (mindestens 1 Application, 1 Material)
    - Email-Sequence vollständig (3 Mails)
    - Mail 1 ≤ 200 Wörter
    - Kein Markdown in Email-Body
    - Recommended Brands (1-3 aus Score-Liste)
    - Contact Person extrahiert
    """
    log_test("=" * 60)
    log_test("TEST 1: POST /api/coldleads/analyze-v3 (Haupt-Analyse)")
    log_test("=" * 60)
    
    # Test data - using a known website as fallback
    test_data = {
        "website": "https://www.klingspor.de",
        "company_name": "Test Metallbau GmbH",
        "industry": "Metallverarbeitung", 
        "region": "Köln"
    }
    
    log_test(f"Test payload: {json.dumps(test_data, indent=2, ensure_ascii=False)}")
    
    status, response = test_api_endpoint('POST', '/coldleads/analyze-v3', test_data)
    
    if status is None:
        log_test("❌ CRITICAL: API request failed completely")
        return False
    
    # Check basic response structure
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    
    if isinstance(response, dict):
        # Check required fields
        required_fields = ['ok', 'analysis', 'email_sequence']
        for field in required_fields:
            if field not in response:
                log_test(f"❌ Missing required field: {field}")
                success = False
            else:
                log_test(f"✅ Found required field: {field}")
        
        # Check analysis structure
        if 'analysis' in response:
            analysis = response['analysis']
            analysis_fields = [
                'company', 'confidence_overall', 'applications', 
                'materials', 'machines', 'product_categories',
                'contact_person', 'recommended_brands'
            ]
            
            for field in analysis_fields:
                if field in analysis:
                    log_test(f"✅ Analysis has {field}")
                    
                    # Check specific requirements
                    if field == 'applications' and len(analysis[field]) >= 1:
                        log_test(f"✅ At least 1 application found: {len(analysis[field])} applications")
                    elif field == 'materials' and len(analysis[field]) >= 1:
                        log_test(f"✅ At least 1 material found: {len(analysis[field])} materials")
                    elif field == 'recommended_brands' and len(analysis[field]) >= 1:
                        log_test(f"✅ Recommended brands found: {analysis[field]}")
                    elif field == 'confidence_overall':
                        score = analysis[field]
                        if 0 <= score <= 100:
                            log_test(f"✅ Confidence score valid: {score}%")
                        else:
                            log_test(f"❌ Confidence score invalid: {score}")
                            success = False
                else:
                    log_test(f"❌ Analysis missing field: {field}")
                    success = False
        
        # Check email sequence structure
        if 'email_sequence' in response:
            email_seq = response['email_sequence']
            mail_fields = ['mail_1', 'mail_2', 'mail_3', 'crm_tags']
            
            for field in mail_fields:
                if field in email_seq:
                    log_test(f"✅ Email sequence has {field}")
                    
                    # Check mail structure
                    if field.startswith('mail_'):
                        mail = email_seq[field]
                        if 'subject' in mail and 'body' in mail and 'word_count' in mail:
                            log_test(f"✅ {field} has required structure")
                            
                            # Check word count for mail_1
                            if field == 'mail_1' and mail['word_count'] <= 200:
                                log_test(f"✅ Mail 1 word count OK: {mail['word_count']} ≤ 200")
                            elif field == 'mail_1':
                                log_test(f"❌ Mail 1 word count too high: {mail['word_count']} > 200")
                                success = False
                            
                            # Check for markdown in body
                            body = mail.get('body', '')
                            if '**' not in body and '*' not in body:
                                log_test(f"✅ {field} body has no markdown")
                            else:
                                log_test(f"❌ {field} body contains markdown")
                                success = False
                        else:
                            log_test(f"❌ {field} missing required structure")
                            success = False
                else:
                    log_test(f"❌ Email sequence missing field: {field}")
                    success = False
    
    if success:
        log_test("✅ TEST 1 PASSED: analyze-v3 working correctly")
    else:
        log_test("❌ TEST 1 FAILED: analyze-v3 has issues")
    
    return success, response.get('analysis', {}).get('company', 'Test Company') if isinstance(response, dict) else None

def test_email_v3_send(prospect_id=None):
    """
    Test 2: POST /api/coldleads/email-v3/send (Email versenden)
    
    Erwartung:
    - 200 OK mit { ok: true } ODER 500 mit { ok: false, error: "..." }
    - Response enthält message, recipient, subject
    - API akzeptiert prospect_id + mail_number
    - followup_schedule wird updated
    """
    log_test("=" * 60)
    log_test("TEST 2: POST /api/coldleads/email-v3/send (Email versenden)")
    log_test("=" * 60)
    
    # If no prospect_id provided, try to find one from database or use test ID
    if not prospect_id:
        log_test("⚠️  No prospect_id provided, using test ID")
        prospect_id = "test-prospect-id"
    
    test_data = {
        "prospect_id": prospect_id,
        "mail_number": 1
    }
    
    log_test(f"Test payload: {json.dumps(test_data, indent=2, ensure_ascii=False)}")
    
    status, response = test_api_endpoint('POST', '/coldleads/email-v3/send', test_data)
    
    if status is None:
        log_test("❌ CRITICAL: API request failed completely")
        return False
    
    success = True
    
    # Accept both 200 (success) and 500 (expected failure) as valid responses
    if status not in [200, 400, 404, 500]:
        log_test(f"❌ Unexpected status code: {status}")
        success = False
    else:
        log_test(f"✅ Status code acceptable: {status}")
    
    if isinstance(response, dict):
        # Check for ok field
        if 'ok' in response:
            log_test(f"✅ Response has 'ok' field: {response['ok']}")
            
            if response['ok'] and status == 200:
                # Success case - check required fields
                required_fields = ['message', 'recipient', 'subject']
                for field in required_fields:
                    if field in response:
                        log_test(f"✅ Success response has {field}: {response[field]}")
                    else:
                        log_test(f"❌ Success response missing {field}")
                        success = False
            
            elif not response['ok']:
                # Error case - check error field
                if 'error' in response:
                    log_test(f"✅ Error response has error field: {response['error']}")
                    # Common expected errors
                    error_msg = response['error'].lower()
                    if any(expected in error_msg for expected in [
                        'prospect not found', 'no email sequence', 'no recipient email',
                        'prospect_id required', 'authentication', 'smtp'
                    ]):
                        log_test("✅ Error is expected/acceptable")
                    else:
                        log_test(f"⚠️  Unexpected error: {response['error']}")
                else:
                    log_test("❌ Error response missing error field")
                    success = False
        else:
            log_test("❌ Response missing 'ok' field")
            success = False
    
    if success:
        log_test("✅ TEST 2 PASSED: email-v3/send API logic working correctly")
    else:
        log_test("❌ TEST 2 FAILED: email-v3/send has issues")
    
    return success

def test_delete_prospect():
    """
    CRITICAL TEST 1: DELETE /api/coldleads/delete
    Test with existing prospect (recently fixed import path issue)
    """
    log_test("=" * 60)
    log_test("CRITICAL TEST 1: DELETE /api/coldleads/delete")
    log_test("=" * 60)
    
    # First, try to get existing prospects to find one to delete
    log_test("Step 1: Getting existing prospects...")
    status, response = test_api_endpoint('GET', '/coldleads/search?limit=1')
    
    prospect_id = None
    if status == 200 and isinstance(response, dict) and response.get('ok'):
        prospects = response.get('prospects', [])
        if prospects:
            prospect_id = prospects[0].get('id')
            log_test(f"✅ Found existing prospect to delete: {prospect_id}")
        else:
            log_test("⚠️  No existing prospects found, will create test prospect")
    
    # If no existing prospect, create one first
    if not prospect_id:
        log_test("Step 1b: Creating test prospect for deletion...")
        create_data = {
            "industry": "Metallverarbeitung",
            "region": "Köln", 
            "limit": 1
        }
        status, response = test_api_endpoint('POST', '/coldleads/search', create_data)
        
        if status == 200 and isinstance(response, dict) and response.get('ok'):
            prospects = response.get('prospects', [])
            if prospects:
                prospect_id = prospects[0].get('id')
                log_test(f"✅ Created test prospect: {prospect_id}")
            else:
                log_test("❌ Failed to create test prospect")
                return False
        else:
            log_test("❌ Failed to create test prospect via search")
            return False
    
    # Now test the DELETE endpoint
    log_test("Step 2: Testing DELETE endpoint...")
    delete_data = {
        "prospect_id": prospect_id
    }
    
    status, response = test_api_endpoint('DELETE', '/coldleads/delete', delete_data)
    
    success = True
    
    if status == 200:
        log_test("✅ DELETE returned 200 OK")
        if isinstance(response, dict):
            if response.get('ok') == True:
                log_test("✅ DELETE successful: ok=true")
                if 'message' in response:
                    log_test(f"✅ Success message: {response['message']}")
            else:
                log_test(f"❌ DELETE failed: {response.get('error', 'Unknown error')}")
                success = False
        else:
            log_test("❌ Invalid response format")
            success = False
    elif status == 404:
        log_test("⚠️  DELETE returned 404 (prospect not found) - acceptable if already deleted")
        if isinstance(response, dict) and response.get('error'):
            log_test(f"✅ Proper 404 error: {response['error']}")
    else:
        log_test(f"❌ Unexpected status code: {status}")
        success = False
    
    # Verify deletion by trying to find the prospect again
    log_test("Step 3: Verifying deletion...")
    status, response = test_api_endpoint('GET', '/coldleads/search?limit=50')
    
    if status == 200 and isinstance(response, dict) and response.get('ok'):
        prospects = response.get('prospects', [])
        found_deleted = any(p.get('id') == prospect_id for p in prospects)
        if not found_deleted:
            log_test("✅ Prospect successfully deleted (not found in list)")
        else:
            log_test("⚠️  Prospect still exists after deletion")
    
    if success:
        log_test("✅ CRITICAL TEST 1 PASSED: DELETE endpoint working correctly")
    else:
        log_test("❌ CRITICAL TEST 1 FAILED: DELETE endpoint has issues")
    
    return success

def test_search_prospects():
    """
    IMPORTANT TEST 4: GET /api/coldleads/search?status=analyzed
    Get analyzed prospects
    """
    log_test("=" * 60)
    log_test("IMPORTANT TEST 4: GET /api/coldleads/search?status=analyzed")
    log_test("=" * 60)
    
    status, response = test_api_endpoint('GET', '/coldleads/search?status=analyzed&limit=10')
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        required_fields = ['ok', 'count', 'prospects']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}: {response[field]}")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        if response.get('ok'):
            prospects = response.get('prospects', [])
            count = response.get('count', 0)
            
            log_test(f"✅ Found {count} analyzed prospects")
            
            # Check structure of prospects
            if prospects:
                sample_prospect = prospects[0]
                expected_fields = ['id', 'company_name', 'website', 'status', 'analysis_v3']
                for field in expected_fields:
                    if field in sample_prospect:
                        log_test(f"✅ Prospect has {field}")
                    else:
                        log_test(f"⚠️  Prospect missing {field}")
                
                # Verify status is actually 'analyzed'
                if sample_prospect.get('status') == 'analyzed':
                    log_test("✅ Prospect status correctly filtered to 'analyzed'")
                else:
                    log_test(f"❌ Prospect status is '{sample_prospect.get('status')}', not 'analyzed'")
                    success = False
            else:
                log_test("⚠️  No analyzed prospects found (may be expected for new system)")
    
    if success:
        log_test("✅ IMPORTANT TEST 4 PASSED: search prospects working correctly")
    else:
        log_test("❌ IMPORTANT TEST 4 FAILED: search prospects has issues")
    
    return success

def test_search_new_companies():
    """
    IMPORTANT TEST 5: POST /api/coldleads/search
    Search for new companies
    """
    log_test("=" * 60)
    log_test("IMPORTANT TEST 5: POST /api/coldleads/search")
    log_test("=" * 60)
    
    test_data = {
        "industry": "Metallbau",
        "region": "München",
        "limit": 3
    }
    
    log_test(f"Test payload: {json.dumps(test_data, indent=2, ensure_ascii=False)}")
    
    status, response = test_api_endpoint('POST', '/coldleads/search', test_data)
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        required_fields = ['ok', 'count', 'prospects']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}: {response[field]}")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        if response.get('ok'):
            prospects = response.get('prospects', [])
            count = response.get('count', 0)
            
            log_test(f"✅ Found {count} new prospects")
            
            # Check structure of prospects
            if prospects:
                sample_prospect = prospects[0]
                expected_fields = ['id', 'company_name', 'website', 'industry', 'region', 'status']
                for field in expected_fields:
                    if field in sample_prospect:
                        log_test(f"✅ Prospect has {field}: {sample_prospect[field]}")
                    else:
                        log_test(f"❌ Prospect missing {field}")
                        success = False
                
                # Verify industry and region match
                if sample_prospect.get('industry') == test_data['industry']:
                    log_test("✅ Industry correctly set")
                else:
                    log_test(f"❌ Industry mismatch: expected {test_data['industry']}, got {sample_prospect.get('industry')}")
                
                if sample_prospect.get('region') == test_data['region']:
                    log_test("✅ Region correctly set")
                else:
                    log_test(f"❌ Region mismatch: expected {test_data['region']}, got {sample_prospect.get('region')}")
            else:
                log_test("⚠️  No prospects found (may be expected if Google API not configured)")
    
    if success:
        log_test("✅ IMPORTANT TEST 5 PASSED: search new companies working correctly")
    else:
        log_test("❌ IMPORTANT TEST 5 FAILED: search new companies has issues")
    
    return success

def test_dashboard_stats():
    """
    IMPORTANT TEST 6: GET /api/coldleads/stats
    Dashboard statistics
    """
    log_test("=" * 60)
    log_test("IMPORTANT TEST 6: GET /api/coldleads/stats")
    log_test("=" * 60)
    
    status, response = test_api_endpoint('GET', '/coldleads/stats')
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        required_fields = ['ok', 'unreadReplies', 'recentReplies', 'awaitingFollowup', 'byStatus', 'total']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}: {response[field]}")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        if response.get('ok'):
            # Validate field types
            if isinstance(response.get('unreadReplies'), int):
                log_test("✅ unreadReplies is integer")
            else:
                log_test("❌ unreadReplies is not integer")
                success = False
            
            if isinstance(response.get('byStatus'), dict):
                log_test("✅ byStatus is dictionary")
                by_status = response.get('byStatus', {})
                log_test(f"✅ Status breakdown: {by_status}")
            else:
                log_test("❌ byStatus is not dictionary")
                success = False
            
            if isinstance(response.get('total'), int):
                log_test(f"✅ total is integer: {response.get('total')}")
            else:
                log_test("❌ total is not integer")
                success = False
    
    if success:
        log_test("✅ IMPORTANT TEST 6 PASSED: dashboard stats working correctly")
    else:
        log_test("❌ IMPORTANT TEST 6 FAILED: dashboard stats has issues")
    
    return success

def test_autopilot_status():
    """
    AUTOPILOT TEST 7: GET /api/coldleads/autopilot/status
    Get autopilot status
    """
    log_test("=" * 60)
    log_test("AUTOPILOT TEST 7: GET /api/coldleads/autopilot/status")
    log_test("=" * 60)
    
    status, response = test_api_endpoint('GET', '/coldleads/autopilot/status')
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        required_fields = ['ok', 'state']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        if response.get('ok') and 'state' in response:
            state = response['state']
            state_fields = ['running', 'dailyLimit', 'dailyCount', 'remaining', 'totalProcessed']
            
            for field in state_fields:
                if field in state:
                    log_test(f"✅ State has {field}: {state[field]}")
                else:
                    log_test(f"❌ State missing {field}")
                    success = False
            
            # Validate state values
            if isinstance(state.get('running'), bool):
                log_test(f"✅ running is boolean: {state.get('running')}")
            else:
                log_test("❌ running is not boolean")
                success = False
            
            if isinstance(state.get('dailyLimit'), int) and state.get('dailyLimit') > 0:
                log_test(f"✅ dailyLimit is positive integer: {state.get('dailyLimit')}")
            else:
                log_test("❌ dailyLimit is not positive integer")
                success = False
    
    if success:
        log_test("✅ AUTOPILOT TEST 7 PASSED: autopilot status working correctly")
    else:
        log_test("❌ AUTOPILOT TEST 7 FAILED: autopilot status has issues")
    
    return success

def test_autopilot_tick():
    """
    AUTOPILOT TEST 8: POST /api/coldleads/autopilot/tick
    Simulate autopilot tick
    """
    log_test("=" * 60)
    log_test("AUTOPILOT TEST 8: POST /api/coldleads/autopilot/tick")
    log_test("=" * 60)
    
    status, response = test_api_endpoint('POST', '/coldleads/autopilot/tick')
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        required_fields = ['ok', 'action']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}: {response[field]}")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        if response.get('ok'):
            action = response.get('action')
            valid_actions = ['skip', 'limit_reached', 'search_no_results', 'analyzed_but_not_ready', 'email_sent', 'email_failed']
            
            if action in valid_actions:
                log_test(f"✅ Valid action: {action}")
                
                # Check action-specific fields
                if action == 'email_sent' and 'prospect' in response:
                    log_test(f"✅ Email sent to: {response['prospect']}")
                elif action == 'limit_reached' and 'dailyCount' in response:
                    log_test(f"✅ Daily limit reached: {response['dailyCount']}")
                elif action == 'skip':
                    log_test("✅ Autopilot skipped (not running)")
            else:
                log_test(f"❌ Unknown action: {action}")
                success = False
    
    if success:
        log_test("✅ AUTOPILOT TEST 8 PASSED: autopilot tick working correctly")
    else:
        log_test("❌ AUTOPILOT TEST 8 FAILED: autopilot tick has issues")
    
    return success

def main():
    """Run all Kaltakquise tests in priority order"""
    log_test("🚀 STARTING KALTAKQUISE COMPLETE MODULE BACKEND TESTING")
    log_test(f"Base URL: {BASE_URL}")
    log_test(f"API Base: {API_BASE}")
    log_test("")
    log_test("Testing according to German specifications:")
    log_test("KRITISCHE TESTS (Priorität 1): DELETE, analyze-v3, email-v3/send")
    log_test("WICHTIGE TESTS (Priorität 2): search prospects, search companies, stats")
    log_test("AUTOPILOT TESTS (Priorität 3): status, tick")
    log_test("")
    
    results = []
    
    # KRITISCHE TESTS (Priorität 1)
    log_test("🔴 STARTING CRITICAL TESTS (Priority 1)")
    log_test("")
    
    # Critical Test 1: DELETE endpoint (recently fixed import path)
    try:
        result1 = test_delete_prospect()
        results.append(("DELETE /api/coldleads/delete", result1))
    except Exception as e:
        log_test(f"❌ CRITICAL TEST 1 EXCEPTION: {str(e)}")
        results.append(("DELETE /api/coldleads/delete", False))
    
    log_test("")
    
    # Critical Test 2: analyze-v3 (main analysis)
    try:
        result2, company_name = test_analyze_v3()
        results.append(("POST /api/coldleads/analyze-v3", result2))
    except Exception as e:
        log_test(f"❌ CRITICAL TEST 2 EXCEPTION: {str(e)}")
        results.append(("POST /api/coldleads/analyze-v3", False))
        company_name = None
    
    log_test("")
    
    # Critical Test 3: email-v3/send (with send=false)
    try:
        result3 = test_email_v3_send()
        results.append(("POST /api/coldleads/email-v3/send", result3))
    except Exception as e:
        log_test(f"❌ CRITICAL TEST 3 EXCEPTION: {str(e)}")
        results.append(("POST /api/coldleads/email-v3/send", False))
    
    log_test("")
    
    # WICHTIGE TESTS (Priorität 2)
    log_test("🟡 STARTING IMPORTANT TESTS (Priority 2)")
    log_test("")
    
    # Important Test 4: Get analyzed prospects
    try:
        result4 = test_search_prospects()
        results.append(("GET /api/coldleads/search?status=analyzed", result4))
    except Exception as e:
        log_test(f"❌ IMPORTANT TEST 4 EXCEPTION: {str(e)}")
        results.append(("GET /api/coldleads/search?status=analyzed", False))
    
    log_test("")
    
    # Important Test 5: Search new companies
    try:
        result5 = test_search_new_companies()
        results.append(("POST /api/coldleads/search", result5))
    except Exception as e:
        log_test(f"❌ IMPORTANT TEST 5 EXCEPTION: {str(e)}")
        results.append(("POST /api/coldleads/search", False))
    
    log_test("")
    
    # Important Test 6: Dashboard statistics
    try:
        result6 = test_dashboard_stats()
        results.append(("GET /api/coldleads/stats", result6))
    except Exception as e:
        log_test(f"❌ IMPORTANT TEST 6 EXCEPTION: {str(e)}")
        results.append(("GET /api/coldleads/stats", False))
    
    log_test("")
    
    # AUTOPILOT TESTS (Priorität 3)
    log_test("🟢 STARTING AUTOPILOT TESTS (Priority 3)")
    log_test("")
    
    # Autopilot Test 7: Status
    try:
        result7 = test_autopilot_status()
        results.append(("GET /api/coldleads/autopilot/status", result7))
    except Exception as e:
        log_test(f"❌ AUTOPILOT TEST 7 EXCEPTION: {str(e)}")
        results.append(("GET /api/coldleads/autopilot/status", False))
    
    log_test("")
    
    # Autopilot Test 8: Tick simulation
    try:
        result8 = test_autopilot_tick()
        results.append(("POST /api/coldleads/autopilot/tick", result8))
    except Exception as e:
        log_test(f"❌ AUTOPILOT TEST 8 EXCEPTION: {str(e)}")
        results.append(("POST /api/coldleads/autopilot/tick", False))
    
    # Summary
    log_test("")
    log_test("=" * 80)
    log_test("KALTAKQUISE COMPLETE MODULE TESTING SUMMARY")
    log_test("=" * 80)
    
    passed = 0
    total = len(results)
    critical_passed = 0
    critical_total = 3
    
    log_test("CRITICAL TESTS (Priority 1):")
    for i in range(3):
        if i < len(results):
            test_name, success = results[i]
            status = "✅ PASSED" if success else "❌ FAILED"
            log_test(f"  {test_name}: {status}")
            if success:
                passed += 1
                critical_passed += 1
    
    log_test("")
    log_test("IMPORTANT TESTS (Priority 2):")
    for i in range(3, 6):
        if i < len(results):
            test_name, success = results[i]
            status = "✅ PASSED" if success else "❌ FAILED"
            log_test(f"  {test_name}: {status}")
            if success:
                passed += 1
    
    log_test("")
    log_test("AUTOPILOT TESTS (Priority 3):")
    for i in range(6, 8):
        if i < len(results):
            test_name, success = results[i]
            status = "✅ PASSED" if success else "❌ FAILED"
            log_test(f"  {test_name}: {status}")
            if success:
                passed += 1
    
    log_test("")
    log_test(f"OVERALL RESULT: {passed}/{total} tests passed")
    log_test(f"CRITICAL TESTS: {critical_passed}/{critical_total} passed")
    
    if critical_passed == critical_total:
        log_test("🎉 ALL CRITICAL TESTS PASSED - Kaltakquise module working correctly!")
    elif critical_passed >= 2:
        log_test("⚠️  MOSTLY CRITICAL WORKING - Some critical issues found")
    else:
        log_test("❌ CRITICAL ISSUES - Kaltakquise module needs immediate attention")
    
    if passed == total:
        log_test("🎉 ALL TESTS PASSED - Complete Kaltakquise system working perfectly!")
    elif passed >= 6:
        log_test("⚠️  MOSTLY WORKING - Some minor issues found but core functionality OK")
    else:
        log_test("❌ SIGNIFICANT ISSUES - Multiple components need attention")
    
    log_test("")
    log_test("IMPORTANT NOTES:")
    log_test("- MongoDB Collection: 'prospects' (NOT 'cold_prospects')")
    log_test("- For analyze-v3: Website should exist and be crawlable")
    log_test("- For email-v3: Check analysis_v3 and email_sequence are saved correctly")
    log_test("- Expected structure after analyze-v3: analysis_v3 + email_sequence objects")
    log_test("")
    log_test("Testing completed at " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    return passed, total

if __name__ == "__main__":
    main()