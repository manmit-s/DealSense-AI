from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from importlib import import_module
from typing import Any, TypedDict
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent_log import AgentLog
from models.battlecard import Battlecard
from models.deal import Deal

try:
    _langgraph = import_module("langgraph.graph")
    END = _langgraph.END
    StateGraph = _langgraph.StateGraph
except Exception:  # pragma: no cover - optional dependency in local setup
    END = "END"
    StateGraph = None


class CompetitiveState(TypedDict, total=False):
    org_id: str
    competitor_name: str
    competitor_domain: str
    search_results: list[dict[str, Any]]
    analysis: dict[str, Any]
    battlecard: dict[str, Any]
    deal_mentions: list[str]
    _db: Any


async def _log(
    db: AsyncSession,
    org_id: str,
    action: str,
    status: str = "running",
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AgentLog(
            org_id=UUID(str(org_id)),
            agent_type="competitive",
            action=action,
            status=status,
            metadata_info=metadata or {},
        )
    )
    await db.flush()


async def _serper_search(query: str) -> list[dict[str, str]]:
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        # Local fallback keeps flow usable without external keys.
        return [
            {
                "title": f"No live SERPER key for query: {query}",
                "snippet": "Using local fallback competitive summary.",
                "link": "",
            }
        ]

    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": 5}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("https://google.serper.dev/search", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return []

    organic = data.get("organic", []) or []
    return [
        {
            "title": str(item.get("title", "")),
            "snippet": str(item.get("snippet", "")),
            "link": str(item.get("link", "")),
        }
        for item in organic[:5]
    ]


