# 🤖 RevAI — Implementation Prompt Guide
### ETH India Hackathon | Ready-to-Use Prompts for Every Build Step

---

## How to Use This Guide

1. Each prompt is **ready to paste** into Cursor, Claude, or your IDE AI assistant
2. Replace anything in `[BRACKETS]` with your actual values
3. Prompts are ordered — each builds on the previous
4. Copy the entire prompt block including context for best results
5. After each prompt, verify output before moving to next

---

# PHASE 0 PROMPTS — Setup & Architecture

---

## P0.1 — Monorepo & Docker Setup

```
Create a full-stack monorepo project called "revai" for an AI-powered sales platform.

PROJECT STRUCTURE:
/revai
  /frontend      ← Next.js 14 App Router, TypeScript
  /backend       ← FastAPI Python
  /docker-compose.yml
  /.env.example
  /README.md

DOCKER COMPOSE (docker-compose.yml):
Create a docker-compose.yml with 4 services:
1. postgres: image postgres:15-alpine, port 5432, env POSTGRES_DB=revai POSTGRES_USER=revai POSTGRES_PASSWORD=password, named volume
2. redis: image redis:7-alpine, port 6379
3. backend: build from ./backend, port 8000, depends on postgres+redis, volume mount for hot reload, env_file .env
4. frontend: build from ./frontend, port 3000, depends on backend, volume mount, env_file .env

ENV EXAMPLE (.env.example):
DATABASE_URL=postgresql://revai:password@postgres:5432/revai
REDIS_URL=redis://redis:6379
GEMINI_API_KEY=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
TAVILY_API_KEY=
APIFY_API_TOKEN=
SLACK_WEBHOOK_URL=
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

BACKEND Dockerfile:
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FRONTEND Dockerfile:
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

README.md: Include setup steps: clone, copy .env.example to .env, fill in API keys, docker-compose up
```

---

## P0.2 — Database Schema & Migration

```
Create a complete PostgreSQL database schema for RevAI — an AI sales operations platform.

Use SQLAlchemy ORM models and Alembic migrations.

Create these files:
1. /backend/models/base.py — SQLAlchemy declarative base + timestamp mixin
2. /backend/models/user.py — User and Organization models
3. /backend/models/prospect.py — Prospect and Sequence models  
4. /backend/models/deal.py — Deal and DealAlert models
5. /backend/models/account.py — Account model (for retention)
6. /backend/models/battlecard.py — Battlecard model
7. /backend/models/agent_log.py — AgentLog model
8. /backend/alembic/versions/001_initial.py — Alembic migration creating all tables

EXACT COLUMNS:

users: id (UUID PK), email (unique), name, org_id (FK organizations), role (admin/member), password_hash, created_at

organizations: id (UUID PK), name, crm_type (hubspot/salesforce/none), hubspot_access_token (nullable), created_at

prospects: id (UUID PK), org_id (FK), company_name, domain, contact_name, contact_email, contact_linkedin (nullable), icp_score (int 0-100 nullable), status (researching/qualified/low_fit/sequence_sent), fit_signals (JSONB default []), created_at

sequences: id (UUID PK), prospect_id (FK), steps (JSONB — array of {subject, body, delay_days}), status (draft/approved/active/completed), current_step (int default 0), created_at

deals: id (UUID PK), org_id (FK), crm_deal_id (nullable, for HubSpot), title, value (numeric), stage, close_date (date), health_score (int default 100), risk_signals (JSONB default []), last_contact_date (date nullable), assigned_to (nullable), created_at

deal_alerts: id (UUID PK), deal_id (FK deals), alert_type (silence/competitor/stakeholder/budget), severity (low/medium/high/critical), description text, recovery_play text (nullable), status (open/acknowledged/resolved), created_at

accounts: id (UUID PK), org_id (FK), company_name, mrr (numeric), contract_end_date (date nullable), churn_score (int default 0), churn_reason text (nullable), usage_data JSONB (default {}), intervention_status (none/triggered/completed), created_at

battlecards: id (UUID PK), org_id (FK), competitor_name, strengths text, weaknesses text, positioning text, objection_handlers JSONB (default []), last_updated timestamp

agent_logs: id (UUID PK), org_id (FK), agent_type (prospecting/deal_intel/retention/competitive), action text, status (running/completed/failed), metadata JSONB (default {}), created_at

Use UUID for all PKs (import from sqlalchemy.dialects.postgresql import UUID). Include proper indexes on org_id columns. Include cascade deletes where appropriate.
```

---

## P0.3 — FastAPI Boilerplate + JWT Auth

```
Create a complete FastAPI backend boilerplate for RevAI with JWT authentication.

FILES TO CREATE:
1. /backend/main.py
2. /backend/database.py
3. /backend/utils/auth.py
4. /backend/api/auth.py
5. /backend/schemas/auth.py

MAIN.PY:
- FastAPI app with title "RevAI API"
- CORS middleware: allow origins ["http://localhost:3000"], allow all methods/headers/credentials
- Include routers: auth, dashboard, prospects, deals, retention, competitive
- Health check: GET / returns {"status": "ok", "service": "revai"}
- Startup: create DB tables if not exist (for development)

DATABASE.PY:
- Async SQLAlchemy engine using DATABASE_URL from env
- AsyncSession factory
- get_db dependency function (async generator)

UTILS/AUTH.PY:
- SECRET_KEY from env (NEXTAUTH_SECRET)
- Algorithm: HS256, token expiry: 24 hours
- create_access_token(data: dict) → str
- verify_token(token: str) → dict (raises HTTPException 401 if invalid)
- get_current_user dependency: extracts Bearer token from Authorization header, returns User object

API/AUTH.PY:
- POST /api/auth/register: accepts {email, name, password, org_name}, creates Organization + User, hashes password with bcrypt, returns {access_token, token_type, user}
- POST /api/auth/login: accepts {email, password}, validates credentials, returns {access_token, token_type, user}
- GET /api/auth/me: protected, returns current user data

SCHEMAS/AUTH.PY:
- UserCreate: email, name, password, org_name
- UserLogin: email, password
- TokenResponse: access_token, token_type, user (nested UserResponse)
- UserResponse: id, email, name, org_id, role

All routes use proper HTTPExceptions with descriptive messages. Use passlib with bcrypt for password hashing.
```

