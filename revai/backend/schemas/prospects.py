from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID

class ProspectResearchRequest(BaseModel):
    company_name: str
    domain: str
    contact_name: str
    contact_email: str
    use_icp_from_settings: bool = True

class ProspectResponse(BaseModel):
    id: UUID
    org_id: UUID
    company_name: str
    domain: str
    contact_name: str
    contact_email: str
    icp_score: Optional[int] = None
    status: str
    fit_signals: List[str]
    
    model_config = ConfigDict(from_attributes=True)

class TaskResponse(BaseModel):
    task_id: str
    status: str
