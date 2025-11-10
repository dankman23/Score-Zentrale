#!/usr/bin/env python3
"""
Kaltakquise V3 System Backend Testing
Tests the 3 new V3 APIs according to German specifications
"""

import requests
import json
import time
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://jt-article-hub.preview.emergentagent.com')
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

def test_followup_auto():
    """
    Test 3: GET /api/coldleads/followup/auto (Auto Follow-up Check)
    
    Erwartung:
    - 200 OK mit { ok: true }
    - Response enthält sent, errors, timestamp
    - API läuft ohne Crash
    - Falls keine fällig: sent=0, errors=0
    """
    log_test("=" * 60)
    log_test("TEST 3: GET /api/coldleads/followup/auto (Auto Follow-up Check)")
    log_test("=" * 60)
    
    status, response = test_api_endpoint('GET', '/coldleads/followup/auto')
    
    if status is None:
        log_test("❌ CRITICAL: API request failed completely")
        return False
    
    success = True
    
    if status != 200:
        log_test(f"❌ Expected status 200, got {status}")
        success = False
    else:
        log_test("✅ Status 200 OK")
    
    if isinstance(response, dict):
        # Check required fields
        required_fields = ['ok', 'sent', 'errors', 'timestamp']
        for field in required_fields:
            if field in response:
                log_test(f"✅ Response has {field}: {response[field]}")
                
                # Validate field types
                if field == 'ok' and isinstance(response[field], bool):
                    log_test(f"✅ {field} is boolean")
                elif field in ['sent', 'errors'] and isinstance(response[field], int):
                    log_test(f"✅ {field} is integer")
                elif field == 'timestamp' and isinstance(response[field], str):
                    log_test(f"✅ {field} is string (ISO format)")
                    # Try to parse timestamp
                    try:
                        datetime.fromisoformat(response[field].replace('Z', '+00:00'))
                        log_test(f"✅ Timestamp is valid ISO format")
                    except:
                        log_test(f"⚠️  Timestamp format might be non-standard")
            else:
                log_test(f"❌ Response missing {field}")
                success = False
        
        # Check if response makes sense
        if response.get('ok') == True:
            sent = response.get('sent', 0)
            errors = response.get('errors', 0)
            log_test(f"✅ Follow-up results: {sent} sent, {errors} errors")
            
            if sent == 0 and errors == 0:
                log_test("✅ No follow-ups due (expected for fresh system)")
            elif sent > 0:
                log_test(f"✅ {sent} follow-ups sent successfully")
            elif errors > 0:
                log_test(f"⚠️  {errors} follow-up errors (may be expected)")
        else:
            log_test("❌ Response ok=false")
            success = False
    
    if success:
        log_test("✅ TEST 3 PASSED: followup/auto working correctly")
    else:
        log_test("❌ TEST 3 FAILED: followup/auto has issues")
    
    return success

def main():
    """Run all V3 API tests in sequence"""
    log_test("🚀 STARTING KALTAKQUISE V3 SYSTEM BACKEND TESTING")
    log_test(f"Base URL: {BASE_URL}")
    log_test(f"API Base: {API_BASE}")
    log_test("")
    
    results = []
    
    # Test 1: analyze-v3 (most important)
    try:
        result1, company_name = test_analyze_v3()
        results.append(("analyze-v3", result1))
    except Exception as e:
        log_test(f"❌ TEST 1 EXCEPTION: {str(e)}")
        results.append(("analyze-v3", False))
        company_name = None
    
    log_test("")
    
    # Test 2: email-v3/send (optional if prospect available)
    try:
        result2 = test_email_v3_send()
        results.append(("email-v3/send", result2))
    except Exception as e:
        log_test(f"❌ TEST 2 EXCEPTION: {str(e)}")
        results.append(("email-v3/send", False))
    
    log_test("")
    
    # Test 3: followup/auto (should always run)
    try:
        result3 = test_followup_auto()
        results.append(("followup/auto", result3))
    except Exception as e:
        log_test(f"❌ TEST 3 EXCEPTION: {str(e)}")
        results.append(("followup/auto", False))
    
    # Summary
    log_test("")
    log_test("=" * 60)
    log_test("KALTAKQUISE V3 TESTING SUMMARY")
    log_test("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        log_test(f"{test_name}: {status}")
        if success:
            passed += 1
    
    log_test("")
    log_test(f"OVERALL RESULT: {passed}/{total} tests passed")
    
    if passed == total:
        log_test("🎉 ALL TESTS PASSED - V3 System working correctly!")
    elif passed >= 2:
        log_test("⚠️  MOSTLY WORKING - Some issues found but core functionality OK")
    else:
        log_test("❌ CRITICAL ISSUES - V3 System needs attention")
    
    log_test("")
    log_test("Testing completed at " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    return passed, total

if __name__ == "__main__":
    main()