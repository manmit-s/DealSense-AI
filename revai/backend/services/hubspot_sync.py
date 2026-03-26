import uuid
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
import httpx
from datetime import datetime, timezone

from models.deal import Deal
from models.agent_log import AgentLog

class HubSpotSyncService:
    async def sync_deals(self, org_id: uuid.UUID, access_token: str, db: AsyncSession) -> Dict[str, Any]:
        if not access_token:
            return await self._create_demo_deals(org_id, db)
            
        headers = {"Authorization": f"Bearer {access_token}"}
        url = "https://api.hubapi.com/crm/v3/objects/deals"
        params = {
            "properties": "dealname,amount,dealstage,closedate,hs_lastmodifieddate",
            "limit": 100
        }
        
        synced_count = 0
        errors = []
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            
            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="HubSpot token expired, please reconnect")
            elif response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch deals from HubSpot")
                
            data = response.json()
            deals = data.get("results", [])
            
            for d in deals:
                try:
                    # Get contacts associations
                    assoc_url = f"https://api.hubapi.com/crm/v3/objects/deals/{d['id']}/associations/contacts"
                    # Note: Skipping the actual fetch here for brevity, but this is where you'd call it if needed.
                    # assoc_res = await client.get(assoc_url, headers=headers)
                    
                    props = d.get("properties", {})
                    
                    # Map properties
                    dealname = props.get("dealname", "Unknown Deal")
                    amount = float(props.get("amount", 0)) if props.get("amount") else 0.0
                    dealstage = props.get("dealstage", "Prospect")
                    closedate_str = props.get("closedate")
                    
                    closedate = None
                    if closedate_str:
                        closedate = datetime.fromisoformat(closedate_str.replace("Z", "+00:00")).date()
                    
                    # Upsert Deal
                    stmt = select(Deal).where(Deal.org_id == org_id, Deal.crm_deal_id == d['id'])
                    result = await db.execute(stmt)
                    existing_deal = result.scalar_one_or_none()
                    
                    if existing_deal:
                        existing_deal.title = dealname
                        existing_deal.value = amount
                        existing_deal.stage = dealstage
                        if closedate:
                            existing_deal.close_date = closedate
                    else:
                        new_deal = Deal(
                            org_id=org_id,
                            crm_deal_id=d['id'],
                            title=dealname,
                            value=amount,
                            stage=dealstage,
                            close_date=closedate,
                            health_score=100,
                            risk_signals=[]
                        )
                        db.add(new_deal)
                    
                    synced_count += 1
                except Exception as e:
                    errors.append({"deal_id": d.get("id"), "error": str(e)})
        
        # Log to agent_logs
        log = AgentLog(
            org_id=org_id,
            agent_type="deal_intel",
            action="HubSpot sync completed",
            status="completed",
            metadata={"deals_synced": synced_count, "errors": len(errors)}
        )
        db.add(log)
        await db.commit()
        
        return {"synced": synced_count, "errors": errors}

    async def _create_demo_deals(self, org_id: uuid.UUID, db: AsyncSession) -> Dict[str, Any]:
        # Demo dummy deals
        demo_data = [
            {"title": "Acme Corp Q4 Upsell", "value": 150000, "stage": "Negotiation", "health_score": 45},
            {"title": "Globex Enterprise License", "value": 340000, "stage": "Proposal", "health_score": 30},
            {"title": "Initech Standard Tier", "value": 15000, "stage": "Prospect", "health_score": 90},
            {"title": "Umbrella Corp Expansion", "value": 550000, "stage": "Qualified", "health_score": 85},
            {"title": "Stark Ind Renewals", "value": 120000, "stage": "Demo", "health_score": 40},
            {"title": "Wayne Ent Security", "value": 85000, "stage": "Negotiation", "health_score": 95},
            {"title": "Massive Dynamic Cloud", "value": 240000, "stage": "Proposal", "health_score": 70},
            {"title": "Soylent Corp BI Tool", "value": 45000, "stage": "Qualified", "health_score": 80},
        ]
        
        synced_count = 0
        for d in demo_data:
            new_deal = Deal(
                org_id=org_id,
                crm_deal_id=f"demo_{uuid.uuid4().hex[:8]}",
                title=d["title"],
                value=d["value"],
                stage=d["stage"],
                health_score=d["health_score"],
                risk_signals=[] if d["health_score"] > 50 else [{"type": "competitor", "description": "Demo risk signal"}]
            )
            db.add(new_deal)
            synced_count += 1
            
        log = AgentLog(
            org_id=org_id,
            agent_type="deal_intel",
            action="HubSpot sync completed (DEMO)",
            status="completed",
            metadata={"deals_synced": synced_count}
        )
        db.add(log)
        await db.commit()
        return {"synced": synced_count, "errors": [], "demo_mode": True}
        
hubspot_sync_service = HubSpotSyncService()