---

## P0.4 — Next.js App Shell with Authentication

```
Create a complete Next.js 14 App Router shell for RevAI dashboard with NextAuth.js v5 authentication.

REQUIREMENTS:
- Dark "mission control" theme throughout
- All /dashboard/* routes protected — redirect to /auth/login if not authenticated

FILES TO CREATE:

1. /app/layout.tsx — root layout, includes SessionProvider, Google Fonts import (Space Mono + DM Sans)
2. /app/globals.css — CSS variables for the design system:
   --bg-base: #0A0B0F
   --bg-surface: #111318
   --bg-elevated: #1A1D26
   --border: #232630
   --accent-primary: #00E5FF
   --accent-success: #00C853
   --accent-warning: #FFB300
   --accent-danger: #FF1744
   --accent-purple: #7C3AED
   --text-primary: #F0F2F8
   --text-secondary: #8B92A8
   --text-muted: #4A5168

3. /auth.ts — NextAuth config with Credentials provider, calls POST http://localhost:8000/api/auth/login, JWT strategy

4. /middleware.ts — protect /dashboard/* routes, redirect to /auth/login

5. /app/auth/login/page.tsx — login page:
   - Centered card on dark background
   - RevAI logo/wordmark at top
   - Email + password inputs (shadcn Input)
   - "Sign In" button (cyan accent)
   - On submit: call signIn("credentials"), redirect to /dashboard/overview

6. /app/dashboard/layout.tsx — dashboard shell layout:
   - Left sidebar (240px) with nav links: Overview, Prospects, Deals, Retention, Competitive, Integrations, Settings
   - Top bar with: RevAI wordmark, global search input, notification bell icon, user avatar + name
   - Main content area: flex-1, overflow-auto, bg-base

7. /components/layout/Sidebar.tsx — collapsible sidebar:
   - Links: Overview (Home icon), Prospects (Users icon), Deals (BarChart icon), Retention (TrendingDown icon), Competitive (Swords icon)
   - Active link: cyan text + bg-elevated
   - Collapse button at bottom

8. Placeholder pages for: /dashboard/overview, /dashboard/prospects, /dashboard/deals, /dashboard/retention, /dashboard/competitive — each just shows the page title for now

Include tailwind.config.js with custom colors matching the CSS variables and font families.
```

---

# PHASE 1 PROMPTS — Dashboard & CRM Layer

---

## P1.1 — HubSpot Sync Service

```
Create a HubSpot CRM sync service for RevAI in Python.

FILE: /backend/services/hubspot_sync.py

REQUIREMENTS:
Use httpx for async HTTP. Use SQLAlchemy async sessions.

CLASS: HubSpotSyncService

METHOD: async sync_deals(org_id: UUID, access_token: str)
1. Call HubSpot API: GET https://api.hubapi.com/crm/v3/objects/deals
   Headers: Authorization: Bearer {access_token}
   Params: properties=dealname,amount,dealstage,closedate,hs_lastmodifieddate, limit=100
2. For each deal, call GET https://api.hubapi.com/crm/v3/objects/deals/{id}/associations/contacts
3. Upsert into deals table: use crm_deal_id as unique key (insert or update on conflict)
   Map: dealname→title, amount→value, dealstage→stage, closedate→close_date
4. Log completed sync to agent_logs: agent_type="deal_intel", action="HubSpot sync completed", status="completed", metadata={"deals_synced": count}
5. Return: {"synced": count, "errors": []}

ERROR HANDLING:
- If access_token is invalid (401): raise HTTPException with message "HubSpot token expired, please reconnect"
- Log any individual deal failure but continue processing others
- If HubSpot is not connected (no token): return mock data for demo (8 hardcoded deals)

MOCK DATA (fallback if no HubSpot token):
Return 8 demo deals with realistic names, values, stages — include 3 with health_score < 50 for demo impact.

Also create:
FILE: /backend/api/crm.py
- POST /api/crm/sync — triggers sync, returns {"status": "started", "org_id": ...}
- GET /api/crm/status — returns connection status for HubSpot/Gmail

FILE: /backend/api/integrations.py  
- GET /api/integrations/hubspot/connect — returns HubSpot OAuth URL
- GET /api/integrations/hubspot/callback — handles OAuth callback, stores token
```

---

## P1.2 — Dashboard API Endpoints

```
Create the dashboard API endpoints for RevAI.

FILE: /backend/api/dashboard.py

All endpoints require JWT authentication (use get_current_user dependency).

ENDPOINT 1: GET /api/dashboard/overview
Query the database and return:
{
  "pipeline_value": sum of all open deals value (exclude Closed Lost),
  "deals_at_risk": count of deals where health_score < 50,
  "prospects_in_queue": count of prospects where status IN ('researching', 'qualified'),
  "accounts_at_risk": count of accounts where churn_score > 70,
  "recent_alerts": last 5 deal_alerts ordered by created_at DESC (include: id, alert_type, severity, description, deal title, deal_id),
  "agent_activity": last 10 agent_logs ordered by created_at DESC (include: agent_type, action, status, created_at),
  "pipeline_health_avg": average health_score across all open deals
}

ENDPOINT 2: GET /api/dashboard/pipeline-funnel
Return deal counts and values by stage:
[
  {"stage": "Prospect", "count": N, "value": sum, "avg_health": avg},
  {"stage": "Qualified", "count": N, "value": sum, "avg_health": avg},
  ... (all stages)
]

ENDPOINT 3: GET /api/dashboard/agent-activity?limit=20
Return recent agent_logs with pagination.

FILE: /backend/schemas/dashboard.py
Create Pydantic response schemas for all endpoints above.

Use SQLAlchemy async queries with proper joins. Filter all queries by org_id from current user.
```

