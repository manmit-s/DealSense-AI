from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class DashboardOverview(BaseModel):
    pipeline_value: float = 0.0
    deals_at_risk: int = 0
    prospects_in_queue: int = 0
    accounts_at_risk: int = 0
    pipeline_health_avg: float = 0.0

class FunnelStage(BaseModel):
    stage: str
    count: int = 0
    value: float = 0.0
    avg_health: float = 0.0

class AgentActivityResponse(BaseModel):
    id: UUID
    org_id: UUID
    agent_type: str
    action: str
    status: str
    metadata_info: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    
    class Config:
        from_attributes = True
