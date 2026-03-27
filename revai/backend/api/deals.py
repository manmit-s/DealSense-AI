import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_db
from models.agent_log import AgentLog
from models.deal import DealAlert
from models.deal import Deal
from models.user import User
from agents.deal_intelligence_agent import analyze_deal
from utils.auth import get_current_user
from schemas.deals import (
    DealActivityItem,
    DealDetailMeta,
    DealDetailResponse,
    DealRecoveryResponse,
    DealResponse,
    DealRiskItem,
    DealStageUpdate,
    RecoveryPlay,
)

router = APIRouter(prefix="/api/deals", tags=["deals"])

@router.get("", response_model=List[DealResponse])
async def get_deals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deals = result.scalars().all()
    return deals

@router.get("/{id}", response_model=DealDetailResponse)
async def get_deal(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.id == id, Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    alert_stmt = (
        select(DealAlert)
        .where(DealAlert.deal_id == deal.id)
        .order_by(DealAlert.created_at.desc())
        .limit(1)
    )
    latest_alert = (await db.execute(alert_stmt)).scalar_one_or_none()

    recovery_play = None
    if latest_alert and latest_alert.recovery_play:
        try:
            recovery_payload = json.loads(latest_alert.recovery_play)
            if isinstance(recovery_payload, dict) and recovery_payload:
                recovery_play = RecoveryPlay(**recovery_payload)
        except (json.JSONDecodeError, TypeError, ValueError):
            recovery_play = None

    risk_items: List[DealRiskItem] = []
    for signal in deal.risk_signals or []:
        if isinstance(signal, dict):
            risk_items.append(
                DealRiskItem(
                    type=str(signal.get("type", "objection")),
                    description=str(signal.get("description", "Risk detected")),
                    severity=str(signal.get("severity", "medium")),
                )
            )
        else:
            risk_items.append(
                DealRiskItem(type="objection", description=str(signal), severity="medium")
            )

    log_stmt = (
        select(AgentLog)
        .where(AgentLog.org_id == current_user.org_id)
        .order_by(AgentLog.created_at.desc())
        .limit(50)
    )
    logs = (await db.execute(log_stmt)).scalars().all()

    recent_activity: List[DealActivityItem] = []
    for log in logs:
        metadata = log.metadata_info or {}
        metadata_deal_id = str(metadata.get("deal_id", ""))
        if metadata_deal_id == str(deal.id) or str(deal.id) in (log.action or ""):
            recent_activity.append(
                DealActivityItem(
                    timestamp=log.created_at,
                    subject=log.action,
                    from_name="RevAI Agent",
                )
            )
        if len(recent_activity) >= 5:
            break

    analysis = DealDetailMeta(
        risk_items=risk_items,
        recovery_play=recovery_play,
        analysis_run_at=latest_alert.created_at if latest_alert else None,
        recent_activity=recent_activity,
    )

    payload = DealDetailResponse.model_validate(deal)
    payload.analysis = analysis
    return payload

@router.patch("/{id}/stage", response_model=DealResponse)
async def update_deal_stage(
    id: str,
    update_data: DealStageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.id == id, Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    deal.stage = update_data.stage
    await db.commit()
    await db.refresh(deal)
    
    return deal


@router.post("/{id}/recovery", response_model=DealRecoveryResponse)
async def generate_recovery_play(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Deal).where(Deal.id == id, Deal.org_id == current_user.org_id)
    deal = (await db.execute(stmt)).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    state = await analyze_deal(str(deal.id), str(current_user.org_id), db)
    recovery = state.get("recovery_play")
    recovery_model = RecoveryPlay(**recovery) if isinstance(recovery, dict) and recovery else None

    return DealRecoveryResponse(
        deal_id=deal.id,
        health_score=int(state.get("health_score", deal.health_score)),
        risk_level=str(state.get("risk_level", "green")),
        recovery_play=recovery_model,
    )
