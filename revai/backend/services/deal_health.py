from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_log import AgentLog
from models.deal import Deal, DealAlert


def _to_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _days_since(value: date | datetime | None, today: date) -> int | None:
    parsed = _to_date(value)
    if not parsed:
        return None
    return max((today - parsed).days, 0)


def _extract_email_stats(email_data: dict[str, Any] | None) -> tuple[int | None, int | None, int | None]:
    if not email_data:
        return None, None, None

    # Accept common key variations so the scorer can work with mocked or real feeds.
    count_14 = email_data.get("emails_last_14_days")
    if count_14 is None:
        count_14 = email_data.get("email_count_last_14_days")

    count_30 = email_data.get("emails_last_30_days")
    if count_30 is None:
        count_30 = email_data.get("email_count_last_30_days")

    unique_contacts = email_data.get("unique_contacts_30_days")
    if unique_contacts is None:
        unique_contacts = email_data.get("unique_contacts")

    return count_14, count_30, unique_contacts


def _has_competitor_signal(risk_signals: list[Any] | None) -> bool:
    if not risk_signals:
        return False

    for signal in risk_signals:
        if isinstance(signal, dict):
            signal_type = str(signal.get("type", "")).lower()
            description = str(signal.get("description", "")).lower()
            if "competitor" in signal_type or "competitor" in description:
                return True
        elif isinstance(signal, str) and "competitor" in signal.lower():
            return True

    return False


def calculate_deal_health(deal: Deal, email_data: dict[str, Any] | None = None) -> dict[str, Any]:
    today = date.today()
    score = 100
    penalty_breakdown = {
        "silence": 0,
        "close_date": 0,
        "email_engagement": 0,
        "stakeholder": 0,
        "competitor": 0,
        "stage_progression": 0,
    }
    risk_signals: list[str] = []

    # 1) Days since last contact
    days_since_contact = _days_since(getattr(deal, "last_contact_date", None), today)
    if days_since_contact is not None:
        if days_since_contact >= 15:
            penalty_breakdown["silence"] = 40
            risk_signals.append(f"No contact in {days_since_contact} days")
        elif days_since_contact >= 8:
            penalty_breakdown["silence"] = 25
            risk_signals.append(f"No contact in {days_since_contact} days")
        elif days_since_contact >= 4:
            penalty_breakdown["silence"] = 10

    # 2) Close date pressure
    close_date = _to_date(getattr(deal, "close_date", None))
    stage = (getattr(deal, "stage", "") or "").strip()
    if close_date:
        days_to_close = (close_date - today).days
        if 0 <= days_to_close <= 7 and stage not in ["Negotiation", "Proposal"]:
            penalty_breakdown["close_date"] = 20
            risk_signals.append("Closing soon but stage is early")
        elif 0 <= days_to_close <= 14 and stage in ["Prospect", "Qualified"]:
            penalty_breakdown["close_date"] = 15
            risk_signals.append("Closing soon but stage is early")

    # 3) Email engagement and 4) stakeholder coverage
    count_14, count_30, unique_contacts = _extract_email_stats(email_data)
    if count_14 is not None and int(count_14) == 0:
        penalty_breakdown["email_engagement"] = 20
    elif count_30 is not None and 1 <= int(count_30) <= 2:
        penalty_breakdown["email_engagement"] = 10

    if unique_contacts is not None and int(unique_contacts) <= 1:
        penalty_breakdown["stakeholder"] = 10
        risk_signals.append("Single-threaded - only talking to 1 person")

    # 5) Competitor detection from existing risk signals
    if _has_competitor_signal(getattr(deal, "risk_signals", None)):
        penalty_breakdown["competitor"] = 20
        risk_signals.append("Competitor mentioned in thread")

    # 6) Stage progression
    # Model does not currently track stage-entered-at, so created_at is the best fallback.
    created_days_ago = _days_since(getattr(deal, "created_at", None), today)
    if created_days_ago is not None and created_days_ago > 21:
        closed_stages = {"Closed Won", "Closed Lost"}
        if stage not in closed_stages:
            penalty_breakdown["stage_progression"] = 15
            risk_signals.append("Deal stalled - same stage for 3+ weeks")

    total_penalty = sum(penalty_breakdown.values())
    score = max(0, min(100, score - total_penalty))

    if score >= 65:
        risk_level = "green"
    elif score >= 40:
        risk_level = "yellow"
    else:
        risk_level = "red"

    # Keep unique signals in stable order.
    deduped_risks: list[str] = []
    for signal in risk_signals:
        if signal not in deduped_risks:
            deduped_risks.append(signal)

    return {
        "health_score": score,
        "risk_signals": deduped_risks,
        "risk_level": risk_level,
        "penalty_breakdown": penalty_breakdown,
    }


async def update_all_deal_health(org_id: str, db: AsyncSession) -> dict[str, Any]:
    org_uuid = UUID(str(org_id))

    stmt = select(Deal).where(
        Deal.org_id == org_uuid,
        Deal.stage.notin_(["Closed Won", "Closed Lost"]),
    )
    deals = (await db.execute(stmt)).scalars().all()

    updated = 0
    new_red_alerts = 0

    for deal in deals:
        previous_score = int(getattr(deal, "health_score", 100) or 100)
        result = calculate_deal_health(deal)

        deal.health_score = int(result["health_score"])
        deal.risk_signals = result["risk_signals"]
        updated += 1

        is_new_red = previous_score >= 40 and result["health_score"] < 40
        if is_new_red:
            top_signal = result["risk_signals"][0] if result["risk_signals"] else "Deal risk increased"
            alert_type = "silence"
            lower_signal = top_signal.lower()
            if "competitor" in lower_signal:
                alert_type = "competitor"
            elif "stakeholder" in lower_signal or "single-threaded" in lower_signal:
                alert_type = "stakeholder"
            elif "closing" in lower_signal or "budget" in lower_signal:
                alert_type = "budget"

            db.add(
                DealAlert(
                    deal_id=deal.id,
                    alert_type=alert_type,
                    severity="high" if result["health_score"] >= 25 else "critical",
                    description=f"{top_signal} (health {result['health_score']}/100)",
                    status="open",
                )
            )
            new_red_alerts += 1

    db.add(
        AgentLog(
            org_id=org_uuid,
            agent_type="deal_intel",
            action=f"Deal health updated for {updated} active deals",
            status="completed",
            metadata_info={
                "updated_deals": updated,
                "new_red_alerts": new_red_alerts,
                "run_at": datetime.utcnow().isoformat(),
            },
        )
    )

    await db.commit()

    return {
        "updated": updated,
        "new_red_alerts": new_red_alerts,
    }
