from rq import Queue
from typing import Dict, Any

class SceneQueueManager:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.queue = Queue('scene_rendering', connection=redis_client)
    
    def enqueue_scene(
        self,
        scene_data: Dict[str, Any],
        project_id: str,
        user_id: str,
        chat_id: str,
        scene_index: int
    ):
        """
        Push a scene to the rendering queue
        
        Args:
            scene_data: Dict containing sceneName, code, description
            project_id: Project identifier
            user_id: User identifier
            chat_id: Chat identifier
            scene_index: Index of the scene in the video
        """
        job_data = {
            'sceneName': scene_data['sceneName'],
            'code': scene_data['code'],
            'description': scene_data['description'],
            'projectId': project_id,
            'userId': user_id,
            'chatId': chat_id,
            'sceneIndex': scene_index
        }
        
        # Enqueue the job - worker will call 'render_scene' function with this data
        job = self.queue.enqueue(
            'worker.render_scene',  # This should match your worker function path
            job_data,
            job_timeout='10m',  # Adjust based on rendering time
            result_ttl=3600,  # Keep results for 1 hour
            failure_ttl=86400  # Keep failed jobs for 24 hours
        )
        
        return job.id
    
    def enqueue_all_scenes(
        self,
        scenes: list,
        project_id: str,
        user_id: str,
        chat_id: str
    ):
        """Enqueue all scenes for rendering"""
        job_ids = []
        
        for idx, scene in enumerate(scenes):
            job_id = self.enqueue_scene(
                scene_data=scene,
                project_id=project_id,
                user_id=user_id,
                chat_id=chat_id,
                scene_index=idx
            )
            job_ids.append({
                'sceneIndex': idx,
                'sceneName': scene['sceneName'],
                'jobId': job_id
            })
        
        return job_ids
    
    def get_job_status(self, job_id: str):
        """Get the status of a rendering job"""
        from rq.job import Job
        try:
            job = Job.fetch(job_id, connection=self.redis)
            return {
                'id': job.id,
                'status': job.get_status(),
                'result': job.result,
                'error': str(job.exc_info) if job.is_failed else None
            }
        except Exception as e:
            return {'error': str(e)}