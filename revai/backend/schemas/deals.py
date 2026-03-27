from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID


class DealActivityItem(BaseModel):
    timestamp: datetime
    subject: str
    from_name: str


class RecoveryEmailDraft(BaseModel):
    subject: str
    body: str


class RecoveryPlay(BaseModel):
    diagnosis: str
    recommended_action: str
    email_draft: RecoveryEmailDraft
    talking_points: List[str] = []


class DealRiskItem(BaseModel):
    type: str
    description: str
    severity: str = "medium"


class DealDetailMeta(BaseModel):
    risk_items: List[DealRiskItem] = []
    recovery_play: Optional[RecoveryPlay] = None
    analysis_run_at: Optional[datetime] = None
    recent_activity: List[DealActivityItem] = []

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


class DealDetailResponse(DealResponse):
    analysis: DealDetailMeta = DealDetailMeta()


class DealRecoveryResponse(BaseModel):
    deal_id: UUID
    health_score: int
    risk_level: str
    recovery_play: Optional[RecoveryPlay] = None
