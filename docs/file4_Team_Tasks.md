# 👥 RevAI — Team Task Division
### Aarya · Anurag · Manmit · Soham
### ETH India Hackathon | 48-Hour Sprint

---

## Team Roles

| Name | Role | Core Strength |
|---|---|---|
| **Anurag** | Backend Lead | FastAPI, database, CRM integrations, infrastructure |
| **Manmit** | AI / Agent Engineer | LangGraph agents, Claude prompt engineering, LLM pipelines |
| **Soham** | Frontend Engineer | Next.js UI, components, charts, animations |
| **Aarya** | PM + Demo Lead | Product decisions, demo data, content, deck, testing, demo script |

---

## 🚦 Hour-by-Hour Sprint Overview

| Time | Anurag | Manmit | Soham | Aarya |
|---|---|---|---|---|
| 0–2h | Docker + DB schema | Gmail MCP setup | Next.js shell | Env vars doc + ICP config |
| 2–6h | FastAPI + Auth APIs | LangGraph environment setup | Auth UI + sidebar layout | Research & define demo scenarios |
| 6–10h | HubSpot sync service | Test Gmail integration | Dashboard overview page | Write ICP configs + prospect data |
| 10–14h | Dashboard APIs | Agent runner infrastructure | Kanban board + component library | Test API contracts + write mock data |
| 14–18h | Prospect API endpoints | Prospecting agent (nodes 1–3) | Prospects table + research form | Review Claude prompts for outreach quality |
| 18–22h | Background task runner | Prospecting agent (nodes 4–5) | Prospect drawer + sequence viewer | Seed 5 realistic prospects manually |
| 22–26h | Deal health service | Deal intelligence agent (nodes 1–2) | Deal detail page | QA: test deal scenarios end-to-end |
| 26–30h | Deal alert APIs | Deal intelligence agent (nodes 3–5) | Deal AI panel + recovery play UI | Review + refine recovery email prompts |
| 30–34h | Usage simulator + retention APIs | Retention agent (churn scoring) | Retention dashboard | Define 6 realistic account scenarios |
| 34–38h | Retention endpoints + scheduler | Retention agent (intervention gen) | Account drawer + charts | Test intervention flows + QA |
| 38–42h | Competitive APIs + Slack webhook | Competitive agent (nodes 1–3) | Battlecard UI | Write competitor scenario content |
| 42–44h | Deployment setup (Vercel/Railway) | Competitive agent (nodes 4–5) | Landing page | Finalize demo data requirements |
| 44–46h | Seed data script + deployment | End-to-end agent testing | Polish animations + mobile | Write demo script + talking points |
| 46–48h | Production smoke test | Fix agent bugs | Fix UI bugs | Full demo rehearsal + deck |

---

# ANURAG — Backend Lead

**Your domain:** Everything server-side. The engine that makes the product work.  
**Your success metric:** All APIs return real data before Soham needs them.

---

## Phase 0 (Hours 0–6) — Foundation

### ✅ Task A-0.1 — Monorepo + Docker Setup
**Time:** 1.5h

- Set up `/revai` monorepo with `/frontend`, `/backend` folders
- Write `docker-compose.yml`: postgres:15, redis:7, FastAPI:8000, Next.js:3000
- Write `Dockerfile` for backend (Python 3.11-slim, uvicorn, hot-reload)
- Write `Dockerfile` for frontend (Node 20-alpine)
- Write `.env.example` with all keys (see prompt guide P0.1)
- Verify `docker-compose up` runs all 4 services clean

**Deliverable:** `docker-compose up` → all services healthy → share screenshot in team chat

---

### ✅ Task A-0.2 — Database Schema + Alembic
**Time:** 1h

- Create SQLAlchemy models for all 9 tables
- Write Alembic initial migration `001_initial.py`
- Run `alembic upgrade head` — confirm all tables created
- Create `database.py` with async session + `get_db` dependency

**Deliverable:** PostgreSQL has all 9 tables. Share schema screenshot in team chat.

---

### ✅ Task A-0.3 — FastAPI Auth APIs
**Time:** 2h

- `POST /api/auth/register` — creates user + org, returns JWT
- `POST /api/auth/login` — validates, returns JWT
- `GET /api/auth/me` — protected, returns current user
- JWT middleware: `get_current_user` dependency for all protected routes
- Pydantic schemas: `UserCreate`, `UserLogin`, `TokenResponse`
- Test with Postman/curl: register → login → me ✅

**Deliverable:** Curl commands work. Share with Soham so he can wire NextAuth.

---

### ✅ Task A-0.4 — HubSpot OAuth Scaffold
**Time:** 1.5h

