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

def validate_list_response(data: Dict[str, Any], expected_max_articles: int = None) -> bool:
    """Validate list API response structure"""
    print("\n🔍 Validating list response structure...")
    
    # Check required fields
    required_fields = ["ok", "articles", "pagination", "filters"]
    for field in required_fields:
        if field not in data:
            print(f"❌ Missing required field: {field}")
            return False
    
    # Check ok field
    if data["ok"] != True:
        print(f"❌ ok field is not true: {data['ok']}")
        return False
    
    # Check articles array
    if not isinstance(data["articles"], list):
        print(f"❌ articles is not an array")
        return False
    
    # Check max articles limit
    if expected_max_articles and len(data["articles"]) > expected_max_articles:
        print(f"❌ Too many articles returned: {len(data['articles'])} > {expected_max_articles}")
        return False
    
    # Check pagination structure
    pagination = data["pagination"]
    required_pagination_fields = ["page", "limit", "total", "totalPages", "hasNext", "hasPrev"]
    for field in required_pagination_fields:
        if field not in pagination:
            print(f"❌ Missing pagination field: {field}")
            return False
    
    # Check filters structure
    filters = data["filters"]
    if not isinstance(filters, dict):
        print(f"❌ filters is not an object")
        return False
    
    # Check article structure if articles exist
    if len(data["articles"]) > 0:
        first_article = data["articles"][0]
        required_article_fields = ["kArtikel", "cArtNr", "cName", "cHerstellerName", "cWarengruppenName", "fVKNetto", "fEKNetto", "margin_percent"]
        for field in required_article_fields:
            if field not in first_article:
                print(f"❌ Missing article field: {field}")
                return False
    
    print(f"✅ List response structure valid")
    print(f"📊 Articles count: {len(data['articles'])}")
    print(f"📊 Total articles: {pagination['total']}")
    print(f"📊 Page: {pagination['page']}, Limit: {pagination['limit']}")
    
    return True

def test_search_functionality(data: Dict[str, Any], search_term: str) -> bool:
    """Test if search results contain the search term"""
    print(f"\n🔍 Validating search results for term: '{search_term}'")
    
    if len(data["articles"]) == 0:
        print(f"⚠️ No articles found for search term '{search_term}'")
        return True  # Empty results are acceptable
    
    # Check if articles contain search term
    search_term_lower = search_term.lower()
    valid_articles = 0
    
    for article in data["articles"]:
        article_matches = False
        
        # Check cArtNr
        if "cArtNr" in article and article["cArtNr"] and search_term_lower in str(article["cArtNr"]).lower():
            article_matches = True
        
        # Check cName
        if "cName" in article and article["cName"] and search_term_lower in str(article["cName"]).lower():
            article_matches = True
        
        # Check cBarcode
        if "cBarcode" in article and article["cBarcode"] and search_term_lower in str(article["cBarcode"]).lower():
            article_matches = True
        
        if article_matches:
            valid_articles += 1
        else:
            print(f"❌ Article does not contain search term: {article.get('cArtNr', 'N/A')} - {article.get('cName', 'N/A')}")
    
    if valid_articles == len(data["articles"]):
        print(f"✅ All {valid_articles} articles contain search term '{search_term}'")
        return True
    else:
        print(f"❌ Only {valid_articles}/{len(data['articles'])} articles contain search term")
        return False

def test_manufacturer_filter(data: Dict[str, Any], manufacturer: str) -> bool:
    """Test if all articles are from the specified manufacturer"""
    print(f"\n🔍 Validating manufacturer filter for: '{manufacturer}'")
    
    if len(data["articles"]) == 0:
        print(f"⚠️ No articles found for manufacturer '{manufacturer}'")
        return True  # Empty results are acceptable
    
    valid_articles = 0
    
    for article in data["articles"]:
        if article.get("cHerstellerName") == manufacturer:
            valid_articles += 1
        else:
            print(f"❌ Article from wrong manufacturer: {article.get('cHerstellerName', 'N/A')} (expected: {manufacturer})")
    
    if valid_articles == len(data["articles"]):
        print(f"✅ All {valid_articles} articles are from manufacturer '{manufacturer}'")
        return True
    else:
        print(f"❌ Only {valid_articles}/{len(data['articles'])} articles are from correct manufacturer")
        return False

