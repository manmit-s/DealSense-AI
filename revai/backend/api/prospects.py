from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from database import get_db
from models.prospect import Prospect, Sequence
from schemas.prospects import ProspectResearchRequest, ProspectResponse
from utils.auth import get_current_user
from models.user import User

from tasks import run_prospect_research

router = APIRouter(prefix="/api/prospects", tags=["prospects"])

@router.post("/research")
async def research_prospect(
    request: ProspectResearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Create prospect first in pending state
    new_prospect = Prospect(
        org_id=current_user.org_id,
        company_name=request.company_name,
        domain=request.domain,
        contact_name=request.contact_name,
        contact_email=request.contact_email,
        status="researching"
    )
    db.add(new_prospect)
    await db.commit()
    await db.refresh(new_prospect)

    icp_config = "B2B Software companies looking to scale sales." # Could be fetched from org settings
    
    # Dispatch celery task
    task = run_prospect_research.delay(
        prospect_id=str(new_prospect.id),
        org_id=str(current_user.org_id),
        company_name=request.company_name,
        domain=request.domain,
        contact_name=request.contact_name,
        contact_email=request.contact_email,
        icp_config=icp_config
    )
    
    return {"task_id": task.id, "prospect_id": str(new_prospect.id)}

@router.get("", response_model=List[ProspectResponse])
async def list_prospects(
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Prospect).where(Prospect.org_id == current_user.org_id)
    if status:
        query = query.where(Prospect.status == status)
    if min_score is not None:
        query = query.where(Prospect.icp_score >= min_score)
        
    result = await db.execute(query)
    prospects = result.scalars().all()
    return prospects

@router.get("/{id}")
async def get_prospect_detail(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Prospect).options(selectinload(Prospect.sequences)).where(
        Prospect.id == id,
        Prospect.org_id == current_user.org_id
    )
    result = await db.execute(query)
    prospect = result.scalars().first()
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
        
    return prospect

@router.patch("/{id}/approve")
async def approve_prospect_sequence(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Sequence).join(Prospect).where(
        Sequence.prospect_id == id,
        Prospect.org_id == current_user.org_id
    )
    result = await db.execute(query)
    sequences = result.scalars().all()
    
    if not sequences:
        raise HTTPException(status_code=404, detail="Sequence not found for prospect")
        
    # Assume first sequence
    sequence = sequences[0]
    sequence.status = "approved"
    
    await db.commit()
    return {"status": "success"}
