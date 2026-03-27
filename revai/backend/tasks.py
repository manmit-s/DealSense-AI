import os
import asyncio
from celery import Celery
from agents.prospecting_agent import prospecting_agent_graph

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "revai_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(bind=True)
def run_prospect_research(self, prospect_id: str, org_id: str, company_name: str, domain: str, contact_name: str, contact_email: str, icp_config: str):
    # LangGraph is async, Celery runs sync, so we need to run asyncio event loop
    state = {
        "prospect_id": prospect_id,
        "org_id": org_id,
        "company_name": company_name,
        "domain": domain,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "icp_config": icp_config,
    }
    
    async def _run():
        await prospecting_agent_graph.ainvoke(state)
        
    try:
        # Check if there is already an event loop
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.run_until_complete(_run())
    
    return {"status": "completed", "prospect_id": prospect_id}
