from __future__ import annotations

import asyncio
from importlib import import_module
from typing import Any

from sqlalchemy import select

from database import AsyncSessionLocal
from models.battlecard import Battlecard
from models.deal import Deal
from agents.competitive_agent import run_competitive_agent
from agents.deal_intelligence_agent import analyze_deal

try:
    AsyncIOScheduler = import_module("apscheduler.schedulers.asyncio").AsyncIOScheduler
except Exception:  # pragma: no cover - optional in local incremental setup
    AsyncIOScheduler = None

_scheduler = None


async def run_deal_intelligence_for_all_deals(org_id: str | None = None) -> dict[str, Any]:
    analyzed = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        stmt = select(Deal).where(Deal.stage.notin_(["Closed Won", "Closed Lost"]))
        if org_id:
            stmt = stmt.where(Deal.org_id == org_id)

        deals = (await db.execute(stmt)).scalars().all()

        for deal in deals:
            try:
                await analyze_deal(str(deal.id), str(deal.org_id), db)
                analyzed += 1
            except Exception:
                failed += 1

    return {"analyzed": analyzed, "failed": failed}


async def run_competitive_intel_for_tracked_competitors(org_id: str | None = None) -> dict[str, Any]:
    processed = 0
    failed = 0

    async with AsyncSessionLocal() as db:
        stmt = select(Battlecard)
        if org_id:
            stmt = stmt.where(Battlecard.org_id == org_id)

        cards = (await db.execute(stmt)).scalars().all()
        seen: set[tuple[str, str]] = set()

        for card in cards:
            key = (str(card.org_id), card.competitor_name.lower())
            if key in seen:
                continue
            seen.add(key)

            try:
                await run_competitive_agent(
                    org_id=str(card.org_id),
                    competitor_name=card.competitor_name,
                    competitor_domain="",
                    db=db,
                )
                processed += 1
            except Exception:
                failed += 1

    return {"processed": processed, "failed": failed}


def start_scheduler() -> Any:
    global _scheduler

    if AsyncIOScheduler is None:
        print("[scheduler] APScheduler not installed, skipping background jobs")
        return None

    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler()

    def _enqueue_job() -> None:
        asyncio.create_task(run_deal_intelligence_for_all_deals())

    def _enqueue_competitive_job() -> None:
        asyncio.create_task(run_competitive_intel_for_tracked_competitors())

    _scheduler.add_job(
        _enqueue_job,
        trigger="interval",
        hours=6,
        id="deal_intelligence_every_6h",
        replace_existing=True,
    )
    _scheduler.add_job(
        _enqueue_competitive_job,
        trigger="interval",
        weeks=1,
        id="competitive_intel_weekly",
        replace_existing=True,
    )
    _scheduler.start()
    print("[scheduler] Deal intelligence (6h) and competitive intel (weekly) jobs scheduled")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