---

## P1.3 — Dashboard Overview Page UI

```
Create the /dashboard/overview page for RevAI in Next.js 14 with TypeScript.

FILE: /app/dashboard/overview/page.tsx

DESIGN: Dark mission-control theme. Colors: bg #0A0B0F, surface #111318, elevated #1A1D26, cyan accent #00E5FF.

LAYOUT:
Top row — 4 stat cards (grid-cols-4) with Framer Motion staggered entrance (each card animates up with 50ms delay):
- "Pipeline Value" — dollar amount in large Space Mono font, green if > $100k
- "Deals at Risk" — count, red background tint + pulsing dot if > 0
- "Prospects in Queue" — count, cyan accent
- "Accounts at Risk" — count, amber if > 0

Middle row — 2 columns:
Left column (60%): "Active Alerts"
- Section header with alert count badge
- Each alert: left border color by severity (critical=red, high=amber, medium=cyan), company name bold, description small, "View Deal →" link
- Empty state: green checkmark + "No active alerts — pipeline is healthy"

Right column (40%): "Agent Activity"
- Section header
- Scrollable list (max-height 300px)
- Each item: icon by agent_type (🔍 prospecting, 🧠 deal_intel, 📉 retention, ⚔️ competitive), timestamp (Space Mono, muted), action text
- Auto-refreshes every 30 seconds with SWR

Bottom row: "Pipeline Funnel"
- Full width Recharts FunnelChart
- Each funnel stage labeled with count + value
- Color gradient from cyan to purple

DATA FETCHING:
Use SWR for all data fetching from GET /api/dashboard/overview and GET /api/dashboard/pipeline-funnel.
Show skeleton screens while loading (animated shimmer divs, bg #1A1D26).

Include a "Last synced: X minutes ago" refresh button in top-right.
```

---

## P1.4 — Kanban Pipeline Component

```
Create a drag-and-drop Kanban pipeline board for RevAI in Next.js with TypeScript.

FILE: /components/deals/KanbanBoard.tsx

DEPENDENCIES: @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

STAGES (in order): Prospect | Qualified | Demo | Proposal | Negotiation | Closed Won

KANBAN COLUMN COMPONENT (KanbanColumn):
Props: stage name, deals array
- Dark column header: stage name + deal count badge + total value (small, muted)
- Scrollable card list
- Column background: bg-surface with subtle border
- "Empty" state: dashed border box in column

DEAL CARD COMPONENT (DealCard):
Props: deal object
- Left border 3px: green (health > 65) / amber (40-65) / red (< 40)
- Background: at-risk cards get rgba(255,23,68,0.04) tint
- Company name: bold, text-primary, 15px
- Value: right-aligned, Space Mono, cyan
- Row below: stage chip + "Xd ago" (days since last_contact_date, amber if > 7)
- Bottom row: assigned_to initials in circle avatar + health score badge
- Hover: box-shadow glow in border color, translateY(-1px), cursor pointer
- Click: navigate to /dashboard/deals/[id]

DRAG AND DROP:
- Use DndContext with PointerSensor
- Dragging a card: shows semi-transparent ghost, other cards create space
- On drop into new column: 
  1. Optimistic UI update immediately
  2. Call PATCH /api/deals/{id}/stage with new stage
  3. Revert if API call fails

SUMMARY STATS BAR (above kanban):
- Total active deals | Total pipeline value | Avg deal health (colored) | # at risk

Fetch deals from GET /api/deals. Group by stage client-side.
```

---

# PHASE 2 PROMPTS — Prospecting Agent

---

## P2.1 — Prospecting Agent (LangGraph)

