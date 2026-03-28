import os
import json
import logging
from typing import Any, TypedDict, Annotated, List, Optional
from langgraph.graph import StateGraph, END
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from apify_client import ApifyClientAsync
from sqlalchemy.future import select

# To use async db queries inside the agent
from database import AsyncSessionLocal
from models.prospect import Prospect, Sequence
from models.agent_log import AgentLog
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class SequenceStep(BaseModel):
    subject: str = Field(description="The subject line of the email")
    body: str = Field(description="The body content of the email")
    delay_days: int = Field(description="Days to wait before sending this step")

class ICPFitResult(BaseModel):
    score: int = Field(description="ICP Match Score from 0 to 100")
    fit_signals: List[str] = Field(description="List of positive or negative fit signals identified")

class SequenceResult(BaseModel):
    steps: List[SequenceStep]

class ProspectState(TypedDict):
    prospect_id: str
    org_id: str
    company_name: str
    domain: str
    contact_name: str
    contact_email: str
    icp_config: str
    
    # State updated by nodes:
    company_summary: str
    contact_role: str
    contact_pain_points: str
    icp_score: int
    fit_signals: List[str]
    sequence_steps: List[dict]


# ---------------------------------------------
# NODES
# ---------------------------------------------

async def research_company(state: ProspectState):
    """
    Node 1 — research_company
    Call Tavily API: "{company_name} news funding team size"
    Parse top 5 results into company summary
    """
    company_name = state["company_name"]
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    summary = f"Company: {company_name}. No public news or funding data found."
    
    if tavily_api_key:
        try:
            tool = TavilySearchResults(max_results=5, tavily_api_key=tavily_api_key)
            results = await tool.ainvoke(f"{company_name} news funding team size")

            snippets: list[str] = []
            for item in results if isinstance(results, list) else []:
                if isinstance(item, dict):
                    text = item.get("content") or item.get("snippet") or ""
                    if text:
                        snippets.append(str(text))

            if snippets:
                summary = f"Search highlights for {company_name}:\n" + "\n".join(snippets[:5])
        except Exception as e:
            logger.error(f"Error researching company: {e}")

    return {"company_summary": summary}


async def enrich_contact(state: ProspectState):
    """
    Node 2 — enrich_contact
    Use Apify enrichment/search to gather role and likely pain points
    Extract: role, tenure, likely pain points
    """
    contact_name = state["contact_name"]
    company_name = state["company_name"]
    apify_api_token = os.getenv("APIFY_API_TOKEN")
    
    # Default mock
    role = "Decision Maker (Simulated)"
    pain_points = "Improving operational efficiency, reducing costs."

    if apify_api_token:
        try:
            client = ApifyClientAsync(apify_api_token)
            run_input = {
                "queries": f"{contact_name} {company_name} LinkedIn",
                "maxPagesPerQuery": 1,
                "resultsPerPage": 5,
            }
            run = await client.actor("apify/google-search-scraper").call(run_input=run_input)

            dataset_id = run.get("defaultDatasetId") if isinstance(run, dict) else None
            if dataset_id:
                dataset_items = await client.dataset(dataset_id).list_items()
                items = dataset_items.get("items", []) if isinstance(dataset_items, dict) else []

                organic_results: list[dict[str, Any]] = []
                for item in items:
                    if isinstance(item, dict):
                        organic = item.get("organicResults")
                        if isinstance(organic, list):
                            organic_results.extend([x for x in organic if isinstance(x, dict)])

                if organic_results:
                    first_result = organic_results[0]
                    snippet = str(
                        first_result.get("description")
                        or first_result.get("snippet")
                        or ""
                    )
                    title = str(first_result.get("title") or "")
                    role = title.split("-")[0].strip() if "-" in title else (title or role)
                    if snippet:
                        pain_points = f"Derived from Apify search snippet: {snippet}"
        except Exception as e:
            logger.error(f"Error enriching contact: {e}")

    return {
        "contact_role": role,
        "contact_pain_points": pain_points
    }


async def score_icp_fit(state: ProspectState):
    """
    Node 3 — score_icp_fit
    Call Claude with ICP config + research summary
    Return: `score` (int 0–100), `fit_signals` (list of strings)
    """
    llm = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
        temperature=0,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    structured_llm = llm.with_structured_output(ICPFitResult)
    
    prompt = f"""
    Please evaluate the following prospect against our Ideal Customer Profile (ICP).
    
    ICP Configuration:
    {state.get('icp_config', 'B2B Software companies looking to scale sales.')}
    
    Company Research:
    {state.get('company_summary')}
    
    Contact Role/Info:
    {state.get('contact_role')}
    {state.get('contact_pain_points')}
    
    Provide an ICP fit score from 0-100, and a list of specific fit signals (positive or negative).
    """
    try:
        result: ICPFitResult = await structured_llm.ainvoke([HumanMessage(content=prompt)])
        return {
            "icp_score": result.score,
            "fit_signals": result.fit_signals
        }
    except Exception as e:
        logger.error(f"Error evaluating ICP Fit: {e}")
        return {
            "icp_score": 50,  # default fallback
            "fit_signals": ["Failed to parse AI response. Used fallback score."]
        }