def _extract_json_payload(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return None

    return None


async def _anthropic_json(system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1200,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
            if response.status_code != 200:
                return None
            data = response.json()
    except Exception:
        return None

    content = data.get("content", [])
    text = "\n".join(chunk.get("text", "") for chunk in content if chunk.get("type") == "text")
    return _extract_json_payload(text)


async def scrape_competitor(state: CompetitiveState) -> CompetitiveState:
    db: AsyncSession = state["_db"]
    competitor_name = state["competitor_name"]
    domain = state.get("competitor_domain", "")

    await _log(db, state["org_id"], f"Scraping intel on: {competitor_name}")

    queries = [
        f"{competitor_name} pricing plans 2024",
        f"{competitor_name} new features product update",
        f"{competitor_name} reviews complaints G2 Capterra",
    ]
    if domain:
        queries.append(f"{competitor_name} {domain} platform overview")

    results = await asyncio.gather(*[_serper_search(q) for q in queries])
    merged: list[dict[str, str]] = []
    for chunk in results:
        merged.extend(chunk[:5])

    state["search_results"] = merged[:15]
    return state


async def analyze_intel(state: CompetitiveState) -> CompetitiveState:
    competitor_name = state["competitor_name"]
    search_results = state.get("search_results", [])

    llm_response = await _anthropic_json(
        "You are a competitive intelligence analyst. Extract structured intel from search results. Return ONLY valid JSON.",
        f"""
Competitor: {competitor_name}
Search Results: {json.dumps(search_results)}

Extract and return JSON:
{{
  "pricing_intel": "What we know about their pricing (or 'Unknown' if not found)",
  "recent_features": ["feature1", "feature2"],
  "customer_complaints": ["complaint1", "complaint2", "complaint3"],
  "perceived_strengths": ["strength1", "strength2"],
  "market_positioning": "One sentence on how they position themselves"
}}
""",
    )

    if llm_response:
        state["analysis"] = {
            "pricing_intel": str(llm_response.get("pricing_intel", "Unknown")),
            "recent_features": list(llm_response.get("recent_features", []))[:5],
            "customer_complaints": list(llm_response.get("customer_complaints", []))[:5],
            "perceived_strengths": list(llm_response.get("perceived_strengths", []))[:5],
            "market_positioning": str(llm_response.get("market_positioning", "")),
        }
        return state

    # Heuristic fallback for local flow.
    snippets = " ".join(item.get("snippet", "") for item in search_results).lower()
    state["analysis"] = {
        "pricing_intel": "Pricing appears tiered; exact pricing requires deeper validation." if snippets else "Unknown",
        "recent_features": ["AI-assisted workflows", "Expanded integration catalog"],
        "customer_complaints": ["Steep pricing at higher tiers", "Support response delay"],
        "perceived_strengths": ["Brand familiarity", "Enterprise buying confidence"],
        "market_positioning": f"{competitor_name} positions as a broad sales platform with enterprise depth.",
    }
    return state


async def generate_battlecard(state: CompetitiveState) -> CompetitiveState:
    competitor_name = state["competitor_name"]
    intel = state.get("analysis", {})

    llm_response = await _anthropic_json(
        "You are a sales enablement expert writing battlecards for a SaaS sales team. Return ONLY valid JSON.",
        f"""
Competitor: {competitor_name}
Intel: {json.dumps(intel)}
Our strengths: [Fast implementation, Superior AI features, Better integrations, Dedicated support]

Return JSON:
{{
  "overview": "2-sentence neutral summary of competitor",
  "their_strengths": ["strength1", "strength2", "strength3"],
  "their_weaknesses": ["weakness1", "weakness2", "weakness3"],
  "how_we_win": ["differentiator1", "differentiator2", "differentiator3"],
  "key_differentiators": ["point1", "point2"],
  "objection_handlers": [
    {{"objection": "...", "response": "..."}},
    {{"objection": "...", "response": "..."}},
    {{"objection": "...", "response": "..."}}
  ]
}}
""",
    )

    if llm_response:
        state["battlecard"] = {
            "overview": str(llm_response.get("overview", "")),
            "their_strengths": list(llm_response.get("their_strengths", []))[:6],
            "their_weaknesses": list(llm_response.get("their_weaknesses", []))[:6],
            "how_we_win": list(llm_response.get("how_we_win", []))[:6],
            "key_differentiators": list(llm_response.get("key_differentiators", []))[:6],
            "objection_handlers": list(llm_response.get("objection_handlers", []))[:8],
        }
        return state

    # Local fallback battlecard.
    state["battlecard"] = {
        "overview": f"{competitor_name} is a recognized player with broad market awareness. Their narrative focuses on scale and platform breadth.",
        "their_strengths": ["Recognized brand", "Large integration footprint", "Enterprise familiarity"],
        "their_weaknesses": ["Longer implementation cycles", "Less tailored AI workflows", "Higher cost at scale"],
        "how_we_win": ["Faster go-live", "Sharper AI-native playbooks", "Hands-on support"],
        "key_differentiators": ["Outcome-first onboarding", "Deal-specific AI recommendations"],
        "objection_handlers": [
            {
                "objection": f"{competitor_name} is more established.",
                "response": "Established does not always mean faster results. We prioritize speed-to-value with guided implementation in days, not months.",
            },
            {
                "objection": f"{competitor_name} has more features.",
                "response": "Feature count matters less than adoption. Our focused workflows improve execution quality for pipeline and risk management.",
            },
            {
                "objection": "Switching platforms is risky.",
                "response": "We de-risk migration with phased rollout, side-by-side validation, and direct support throughout onboarding.",
            },
        ],
    }
    return state


async def detect_deal_mentions(state: CompetitiveState) -> CompetitiveState:
    db: AsyncSession = state["_db"]
    org_id = UUID(str(state["org_id"]))
    competitor = state["competitor_name"].lower()

    stmt = select(Deal).where(
        Deal.org_id == org_id,
        Deal.stage.notin_(["Closed Won", "Closed Lost"]),
    )
    deals = (await db.execute(stmt)).scalars().all()

    mentions: list[str] = []
    for deal in deals:
        found = False
        for signal in deal.risk_signals or []:
            if isinstance(signal, dict):
                text = f"{signal.get('type', '')} {signal.get('description', '')}".lower()
            else:
                text = str(signal).lower()

            if competitor in text:
                found = True
                break

        if found:
            mentions.append(deal.title)

    state["deal_mentions"] = mentions
    return state


async def save_and_notify(state: CompetitiveState) -> CompetitiveState:
    db: AsyncSession = state["_db"]
    org_id = UUID(str(state["org_id"]))
    competitor_name = state["competitor_name"]
    battlecard = state.get("battlecard", {})
    analysis = state.get("analysis", {})
    mentions = state.get("deal_mentions", [])

    stmt = select(Battlecard).where(
        Battlecard.org_id == org_id,
        Battlecard.competitor_name.ilike(competitor_name),
    )
    existing = (await db.execute(stmt)).scalars().first()

    strengths = "\n".join(battlecard.get("their_strengths", []))
    weaknesses = "\n".join(battlecard.get("their_weaknesses", []))
    positioning = (
        f"Overview: {battlecard.get('overview', '')}\n"
        f"Market Positioning: {analysis.get('market_positioning', '')}\n"
        f"Pricing Intel: {analysis.get('pricing_intel', 'Unknown')}\n"
        f"How We Win: {', '.join(battlecard.get('how_we_win', []))}"
    )

    payload_handlers = list(battlecard.get("objection_handlers", []))
    payload_handlers.append(
        {
            "meta": {
                "key_differentiators": battlecard.get("key_differentiators", []),
                "recent_features": analysis.get("recent_features", []),
                "customer_complaints": analysis.get("customer_complaints", []),
                "deal_mentions": mentions,
            }
        }
    )

    if existing:
        existing.strengths = strengths
        existing.weaknesses = weaknesses
        existing.positioning = positioning
        existing.objection_handlers = payload_handlers
        existing.last_updated = datetime.utcnow()
    else:
        db.add(
            Battlecard(
                org_id=org_id,
                competitor_name=competitor_name,
                strengths=strengths,
                weaknesses=weaknesses,
                positioning=positioning,
                objection_handlers=payload_handlers,
            )
        )

    # Notify Slack when competitor appears in active deals.
    if mentions and os.getenv("SLACK_WEBHOOK_URL"):
        message_lines = [f"⚔️ {competitor_name} mentioned in active deals:"] + [f"- {name}" for name in mentions]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(os.getenv("SLACK_WEBHOOK_URL", ""), json={"text": "\n".join(message_lines)})
        except Exception:
            pass

    await _log(
        db,
        state["org_id"],
        f"Competitive analysis complete: {competitor_name}",
        status="completed",
        metadata={"deal_mentions": mentions, "mentions_count": len(mentions)},
    )

    await db.commit()
    return state


def _compile_graph() -> Any:
    if StateGraph is None:
        return None

    graph = StateGraph(CompetitiveState)
    graph.add_node("scrape_competitor", scrape_competitor)
    graph.add_node("analyze_intel", analyze_intel)
    graph.add_node("generate_battlecard", generate_battlecard)
    graph.add_node("detect_deal_mentions", detect_deal_mentions)
    graph.add_node("save_and_notify", save_and_notify)

    graph.set_entry_point("scrape_competitor")
    graph.add_edge("scrape_competitor", "analyze_intel")
    graph.add_edge("analyze_intel", "generate_battlecard")
    graph.add_edge("generate_battlecard", "detect_deal_mentions")
    graph.add_edge("detect_deal_mentions", "save_and_notify")
    graph.add_edge("save_and_notify", END)

    return graph.compile()


competitive_graph = _compile_graph()


async def run_competitive_agent(
    org_id: str,
    competitor_name: str,
    competitor_domain: str,
    db: AsyncSession,
) -> CompetitiveState:
    initial_state: CompetitiveState = {
        "org_id": str(org_id),
        "competitor_name": competitor_name,
        "competitor_domain": competitor_domain,
        "_db": db,
    }

    if competitive_graph is None:
        state = await scrape_competitor(initial_state)
        state = await analyze_intel(state)
        state = await generate_battlecard(state)
        state = await detect_deal_mentions(state)
        state = await save_and_notify(state)
        state.pop("_db", None)
        return state

    state = await competitive_graph.ainvoke(initial_state)
    state.pop("_db", None)
    return state