```
Build a LangGraph-based prospecting intelligence agent for RevAI.

FILE: /backend/agents/prospecting_agent.py

DEPENDENCIES: langgraph langchain-anthropic langchain-community python-dotenv

STATE CLASS (TypedDict):
{
  prospect_id: str,
  org_id: str,
  company_name: str,
  domain: str,
  contact_name: str,
  contact_email: str,
  icp_config: dict,  # {industries: [], company_sizes: [], roles: [], pain_points: []}
  company_research: str,  # filled by node 1
  contact_context: str,   # filled by node 2
  icp_score: int,         # filled by node 3
  fit_signals: list,      # filled by node 3
  email_sequence: list,   # filled by node 4
  error: str | None
}

NODE 1 — research_company(state):
  Use Serper API (via langchain_community.utilities.GoogleSerperAPIWrapper) 
  Search query: f"{state['company_name']} {state['domain']} company overview funding news 2024"
  Take top 5 results, concatenate titles + snippets
  Set state['company_research'] = summary (max 500 chars)
  Log to agent_logs: action="Researching company: {company_name}"

NODE 2 — enrich_contact(state):
  Search query: f"{state['contact_name']} {state['company_name']} LinkedIn role responsibilities"
  Take top 3 results
  Set state['contact_context'] = summary (max 300 chars)
  Log to agent_logs: action="Enriching contact: {contact_name}"

NODE 3 — score_icp_fit(state):
  Call Anthropic Claude (claude-sonnet-4-20250514) with:
  System: "You are a B2B sales ICP scoring agent. Given prospect data and ICP criteria, return ONLY valid JSON."
  User: f"""
  ICP Criteria: {json.dumps(state['icp_config'])}
  Company Research: {state['company_research']}
  Contact Context: {state['contact_context']}
  
  Return JSON: {{"score": <int 0-100>, "fit_signals": ["signal1", "signal2", "signal3"], "low_fit_reason": "<only if score < 30>"}}
  Score 80-100: Strong ICP match. Score 50-80: Good fit. Score 30-50: Possible fit. Below 30: Poor fit.
  """
  Parse JSON response, set state['icp_score'] and state['fit_signals']
  Update prospect in DB with icp_score and fit_signals
  Log: action="ICP scored: {company_name} → {score}/100"

NODE 4 — generate_sequence(state):
  (Only runs if icp_score >= 30)
  Call Claude with:
  System: """You are an elite B2B SDR. Write email sequences that are specific, conversational, and drive replies. 
  Rules: Reference specific company context. No fluff. Max 120 words per email. Clear CTA. Return ONLY valid JSON array."""
  User: f"""
  Contact: {state['contact_name']}, at {state['company_name']}
  Company context: {state['company_research']}
  Contact context: {state['contact_context']}
  ICP fit signals: {state['fit_signals']}
  
  Write a 3-step email sequence. Return JSON array:
  [
    {{"step": 1, "subject": "...", "body": "...", "send_after_days": 0}},
    {{"step": 2, "subject": "...", "body": "...", "send_after_days": 3}},
    {{"step": 3, "subject": "...", "body": "...", "send_after_days": 7}}
  ]
  Step 1: Reference specific company trigger (funding/news/growth). Direct CTA.
  Step 2: Social proof angle or relevant case study reference. Softer CTA.
  Step 3: Short break-up email. "Is this still relevant?" energy. Max 60 words.
  """
  Parse JSON, create sequence record in DB
  Set state['email_sequence'] = parsed array
  Log: action="Sequence generated for {company_name}"

NODE 5 — save_results(state):
  Update prospect status: "qualified" if score >= 30, else "low_fit"
  Log: action="Research completed: {company_name}", status="completed"

EDGES:
research_company → enrich_contact → score_icp_fit → conditional:
  if icp_score >= 30: → generate_sequence → save_results
  else: → save_results

COMPILE AND EXPORT:
graph = StateGraph(ProspectState)
# add nodes and edges
prospecting_graph = graph.compile()

ENTRY FUNCTION:
async def run_prospecting_agent(prospect_id: str, org_id: str, company_name: str, domain: str, contact_name: str, contact_email: str, icp_config: dict) → dict:
  # builds initial state, runs graph, returns final state
```

---

## P2.2 — Prospects UI (Full Page)

```
Create the full Prospects page for RevAI at /dashboard/prospects in Next.js 14 TypeScript.

FILE: /app/dashboard/prospects/page.tsx
Plus components: /components/prospects/ProspectTable.tsx, /components/prospects/ResearchForm.tsx, /components/prospects/ProspectDrawer.tsx

PAGE LAYOUT:
- Left panel (300px fixed): ResearchForm component
- Main area (flex-1): ProspectTable component  
- Right drawer (420px): ProspectDrawer — slides in when prospect row clicked

RESEARCH FORM (ResearchForm.tsx):
Header: "Run Research" with 🔍 icon
Fields (shadcn Input components, dark styled):
- Company Name (required)
- Website Domain (required, placeholder: acme.com)
- Contact Full Name (required)
- Contact Email (required)
- Contact LinkedIn URL (optional)
Toggle: "Use saved ICP config" (on by default)
Button: "Run Research" (full width, cyan background)

ON SUBMIT:
1. POST /api/prospects/research with form data
2. Show progress in form: "🔍 Researching..." → "📊 Scoring ICP..." → "✉️ Writing sequence..." (poll GET /api/tasks/{task_id} every 2s)
3. On task complete: add new prospect to table, show success toast
4. Reset form

PROSPECT TABLE (ProspectTable.tsx):
Filter bar: status dropdown (All/Researching/Qualified/Low Fit/Sequence Sent) + sort (Score ↓, Score ↑, Newest)
Column headers: Company | Contact | ICP Score | Status | Fit Signals | Actions
Each row:
- Company: bold name + domain (muted, small)
- Contact: name + email (muted)
- ICP Score: colored pill badge (green > 70 / amber 40–70 / red < 40 / gray if null)
- Status: colored chip
- Fit Signals: up to 3 small chips + "+N more" if needed
- Actions: "View" button + "..." menu (Approve / Reject)
Row click: opens ProspectDrawer

PROSPECT DRAWER (ProspectDrawer.tsx):
Slides in from right (Framer Motion, 200ms ease-out).
Sections:
1. Header: company name (H2) + contact name/role/email + ICP score badge
2. "Fit Signals": chips for each signal in fit_signals array
3. "Outreach Sequence": accordion with 3 panels
   Each panel header: "Step 1 — Day 0" + email subject
   Panel body: full email body in pre-formatted card, copy icon
4. Action buttons (bottom, sticky):
   "✓ Approve Sequence" (green) + "✏️ Edit" (outlined) + "✗ Reject" (red outlined)
   Approve: PATCH /api/prospects/{id}/approve → show success state
```

---

# PHASE 3 PROMPTS — Deal Intelligence Agent

---

## P3.1 — Deal Health Scoring Service

