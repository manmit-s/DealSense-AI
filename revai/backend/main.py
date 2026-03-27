from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from api import auth, crm, integrations, dashboard, deals

app = FastAPI(title="RevAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(crm.router)
app.include_router(integrations.router)
app.include_router(dashboard.router)
app.include_router(deals.router)

@app.on_event("startup")
async def startup_event():
    # Allow API boot without Docker DB so health routes can still be tested locally.
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        print(f"[startup] Database unavailable, continuing without init: {exc}")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "revai"}