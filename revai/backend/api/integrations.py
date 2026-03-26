from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette.responses import RedirectResponse
import os

from database import get_db
from models.user import User
from models.user import Organization
from utils.auth import get_current_user

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

HUBSPOT_CLIENT_ID = os.getenv("HUBSPOT_CLIENT_ID", "demo_client_id")
HUBSPOT_REDIRECT_URI = "http://localhost:8000/api/integrations/hubspot/callback"

@router.get("/hubspot/connect")
async def hubspot_connect(current_user: User = Depends(get_current_user)):
    # Scope definitions for what RevAI needs
    scopes = "crm.objects.deals.read crm.objects.contacts.read"
    auth_url = (
        f"https://app.hubspot.com/oauth/authorize"
        f"?client_id={HUBSPOT_CLIENT_ID}"
        f"&redirect_uri={HUBSPOT_REDIRECT_URI}"
        f"&scope={scopes}"
        f"&state={current_user.org_id}" # Used to identify the org on callback
    )
    return {"url": auth_url}

@router.get("/hubspot/callback")
async def hubspot_callback(
    code: str, 
    state: str = None, 
    db: AsyncSession = Depends(get_db)
):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")
        
    org_id = state
    # In a real app we'd exchange `code` for an access_token using HubSpot's oauth endpoint.
    # For demo purposes, we will mock the logic.
    mock_access_token = f"hubspot_mock_token_{code}"
    
    stmt = select(Organization).where(Organization.id == org_id)
    result = await db.execute(stmt)
    org = result.scalar_one_or_none()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    org.hubspot_access_token = mock_access_token
    org.crm_type = "hubspot"
    
    await db.commit()
    
    return RedirectResponse(url="http://localhost:3000/dashboard/integrations?status=success")