```
Create a deal health scoring service for RevAI.

FILE: /backend/services/deal_health.py

FUNCTION: calculate_deal_health(deal: Deal, email_data: dict = None) -> dict

SCORING ALGORITHM (start at 100, subtract penalties):
1. Days since last contact:
   - 0–3 days: no penalty
   - 4–7 days: -10
   - 8–14 days: -25
   - 15+ days: -40 (maximum silence penalty)

2. Close date pressure:
   - If close_date exists and is within 7 days but stage is not in ['Negotiation', 'Proposal']: -20
   - If close_date is within 14 days and stage is 'Prospect' or 'Qualified': -15

3. Email engagement (from email_data dict if provided):
   - No emails in last 14 days: -20
   - Only 1-2 emails total in last 30 days: -10

4. Stakeholder coverage (from email_data):
   - Only 1 unique contact emailed (single-threaded): -10

5. Competitor detection (from deal.risk_signals):
   - If any risk_signal has type="competitor": -20

6. Stage progression:
   - Deal has been in same stage for > 21 days: -15

Clamp final score to 0–100.

RISK SIGNAL GENERATION:
Based on the deductions applied, build a list of risk_signal strings:
- "No contact in X days"
- "Closing soon but stage is early"  
- "Single-threaded — only talking to 1 person"
- "Competitor mentioned in thread"
- "Deal stalled — same stage for 3+ weeks"

RISK LEVEL:
- score >= 65: "green"
- score >= 40: "yellow"  
- score < 40: "red"

RETURN:
{
  "health_score": int,
  "risk_signals": [list of strings],
  "risk_level": "green" | "yellow" | "red",
  "penalty_breakdown": {"silence": int, "close_date": int, ...}  # for debugging
}

BATCH FUNCTION: async update_all_deal_health(org_id: str, db: AsyncSession)
- Fetches all active deals (not Closed Won/Lost) for org
- Calls calculate_deal_health for each
- Updates health_score and risk_signals in DB
- Creates deal_alerts for any deals newly entering "red" territory
- Logs to agent_logs
```

---

## P3.2 — Deal Risk Detection & Recovery Agent

```
Build the Deal Intelligence LangGraph agent for RevAI.

FILE: /backend/agents/deal_intelligence_agent.py

STATE (TypedDict):
{
  deal_id: str, org_id: str,
  deal_data: dict,         # from DB
  email_snippets: list,    # from Gmail, list of {subject, snippet, date, from}
  detected_risks: list,    # [{type, description, severity}]
  health_score: int,
  risk_level: str,
  recovery_play: dict | None,  # {diagnosis, action, email_draft, talking_points}
  previous_health_score: int   # to detect score drops
}

NODE 1 — fetch_deal_context(state):
  Pull full deal from DB (convert to dict)
  If Gmail MCP available: fetch last 5 email thread snippets for deal's contact email
  If not available: use deal.risk_signals to simulate email context
  Log: "Analyzing deal: {deal_title}"

NODE 2 — detect_risks(state):
  Call Claude with:
  System: "You are a sales risk analyst. Identify deal risks from context. Return ONLY valid JSON."
  User: f"""
  Deal: {state['deal_data']['title']}, Stage: {state['deal_data']['stage']}, Value: ${state['deal_data']['value']}
  Last Contact: {state['deal_data']['last_contact_date']}
  Email Thread Snippets (most recent): {json.dumps(state['email_snippets'])}
  
  Identify risks. Look for:
  - Engagement drop (silence pattern)
  - Competitor mentions (any company names that could be alternatives)
  - Budget concerns ("cost", "expensive", "budget review", "pause")
  - Stakeholder changes ("new role", "left the company", "team change")
  - Objections that weren't addressed
  
  Return JSON: {{"risks": [{{"type": "silence|competitor|budget|stakeholder|objection", "description": "...", "severity": "low|medium|high|critical"}}]}}
  """
  Parse response, set state['detected_risks']

NODE 3 — calculate_score(state):
  Import and call calculate_deal_health() from deal_health service
  Set state['health_score'] and state['risk_level']

NODE 4 — generate_recovery_play(state):
  ONLY if health_score < 60:
  Call Claude with:
  System: "You are a senior sales coach helping rescue at-risk deals. Be specific, practical, and direct. Return ONLY valid JSON."
  User: f"""
  DEAL AT RISK:
  Deal: {state['deal_data']['title']}
  Value: ${state['deal_data']['value']}
  Stage: {state['deal_data']['stage']}
  Close Date: {state['deal_data']['close_date']}
  Risk Signals: {json.dumps(state['detected_risks'])}
  
  Generate a recovery play. Return JSON:
  {{
    "diagnosis": "One sentence: the core problem with this deal right now",
    "recommended_action": "Specific next step to take in the next 24 hours",
    "email_draft": {{
      "subject": "...",
      "body": "...(max 120 words, conversational, not desperate, references specific context)..."
    }},
    "talking_points": ["point 1", "point 2", "point 3"]
  }}
  """
  Parse and set state['recovery_play']

NODE 5 — save_alert(state):
  Update deal health_score and risk_signals in DB
  If health_score < 50 AND (previous_score was >= 50 OR previous_score is None):
    Create deal_alert: type from highest severity risk, recovery_play as JSON string
  Log: "Deal analysis complete: {title}, score: {score}"

COMPILE:
deal_intelligence_graph = StateGraph(DealState).compile()

SCHEDULER (in /backend/scheduler.py):
Schedule run_deal_intelligence_for_all_deals() every 6 hours using APScheduler.
```

---

## P3.3 — Deal Detail Page UI

```
Create the Deal Detail page for RevAI at /dashboard/deals/[id].

FILE: /app/dashboard/deals/[id]/page.tsx

LAYOUT: Full-width page with 2 columns:
- Left: deal info + timeline (flex: 1.5)
- Right: AI analysis panel (flex: 1, min-width: 360px)

LEFT COLUMN:

HEADER CARD (bg-surface, rounded):
- Deal title (H1, Space Mono)
- Row: Value ($X) in cyan | Stage chip | Close date | Assigned to avatar
- Health score arc gauge (SVG, 120px diameter):
  - Arc from 7 o'clock to 5 o'clock (270 degrees)
  - Fill color: green (score >= 65) / amber (40-65) / red (< 40)
  - Large score number in center (Space Mono, 28px, colored)
  - "Deal Health" label below

RISK SIGNALS SECTION:
- Section title "Risk Signals" + count badge
- Each signal: icon (⚠️ silence, ⚔️ competitor, 💰 budget, 👤 stakeholder) + description
- Color coded by severity

ACTIVITY TIMELINE:
- Section title "Recent Activity"
- Chronological list: date (muted) + email subject + from name
- Empty state if no Gmail data

RIGHT COLUMN — AI ANALYSIS PANEL:

Panel header: "AI Analysis" + purple 🤖 badge + "Last run: X minutes ago" + "Re-run" button

If recovery play exists:
  DIAGNOSIS section: italic text in muted color, left purple border
  RECOMMENDED ACTION: bold text in elevated card
  EMAIL DRAFT card:
    Subject line shown
    Body in monospace-ish readable font
    "Edit & Send" button (cyan) + "Copy" icon button
  TALKING POINTS: numbered list, each point as a row

If no recovery play (healthy deal):
  Green checkmark + "Deal is on track" message
  Last analysis timestamp

"Generate Recovery Play" button (purple, full width) — always visible at bottom of panel.
On click: POST /api/deals/{id}/recovery → stream response with typewriter effect.

Fetch deal data from GET /api/deals/{id}.
```

