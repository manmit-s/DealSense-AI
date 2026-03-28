from __future__ import annotations

import json
import os
from datetime import date
from typing import Any, TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_log import AgentLog
from models.deal import Deal, DealAlert
from services.deal_health import calculate_deal_health

try:
    from langgraph.graph import END, StateGraph
except ImportError:  # pragma: no cover - optional dependency for local incremental setup
    END = "END"
    StateGraph = None


class DealState(TypedDict, total=False):
    deal_id: str
    org_id: str
    deal_data: dict[str, Any]
    email_snippets: list[dict[str, Any]]
    detected_risks: list[dict[str, Any]]
    health_score: int
    risk_level: str
    recovery_play: dict[str, Any] | None
    previous_health_score: int | None
    health_risk_signals: list[str]
    _db: Any


def _coerce_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _extract_json_payload(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(text[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            return None

    return None


async def _log(db: AsyncSession, org_id: str, action: str, status: str = "running", metadata: dict[str, Any] | None = None) -> None:
    db.add(
        AgentLog(
            org_id=org_id,
            agent_type="deal_intel",
            action=action,
            status=status,
            metadata_info=metadata or {},
        )
    )
    await db.flush()


def _simulate_email_snippets_from_signals(deal: Deal) -> list[dict[str, Any]]:
    snippets: list[dict[str, Any]] = []
    for signal in deal.risk_signals or []:
        if isinstance(signal, dict):
            desc = signal.get("description") or signal.get("type") or "Risk signal detected"
        else:
            desc = str(signal)

        snippets.append(
            {
                "subject": f"Deal note: {deal.title}",
                "snippet": desc,
                "date": date.today().isoformat(),
                "from": "system@revai.local",
            }
        )

    return snippets


def _heuristic_detect_risks(deal: Deal, email_snippets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    risks: list[dict[str, Any]] = []
    text_blob = " ".join(
        f"{item.get('subject', '')} {item.get('snippet', '')}".lower()
        for item in email_snippets
    )

    if "competitor" in text_blob:
        risks.append(
            {
                "type": "competitor",
                "description": "Competitor mentioned in recent thread context",
                "severity": "high",
            }
        )

    if any(word in text_blob for word in ["budget", "expensive", "cost", "pause", "freeze"]):
        risks.append(
            {
                "type": "budget",
                "description": "Budget pressure language detected in recent interactions",
                "severity": "high",
            }
        )

    if any(word in text_blob for word in ["new role", "left", "reorg", "team change", "stakeholder"]):
        risks.append(
            {
                "type": "stakeholder",
                "description": "Potential stakeholder change detected",
                "severity": "medium",
            }
        )

    if not risks:
        days_silence = None
        if deal.last_contact_date:
            days_silence = max((date.today() - deal.last_contact_date).days, 0)

        if days_silence is not None and days_silence >= 7:
            risks.append(
                {
                    "type": "silence",
                    "description": f"No reply pattern detected for {days_silence} days",
                    "severity": "medium" if days_silence < 14 else "high",
                }
            )

    return risks


def _llm_text_from_response(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
        return "\n".join(chunks)
    return ""


async def _gemini_json(system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
            temperature=0,
            google_api_key=api_key,
        )
        response = await llm.ainvoke(
            f"{system_prompt}\n\n{user_prompt}\n\nReturn ONLY valid JSON."
        )
    except Exception:
        return None

    text = _llm_text_from_response(getattr(response, "content", ""))
    return _extract_json_payload(text)


def _build_email_data(email_snippets: list[dict[str, Any]]) -> dict[str, Any]:
    # Local heuristic summary until Gmail MCP wiring is added.
    total = len(email_snippets)
    return {
        "emails_last_14_days": total,
        "emails_last_30_days": total,
        "unique_contacts_30_days": max(1, len({s.get("from") for s in email_snippets if s.get("from")})),
    }


async def fetch_deal_context(state: DealState) -> DealState:
    db: AsyncSession = state["_db"]
    await _log(db, state["org_id"], f"Analyzing deal: {state['deal_id']}")

    stmt = select(Deal).where(Deal.id == state["deal_id"], Deal.org_id == state["org_id"])
    deal = (await db.execute(stmt)).scalar_one_or_none()
    if not deal:
        raise ValueError("Deal not found for the provided org")

    snippets = state.get("email_snippets") or _simulate_email_snippets_from_signals(deal)

    state["previous_health_score"] = deal.health_score
    state["deal_data"] = {
        "id": str(deal.id),
        "title": deal.title,
        "value": float(deal.value or 0),
        "stage": deal.stage,
        "close_date": deal.close_date.isoformat() if deal.close_date else None,
        "last_contact_date": deal.last_contact_date.isoformat() if deal.last_contact_date else None,
        "risk_signals": deal.risk_signals or [],
    }
    state["email_snippets"] = snippets
    return state


async def detect_risks(state: DealState) -> DealState:
    db: AsyncSession = state["_db"]
    deal_data = state["deal_data"]
    email_snippets = state.get("email_snippets", [])

    system_prompt = "You are a sales risk analyst. Identify deal risks from context. Return ONLY valid JSON."
    user_prompt = f"""
Deal: {deal_data.get('title')}, Stage: {deal_data.get('stage')}, Value: ${deal_data.get('value')}
Last Contact: {deal_data.get('last_contact_date')}
Email Thread Snippets (most recent): {json.dumps(email_snippets)}

Identify risks. Look for:
- Engagement drop (silence pattern)
- Competitor mentions
- Budget concerns
- Stakeholder changes
- Objections that weren't addressed

Return JSON: {{"risks": [{{"type": "silence|competitor|budget|stakeholder|objection", "description": "...", "severity": "low|medium|high|critical"}}]}}
"""
    llm_response = await _gemini_json(system_prompt, user_prompt)
    llm_risks = (llm_response or {}).get("risks") if llm_response else None

    if isinstance(llm_risks, list) and llm_risks:
        detected = [
            {
                "type": str(item.get("type", "objection")),
                "description": str(item.get("description", "Potential risk detected")),
                "severity": str(item.get("severity", "medium")),
            }
            for item in llm_risks
            if isinstance(item, dict)
        ]
    else:
        # Fallback for local development without AI key.
        stmt = select(Deal).where(Deal.id == state["deal_id"], Deal.org_id == state["org_id"])
        deal = (await db.execute(stmt)).scalar_one()
        detected = _heuristic_detect_risks(deal, email_snippets)

    state["detected_risks"] = detected
    return state


async def calculate_score(state: DealState) -> DealState:
    db: AsyncSession = state["_db"]
    stmt = select(Deal).where(Deal.id == state["deal_id"], Deal.org_id == state["org_id"])
    deal = (await db.execute(stmt)).scalar_one()

    email_data = _build_email_data(state.get("email_snippets", []))
    score_payload = calculate_deal_health(deal, email_data=email_data)

    state["health_score"] = int(score_payload["health_score"])
    state["risk_level"] = str(score_payload["risk_level"])
    state["health_risk_signals"] = list(score_payload.get("risk_signals", []))
    return state


async def generate_recovery_play(state: DealState) -> DealState:
    if int(state.get("health_score", 100)) >= 60:
        state["recovery_play"] = None
        return state

    deal_data = state["deal_data"]
    risks = state.get("detected_risks", [])

    system_prompt = "You are a senior sales coach helping rescue at-risk deals. Return ONLY valid JSON."
    user_prompt = f"""
DEAL AT RISK:
Deal: {deal_data.get('title')}
Value: ${deal_data.get('value')}
Stage: {deal_data.get('stage')}
Close Date: {deal_data.get('close_date')}
Risk Signals: {json.dumps(risks)}

Return JSON:
{{
  "diagnosis": "One sentence: the core problem with this deal right now",
  "recommended_action": "Specific next step to take in the next 24 hours",
  "email_draft": {{"subject": "...", "body": "...(max 120 words)..."}},
  "talking_points": ["point 1", "point 2", "point 3"]
}}
"""
    llm_response = await _gemini_json(system_prompt, user_prompt)

    if llm_response and all(key in llm_response for key in ["diagnosis", "recommended_action", "email_draft"]):
        state["recovery_play"] = llm_response
        return state

    # Local deterministic fallback.
    state["recovery_play"] = {
        "diagnosis": "The deal is losing momentum because recent engagement and progression are not aligned with close expectations.",
        "recommended_action": "Send a focused re-engagement note today and secure a concrete next-step meeting with at least one additional stakeholder.",
        "email_draft": {
            "subject": f"Quick next step on {deal_data.get('title')}",
            "body": (
                "Hi there,\n\n"
                "I want to make sure we keep momentum and align on the fastest path to value. "
                "Would you be open to a 20-minute working session this week to confirm scope, timeline, and stakeholders? "
                "I can also share a tailored rollout plan based on your current stage.\n\n"
                "Best,"
            ),
        },
        "talking_points": [
            "Confirm current buying timeline and close-date realism",
            "Identify one additional stakeholder to de-risk single-threading",
            "Agree on a dated next milestone with clear owner",
        ],
    }
    return state


def _highest_severity(risks: list[dict[str, Any]]) -> str:
    rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    top = "low"
    top_rank = 0
    for risk in risks:
        sev = str(risk.get("severity", "low")).lower()
        if rank.get(sev, 0) > top_rank:
            top_rank = rank.get(sev, 0)
            top = sev
    return top


def _risk_type_for_alert(risks: list[dict[str, Any]]) -> str:
    if not risks:
        return "silence"
    top = risks[0]
    return str(top.get("type", "silence"))


async def save_alert(state: DealState) -> DealState:
    db: AsyncSession = state["_db"]
    stmt = select(Deal).where(Deal.id == state["deal_id"], Deal.org_id == state["org_id"])
    deal = (await db.execute(stmt)).scalar_one()

    health_signal_dicts = [
        {"type": "health", "description": signal, "severity": "medium"}
        for signal in state.get("health_risk_signals", [])
    ]
    combined_risks = (state.get("detected_risks", []) or []) + health_signal_dicts

    deal.health_score = int(state.get("health_score", deal.health_score or 100))
    deal.risk_signals = combined_risks

    previous = state.get("previous_health_score")
    current = int(state.get("health_score", 100))
    if current < 50 and (previous is None or int(previous) >= 50):
        db.add(
            DealAlert(
                deal_id=deal.id,
                alert_type=_risk_type_for_alert(combined_risks),
                severity=_highest_severity(combined_risks),
                description=f"Deal analysis flagged risk; score dropped to {current}",
                recovery_play=json.dumps(state.get("recovery_play") or {}),
                status="open",
            )
        )

    await _log(
        db,
        state["org_id"],
        f"Deal analysis complete: {deal.title}, score: {current}",
        status="completed",
        metadata={"deal_id": state["deal_id"], "risk_level": state.get("risk_level")},
    )
    await db.commit()
    return state


def _next_after_score(state: DealState) -> str:
    if int(state.get("health_score", 100)) < 60:
        return "generate_recovery_play"
    return "save_alert"


def _compile_graph() -> Any:
    if StateGraph is None:
        return None

    graph = StateGraph(DealState)
    graph.add_node("fetch_deal_context", fetch_deal_context)
    graph.add_node("detect_risks", detect_risks)
    graph.add_node("calculate_score", calculate_score)
    graph.add_node("generate_recovery_play", generate_recovery_play)
    graph.add_node("save_alert", save_alert)

    graph.set_entry_point("fetch_deal_context")
    graph.add_edge("fetch_deal_context", "detect_risks")
    graph.add_edge("detect_risks", "calculate_score")
    graph.add_conditional_edges(
        "calculate_score",
        _next_after_score,
        {
            "generate_recovery_play": "generate_recovery_play",
            "save_alert": "save_alert",
        },
    )
    graph.add_edge("generate_recovery_play", "save_alert")
    graph.add_edge("save_alert", END)

    return graph.compile()


deal_intelligence_graph = _compile_graph()


async def analyze_deal(
    deal_id: str,
    org_id: str,
    db: AsyncSession,
    email_snippets: list[dict[str, Any]] | None = None,
) -> DealState:
    initial_state: DealState = {
        "deal_id": str(deal_id),
        "org_id": str(org_id),
        "email_snippets": email_snippets or [],
        "_db": db,
    }

    if deal_intelligence_graph is None:
        # Fallback linear flow when LangGraph is unavailable locally.
        state = await fetch_deal_context(initial_state)
        state = await detect_risks(state)
        state = await calculate_score(state)
        if int(state.get("health_score", 100)) < 60:
            state = await generate_recovery_play(state)
        state = await save_alert(state)
        state.pop("_db", None)
        return state

    state = await deal_intelligence_graph.ainvoke(initial_state)
    state.pop("_db", None)
    return state
