from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models.user import User, Organization
from schemas.auth import UserCreate, UserLogin, TokenResponse, UserResponse
from utils.auth import create_access_token, get_password_hash, verify_password, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    # Create Organization
    org = Organization(name=user_data.org_name)
    db.add(org)
    await db.flush()
    
    # Create User
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        org_id=org.id,
        password_hash=get_password_hash(user_data.password),
        role="admin"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Create Token
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