---

# PHASE 4 PROMPTS — Revenue Retention Agent

---

## P4.1 — Churn Scoring + Retention Agent

```
Build the revenue retention agent for RevAI.

FILE: /backend/services/retention_service.py

FUNCTION: calculate_churn_score(account: Account) -> dict

Read these from account.usage_data jsonb:
- login_frequency_30d: int (logins in last 30 days)
- login_frequency_prev_30d: int (logins in prior 30 days)
- feature_adoption_score: int (0-100)
- support_tickets_30d: int
- avg_ticket_sentiment: float (-1.0 to 1.0, use 0 if not available)
- nps_score: int | None
- key_feature_last_used: int (days ago, None if never)

SCORING (additive, cap at 100):
score = 0
- If login_frequency_30d dropped > 50% vs prev: score += 30
- If feature_adoption_score < 30: score += 20
- If avg_ticket_sentiment < -0.3: score += 25
- If account.contract_end_date within 60 days: score += 15
- If nps_score is not None and nps_score < 6: score += 10
- If key_feature_last_used > 14: score += 15 (feature abandonment)

RETURN: {"churn_score": int, "risk_tier": "red"|"yellow"|"green", "score_breakdown": dict}
red: score >= 65 | yellow: score >= 35 | green: score < 35

FILE: /backend/agents/retention_agent.py (LangGraph)

STATE: {account_id, org_id, account_data, churn_score, risk_tier, churn_reason, intervention}

NODE 1 — gather_signals: pull account from DB, compute initial score via retention_service
NODE 2 — classify_reason: Call Claude:
  Prompt: "Account {name} shows these churn signals: {breakdown}. In exactly one sentence, state the PRIMARY churn risk driver. Be specific."
  Set state['churn_reason']

NODE 3 — generate_intervention (if churn_score >= 35):
  Call Claude:
  Prompt: f"""
  Account: {account_data['company_name']}, MRR: ${account_data['mrr']}
  Churn Score: {churn_score}/100
  Primary Risk: {churn_reason}
  Signals: {breakdown}
  Contract renewal: {account_data['contract_end_date']}
  
  Recommend ONE intervention and write an outreach email. Return JSON:
  {{
    "intervention_type": "high_touch_call|feature_training|exec_sponsor|discount_offer|success_review",
    "urgency": "this_week|this_month",
    "email_draft": {{"subject": "...", "body": "...(warm, helpful tone, not salesy, max 100 words)..."}}
  }}
  """

NODE 4 — update_account: Save churn_score, churn_reason, intervention to DB. Log.

FILE: /backend/services/usage_simulator.py
Generate realistic usage_data for demo accounts:
- Red account: login_frequency_30d=2 (was 25), feature_adoption=15, tickets=8, sentiment=-0.6
- Yellow account: login_frequency_30d=12 (was 20), feature_adoption=45, tickets=3, sentiment=0.1
- Green account: login_frequency_30d=35, feature_adoption=78, tickets=1, sentiment=0.7
```

---

## P4.2 — Retention Dashboard UI

```
Create the Revenue Retention dashboard for RevAI at /dashboard/retention in Next.js TypeScript.

FILE: /app/dashboard/retention/page.tsx
FILE: /components/retention/AccountTable.tsx
FILE: /components/retention/AccountDrawer.tsx
FILE: /components/retention/ChurnScorePill.tsx

PAGE LAYOUT:
Header KPIs (3 stat cards, same style as overview):
- "Accounts at Risk" (red count, pulsing dot if > 0)
- "Revenue at Risk" (sum of MRR for accounts with churn_score > 65, in red)
- "Avg Churn Score" (colored by range)

Filter bar: risk tier tabs (All | 🔴 Red | 🟡 Yellow | 🟢 Green) + sort by MRR/ChurnScore

CHURN SCORE PILL COMPONENT (ChurnScorePill.tsx):
Props: score (int), size ("sm" | "md")
Shows:
- Thin horizontal bar (full width of pill), filled percentage = score
- Bar color: red > 65, amber 35–65, green < 35
- Score number: right-aligned, Space Mono, colored
- Risk label: "HIGH" / "MEDIUM" / "LOW" in small caps

ACCOUNT TABLE (AccountTable.tsx):
Columns: Company | MRR | Churn Score | Churn Reason | Renewal Date | Intervention | Actions
- Company: bold name
- MRR: "$X,XXX/mo" in Space Mono
- Churn Score: ChurnScorePill component
- Churn Reason: truncated text, tooltip for full
- Renewal Date: show in red if < 60 days
- Intervention: chip (none=muted / triggered=cyan / completed=green)
- Actions: "Trigger Intervention" button (disabled if status=completed)

Row click → opens AccountDrawer

ACCOUNT DRAWER (AccountDrawer.tsx):
Header: company name + churn score pill + MRR

CHARTS SECTION:
- "Login Activity" — Recharts BarChart: last 8 weeks login counts, red bars for recent weeks if dropped
- "Feature Adoption" — Recharts RadialBarChart showing adoption % (colored by score)

SUPPORT TICKETS section:
List last 5 tickets: date + title + sentiment icon (😊 positive / 😐 neutral / 😠 negative based on avg_ticket_sentiment)

INTERVENTION CARD (if churn_score >= 35):
- Recommended action type (prominent, cyan)
- Email draft preview
- "Execute Intervention" button (full width, cyan)
- On click: POST /api/retention/intervene/{id} → show email draft in editable textarea → "Send via Gmail" button
```

