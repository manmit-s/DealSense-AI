from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from database import get_db
from models.deal import Deal
from models.user import User
from utils.auth import get_current_user
from schemas.deals import DealResponse, DealStageUpdate

router = APIRouter(prefix="/api/deals", tags=["deals"])

@router.get("", response_model=List[DealResponse])
async def get_deals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deals = result.scalars().all()
    return deals

@router.get("/{id}", response_model=DealResponse)
async def get_deal(
    id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.id == id, Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

@router.patch("/{id}/stage", response_model=DealResponse)
async def update_deal_stage(
    id: str,
    update_data: DealStageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Deal).where(Deal.id == id, Deal.org_id == current_user.org_id)
    result = await db.execute(stmt)
    deal = result.scalar_one_or_none()
    
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    deal.stage = update_data.stage
    await db.commit()
    await db.refresh(deal)
    
    return deal
