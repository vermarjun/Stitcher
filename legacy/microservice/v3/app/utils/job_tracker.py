from rq.job import Job
from typing import List, Dict, Any
import asyncio

class JobCompletionTracker:
    """
    Tracks RQ job completion status and waits for all jobs to finish.
    Used to wait for render jobs before calling the response summary agent.
    """
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def wait_for_jobs(
        self, 
        job_ids: List[str],
        poll_interval: int = 5,
        timeout: int = 1800  # 30 minutes default
    ) -> List[Dict[str, Any]]:
        """
        Wait for all jobs to complete (success or failure).
        
        Args:
            job_ids: List of RQ job IDs to track
            poll_interval: Seconds between status checks (default: 5)
            timeout: Maximum seconds to wait (default: 1800 = 30 min)
        
        Returns:
            List of job results with status, result/error info
        """
        start_time = asyncio.get_event_loop().time()
        pending_jobs = set(job_ids)
        results = []
        
        print(f"[JobTracker] Tracking {len(job_ids)} jobs with {timeout}s timeout")
        
        while pending_jobs:
            # Check timeout
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout:
                print(f"[JobTracker] ⚠ Timeout after {timeout}s. {len(pending_jobs)} jobs still pending")
                # Add timeout results for pending jobs
                for job_id in pending_jobs:
                    results.append({
                        'jobId': job_id,
                        'status': 'timeout',
                        'result': None,
                        'error': f'Job timed out after {timeout} seconds'
                    })
                break
            
            completed_this_round = set()
            
            for job_id in list(pending_jobs):
                try:
                    job = Job.fetch(job_id, connection=self.redis)
                    status = job.get_status()
                    
                    if status in ['finished', 'failed']:
                        result = {
                            'jobId': job_id,
                            'status': status,
                            'result': job.result if status == 'finished' else None,
                            'error': str(job.exc_info) if status == 'failed' else None
                        }
                        results.append(result)
                        completed_this_round.add(job_id)
                        print(f"[JobTracker] ✓ Job {job_id[:8]}... {status}")
                        
                except Exception as e:
                    print(f"[JobTracker] ⚠ Error checking job {job_id}: {e}")
                    # Treat as failed
                    results.append({
                        'jobId': job_id,
                        'status': 'failed',
                        'result': None,
                        'error': f'Error fetching job status: {str(e)}'
                    })
                    completed_this_round.add(job_id)
            
            pending_jobs -= completed_this_round
            
            if pending_jobs:
                print(f"[JobTracker] Waiting... {len(pending_jobs)} jobs remaining (elapsed: {int(elapsed)}s)")
                await asyncio.sleep(poll_interval)
        
        print(f"[JobTracker] ✓ All jobs completed. Total: {len(results)}")
        return results