---

# PHASE 5 PROMPTS — Competitive Intelligence Agent

---

## P5.1 — Competitive Intel Agent + Battlecard Generator

```
Build the Competitive Intelligence agent for RevAI.

FILE: /backend/agents/competitive_agent.py (LangGraph)

STATE: {org_id, competitor_name, competitor_domain, search_results, analysis, battlecard, deal_mentions}

NODE 1 — scrape_competitor(state):
  Use Serper API for 3 searches (run in parallel with asyncio.gather):
  1. f"{competitor_name} pricing plans 2024"
  2. f"{competitor_name} new features product update"
  3. f"{competitor_name} reviews complaints G2 Capterra"
  Combine top 5 results from each, set state['search_results']
  Log: "Scraping intel on: {competitor_name}"

NODE 2 — analyze_intel(state):
  Call Claude:
  System: "You are a competitive intelligence analyst. Extract structured intel from search results. Return ONLY valid JSON."
  User: f"""
  Competitor: {competitor_name}
  Search Results: {state['search_results']}
  
  Extract and return JSON:
  {{
    "pricing_intel": "What we know about their pricing (or 'Unknown' if not found)",
    "recent_features": ["feature1", "feature2"],
    "customer_complaints": ["complaint1", "complaint2", "complaint3"],
    "perceived_strengths": ["strength1", "strength2"],
    "market_positioning": "One sentence on how they position themselves"
  }}
  """

NODE 3 — generate_battlecard(state):
  Call Claude:
  System: "You are a sales enablement expert writing battlecards for a SaaS sales team. Be direct, specific, and useful for AEs in active deals. Return ONLY valid JSON."
  User: f"""
  Competitor: {state['competitor_name']}
  Intel: {json.dumps(state['analysis'])}
  Our strengths: [Fast implementation, Superior AI features, Better integrations, Dedicated support]
  
  Write a complete battlecard. Return JSON:
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
  """

NODE 4 — detect_deal_mentions(state):
  Query active deals for org
  For each deal, check deal.risk_signals for competitor mentions
  Also: if Gmail snippets available, search for competitor_name in subject/body
  If found: create competitive_alert record with deal_id
  Set state['deal_mentions'] = list of deal titles

NODE 5 — save_and_notify(state):
  Upsert battlecard in DB (update if competitor exists)
  If new deal_mentions found: POST to SLACK_WEBHOOK_URL with formatted message:
    "⚔️ {competitor_name} mentioned in deal: {deal_title} — Review battlecard"
  Log to agent_logs

SCHEDULE: Run weekly for all tracked competitors via APScheduler.

ALSO CREATE: /backend/api/competitive.py
- GET /api/competitive/battlecards
- GET /api/competitive/battlecards/{competitor_name}
- POST /api/competitive/track — {competitor_name, competitor_domain}
- GET /api/competitive/alerts
```

---

## P5.2 — Battlecard UI

```
Create the Competitive Intelligence page for RevAI at /dashboard/competitive.

FILE: /app/dashboard/competitive/page.tsx

LAYOUT: Two-panel horizontal split
- Left: competitor list sidebar (260px)
- Right: battlecard main view (flex-1)

LEFT SIDEBAR:
Header: "Competitors" + "Track New +" button
Each competitor item (clickable, highlights when selected):
  - Competitor name (bold)
  - Last updated (muted, small)
  - Alert badge (red pill with count if deal_mentions > 0)
  - Hover: bg-elevated

"Track New Competitor" button → opens Modal:
  Inputs: Competitor Name + Domain
  "Track Competitor" submit button → POST /api/competitive/track → adds to list

RIGHT PANEL — BATTLECARD VIEW:

When no competitor selected: 
  Centered empty state: shield icon + "Select a competitor to view their battlecard"

When competitor selected:
  Header: competitor name (H1) + "Last updated: X days ago" + "Refresh Intel" button (triggers agent re-run)
  
  "Active Deal Alerts" banner (only if deal_mentions > 0):
    Amber background, "⚔️ {competitor} mentioned in {N} active deal(s) this week" + deal name chips
  
  4 content sections in 2x2 grid:
  
  SECTION 1 — "Their Strengths" (neutral blue tint):
    Bullet list from battlecard.their_strengths
    Each bullet: checkmark icon (muted color)
  
  SECTION 2 — "Their Weaknesses" (amber tint):
    Bullet list from battlecard.their_weaknesses
    Each bullet: warning icon, text in amber
  
  SECTION 3 — "How We Win" (green tint):
    Bullet list from battlecard.how_we_win
    Each bullet: green checkmark, bold text
  
  SECTION 4 — "Objection Handlers" (elevated bg):
    Accordion — each row: objection text (collapsed) → expand shows response
    Add "Copy response" button on expanded state
  
  Bottom: "Active Deal Alerts" section — list of deals with this competitor, "View Deal →" links

Fetch from GET /api/competitive/battlecards/{competitor_name}.
Loading: skeleton sections. Empty: placeholder text.
```

---

# PHASE 6 PROMPTS — Polish & Demo

---

## P6.1 — Demo Data Seeder