- `GET /api/integrations/hubspot/connect` → return OAuth URL
- `GET /api/integrations/hubspot/callback` → store access token in organizations table
- `GET /api/crm/status` → return connection status
- If no HubSpot connected: flag in response (Manmit will use this to know whether to use real or mock data)

---

## Phase 1 (Hours 6–14) — Data Layer

### ✅ Task A-1.1 — HubSpot Deal Sync Service
**Time:** 2h

- Create `/services/hubspot_sync.py`
- Fetch deals + contacts from HubSpot REST API
- Upsert into `deals` table using `crm_deal_id`
- **Important fallback:** if no token exists → load 8 demo deals from a hardcoded dict (for demo reliability)
- `POST /api/crm/sync` endpoint
- APScheduler: sync every 30 min

**Deliverable:** `POST /api/crm/sync` → deals appear in DB table

---

### ✅ Task A-1.2 — Dashboard API Endpoints
**Time:** 1.5h

Create `/api/dashboard.py`:
- `GET /api/dashboard/overview` — returns pipeline_value, deals_at_risk, prospects_in_queue, accounts_at_risk, recent_alerts, agent_activity
- `GET /api/dashboard/pipeline-funnel` — deals grouped by stage with count + value

**Publish API contract to Soham** (exact JSON shapes) as soon as done — he can mock in frontend.

---

### ✅ Task A-1.3 — Deal CRUD APIs
**Time:** 1h

- `GET /api/deals` — all deals for org, grouped or flat
- `GET /api/deals/{id}` — full deal with risk_signals, alerts
- `PATCH /api/deals/{id}/stage` — update stage (for Kanban drag-drop)
- `POST /api/deals/{id}/recovery` — triggers deal intelligence agent as Celery task

---

## Phase 2 (Hours 14–22) — Prospect Backend

### ✅ Task A-2.1 — Prospect API Endpoints
**Time:** 1.5h

- `POST /api/prospects/research` — accepts form data, kicks off Celery task running Manmit's agent, returns `{task_id, prospect_id}`
- `GET /api/prospects` — paginated list with filters: status, min_score
- `GET /api/prospects/{id}` — full detail with sequence steps
- `PATCH /api/prospects/{id}/approve` — sets sequence status to "approved"
- `GET /api/tasks/{task_id}` — Celery task status: pending/running/success/failure

---

### ✅ Task A-2.2 — Celery + Redis Task Infrastructure
**Time:** 1.5h

- Set up Celery worker with Redis broker
- Create task wrapper for `run_prospecting_agent()`
- Create task wrapper for `run_deal_intelligence_agent()`
- Create task wrapper for `run_retention_agent()`
- Verify tasks enqueue and complete via Celery worker logs

**Deliverable:** Run a test task, see it complete in Celery logs.

---

## Phase 3 (Hours 22–30) — Deal Intel Backend

### ✅ Task A-3.1 — Deal Health Scoring Service
**Time:** 2h (pair with Manmit if needed)

- Create `/services/deal_health.py`
- Implement scoring algorithm (silence penalty, close date pressure, competitor signal, etc.)
- `calculate_deal_health(deal, email_data)` → `{health_score, risk_signals, risk_level}`
- `update_all_deal_health(org_id, db)` batch function
- APScheduler: run every 6 hours

---

### ✅ Task A-3.2 — Deal Alert APIs
**Time:** 1h

- `GET /api/deals/alerts` — all open alerts for org, with deal info
- `PATCH /api/deals/alerts/{id}/acknowledge` — mark as acknowledged

---

## Phase 4 (Hours 30–38) — Retention Backend

### ✅ Task A-4.1 — Usage Data Simulator
**Time:** 1.5h

- Create `/services/usage_simulator.py`
- Generate realistic `usage_data` JSONB for each account tier (red/yellow/green)
- `populate_usage_data(org_id)` — fills accounts table with simulated usage data

---

### ✅ Task A-4.2 — Retention API Endpoints
**Time:** 1.5h

- `GET /api/retention/accounts` — with tier filter (red/yellow/green), sort by MRR/churn
- `GET /api/retention/accounts/{id}` — full account with usage data
- `POST /api/retention/intervene/{id}` — triggers retention agent, returns intervention + email draft

---

## Phase 5 (Hours 38–44) — Competitive + Slack

### ✅ Task A-5.1 — Competitive API Endpoints
**Time:** 1h

- `GET /api/competitive/battlecards` — list all
- `GET /api/competitive/battlecards/{competitor_name}` — full battlecard
- `POST /api/competitive/track` — add competitor to monitoring list
- `GET /api/competitive/alerts` — deal alerts with competitor mentions

---

### ✅ Task A-5.2 — Slack Webhook Notification
**Time:** 45min

