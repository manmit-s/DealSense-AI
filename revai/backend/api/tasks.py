from fastapi import APIRouter, Depends
from celery.result import AsyncResult
from utils.auth import get_current_user
from models.user import User
from tasks import celery_app

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    task_result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": task_result.result if task_result.ready() else None
    }
