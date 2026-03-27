from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database import get_db
from models.deal import Deal, DealAlert
from models.prospect import Prospect
from models.account import Account
from models.agent_log import AgentLog
from models.user import User
from utils.auth import get_current_user
from schemas.dashboard import DashboardOverview, FunnelStage, AgentActivityResponse, DealAlertSummary, AgentActivityItem
from typing import List

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/overview", response_model=DashboardOverview)
async def get_overview(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_id = current_user.org_id
    
    # 1. Pipeline value (Open Deals)
    val_stmt = select(func.coalesce(func.sum(Deal.value), 0.0)).where(
        and_(Deal.org_id == org_id, Deal.stage.notin_(["Closed Lost", "Closed Won"]))
    )
    pipeline_value = await db.scalar(val_stmt)
    
    # 2. Deals at risk (Health < 50)
    risk_stmt = select(func.count(Deal.id)).where(
        and_(Deal.org_id == org_id, Deal.stage.notin_(["Closed Lost", "Closed Won"]), Deal.health_score < 50)
    )
    deals_at_risk = await db.scalar(risk_stmt)
    
    # 3. Prospects in queue
    prospect_stmt = select(func.count(Prospect.id)).where(
        and_(Prospect.org_id == org_id, Prospect.status.in_(["researching", "qualified"]))
    )
    prospects_in_queue = await db.scalar(prospect_stmt)
    
    # 4. Accounts at risk (Churn Score > 70)
    account_stmt = select(func.count(Account.id)).where(
        and_(Account.org_id == org_id, Account.churn_score > 70)
    )
    accounts_at_risk = await db.scalar(account_stmt)
    
    # 5. Pipeline health average
    health_stmt = select(func.coalesce(func.avg(Deal.health_score), 0.0)).where(
        and_(Deal.org_id == org_id, Deal.stage.notin_(["Closed Lost", "Closed Won"]))
    )
    pipeline_health_avg = await db.scalar(health_stmt)

    # 6. Recent alerts
    alert_stmt = (
        select(DealAlert, Deal.title)
        .join(Deal, DealAlert.deal_id == Deal.id)
        .where(Deal.org_id == org_id)
        .order_by(DealAlert.created_at.desc())
        .limit(5)
    )
    alert_rows = (await db.execute(alert_stmt)).all()
    recent_alerts = [
        DealAlertSummary(
            id=alert.id,
            deal_id=alert.deal_id,
            deal_title=deal_title,
            alert_type=alert.alert_type,
            severity=alert.severity,
            description=alert.description,
            created_at=alert.created_at,
        )
        for alert, deal_title in alert_rows
    ]

    # 7. Recent agent activity
    activity_stmt = (
        select(AgentLog)
        .where(AgentLog.org_id == org_id)
        .order_by(AgentLog.created_at.desc())
        .limit(10)
    )
    activity_logs = (await db.execute(activity_stmt)).scalars().all()
    agent_activity = [
        AgentActivityItem(
            id=log.id,
            agent_type=log.agent_type,
            action=log.action,
            status=log.status,
            created_at=log.created_at,
        )
        for log in activity_logs
    ]
    
    return DashboardOverview(
        pipeline_value=float(pipeline_value) if pipeline_value else 0.0,
        deals_at_risk=int(deals_at_risk) if deals_at_risk else 0,
        prospects_in_queue=int(prospects_in_queue) if prospects_in_queue else 0,
        accounts_at_risk=int(accounts_at_risk) if accounts_at_risk else 0,
        pipeline_health_avg=float(pipeline_health_avg) if pipeline_health_avg else 0.0,
        recent_alerts=recent_alerts,
        agent_activity=agent_activity,
    )


@router.get("/pipeline-funnel", response_model=List[FunnelStage])
async def get_pipeline_funnel(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_id = current_user.org_id
    
    stmt = select(
        Deal.stage,
        func.count(Deal.id).label("count"),
        func.coalesce(func.sum(Deal.value), 0.0).label("value"),
        func.coalesce(func.avg(Deal.health_score), 0.0).label("avg_health")
    ).where(
        Deal.org_id == org_id
    ).group_by(Deal.stage)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Define order
    stages_order = ["Prospect", "Qualified", "Demo", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]
    
    row_dict = {row.stage: row for row in rows}
    
    funnel = []
    for stage in stages_order:
        if stage in row_dict:
            r = row_dict[stage]
            funnel.append(FunnelStage(
                stage=stage, 
                count=r.count, 
                value=float(r.value), 
                avg_health=float(r.avg_health)
            ))
        else:
            funnel.append(FunnelStage(stage=stage, count=0, value=0.0, avg_health=0.0))
            
    return funnel


@router.get("/agent-activity", response_model=List[AgentActivityResponse])
async def get_agent_activity(
    limit: int = Query(20, ge=1, le=100), 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    org_id = current_user.org_id
    
    stmt = select(AgentLog).where(
        AgentLog.org_id == org_id
    ).order_by(AgentLog.created_at.desc()).limit(limit)
    
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    return logs