```
Create a comprehensive demo data seeder for RevAI that creates realistic, impressive data for hackathon demo.

FILE: /backend/scripts/seed_demo_data.py

Use SQLAlchemy sync session (not async for simplicity). Accept --org-id as CLI argument.

CREATE THIS EXACT DATA:

DEALS (8 total, insert in this exact state for best demo impact):
1. "FinTrack Ltd" — $75,000 — Proposal — health_score=28 — risk_signals=[{type:"competitor",description:"CompetitorX mentioned in last email"},{type:"silence",description:"No contact in 14 days"}] — last_contact: 14 days ago
2. "TechStart Inc" — $42,000 — Qualified — health_score=35 — risk_signals=[{type:"silence",description:"No contact in 12 days"},{type:"stakeholder",description:"Single-threaded — only 1 contact engaged"}] — last_contact: 12 days ago
3. "DataSync Co" — $120,000 — Negotiation — health_score=22 — risk_signals=[{type:"budget",description:"Budget review mentioned in last call"},{type:"silence",description:"No response in 9 days"}] — last_contact: 9 days ago
4. "NexaAI Ltd" — $89,000 — Demo — health_score=82 — risk_signals=[] — last_contact: 2 days ago
5. "BuildFast Inc" — $55,000 — Proposal — health_score=75 — risk_signals=[] — last_contact: 1 day ago
6. "CloudOps" — $210,000 — Negotiation — health_score=68 — last_contact: 3 days ago
7. "ScaleUp HQ" — $33,000 — Prospect — health_score=90 — last_contact: today
8. "EnterpriseX" — $350,000 — Closed Won — health_score=100 — last_contact: 5 days ago

DEAL ALERTS (for at-risk deals):
- FinTrack Ltd: severity=critical, type=competitor, description="CompetitorX mentioned in email thread", recovery_play with full diagnosis + email draft
- TechStart: severity=high, type=silence, description="No contact in 12 days — deal at risk"
- DataSync: severity=critical, type=budget, description="Budget freeze mentioned — needs executive intervention"

PROSPECTS (8 total):
Mix of: icp_score 85 (DataSync Inc, CTO), 72 (CloudBuild, VP Eng), 91 (HealthTech, CRO), 45 (RetailCo, IT Manager), 33 (SmallBiz, Owner)...
Include 3 with full sequences, 2 with status=qualified, 2 researching, 1 low_fit

ACCOUNTS (6 for retention):
1. "Momentum Inc" — MRR $8,500 — churn_score=82 — churn_reason="Login frequency dropped 80% — possible abandonment" — usage: logins 2 (was 28), adoption 12, tickets 7, sentiment -0.7
2. "BrightSpark" — MRR $12,000 — churn_score=74 — churn_reason="Negative support experience + upcoming renewal pressure"
3. "FlowState Co" — MRR $5,000 — churn_score=51 — churn_reason="Feature adoption stalled at 28%"
4. "PulseMetrics" — MRR $15,000 — churn_score=28 — churn_reason=None (healthy)
5. "RocketGrowth" — MRR $22,000 — churn_score=15 — healthy power user
6. "SteadyEDU" — MRR $3,500 — churn_score=42 — moderate risk, renewal in 45 days

BATTLECARDS (2 competitors):
CompetitorX: full battlecard with 3 objection handlers
RivalSoft: battlecard with note that pricing increased 20% last quarter

AGENT LOGS (20 entries, spread over last 24 hours):
Mix of all 4 agent types with varied actions. Include some "completed" and 2 "running" states.
```

---

## P6.2 — Landing Page

```
Create a stunning public landing page for RevAI at /app/page.tsx.

Design: Dark "mission control" theme. Framer Motion scroll animations. Professional B2B SaaS feel.

SECTION 1 — HERO (full viewport height):
Background: #0A0B0F with animated subtle dot-grid pattern (CSS background-image radial-gradient dots)
Top nav: RevAI wordmark (Space Mono) + "Sign In" link (right)
Center content (max-width 800px, centered):
  - Small badge: "🤖 AI-Powered Sales Intelligence" (cyan bordered pill)
  - H1 (Space Mono, 56px): "Your AI Sales Team." on line 1, "Working 24/7." on line 2 (second line in cyan)
  - Subtitle (DM Sans, 20px, muted): "RevAI monitors your pipeline, researches prospects, and rescues at-risk deals — automatically."
  - 2 CTA buttons: "Start Free Trial →" (cyan bg, dark text) + "Watch Demo" (outlined, white)
  - Below CTAs: small text "Trusted by 200+ sales teams · No credit card required"

SECTION 2 — FEATURES (4 agent cards, 2x2 grid):
Section heading: "Four AI Agents. One Revenue Engine."
Each card (bg-surface, border, hover glow):
  - Colored icon circle (each agent has different accent color)
  - Agent name (bold)
  - 1-line description
  - 3 bullet points of capabilities
Cards: Prospecting Agent (cyan) / Deal Intelligence (amber) / Revenue Retention (red) / Competitive Intel (purple)
Framer Motion: cards animate in from bottom when scrolled into view

SECTION 3 — METRICS STRIP (dark, full width):
3 large metrics centered:
  "10× Faster Prospecting"
  "7 Days Earlier Risk Detection"  
  "40%+ Email Open Rate"
Each with a subtle label below: "vs manual research" / "avg across deployments" / "vs 20% industry avg"
Space Mono font, large (48px), cyan colored numbers

SECTION 4 — HOW IT WORKS (3 steps horizontal):
"Deploy in 3 Steps"
Step 1: Connect CRM (plug icon) → Step 2: Agents Monitor (eye icon) → Step 3: You Close Deals (lightning icon)
Connected by dashed line with arrow between steps
Each step: icon + number + title + 1 sentence description

SECTION 5 — INTEGRATIONS:
"Works with your existing stack"
Logo row: HubSpot · Salesforce · Gmail · Slack · LinkedIn · Apollo
Simple text logos or grayscale icons in a horizontal strip

SECTION 6 — CTA FOOTER:
"Ready to close more deals?"
Large centered CTA button: "Get Started — It's Free"
Muted text below: "Setup in 10 minutes · No engineers required"

Use Framer Motion's useInView for scroll-triggered reveals. Each section fades + slides up when entering viewport.
```

---

*RevAI | File 3 of 4 — Implementation Prompt Guide*
*ETH India Hackathon*