def test_pagination_differences(page1_data: Dict[str, Any], page2_data: Dict[str, Any]) -> bool:
    """Test if page 1 and page 2 have different articles"""
    print(f"\n🔍 Validating pagination differences between page 1 and page 2")
    
    page1_ids = set()
    page2_ids = set()
    
    # Collect kArtikel IDs from page 1
    for article in page1_data["articles"]:
        if "kArtikel" in article:
            page1_ids.add(article["kArtikel"])
    
    # Collect kArtikel IDs from page 2
    for article in page2_data["articles"]:
        if "kArtikel" in article:
            page2_ids.add(article["kArtikel"])
    
    # Check for overlaps
    overlap = page1_ids.intersection(page2_ids)
    
    if len(overlap) == 0:
        print(f"✅ No overlapping articles between pages (Page 1: {len(page1_ids)} IDs, Page 2: {len(page2_ids)} IDs)")
        return True
    else:
        print(f"❌ Found {len(overlap)} overlapping articles between pages")
        print(f"Overlapping IDs: {list(overlap)[:5]}...")  # Show first 5
        return False

def main():
    """Main test function"""
    print("🚀 Starting JTL Articles Browser APIs Testing")
    print("=" * 60)
    
    test_results = []
    
    # Test 1: GET /api/jtl/articles/filters
    print("\n" + "=" * 60)
    print("TEST 1: GET /api/jtl/articles/filters")
    print("=" * 60)
    
    filters_url = f"{BASE_URL}/api/jtl/articles/filters"
    filters_result = test_api_endpoint(filters_url, 200, "Filter-Optionen für Artikel-Browser")
    
    if filters_result["success"]:
        if validate_filters_response(filters_result["data"]):
            test_results.append(("✅ Test 1: Filters API", True))
        else:
            test_results.append(("❌ Test 1: Filters API - Invalid structure", False))
    else:
        test_results.append(("❌ Test 1: Filters API - Request failed", False))
    
    # Get first manufacturer for later tests
    first_manufacturer = None
    if filters_result["success"] and len(filters_result["data"].get("hersteller", [])) > 0:
        first_manufacturer = filters_result["data"]["hersteller"][0]["name"]
        print(f"📝 First manufacturer for testing: {first_manufacturer}")
    
    # Test 2: GET /api/jtl/articles/list (Default ohne Filter)
    print("\n" + "=" * 60)
    print("TEST 2: GET /api/jtl/articles/list (Default ohne Filter)")
    print("=" * 60)
    
    list_default_url = f"{BASE_URL}/api/jtl/articles/list?page=1&limit=10"
    list_default_result = test_api_endpoint(list_default_url, 200, "Artikel-Liste Standard (page=1, limit=10)")
    
    if list_default_result["success"]:
        if validate_list_response(list_default_result["data"], expected_max_articles=10):
            test_results.append(("✅ Test 2: List API Default", True))
        else:
            test_results.append(("❌ Test 2: List API Default - Invalid structure", False))
    else:
        test_results.append(("❌ Test 2: List API Default - Request failed", False))
    
    # Test 3: GET /api/jtl/articles/list (Mit Text-Suche)
    print("\n" + "=" * 60)
    print("TEST 3: GET /api/jtl/articles/list (Mit Text-Suche)")
    print("=" * 60)
    
    search_url = f"{BASE_URL}/api/jtl/articles/list?search=schleif&page=1&limit=5"
    search_result = test_api_endpoint(search_url, 200, "Artikel-Liste mit Text-Suche 'schleif'")
    
    if search_result["success"]:
        structure_valid = validate_list_response(search_result["data"], expected_max_articles=5)
        search_valid = test_search_functionality(search_result["data"], "schleif")
        
        if structure_valid and search_valid:
            test_results.append(("✅ Test 3: List API Text Search", True))
        else:
            test_results.append(("❌ Test 3: List API Text Search - Validation failed", False))
    else:
        test_results.append(("❌ Test 3: List API Text Search - Request failed", False))
    
    # Test 4: GET /api/jtl/articles/list (Mit Hersteller-Filter)
    print("\n" + "=" * 60)
    print("TEST 4: GET /api/jtl/articles/list (Mit Hersteller-Filter)")
    print("=" * 60)
    
    if first_manufacturer:
        manufacturer_url = f"{BASE_URL}/api/jtl/articles/list?hersteller={first_manufacturer}&limit=5"
        manufacturer_result = test_api_endpoint(manufacturer_url, 200, f"Artikel-Liste mit Hersteller-Filter '{first_manufacturer}'")
        
        if manufacturer_result["success"]:
            structure_valid = validate_list_response(manufacturer_result["data"], expected_max_articles=5)
            manufacturer_valid = test_manufacturer_filter(manufacturer_result["data"], first_manufacturer)
            
            if structure_valid and manufacturer_valid:
                test_results.append(("✅ Test 4: List API Manufacturer Filter", True))
            else:
                test_results.append(("❌ Test 4: List API Manufacturer Filter - Validation failed", False))
        else:
            test_results.append(("❌ Test 4: List API Manufacturer Filter - Request failed", False))
    else:
        print("⚠️ Skipping manufacturer filter test - no manufacturers available")
        test_results.append(("⚠️ Test 4: List API Manufacturer Filter - Skipped (no manufacturers)", True))
    
    # Test 5: GET /api/jtl/articles/list (Pagination Test)
    print("\n" + "=" * 60)
    print("TEST 5: GET /api/jtl/articles/list (Pagination Test)")
    print("=" * 60)
    
    # Page 1
    page1_url = f"{BASE_URL}/api/jtl/articles/list?page=1&limit=25"
    page1_result = test_api_endpoint(page1_url, 200, "Artikel-Liste Page 1 (limit=25)")
    
    # Page 2
    page2_url = f"{BASE_URL}/api/jtl/articles/list?page=2&limit=25"
    page2_result = test_api_endpoint(page2_url, 200, "Artikel-Liste Page 2 (limit=25)")
    
    pagination_success = True
    
    if page1_result["success"] and page2_result["success"]:
        # Validate structures
        page1_structure = validate_list_response(page1_result["data"], expected_max_articles=25)
        page2_structure = validate_list_response(page2_result["data"], expected_max_articles=25)
        
        if page1_structure and page2_structure:
            # Check pagination flags
            page1_data = page1_result["data"]
            page2_data = page2_result["data"]
            
            # Page 1 should have hasNext=true (if there are enough articles)
            if page1_data["pagination"]["hasNext"]:
                print("✅ Page 1 has hasNext=true")
            else:
                print("⚠️ Page 1 has hasNext=false (may be acceptable if few articles)")
            
            # Page 2 should have hasPrev=true
            if page2_data["pagination"]["hasPrev"]:
                print("✅ Page 2 has hasPrev=true")
            else:
                print("❌ Page 2 has hasPrev=false")
                pagination_success = False
            
            # Check for different articles
            if test_pagination_differences(page1_data, page2_data):
                print("✅ Pages contain different articles")
            else:
                print("❌ Pages contain overlapping articles")
                pagination_success = False
            
            if pagination_success:
                test_results.append(("✅ Test 5: List API Pagination", True))
            else:
                test_results.append(("❌ Test 5: List API Pagination - Validation failed", False))
        else:
            test_results.append(("❌ Test 5: List API Pagination - Invalid structure", False))
    else:
        test_results.append(("❌ Test 5: List API Pagination - Request failed", False))
    
    # Final Results Summary
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, success in test_results:
        print(test_name)
        if success:
            passed_tests += 1
    
    print(f"\n📈 OVERALL RESULT: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! JTL Articles Browser APIs are working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Please check the detailed results above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)