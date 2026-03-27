import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.competitive_agent import run_competitive_agent
from database import get_db
from models.battlecard import Battlecard
from models.deal import Deal
from models.user import User
from schemas.competitive import (
    BattlecardListItem,
    BattlecardResponse,
    CompetitiveAlertItem,
    CompetitiveTrackRequest,
    CompetitiveTrackResponse,
    ObjectionHandler,
)
from utils.auth import get_current_user

router = APIRouter(prefix="/api/competitive", tags=["competitive"])


def _parse_multiline(value: str) -> list[str]:
    return [line.strip() for line in (value or "").splitlines() if line.strip()]


def _battlecard_to_response(card: Battlecard) -> BattlecardResponse:
    meta: dict[str, Any] = {}
    handlers: list[ObjectionHandler] = []

    for item in card.objection_handlers or []:
        if isinstance(item, dict) and "meta" in item:
            meta = item.get("meta") or {}
            continue
        if isinstance(item, dict) and item.get("objection") and item.get("response"):
            handlers.append(
                ObjectionHandler(
                    objection=str(item.get("objection")),
                    response=str(item.get("response")),
                )
            )

    overview = ""
    market = ""
    pricing = ""
    how_we_win = []

    for line in (card.positioning or "").splitlines():
        if line.startswith("Overview:"):
            overview = line.replace("Overview:", "", 1).strip()
        elif line.startswith("Market Positioning:"):
            market = line.replace("Market Positioning:", "", 1).strip()
        elif line.startswith("Pricing Intel:"):
            pricing = line.replace("Pricing Intel:", "", 1).strip()
        elif line.startswith("How We Win:"):
            how_we_win = [v.strip() for v in line.replace("How We Win:", "", 1).split(",") if v.strip()]

    if market and pricing:
        overview = f"{overview} {market} Pricing intel: {pricing}".strip()

    return BattlecardResponse(
        id=card.id,
        competitor_name=card.competitor_name,
        overview=overview,
        their_strengths=_parse_multiline(card.strengths),
        their_weaknesses=_parse_multiline(card.weaknesses),
        how_we_win=how_we_win,
        key_differentiators=list(meta.get("key_differentiators", [])),
        objection_handlers=handlers,
        recent_features=list(meta.get("recent_features", [])),
        customer_complaints=list(meta.get("customer_complaints", [])),
        deal_mentions=list(meta.get("deal_mentions", [])),
        last_updated=card.last_updated,
    )


@router.get("/battlecards", response_model=list[BattlecardListItem])
async def get_battlecards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Battlecard)
        .where(Battlecard.org_id == current_user.org_id)
        .order_by(Battlecard.last_updated.desc())
    )
    cards = (await db.execute(stmt)).scalars().all()

    result: list[BattlecardListItem] = []
    for card in cards:
        meta = {}
        for item in card.objection_handlers or []:
            if isinstance(item, dict) and "meta" in item:
                meta = item.get("meta") or {}
                break

        mentions = list(meta.get("deal_mentions", []))
        result.append(
            BattlecardListItem(
                competitor_name=card.competitor_name,
                last_updated=card.last_updated,
                alert_count=len(mentions),
            )
        )

    return result


@router.get("/battlecards/{competitor_name}", response_model=BattlecardResponse)
async def get_battlecard(
    competitor_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Battlecard).where(
        Battlecard.org_id == current_user.org_id,
        Battlecard.competitor_name.ilike(competitor_name),
    )
    card = (await db.execute(stmt)).scalars().first()
    if not card:
        raise HTTPException(status_code=404, detail="Battlecard not found")

    return _battlecard_to_response(card)


@router.post("/track", response_model=CompetitiveTrackResponse)
async def track_competitor(
    payload: CompetitiveTrackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = payload.competitor_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="competitor_name is required")

    state = await run_competitive_agent(
        org_id=str(current_user.org_id),
        competitor_name=name,
        competitor_domain=payload.competitor_domain.strip(),
        db=db,
    )

    mentions = list(state.get("deal_mentions", []))
    return CompetitiveTrackResponse(
        status="tracked",
        competitor_name=name,
        deal_mentions=mentions,
        message="Competitive intelligence run completed",
    )


@router.get("/alerts", response_model=list[CompetitiveAlertItem])
async def get_competitive_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cards_stmt = select(Battlecard).where(Battlecard.org_id == current_user.org_id)
    cards = (await db.execute(cards_stmt)).scalars().all()

    competitors = [card.competitor_name.lower() for card in cards]
    if not competitors:
        return []

    deals_stmt = select(Deal).where(
        Deal.org_id == current_user.org_id,
        Deal.stage.notin_(["Closed Won", "Closed Lost"]),
    )
    deals = (await db.execute(deals_stmt)).scalars().all()

    alerts: list[CompetitiveAlertItem] = []
    now = datetime.utcnow()

    for deal in deals:
        signal_blob = ""
        for signal in deal.risk_signals or []:
            if isinstance(signal, dict):
                signal_blob += f" {signal.get('type', '')} {signal.get('description', '')}"
            else:
                signal_blob += f" {signal}"

        blob = signal_blob.lower()
        for competitor in competitors:
            if competitor and competitor in blob:
                alerts.append(
                    CompetitiveAlertItem(
                        competitor_name=competitor.title(),
                        deal_title=deal.title,
                        severity="high",
                        created_at=now,
                    )
                )
                break

    return alerts
