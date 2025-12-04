#!/usr/bin/env python3
"""
Klingspor Price Configurator Backend Testing
Comprehensive test suite for POST /api/pricing/konfigurator
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Backend URL from environment
BASE_URL = "https://buchhaltung-amazon.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api/pricing/konfigurator"

def test_api_call(payload: Dict[str, Any], test_name: str) -> Dict[str, Any]:
    """Make API call and return response"""
    print(f"\n🧪 {test_name}")
    print(f"📤 Request: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        print(f"📊 Status: {response.status_code}")
        
        if response.headers.get('content-type', '').startswith('application/json'):
            result = response.json()
            print(f"📥 Response: {json.dumps(result, indent=2)}")
            return {
                'status_code': response.status_code,
                'data': result,
                'success': response.status_code == 200 and result.get('ok') == True
            }
        else:
            print(f"❌ Non-JSON response: {response.text[:500]}")
            return {
                'status_code': response.status_code,
                'data': {'error': 'Non-JSON response'},
                'success': False
            }
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {str(e)}")
        return {
            'status_code': 0,
            'data': {'error': str(e)},
            'success': False
        }

def validate_response_structure(data: Dict[str, Any], test_name: str) -> bool:
    """Validate response structure"""
    print(f"\n🔍 Validating response structure for {test_name}")
    
    if not data.get('ok'):
        print(f"❌ Response not ok: {data}")
        return False
    
    result = data.get('result')
    if not result:
        print(f"❌ No result field in response")
        return False
    
    # Required fields
    required_fields = [
        'manufacturer', 'type', 'grit', 'widthMm', 'lengthMm',
        'backingType', 'listPrice', 'stueckEk', 'minOrderQty', 'ekGesamtMbm',
        'vkStueckNetto', 'vkStueckBrutto', 'vkMbmNetto', 'vkMbmBrutto',
        'staffelPreise', 'debug'
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in result:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ Missing required fields: {missing_fields}")
        return False
    
    # Validate staffelPreise array
    staffel = result.get('staffelPreise', [])
    if not isinstance(staffel, list) or len(staffel) != 8:
        print(f"❌ staffelPreise should be array with 8 entries, got {len(staffel) if isinstance(staffel, list) else 'not array'}")
        return False
    
    expected_ve = [1, 3, 5, 10, 25, 50, 100, 300]
    actual_ve = [item.get('ve') for item in staffel]
    if actual_ve != expected_ve:
        print(f"❌ staffelPreise VE values incorrect. Expected: {expected_ve}, Got: {actual_ve}")
        return False
    
    # Validate debug structure
    debug = result.get('debug', {})
    if not debug.get('klingsporCalculation') or not debug.get('scoreEkSelection'):
        print(f"❌ Debug structure incomplete")
        return False
    
    print(f"✅ Response structure valid")
    return True

def validate_cs310x_calculation(result: Dict[str, Any]) -> bool:
    """Validate CS 310 X specific calculations"""
    print(f"\n🔍 Validating CS 310 X calculations")
    
    # Expected values for CS 310 X, Körnung 80, 100x1000mm
    expected_stueck_ek = 84.40  # Gewebe-Typ
    expected_mbm = 15  # für 100mm Breite
    expected_ek_gesamt_mbm = expected_stueck_ek * expected_mbm  # ~1266 EUR
    
    stueck_ek = result.get('stueckEk', 0)
    mbm = result.get('minOrderQty', 0)
    ek_gesamt_mbm = result.get('ekGesamtMbm', 0)
    vk_stueck_netto = result.get('vkStueckNetto', 0)
    vk_stueck_brutto = result.get('vkStueckBrutto', 0)
    
    # Tolerance for floating point comparisons
    tolerance = 0.5
    
    # Check stueckEk
    if abs(stueck_ek - expected_stueck_ek) > tolerance:
        print(f"❌ stueckEk incorrect. Expected: ~{expected_stueck_ek}, Got: {stueck_ek}")
        return False
    
    # Check MBM
    if mbm != expected_mbm:
        print(f"❌ minOrderQty incorrect. Expected: {expected_mbm}, Got: {mbm}")
        return False
    
    # Check ekGesamtMbm
    if abs(ek_gesamt_mbm - expected_ek_gesamt_mbm) > tolerance * expected_mbm:
        print(f"❌ ekGesamtMbm incorrect. Expected: ~{expected_ek_gesamt_mbm}, Got: {ek_gesamt_mbm}")
        return False
    
    # Check VK > EK
    if vk_stueck_netto <= stueck_ek:
        print(f"❌ vkStueckNetto should be > stueckEk. VK: {vk_stueck_netto}, EK: {stueck_ek}")
        return False
    
    # Check Brutto = Netto * 1.19
    expected_brutto = vk_stueck_netto * 1.19
    if abs(vk_stueck_brutto - expected_brutto) > 0.01:
        print(f"❌ vkStueckBrutto incorrect. Expected: {expected_brutto:.2f}, Got: {vk_stueck_brutto}")
        return False
    
    # Check debug.scoreEkSelection.selected = stueckEk
    debug = result.get('debug', {})
    score_ek_selection = debug.get('scoreEkSelection', {})
    selected_ek = score_ek_selection.get('selected', 0)
    if abs(selected_ek - stueck_ek) > 0.01:
        print(f"❌ debug.scoreEkSelection.selected should equal stueckEk. Expected: {stueck_ek}, Got: {selected_ek}")
        return False
    
    print(f"✅ CS 310 X calculations valid")
    print(f"   stueckEk: {stueck_ek} EUR (Gewebe-Typ)")
    print(f"   minOrderQty: {mbm}")
    print(f"   ekGesamtMbm: {ek_gesamt_mbm} EUR")
    print(f"   vkStueckNetto: {vk_stueck_netto} EUR")
    print(f"   vkStueckBrutto: {vk_stueck_brutto} EUR")
    return True

def validate_mbm_calculation(width_mm: int, expected_mbm: int, result: Dict[str, Any]) -> bool:
    """Validate MBM calculation for different widths"""
    actual_mbm = result.get('minOrderQty', 0)
    if actual_mbm != expected_mbm:
        print(f"❌ MBM for {width_mm}mm incorrect. Expected: {expected_mbm}, Got: {actual_mbm}")
        return False
    print(f"✅ MBM for {width_mm}mm correct: {actual_mbm}")
    return True

def run_tests():
    """Run all test scenarios"""
    print("🚀 Starting Klingspor Price Configurator Backend Tests")
    print(f"🌐 API URL: {API_URL}")
    
    test_results = []
    
    # Test 1: Basis-Test (CS 310 X, Körnung 80)
    print("\n" + "="*60)
    print("TEST 1: Basis-Test (CS 310 X, Körnung 80)")
    print("="*60)
    
    payload1 = {
        "manufacturer": "Klingspor",
        "type": "CS 310 X",
        "grit": 80,
        "widthMm": 100,
        "lengthMm": 1000
    }
    
    response1 = test_api_call(payload1, "CS 310 X Basis-Test")
    success1 = response1['success']
    
    if success1:
        success1 = validate_response_structure(response1['data'], "CS 310 X")
        if success1:
            success1 = validate_cs310x_calculation(response1['data']['result'])
    
    test_results.append(("CS 310 X Basis-Test", success1))
    
    # Test 2: Test mit verschiedenen Breiten (MBM-Berechnung)
    print("\n" + "="*60)
    print("TEST 2: MBM-Berechnung für verschiedene Breiten")
    print("="*60)
    
    width_tests = [
        (50, 25),   # 50mm → MBM = 25
        (100, 15),  # 100mm → MBM = 15
        (200, 10)   # 200mm → MBM = 10
    ]
    
    mbm_success = True
    for width, expected_mbm in width_tests:
        payload = {
            "manufacturer": "Klingspor",
            "type": "CS 310 X",
            "grit": 80,
            "widthMm": width,
            "lengthMm": 1000
        }
        
        response = test_api_call(payload, f"MBM Test {width}mm")
        if response['success']:
            if not validate_mbm_calculation(width, expected_mbm, response['data']['result']):
                mbm_success = False
        else:
            mbm_success = False
    
    test_results.append(("MBM-Berechnung", mbm_success))
    
    # Test 3: Test mit verschiedenen Typen
    print("\n" + "="*60)
    print("TEST 3: Verschiedene Typen (CS 310 X vs PS 21 F)")
    print("="*60)
    
    # CS 310 X (Gewebe)
    payload_gewebe = {
        "manufacturer": "Klingspor",
        "type": "CS 310 X",
        "grit": 80,
        "widthMm": 100,
        "lengthMm": 1000
    }
    
    response_gewebe = test_api_call(payload_gewebe, "CS 310 X (Gewebe)")
    gewebe_success = response_gewebe['success']
    
    # PS 21 F (Papier/Vlies)
    payload_papier = {
        "manufacturer": "Klingspor",
        "type": "PS 21 F",
        "grit": 80,
        "widthMm": 100,
        "lengthMm": 1000
    }
    
    response_papier = test_api_call(payload_papier, "PS 21 F (Papier/Vlies)")
    papier_success = response_papier['success']
    
    # Compare backing types
    if gewebe_success and papier_success:
        gewebe_backing = response_gewebe['data']['result'].get('backingType', '')
        papier_backing = response_papier['data']['result'].get('backingType', '')
        
        print(f"🔍 CS 310 X backing: {gewebe_backing}")
        print(f"🔍 PS 21 F backing: {papier_backing}")
        
        # Different backing types should result in different EK values
        gewebe_ek = response_gewebe['data']['result'].get('stueckEk', 0)
        papier_ek = response_papier['data']['result'].get('stueckEk', 0)
        
        if gewebe_ek != papier_ek:
            print(f"✅ Different EK for different backing types: Gewebe={gewebe_ek}, Papier={papier_ek}")
        else:
            print(f"⚠️ Same EK for different backing types - might be expected")
    
    type_success = gewebe_success and papier_success
    test_results.append(("Verschiedene Typen", type_success))
    
    # Test 4: Fehlerbehandlung
    print("\n" + "="*60)
    print("TEST 4: Fehlerbehandlung")
    print("="*60)
    
    error_tests = [
        # Ungültiger Typ
        {
            "payload": {
                "manufacturer": "Klingspor",
                "type": "INVALID_TYPE",
                "grit": 80,
                "widthMm": 100,
                "lengthMm": 1000
            },
            "name": "Ungültiger Typ",
            "expected_status": 500
        },
        # Ungültige Körnung
        {
            "payload": {
                "manufacturer": "Klingspor",
                "type": "CS 310 X",
                "grit": 999,
                "widthMm": 100,
                "lengthMm": 1000
            },
            "name": "Ungültige Körnung",
            "expected_status": 500
        },
        # Fehlende Parameter
        {
            "payload": {
                "manufacturer": "Klingspor",
                "type": "CS 310 X"
                # grit, widthMm, lengthMm fehlen
            },
            "name": "Fehlende Parameter",
            "expected_status": 400
        }
    ]
    
    error_success = True
    for test in error_tests:
        response = test_api_call(test["payload"], test["name"])
        expected_status = test["expected_status"]
        
        if response['status_code'] == expected_status:
            print(f"✅ {test['name']}: Korrekte Fehlerbehandlung (Status {expected_status})")
        else:
            print(f"❌ {test['name']}: Falsche Fehlerbehandlung. Expected: {expected_status}, Got: {response['status_code']}")
            error_success = False
    
    test_results.append(("Fehlerbehandlung", error_success))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for _, success in test_results if success)
    
    for test_name, success in test_results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} {test_name}")
    
    print(f"\n📊 Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! Klingspor Price Configurator is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)