#!/usr/bin/env python3
"""
FINALER ROBUSTNESS-TEST: Kaltakquise End-to-End
Tests the complete cold lead workflow with robust fallback system
"""

import requests
import json
import sys

BASE_URL = "http://localhost:3000/api"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_step_1_company_search():
    """
    STEP 1: Firmen-Suche
    POST /api/coldleads/search
    Erwarte: 3 Firmen mit echten deutschen Websites
    """
    print_section("STEP 1: Firmen-Suche (Company Search)")
    
    url = f"{BASE_URL}/coldleads/search"
    payload = {
        "industry": "Metallbau",
        "region": "Köln",
        "limit": 3
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Validierung
        if not data.get('ok'):
            print(f"❌ FAILED: ok field is not true")
            return None
        
        prospects = data.get('prospects', [])
        if not isinstance(prospects, list):
            print(f"❌ FAILED: Expected prospects array, got {type(prospects)}")
            return None
        
        if len(prospects) != 3:
            print(f"❌ FAILED: Expected 3 companies, got {len(prospects)}")
            return None
        
        # Prüfe erste Firma
        first_company = prospects[0]
        required_fields = ['company_name', 'website', 'status']
        
        for field in required_fields:
            if field not in first_company:
                print(f"❌ FAILED: Missing field '{field}' in company")
                return None
        
        # Prüfe dass Website eine echte deutsche Website ist
        website = first_company['website']
        if not website.startswith('http'):
            print(f"❌ FAILED: Website does not start with http: {website}")
            return None
        
        print(f"\n✅ STEP 1 PASSED")
        print(f"   - Found {len(prospects)} companies")
        print(f"   - Company 1: {first_company['company_name']}")
        print(f"   - Website: {first_company['website']}")
        print(f"   - Status: {first_company['status']}")
        
        return first_company['website']
        
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        return None

def test_step_2_analyze_company(website):
    """
    STEP 2: Analyse Firma 1
    POST /api/coldleads/analyze
    Erwarte: 200 OK, analysis.score existiert (40-100), company_info, needs_assessment
    """
    print_section("STEP 2: Analyse Firma 1 (Company Analysis)")
    
    url = f"{BASE_URL}/coldleads/analyze"
    payload = {
        "website": website,
        "industry": "Metallbau"
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Validierung
        if not data.get('ok'):
            print(f"❌ FAILED: ok field is not true")
            return False
        
        analysis = data.get('analysis')
        if not analysis:
            print(f"❌ FAILED: Missing 'analysis' field")
            return False
        
        # Prüfe analysis.score
        if 'score' not in analysis:
            print(f"❌ FAILED: Missing 'score' in analysis")
            return False
        
        score = analysis['score']
        if not isinstance(score, (int, float)) or score < 40 or score > 100:
            print(f"❌ FAILED: Score {score} not in range 40-100")
            return False
        
        # Prüfe company_info
        if 'company_info' not in analysis:
            print(f"❌ FAILED: Missing 'company_info' in analysis")
            return False
        
        # Prüfe needs_assessment
        if 'needs_assessment' not in analysis:
            print(f"❌ FAILED: Missing 'needs_assessment' in analysis")
            return False
        
        print(f"\n✅ STEP 2 PASSED")
        print(f"   - Analysis Score: {score}")
        print(f"   - Company Info: {list(analysis['company_info'].keys())}")
        print(f"   - Needs Assessment: {list(analysis['needs_assessment'].keys())}")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_step_3_data_persistence(website):
    """
    STEP 3: Daten-Persistenz prüfen
    GET /api/coldleads/search?limit=10
    Erwarte: Analysierte Firma hat analysis Feld, needs_assessment.score ist Zahl, contact_persons ist Array
    """
    print_section("STEP 3: Daten-Persistenz prüfen (Data Persistence)")
    
    url = f"{BASE_URL}/coldleads/search?limit=10"
    
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response: Found {len(data)} prospects")
        
        # Finde analysierte Firma
        analyzed_prospect = None
        for prospect in data:
            if prospect.get('website') == website:
                analyzed_prospect = prospect
                break
        
        if not analyzed_prospect:
            print(f"❌ FAILED: Could not find analyzed prospect with website {website}")
            return False
        
        print(f"\nFound analyzed prospect: {analyzed_prospect.get('company_name')}")
        
        # Prüfe analysis Feld
        if 'analysis' not in analyzed_prospect:
            print(f"❌ FAILED: Missing 'analysis' field in prospect")
            return False
        
        analysis = analyzed_prospect['analysis']
        
        # Prüfe needs_assessment.score
        if 'needs_assessment' not in analysis:
            print(f"❌ FAILED: Missing 'needs_assessment' in analysis")
            return False
        
        needs_assessment = analysis['needs_assessment']
        if 'score' not in needs_assessment:
            print(f"❌ FAILED: Missing 'score' in needs_assessment")
            return False
        
        score = needs_assessment['score']
        if not isinstance(score, (int, float)):
            print(f"❌ FAILED: Score is not a number: {type(score)}")
            return False
        
        # Prüfe contact_persons
        if 'contact_persons' not in analysis:
            print(f"❌ FAILED: Missing 'contact_persons' in analysis")
            return False
        
        contact_persons = analysis['contact_persons']
        if not isinstance(contact_persons, list):
            print(f"❌ FAILED: contact_persons is not an array: {type(contact_persons)}")
            return False
        
        print(f"\n✅ STEP 3 PASSED")
        print(f"   - Analysis field exists: ✓")
        print(f"   - Needs Assessment Score: {score} (type: {type(score).__name__})")
        print(f"   - Contact Persons: {len(contact_persons)} found (type: array)")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_step_4_email_generation(website):
    """
    STEP 4: Email-Generierung
    POST /api/coldleads/email
    Erwarte: 200 OK, subject nicht leer, body enthält "SCORE" oder "Schleifwerkzeuge", body enthält "0221-25999901"
    """
    print_section("STEP 4: Email-Generierung (Email Generation)")
    
    url = f"{BASE_URL}/coldleads/email"
    payload = {
        "website": website,
        "send": False
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"\nStatus: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Validierung
        if not data.get('ok'):
            print(f"❌ FAILED: ok field is not true")
            return False
        
        email = data.get('email')
        if not email:
            print(f"❌ FAILED: Missing 'email' field")
            return False
        
        # Prüfe subject
        subject = email.get('subject', '')
        if not subject or len(subject) == 0:
            print(f"❌ FAILED: Subject is empty")
            return False
        
        # Prüfe body
        body = email.get('body', '')
        if not body or len(body) == 0:
            print(f"❌ FAILED: Body is empty")
            return False
        
        # Prüfe body enthält "SCORE" oder "Schleifwerkzeuge"
        body_lower = body.lower()
        if 'score' not in body_lower and 'schleifwerkzeuge' not in body_lower:
            print(f"❌ FAILED: Body does not contain 'SCORE' or 'Schleifwerkzeuge'")
            return False
        
        # Prüfe body enthält Telefonnummer
        if '0221-25999901' not in body:
            print(f"❌ FAILED: Body does not contain phone number '0221-25999901'")
            return False
        
        print(f"\n✅ STEP 4 PASSED")
        print(f"   - Subject: {subject}")
        print(f"   - Body length: {len(body)} characters")
        print(f"   - Contains 'Score/Schleifwerkzeuge': ✓")
        print(f"   - Contains phone '0221-25999901': ✓")
        print(f"\n--- EMAIL PREVIEW ---")
        print(f"Subject: {subject}")
        print(f"\n{body[:500]}...")
        print(f"--- END PREVIEW ---")
        
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Exception - {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*80)
    print("  FINALER ROBUSTNESS-TEST: Kaltakquise End-to-End")
    print("  ZIEL: Vollständiger Test mit ROBUSTEM Fallback-System")
    print("="*80)
    
    results = {
        'step_1': False,
        'step_2': False,
        'step_3': False,
        'step_4': False
    }
    
    # STEP 1: Firmen-Suche
    website = test_step_1_company_search()
    if website:
        results['step_1'] = True
    else:
        print("\n❌ STEP 1 FAILED - Aborting remaining tests")
        print_final_summary(results)
        sys.exit(1)
    
    # STEP 2: Analyse
    if test_step_2_analyze_company(website):
        results['step_2'] = True
    else:
        print("\n❌ STEP 2 FAILED - Aborting remaining tests")
        print_final_summary(results)
        sys.exit(1)
    
    # STEP 3: Daten-Persistenz
    if test_step_3_data_persistence(website):
        results['step_3'] = True
    else:
        print("\n❌ STEP 3 FAILED - Continuing to STEP 4")
    
    # STEP 4: Email-Generierung
    if test_step_4_email_generation(website):
        results['step_4'] = True
    else:
        print("\n❌ STEP 4 FAILED")
    
    print_final_summary(results)
    
    # Exit code
    if all(results.values()):
        sys.exit(0)
    else:
        sys.exit(1)

def print_final_summary(results):
    print_section("FINAL SUMMARY")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print(f"Results: {passed}/{total} steps passed\n")
    
    for step, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {step.upper()}: {status}")
    
    print("\n" + "="*80)
    
    if all(results.values()):
        print("🎉 ALL TESTS PASSED - Kaltakquise workflow is ROBUST!")
        print("   - Firmen-Suche working")
        print("   - Analyse working")
        print("   - Daten-Persistenz working")
        print("   - Email-Generierung working (Template-based)")
    else:
        print("⚠️  SOME TESTS FAILED - See details above")
    
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