def should_generate_sequence(state: ProspectState) -> str:
    """Conditional edge: Only generate sequence if score > 30"""
    return "generate_sequence" if state.get("icp_score", 0) > 30 else "save_results"


async def generate_sequence(state: ProspectState):
    """
    Node 4 — generate_sequence
    Call Claude with full prospect context
    Return: 3-step sequence array [{subject, body, delay_days}]
    """
    llm = ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-1.5-pro"),
        temperature=0.7,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )
    structured_llm = llm.with_structured_output(SequenceResult)
    
    prompt = f"""
    You are an expert SDR writing a highly personalized cold email sequence.
    Write a 3-step email sequence for the following prospect:
    
    Name: {state['contact_name']}
    Role: {state.get('contact_role')}
    Email: {state['contact_email']}
    Company: {state['company_name']}
    Pain Points: {state.get('contact_pain_points')}
    
    Company Context:
    {state.get('company_summary')}
    
    The emails should be conversational, short, and focused on value.
    """
    
    try:
        result: SequenceResult = await structured_llm.ainvoke([HumanMessage(content=prompt)])
        steps_dict = [step.model_dump() for step in result.steps]
        return {"sequence_steps": steps_dict}
    except Exception as e:
        logger.error(f"Error generating sequence: {e}")
        fallback_steps = [
            {"subject": "Exploring synergies", "body": "Hi there, let's connect.", "delay_days": 0},
            {"subject": "Following up", "body": "Any thoughts?", "delay_days": 3},
            {"subject": "Parting ways", "body": "I'll close the file.", "delay_days": 5},
        ]
        return {"sequence_steps": fallback_steps}


async def save_results(state: ProspectState):
    """
    Node 5 — save_results
    Upsert prospect + create sequence record
    Log to `agent_logs`
    """
    prospect_id = state["prospect_id"]
    org_id = state.get("org_id")
    
    async with AsyncSessionLocal() as session:
        try:
            # Upsert/Update Prospect
            stmt = select(Prospect).where(Prospect.id == prospect_id)
            result = await session.execute(stmt)
            prospect = result.scalars().first()
            
            if prospect:
                prospect.icp_score = state.get("icp_score")
                prospect.fit_signals = state.get("fit_signals", [])
                
                status = "qualified" if prospect.icp_score and prospect.icp_score > 30 else "disqualified"
                prospect.status = status
                
                # Create Sequence if generated
                sequence_steps = state.get("sequence_steps")
                if sequence_steps and status == "qualified":
                    new_seq = Sequence(
                        prospect_id=prospect.id,
                        steps=sequence_steps,
                        status="draft",
                        current_step=0
                    )
                    session.add(new_seq)
                
                # Create Agent Log
                log = AgentLog(
                    org_id=prospect.org_id,
                    agent_type="ProspectingAgent",
                    action=f"Researched prospect {prospect.company_name} (Score: {prospect.icp_score})",
                    status="completed",
                    metadata_info={
                        "prospect_id": str(prospect.id),
                        "score": prospect.icp_score,
                        "signals": prospect.fit_signals,
                        "generated_sequence": bool(sequence_steps)
                    }
                )
                session.add(log)
                
                await session.commit()
        except Exception as e:
            logger.error(f"Database error in save_results: {e}")
            await session.rollback()

    return {}


# ---------------------------------------------
# GRAPH CONSTRUCTION
# ---------------------------------------------

def build_prospecting_graph():
    workflow = StateGraph(ProspectState)

    # Add nodes
    workflow.add_node("research_company", research_company)
    workflow.add_node("enrich_contact", enrich_contact)
    workflow.add_node("score_icp_fit", score_icp_fit)
    workflow.add_node("generate_sequence", generate_sequence)
    workflow.add_node("save_results", save_results)

    # Build edges
    workflow.set_entry_point("research_company")
    workflow.add_edge("research_company", "enrich_contact")
    workflow.add_edge("enrich_contact", "score_icp_fit")
    
    # Conditional logic
    workflow.add_conditional_edges(
        "score_icp_fit",
        should_generate_sequence,
        {
            "generate_sequence": "generate_sequence",
            "save_results": "save_results"
        }
    )
    
    workflow.add_edge("generate_sequence", "save_results")
    workflow.add_edge("save_results", END)

    return workflow.compile()

# Instantiated graph to be imported by celery or FastAPI routers
prospecting_agent_graph = build_prospecting_graph()
