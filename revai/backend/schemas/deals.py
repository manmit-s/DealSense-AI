from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

class DealBase(BaseModel):
    title: str
    value: float
    stage: str
    close_date: Optional[date] = None
    health_score: Optional[int] = 100
    risk_signals: Optional[List[dict]] = []
    last_contact_date: Optional[date] = None
    assigned_to: Optional[str] = None

class DealResponse(DealBase):
    id: UUID
    org_id: UUID
    crm_deal_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class DealStageUpdate(BaseModel):
    stage: str