- Create `/utils/slack_notifier.py`
- `send_deal_alert(deal_title, risk_type, description)` → POST to SLACK_WEBHOOK_URL
- `send_competitive_alert(competitor_name, deal_title)` → formatted Slack message
- Test with a real Slack webhook in team workspace

---

## Phase 6 (Hours 44–48) — Demo Data + Deployment

### ✅ Task A-6.1 — Demo Data Seeder Script
**Time:** 1.5h

- Create `/backend/scripts/seed_demo_data.py`
- Seed exactly: 8 deals (3 at-risk), 8 prospects, 6 accounts, 2 battlecards, 20 agent logs
- Use Aarya's data definitions (she'll provide exact company names and story)
- Run: `python seed_demo_data.py --org-id <ORG_ID>`

---

### ✅ Task A-6.2 — Production Deployment
**Time:** 1h

- Deploy backend + Postgres + Redis to Railway
- Deploy frontend to Vercel (connect GitHub)
- Set all production env vars
- Run seed script on production
- Smoke test: login → dashboard loads with data

---

# MANMIT — AI / Agent Engineer

**Your domain:** All LangGraph agents, Claude prompts, and LLM pipelines.  
**Your success metric:** Agents run end-to-end and produce outputs that look impressive in demo.

---

## Phase 0 (Hours 0–6) — Environment Setup

### ✅ Task M-0.1 — Gmail MCP Integration
**Time:** 2h

- Set up Anthropic MCP client for Gmail
- Create `/services/gmail_service.py`:
  - `get_recent_emails(contact_email, limit=5)` → list of `{subject, snippet, date, from}`
  - `send_email(to, subject, body)` → sends via Gmail API
- Test: fetch last 3 emails from a test Gmail account
- If MCP auth fails: return mock email data (3 hardcoded email thread snippets)

**Deliverable:** `gmail_service.get_recent_emails("test@test.com")` → returns list

---

### ✅ Task M-0.2 — LangGraph + Anthropic Environment
**Time:** 1h

- Install: `langgraph langchain-anthropic langchain-community`
- Create `/agents/__init__.py` + basic test agent that calls Claude
- Verify: Claude API key works, LangGraph compiles a simple graph
- Create shared `get_claude_client()` utility function

---

## Phase 1 (Hours 6–14) — Agent Infrastructure

### ✅ Task M-1.1 — Agent Runner + Logging
**Time:** 2h

- Create `/services/agent_runner.py`:
  - Wraps any agent invocation with: start log, execute, end log, error capture
  - `run_agent(graph, initial_state, org_id, agent_type)` → result dict
- Create logging helper: `log_agent_action(agent_type, action, status, metadata, db)`
- Test: running a dummy agent logs correctly to `agent_logs` table

---

## Phase 2 (Hours 14–22) — Prospecting Agent

### ✅ Task M-2.1 — Prospect Research Agent (Core)
**Time:** 5h — **this is your most important deliverable**

Build `/agents/prospecting_agent.py` (full LangGraph implementation):

