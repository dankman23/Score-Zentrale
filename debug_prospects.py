#!/usr/bin/env python3
"""
Debug prospects endpoint response
"""

import requests
import json
import os

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://bullet-gen.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def debug_prospects():
    print("=== Debugging Prospects Endpoint ===")
    
    # Test POST
    prospect_data = {
        "name": "Debug Test GmbH",
        "website": "https://debug.example",
        "region": "Bayern", 
        "industry": "Holz",
        "size": "51-100"
    }
    
    print("POST Request:")
    response = requests.post(f"{API_BASE}/prospects", json=prospect_data)
    print(f"Status: {response.status_code}")
    print("Response JSON:")
    post_result = response.json()
    print(json.dumps(post_result, indent=2, default=str))
    
    print("\n" + "="*50)
    
    # Test GET
    print("GET Request:")
    response = requests.get(f"{API_BASE}/prospects")
    print(f"Status: {response.status_code}")
    get_result = response.json()
    print(f"Number of prospects: {len(get_result)}")
    
    if len(get_result) > 0:
        print("First prospect structure:")
        print(json.dumps(get_result[0], indent=2, default=str))

if __name__ == "__main__":
    debug_prospects()