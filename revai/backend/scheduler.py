from __future__ import annotations

import asyncio
from importlib import import_module
from typing import Any

from sqlalchemy import select

from database import AsyncSessionLocal
from models.deal import Deal
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

    _scheduler.add_job(
        _enqueue_job,
        trigger="interval",
        hours=6,
        id="deal_intelligence_every_6h",
        replace_existing=True,
    )
    _scheduler.start()
    print("[scheduler] Deal intelligence job scheduled every 6 hours")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