**Node 1 — research_company:**
- Serper API call: `"{company_name} {domain} company news funding"`
- Parse top 5 results into 400-char summary
- Handle API failures gracefully (return "No research found" string, don't crash)

**Node 2 — enrich_contact:**
- Serper: `"{contact_name} {company_name} role LinkedIn"`
- Parse into contact context

**Node 3 — score_icp_fit:**
- Claude call with ICP config + research
- Parse JSON response: `{score, fit_signals, low_fit_reason}`
- Fallback: if JSON parse fails, default to score=50 with generic signals
- Update prospect in DB with score + signals

**Node 4 — generate_sequence (if score >= 30):**
- Claude call for 3-step email sequence
- Parse JSON array of `{step, subject, body, send_after_days}`
- **Quality bar:** emails must reference the company_name and at least 1 signal from research
- Create sequence record in DB

**Node 5 — save_results:**
- Update prospect status (qualified vs low_fit)
- Final log entry

**Compile graph and export `prospecting_graph`**

**Test yourself:** Run the full agent on "Notion" + "notion.so" + contact "Ivan Zhao" → verify score + sequence appears in DB

---

## Phase 3 (Hours 22–30) — Deal Intelligence Agent

### ✅ Task M-3.1 — Deal Intelligence Agent
**Time:** 4h

Build `/agents/deal_intelligence_agent.py`:

**Node 1 — fetch_deal_context:**
- Pull deal from DB
- Call `gmail_service.get_recent_emails(deal_contact_email)` → store snippets
- If no Gmail: use deal.risk_signals to construct simulated context

**Node 2 — detect_risks:**
- Claude call: analyze email snippets + deal data for risk signals
- Parse JSON: `{risks: [{type, description, severity}]}`
- Important: look for competitor company names in snippets (any business name that's not the prospect's company)

**Node 3 — calculate_score:**
- Call `deal_health.calculate_deal_health()` from Anurag's service
- Store score in state

**Node 4 — generate_recovery_play (if score < 60):**
- Claude call for recovery play
- Parse JSON: `{diagnosis, recommended_action, email_draft: {subject, body}, talking_points}`
- **Quality bar:** email draft must be under 120 words, must NOT sound desperate, must reference specific deal context

**Node 5 — save_alert:**
- Create `deal_alerts` record
- Update deal health_score in DB

**Test yourself:** Create a test deal with `last_contact_date` = 14 days ago → run agent → verify alert created + recovery play generated

---

## Phase 4 (Hours 30–38) — Retention Agent

### ✅ Task M-4.1 — Retention Churn Agent
**Time:** 3.5h

Build `/agents/retention_agent.py`:

**Node 1 — gather_signals:**
- Pull account from DB
- Import and call `retention_service.calculate_churn_score(account)` (Anurag's service)

**Node 2 — classify_reason:**
- Claude call: given score breakdown, write 1-sentence churn reason
- Prompt: direct and specific, not vague ("Login dropped 80% over last 30 days" not "usage issues")

**Node 3 — generate_intervention (if score >= 35):**
- Claude call: recommend intervention type + write outreach email
- **Quality bar:** email must be warm and helpful, NOT "I noticed you haven't logged in" vibe — instead make it value-driven
- Parse JSON: `{intervention_type, urgency, email_draft: {subject, body}}`

**Node 4 — update_account:**
- Save churn_score, churn_reason, intervention to DB

**Test yourself:** Run agent on a "red" account → verify churn_reason + intervention are populated

---

## Phase 5 (Hours 38–44) — Competitive Agent

### ✅ Task M-5.1 — Competitive Intelligence Agent
**Time:** 4h

Build `/agents/competitive_agent.py`:

**Node 1 — scrape_competitor:**
- 3 Serper searches in parallel (asyncio.gather)
- Combine results into search_results string

**Node 2 — analyze_intel:**
- Claude: extract pricing_intel, recent_features, customer_complaints, perceived_strengths
- Parse JSON

**Node 3 — generate_battlecard:**
- Claude: write full battlecard with our_product_strengths hardcoded
- Parse JSON: overview, their_strengths[], their_weaknesses[], how_we_win[], objection_handlers[]
- **Quality bar:** objection_handlers must be specific and usable in real sales conversations

**Node 4 — detect_deal_mentions:**
- Scan active deals' risk_signals for competitor name
- Also scan Gmail snippets if available
- Return list of matching deal IDs

**Node 5 — save_and_notify:**
- Upsert battlecard
- If deal_mentions found → call Slack notifier

**Test yourself:** Run agent with competitor_name="Salesforce" → verify battlecard created

---

## Phase 6 (Hours 44–48) — Testing & Polish

### ✅ Task M-6.1 — End-to-End Agent Testing
**Time:** 2h

- Run full prospecting agent on 3 real companies → verify all 3 have scores + sequences
- Run deal intelligence on seeded at-risk deals → verify recovery plays generated
- Run retention agent on red accounts → verify interventions generated
- Fix any JSON parsing failures (most common bug) — add try/except with fallback values
- Verify agent_logs table shows realistic activity trail

**Deliverable:** All 3 at-risk demo deals have recovery plays. All red accounts have interventions. Confirm with Aarya.

---

# SOHAM — Frontend Engineer

**Your domain:** Everything the judges see first. Make it look like a funded product.  
**Your success metric:** Every page looks polished and data shows up correctly.

---

## Phase 0 (Hours 0–6) — App Shell

### ✅ Task S-0.1 — Next.js Setup + Design System
**Time:** 1.5h

- `npx create-next-app@latest frontend --typescript --tailwind --app`
- Install: `shadcn-ui framer-motion recharts zustand lucide-react @dnd-kit/core @dnd-kit/sortable`
- Install: `next-auth swr axios`
- `tailwind.config.js`: add custom colors (bg-base #0A0B0F, bg-surface #111318, bg-elevated #1A1D26, cyan, success, warning, danger, purple)
- `globals.css`: CSS variables for all colors, import Space Mono + DM Sans from Google Fonts
- Create `/lib/api.ts`: axios instance with `baseURL: process.env.NEXT_PUBLIC_API_URL`, auto-attach auth header

**Deliverable:** `npm run dev` starts. Dark background visible on localhost:3000.

---

### ✅ Task S-0.2 — Auth + Layout Shell
**Time:** 2.5h

**Auth:**
- `auth.ts`: NextAuth Credentials provider → POST to `/api/auth/login`
- `middleware.ts`: protect `/dashboard/*`
- `/app/auth/login/page.tsx`: centered dark card, email + password inputs, sign in button (cyan)

**Dashboard Layout:**
- `/app/dashboard/layout.tsx`: left sidebar + top bar + main content area
- `Sidebar.tsx`: nav links (Overview/Prospects/Deals/Retention/Competitive), icons, active state (cyan), collapsible
- `TopBar.tsx`: RevAI wordmark, search input, notification bell, user avatar
- Create placeholder pages for all 5 dashboard sections

**Deliverable:** Login works, redirects to dashboard. Sidebar navigation between pages works.

---

## Phase 1 (Hours 6–14) — Core Dashboard UI

### ✅ Task S-1.1 — Component Library
**Time:** 1.5h

Create `/components/ui/` (these are used everywhere — do these first):

- `StatCard.tsx` — metric card (icon, value, label, optional trend arrow)
- `HealthBadge.tsx` — colored pill with score (green/amber/red thresholds as props)
- `StatusChip.tsx` — small colored status chip
- `AlertCard.tsx` — alert with severity left-border, title, description, CTA
- `SkeletonCard.tsx` — shimmer loading placeholder
- `SlideOverDrawer.tsx` — right-side drawer (Framer Motion slide-in, backdrop)
- `AgentActivityItem.tsx` — single activity feed row

---

### ✅ Task S-1.2 — Dashboard Overview Page
**Time:** 3h

`/app/dashboard/overview/page.tsx`:
- 4 stat cards (top row) with staggered Framer Motion entrance
- Active Alerts list (left, 60%) — from `recent_alerts`
- Agent Activity Feed (right, 40%) — from `agent_activity`, monospace timestamps, auto-refresh 30s
- Pipeline Funnel chart (Recharts, bottom full-width)
- All skeleton screens while SWR loads data
- Fetch from `GET /api/dashboard/overview` + `GET /api/dashboard/pipeline-funnel`

**Pro tip:** Use hardcoded JSON mock first, wire SWR after Anurag confirms API is ready.

---

### ✅ Task S-1.3 — Kanban Pipeline Board
**Time:** 3h

`/components/deals/KanbanBoard.tsx`:
- 6 columns: Prospect → Qualified → Demo → Proposal → Negotiation → Closed Won
- `DealCard.tsx`: left border health color, company name, value (cyan, Space Mono), days since contact, health badge
- At-risk cards: `rgba(255,23,68,0.04)` background tint
- @dnd-kit drag-and-drop between columns
- On drop: optimistic update + `PATCH /api/deals/{id}/stage`
- Column summary: count + total value in header

`/app/dashboard/deals/pipeline/page.tsx`: use KanbanBoard + summary stats bar above

---

## Phase 2 (Hours 14–22) — Prospects UI

### ✅ Task S-2.1 — Prospects Page
**Time:** 4h

`/app/dashboard/prospects/page.tsx` + components:

**ResearchForm (left panel):**
- Company, Domain, Contact Name, Contact Email, LinkedIn fields
- Submit → POST → poll task status every 2s
- Progress states: "Researching..." → "Scoring ICP..." → "Writing sequence..." → "Done ✓"

**ProspectTable (main area):**
- ICP score badge (colored), status chip, fit signals (3 chips + "+N more")
- Filters: status dropdown, sort by score
- Row click → opens drawer

**ProspectDrawer (SlideOverDrawer):**
- Contact info header
- ICP score + fit_signals chips
- Sequence accordion: 3 steps, each shows subject + body
- "Approve Sequence" button (green) / "Reject" (red outlined)

---

## Phase 3 (Hours 22–30) — Deal UI

### ✅ Task S-3.1 — Deal Detail Page
**Time:** 3.5h

`/app/dashboard/deals/[id]/page.tsx`:

**Left section:**
- Header card: title, value, stage chip, close date, assigned AE
- Health Score Gauge (SVG arc, 0–100, color by range, score in center)
- Risk Signals section: chips with icons (⚠️/⚔️/💰/👤)
- Activity timeline: email subjects + dates

**Right section — AI Analysis Panel:**
- Purple-tinted header: "AI Analysis" + agent badge
- Diagnosis text (italic, muted, left purple border)
- Recommended Action (bold, elevated card)
- Email Draft card: subject + body, "Edit & Send" + "Copy" buttons
- Talking Points: numbered list
- "Generate Recovery Play" button (purple, full width, bottom)
- On click: POST → stream response with typewriter effect

---

## Phase 4 (Hours 30–38) — Retention UI

### ✅ Task S-4.1 — Retention Dashboard
**Time:** 3.5h

`/app/dashboard/retention/page.tsx`:

**Header:** 3 KPI stat cards (accounts at risk, revenue at risk, avg churn score)

**ChurnScorePill component:**
- Filled bar + score number + HIGH/MEDIUM/LOW label
- Color by score range

**AccountTable:**
- MRR (Space Mono), Churn Score pill, Churn Reason (truncated + tooltip), Renewal Date (red if < 60d), Intervention status chip
- "Trigger Intervention" button per row

**AccountDrawer (SlideOverDrawer):**
- Login activity bar chart (Recharts)
- Feature adoption radial chart
- Support tickets with sentiment icons
- Intervention card: type + "Execute" button → shows email draft textarea → "Send via Gmail"

---

## Phase 5 (Hours 38–44) — Competitive + Landing

### ✅ Task S-5.1 — Battlecard UI
**Time:** 2.5h

`/app/dashboard/competitive/page.tsx`:
- Left sidebar: competitor list with last-updated + alert badge
- Battlecard sections: Their Strengths (neutral) / Their Weaknesses (amber) / How We Win (green) / Objection Handlers (accordion)
- Active deal alerts banner (amber, if deal_mentions exist)
- "Track New Competitor" modal

---

### ✅ Task S-5.2 — Landing Page
**Time:** 2h (do this in Phase 6 if needed)

`/app/page.tsx`:
- Hero: dot-grid background, large headline ("Your AI Sales Team. Working 24/7."), cyan on second line, 2 CTAs
- Features: 4 agent cards 2x2 grid with hover glow
- Metrics strip: 3 large numbers in Space Mono cyan
- How It Works: 3-step flow
- Integrations logo strip
- CTA footer

Framer Motion scroll reveals on each section.

---

## Phase 6 (Hours 44–48) — Polish

### ✅ Task S-6.1 — Animation + Polish Pass
**Time:** 1.5h

- Verify staggered card animations on all list pages
- Add agent activity feed real-time append animation
- Health score number roll animation (CountUp)
- Consistent skeleton states across all pages
- Fix any layout breaks or color inconsistencies
- Test: click through entire demo flow once without bugs

---

# AARYA — PM + Demo Lead

**Your domain:** Product decisions, data quality, quality assurance, the demo, and the pitch.  
**Your success metric:** The demo tells a compelling story in under 4 minutes. Judges are impressed.

---

## Phase 0 (Hours 0–6) — Setup & Product Definition

### ✅ Task AR-0.1 — Environment & API Keys
**Time:** 1h

- Copy `.env.example` → `.env` for the team
- Obtain and fill in:
  - `GEMINI_API_KEY` — from Google AI Studio / Gemini API
  - `TAVILY_API_KEY` — from Tavily (free tier available)
  - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
  - `SLACK_WEBHOOK_URL` — create incoming webhook in team Slack
- Share `.env` file securely with all team members
- Document which keys are test/free vs require signup

---

### ✅ Task AR-0.2 — ICP Configuration
**Time:** 1h

Define the ICP config that will be used by the Prospecting Agent. This is critical for prompt quality:

```json
{
  "industries": ["SaaS", "FinTech", "HealthTech", "E-commerce", "Developer Tools"],
  "company_sizes": ["50-500 employees", "Series A to Series C"],
  "target_roles": ["CTO", "VP Engineering", "VP Sales", "Head of Revenue Ops", "CRO"],
  "pain_points": [
    "Manual CRM data entry taking too much time",
    "No visibility into why deals are going dark",
    "SDRs spending 70% of time on research not selling",
    "Churn detected too late to save the account"
  ],
  "ideal_triggers": [
    "Recently raised funding (Series A/B)",
    "Hiring VP of Sales or Sales Ops",
    "Posted job for 'Revenue Operations'",
    "Recently switched from Excel to a CRM"
  ]
}
```

Share this with Manmit for the prospecting agent prompts.

---

### ✅ Task AR-0.3 — Demo Story & Scenario Design
**Time:** 2h

Design the exact narrative arc for the 4-minute hackathon demo. Write a one-page doc covering:

**Demo Arc (3 scenes):**
1. **"The Pipeline Problem"** (1 min): Show dashboard overview → 3 red deal alerts visible → "Without RevAI, these deals would go dark"
2. **"AI in Action"** (2 min): Click FinTrack Ltd deal → show risk signals (competitor + silence) → click "Generate Recovery Play" → watch AI stream a recovery email → "This would take a sales coach an hour. RevAI does it in seconds"
3. **"Revenue Saved"** (1 min): Click to Retention → Momentum Inc churn score 82 → trigger intervention → AI generates save email → "We caught this 30 days before renewal"

**Write this doc and share with team. You'll use it to:**
- Tell Anurag exactly what data to seed
- Tell Soham exactly what UI flows need to be perfect
- Use as your demo script on stage

---

## Phase 1 (Hours 6–14) — API Contract + Testing Setup

### ✅ Task AR-1.1 — API Contract Documentation
**Time:** 1.5h

Document the expected JSON shapes for every API endpoint (Anurag will build these, Soham will consume them). Create a simple markdown file:

```
GET /api/dashboard/overview
Response: {
  pipeline_value: 450000,
  deals_at_risk: 3,
  prospects_in_queue: 7,
  accounts_at_risk: 2,
  recent_alerts: [{id, alert_type, severity, description, deal_title, deal_id, created_at}],
  agent_activity: [{agent_type, action, status, created_at}]
}
```

Do this for all 20+ endpoints. This prevents Anurag and Soham from miscommunicating.

---

### ✅ Task AR-1.2 — Mock Data JSON Files
**Time:** 1.5h

Create `/frontend/src/mocks/` with JSON files:
- `dashboard-overview.json` — realistic overview response
- `deals.json` — 8 deals including 3 at-risk
- `prospects.json` — 8 prospects with scores and sequences
- `accounts.json` — 6 accounts with churn scores
- `battlecards.json` — 2 competitor battlecards

Soham can use these while APIs are being built so frontend work is unblocked.

---

## Phase 2 (Hours 14–22) — Prompt Quality Review

### ✅ Task AR-2.1 — Outreach Sequence Quality Review
**Time:** 2h

When Manmit's prospecting agent starts generating sequences, review them for quality:

**Test by running agent on these 3 companies:**
1. "Notion" — CTO "Ivan Zhao" — domain "notion.so"
2. "Linear" — VP Engineering — domain "linear.app"
3. "Vercel" — Head of Sales — domain "vercel.com"

**Quality checklist per sequence:**
- [ ] Email 1: References specific company news/context (not generic)
- [ ] Email 2: Different angle (social proof / pain point)
- [ ] Email 3: Short break-up energy (< 60 words)
- [ ] Subject lines: Not clickbait, not boring, < 8 words
- [ ] Body: No "I hope this email finds you well" type openers
- [ ] CTA: Clear and specific (not just "let's chat")

If quality is bad → provide feedback to Manmit with specific rewrites. Act as editorial director for prompts.

---

## Phase 3 (Hours 22–30) — Deal Scenario QA

### ✅ Task AR-3.1 — Deal Scenarios End-to-End QA
**Time:** 2h

Test every deal scenario manually once Anurag + Manmit have deal intelligence running:

**Test Scenarios:**
1. FinTrack Ltd deal → should show: 2 risk signals, health score ~28, competitor mention, recovery play generated
2. TechStart Inc → should show: silence signal, single-threaded signal, health ~35
3. DataSync Co → should show: budget concern signal, recovery play with exec-touch angle
4. NexaAI (healthy) → should show: health 80+, no alerts, AI panel says "On Track"

For each: document what's working, what's broken, report to Anurag/Manmit.

---

### ✅ Task AR-3.2 — Recovery Email Quality Review
**Time:** 1h

Review all recovery emails generated by Manmit's agent:

**Quality bar:**
- [ ] Under 120 words
- [ ] References the specific risk (e.g., "know things have been busy your end" for silence)
- [ ] One clear, low-pressure CTA
- [ ] Does NOT say: "I noticed you haven't responded" / "Just following up" / "Circle back"
- [ ] Sounds like it came from a senior AE, not a robot

Provide specific rewrite suggestions to Manmit if below quality bar.

---

## Phase 4 (Hours 30–38) — Retention Scenario Definition

### ✅ Task AR-4.1 — Account Scenario Data
**Time:** 1.5h

Define the exact data for each of the 6 demo accounts. Give Anurag these exact specs for the seeder:

| Company | MRR | Churn Score | Story for Demo | Key Signals |
|---|---|---|---|---|
| Momentum Inc | $8,500 | 82 | "Power user went quiet — licensing decision coming" | logins: 2 (was 28), tickets: 7, sentiment: -0.7 |
| BrightSpark | $12,000 | 74 | "Support frustration + renewal in 45 days" | tickets: 9, sentiment: -0.6, renewal: 42 days |
| FlowState Co | $5,000 | 51 | "Feature adoption stalled" | adoption: 28, logins: 12 (was 22) |
| PulseMetrics | $15,000 | 28 | "Engaged, growing" | logins: 41, adoption: 72, tickets: 1 |
| RocketGrowth | $22,000 | 12 | "Model customer, expanding" | logins: 55, adoption: 88 |
| SteadyEDU | $3,500 | 42 | "Moderate risk, renewal soon" | renewal: 38 days, adoption: 41 |

---

## Phase 5 (Hours 38–44) — Competitive Content

### ✅ Task AR-5.1 — Competitor Battlecard Content
**Time:** 1.5h

Write the content for 2 demo battlecards (Anurag will seed these). Make them realistic:

**CompetitorX Battlecard:**
- Their Strengths: "Large enterprise customer base", "Established brand recognition", "Deep Salesforce native integration"
- Their Weaknesses: "Slow onboarding (avg 6-8 weeks)", "No AI-native features — all add-ons", "Very expensive for SMBs ($800+/seat)", "Poor customer support ratings (G2: 3.2)"
- How We Win: "Deploy in < 1 day", "AI baked into every workflow", "50% lower cost at comparable seat count", "Dedicated CS from day 1"
- Objection Handlers: 3 specific ones around price / brand / feature parity

**RivalSoft Battlecard:**
- Note: "Raised pricing by 20% last quarter — customers actively looking to switch"
- Include 2 objection handlers specifically around this pricing change

---

## Phase 6 (Hours 44–48) — Demo + Deck

### ✅ Task AR-6.1 — Demo Script (Final)
**Time:** 1.5h

Write the word-for-word demo script. Format:

```
[SCENE 1: Dashboard Overview — 0:00–1:00]

Narration: "This is RevAI's command center. In real-time, we can see our pipeline 
value of $584,000, with 3 deals currently at risk. These aren't just numbers..."

[Click: first alert — FinTrack Ltd]

Narration: "FinTrack is a $75,000 deal. It's been silent for 14 days. And 
our AI just detected that the prospect mentioned CompetitorX in their last email..."

[Click: View Deal]

[SCENE 2: Deal Recovery — 1:00–3:00]
...
```

Keep total demo under 4 minutes. Practice it 3 times before submission.

---

### ✅ Task AR-6.2 — Pitch Deck
**Time:** 1.5h

Create a 7-slide deck:

1. **Cover:** RevAI logo + "Close More. Lose Less. Automatically."
2. **Problem:** 3 bullets — SDR time waste / AE blind spots / CS churn lag. Stats.
3. **Solution:** "4 AI Agents, 1 Platform" — 2x2 grid with agent names + 1-line descriptions
4. **Demo Screenshots:** 3 screenshots — dashboard, deal recovery play, retention dashboard
5. **How It Works:** Connect CRM → Agents Monitor → You Act on Insights (simple 3-step diagram)
6. **Metrics:** 10x / 7 days / 40%+ in large typography
7. **Tech Stack:** Architecture diagram (Claude + LangGraph + FastAPI + Next.js + HubSpot) — ask Manmit for help

Use Canva or Google Slides. Dark theme matching the product.

---

### ✅ Task AR-6.3 — Demo Rehearsal Lead
**Time:** 1h

Coordinate and run the final team rehearsal:

- [ ] Confirm production URL is live (Anurag)
- [ ] Confirm seed data is loaded (Anurag)
- [ ] Run through demo script once → note any UI bugs (report to Soham)
- [ ] Run through demo script again → note any agent failures (report to Manmit)
- [ ] Third run: clean, timed. Must be under 4 minutes.
- [ ] Confirm deck is uploaded to submission platform

**You are the demo presenter.** Stay calm, narrate confidently, have backup screenshots ready if live demo breaks.

---

## 🔁 Team Sync Protocol

### Blockers
- Post in team WhatsApp/Discord **immediately** when stuck > 20 minutes
- Tag the right person: `@anurag` for API issues, `@manmit` for agent issues, `@soham` for UI issues
- Aarya triages product-level blockers

### Phase Checkpoints
| Checkpoint | Time | Aarya checks |
|---|---|---|
| Setup done | Hour 6 | All 4 services running, auth works |
| Dashboard live | Hour 14 | Deals visible on Kanban from seed data |
| Prospecting works | Hour 22 | 1 prospect scored + sequence visible in UI |
| Deal intel works | Hour 30 | 1 at-risk deal shows recovery play |
| All agents done | Hour 38 | Retention + competitive visible in UI |
| Deploy ready | Hour 44 | Production URL loads with data |
| Demo ready | Hour 47 | Full flow demoed without crash |

### API Contract Rule
- Anurag publishes endpoint schema → Soham uses Aarya's mock JSON until API is ready
- **No blocking:** frontend and backend build in parallel

### "It's broken at demo time" Plan
- Every critical screen has a fallback screenshot saved
- Aarya holds the screenshots folder on her laptop
- If live demo breaks: switch to screenshot walkthrough seamlessly

---

*RevAI | File 4 of 4 — Team Task Division*
*Aarya · Anurag · Manmit · Soham*
*ETH India Hackathon*
