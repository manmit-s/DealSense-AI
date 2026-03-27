from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CompetitiveTrackRequest(BaseModel):
    competitor_name: str
    competitor_domain: str = ""


class ObjectionHandler(BaseModel):
    objection: str
    response: str


class BattlecardResponse(BaseModel):
    id: UUID
    competitor_name: str
    overview: str
    their_strengths: list[str]
    their_weaknesses: list[str]
    how_we_win: list[str]
    key_differentiators: list[str]
    objection_handlers: list[ObjectionHandler]
    recent_features: list[str] = []
    customer_complaints: list[str] = []
    deal_mentions: list[str] = []
    last_updated: datetime


class BattlecardListItem(BaseModel):
    competitor_name: str
    last_updated: datetime
    alert_count: int


class CompetitiveAlertItem(BaseModel):
    competitor_name: str
    deal_title: str
    severity: str = "high"
    created_at: datetime


class CompetitiveTrackResponse(BaseModel):
    status: str
    competitor_name: str
    deal_mentions: list[str] = []
    message: str
