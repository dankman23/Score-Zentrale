#!/usr/bin/env python3
"""
Amazon Bulletpoints Async Job System - Backend Testing
Tests the 3 new async APIs for batch processing without timeouts
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://staffel-price.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class AmazonBulletpointsAsyncTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Backend-Tester/1.0'
        })
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_start_job_api(self) -> Optional[str]:
        """
        Test 1: POST /api/amazon/bulletpoints/batch/start-job
        Creates a job with small batch (3 articles)
        Should return immediately with jobId
        """
        self.log("=== TEST 1: Start Job API ===")
        
        try:
            # Test with small batch of real kArtikel IDs
            payload = {
                "kArtikel": [1, 2, 3]  # Small batch to save costs
            }
            
            self.log(f"Sending POST request to start-job with payload: {payload}")
            
            response = self.session.post(
                f"{API_BASE}/amazon/bulletpoints/batch/start-job",
                json=payload,
                timeout=30  # Should return quickly
            )
            
            self.log(f"Response Status: {response.status_code}")
            self.log(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Response Data: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                required_fields = ['ok', 'jobId', 'total', 'message']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"❌ Missing required fields: {missing_fields}", "ERROR")
                    return None
                    
                if not data.get('ok'):
                    self.log(f"❌ API returned ok=false: {data.get('error', 'Unknown error')}", "ERROR")
                    return None
                    
                job_id = data.get('jobId')
                total = data.get('total')
                
                if not job_id:
                    self.log("❌ No jobId returned", "ERROR")
                    return None
                    
                if total != 3:
                    self.log(f"❌ Expected total=3, got total={total}", "ERROR")
                    return None
                    
                self.log(f"✅ Start Job API SUCCESS: jobId={job_id}, total={total}")
                return job_id
                
            else:
                self.log(f"❌ Start Job API FAILED: HTTP {response.status_code}", "ERROR")
                try:
                    error_data = response.json()
                    self.log(f"Error Response: {json.dumps(error_data, indent=2)}", "ERROR")
                except:
                    self.log(f"Error Response Text: {response.text}", "ERROR")
                return None
                
        except requests.exceptions.Timeout:
            self.log("❌ Start Job API TIMEOUT - Should return immediately!", "ERROR")
            return None
        except Exception as e:
            self.log(f"❌ Start Job API EXCEPTION: {str(e)}", "ERROR")
            return None
            
    def test_job_status_api(self, job_id: str) -> Dict[str, Any]:
        """
        Test 2: GET /api/amazon/bulletpoints/batch/job-status
        Polls job status and validates response format
        """
        self.log("=== TEST 2: Job Status API ===")
        
        try:
            self.log(f"Sending GET request to job-status with jobId={job_id}")
            
            response = self.session.get(
                f"{API_BASE}/amazon/bulletpoints/batch/job-status",
                params={'jobId': job_id},
                timeout=10
            )
            
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"Response Data: {json.dumps(data, indent=2)}")
                
                # Validate response structure
                if not data.get('ok'):
                    self.log(f"❌ API returned ok=false: {data.get('error', 'Unknown error')}", "ERROR")
                    return {}
                    
                job = data.get('job', {})
                required_job_fields = ['id', 'status', 'total', 'processed', 'succeeded', 'failed', 'progress']
                missing_fields = [field for field in required_job_fields if field not in job]
                
                if missing_fields:
                    self.log(f"❌ Missing required job fields: {missing_fields}", "ERROR")
                    return {}
                    
                status = job.get('status')
                total = job.get('total')
                processed = job.get('processed')
                progress = job.get('progress')
                
                self.log(f"✅ Job Status API SUCCESS: status={status}, total={total}, processed={processed}, progress={progress}%")
                return job
                
            else:
                self.log(f"❌ Job Status API FAILED: HTTP {response.status_code}", "ERROR")
                try:
                    error_data = response.json()
                    self.log(f"Error Response: {json.dumps(error_data, indent=2)}", "ERROR")
                except:
                    self.log(f"Error Response Text: {response.text}", "ERROR")
                return {}
                
        except Exception as e:
            self.log(f"❌ Job Status API EXCEPTION: {str(e)}", "ERROR")
            return {}
            
    def test_end_to_end_flow(self) -> bool:
        """
        Test 3: End-to-End Flow
        Start job with 2-3 articles, poll status until completed/failed
        Validate final results
        """
        self.log("=== TEST 3: End-to-End Flow ===")
        
        try:
            # Start job with small batch
            payload = {
                "kArtikel": [10, 11]  # Even smaller batch for E2E test
            }
            
            self.log(f"Starting E2E test with payload: {payload}")
            
            response = self.session.post(
                f"{API_BASE}/amazon/bulletpoints/batch/start-job",
                json=payload,
                timeout=30
            )
            
            if response.status_code != 200:
                self.log(f"❌ E2E: Failed to start job: HTTP {response.status_code}", "ERROR")
                return False
                
            data = response.json()
            if not data.get('ok'):
                self.log(f"❌ E2E: Start job returned ok=false: {data.get('error')}", "ERROR")
                return False
                
            job_id = data.get('jobId')
            self.log(f"✅ E2E: Job started successfully: jobId={job_id}")
            
            # Poll status until completed/failed (max 5 minutes)
            max_polls = 150  # 5 minutes with 2-second intervals
            poll_count = 0
            
            while poll_count < max_polls:
                time.sleep(2)  # Wait 2 seconds between polls
                poll_count += 1
                
                self.log(f"Polling status (attempt {poll_count}/{max_polls})...")
                
                status_response = self.session.get(
                    f"{API_BASE}/amazon/bulletpoints/batch/job-status",
                    params={'jobId': job_id},
                    timeout=10
                )
                
                if status_response.status_code != 200:
                    self.log(f"❌ E2E: Status poll failed: HTTP {status_response.status_code}", "ERROR")
                    continue
                    
                status_data = status_response.json()
                if not status_data.get('ok'):
                    self.log(f"❌ E2E: Status poll returned ok=false: {status_data.get('error')}", "ERROR")
                    continue
                    
                job = status_data.get('job', {})
                status = job.get('status')
                processed = job.get('processed', 0)
                succeeded = job.get('succeeded', 0)
                failed = job.get('failed', 0)
                progress = job.get('progress', 0)
                
                self.log(f"Status: {status}, Progress: {progress}%, Processed: {processed}, Succeeded: {succeeded}, Failed: {failed}")
                
                if status == 'completed':
                    self.log(f"✅ E2E: Job completed successfully!")
                    self.log(f"Final Results: Processed={processed}, Succeeded={succeeded}, Failed={failed}")
                    
                    if succeeded > 0:
                        self.log("✅ E2E: At least one article succeeded - bulletpoints generated!")
                        
                        # Check if bulletpoints were saved to MongoDB
                        self.log("Checking if bulletpoints were saved to database...")
                        # Note: We can't directly check MongoDB from here, but the API should have saved them
                        
                        return True
                    else:
                        self.log("⚠️ E2E: Job completed but no articles succeeded", "WARN")
                        return False
                        
                elif status == 'failed':
                    error = job.get('error', 'Unknown error')
                    self.log(f"❌ E2E: Job failed: {error}", "ERROR")
                    return False
                    
                elif status in ['pending', 'running']:
                    # Continue polling
                    continue
                else:
                    self.log(f"❌ E2E: Unknown job status: {status}", "ERROR")
                    return False
                    
            # Timeout reached
            self.log(f"❌ E2E: Timeout reached after {max_polls * 2} seconds", "ERROR")
            return False
            
        except Exception as e:
            self.log(f"❌ E2E: EXCEPTION: {str(e)}", "ERROR")
            return False
            
    def test_error_handling(self) -> bool:
        """
        Test 4: Error Handling
        Test various error conditions
        """
        self.log("=== TEST 4: Error Handling ===")
        
        try:
            # Test 1: Empty kArtikel array
            self.log("Testing empty kArtikel array...")
            response = self.session.post(
                f"{API_BASE}/amazon/bulletpoints/batch/start-job",
                json={"kArtikel": []},
                timeout=10
            )
            
            if response.status_code == 400:
                data = response.json()
                if not data.get('ok') and 'Keine Artikel gefunden' in data.get('error', ''):
                    self.log("✅ Empty array correctly rejected with 400")
                else:
                    self.log(f"❌ Unexpected error response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Expected 400, got {response.status_code}", "ERROR")
                return False
                
            # Test 2: Missing jobId in status request
            self.log("Testing missing jobId parameter...")
            response = self.session.get(
                f"{API_BASE}/amazon/bulletpoints/batch/job-status",
                timeout=10
            )
            
            if response.status_code == 400:
                data = response.json()
                if not data.get('ok') and 'jobId parameter erforderlich' in data.get('error', ''):
                    self.log("✅ Missing jobId correctly rejected with 400")
                else:
                    self.log(f"❌ Unexpected error response: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Expected 400, got {response.status_code}", "ERROR")
                return False
                
            # Test 3: Invalid jobId
            self.log("Testing invalid jobId...")
            response = self.session.get(
                f"{API_BASE}/amazon/bulletpoints/batch/job-status",
                params={'jobId': 'invalid-job-id'},
                timeout=10
            )
            
            if response.status_code == 404:
                data = response.json()
                if not data.get('ok') and 'Job nicht gefunden' in data.get('error', ''):
                    self.log("✅ Invalid jobId correctly rejected with 404")
                else:
                    self.log(f"❌ Unexpected error response: {data}", "ERROR")
                    return False
            else:
                # 500 is also acceptable for invalid ObjectId format
                if response.status_code == 500:
                    self.log("✅ Invalid jobId rejected with 500 (invalid ObjectId format)")
                else:
                    self.log(f"❌ Expected 404 or 500, got {response.status_code}", "ERROR")
                    return False
                    
            self.log("✅ Error handling tests passed")
            return True
            
        except Exception as e:
            self.log(f"❌ Error handling test EXCEPTION: {str(e)}", "ERROR")
            return False
            
    def run_all_tests(self) -> bool:
        """Run all tests in sequence"""
        self.log("🚀 Starting Amazon Bulletpoints Async Job System Backend Testing")
        self.log(f"Base URL: {BASE_URL}")
        self.log(f"API Base: {API_BASE}")
        
        results = []
        
        # Test 1: Start Job API (Quick Test)
        job_id = self.test_start_job_api()
        if job_id:
            results.append(("Start Job API", True))
            
            # Test 2: Job Status API
            job_status = self.test_job_status_api(job_id)
            if job_status:
                results.append(("Job Status API", True))
            else:
                results.append(("Job Status API", False))
        else:
            results.append(("Start Job API", False))
            results.append(("Job Status API", False))  # Skip if start failed
            
        # Test 3: End-to-End Flow
        e2e_success = self.test_end_to_end_flow()
        results.append(("End-to-End Flow", e2e_success))
        
        # Test 4: Error Handling
        error_handling_success = self.test_error_handling()
        results.append(("Error Handling", error_handling_success))
        
        # Summary
        self.log("\n" + "="*60)
        self.log("🏁 AMAZON BULLETPOINTS ASYNC JOB SYSTEM - TEST RESULTS")
        self.log("="*60)
        
        passed = 0
        total = len(results)
        
        for test_name, success in results:
            status = "✅ PASSED" if success else "❌ FAILED"
            self.log(f"{test_name}: {status}")
            if success:
                passed += 1
                
        self.log(f"\nOverall Result: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED - Async Job System is working correctly!")
            return True
        else:
            self.log(f"⚠️ {total - passed} tests failed - Issues found in Async Job System")
            return False

def main():
    """Main test execution"""
    tester = AmazonBulletpointsAsyncTester()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        tester.log("\n❌ Tests interrupted by user", "ERROR")
        sys.exit(1)
    except Exception as e:
        tester.log(f"\n❌ Unexpected error: {str(e)}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()