

## Goal
Lock the Decision Kill-Switch into a strict, production-ready MVP that matches the final product.md spec: 5-line verdict with **"Do This Now"** (replacing Timestamp), 1-free-decision gate before auth, full event logging, SQL-driven KPIs, and a single Gemini-backed edge function. Fully wire the frontend to the backend so the app is end-to-end functional.

## Scope of changes

### 1. Frontend — strict 5-line contract
- **`src/lib/killswitch-schema.ts`**: replace schema. New fields: `verdict`, `biggest_risk`, `what_breaks`, `do_this_now`, `confidence`. Drop `action_lock`, `input_type` from required output. Add post-generation quality filter (reject "it depends", vague language, multiple risks → flag for regenerate).
- **`src/components/VerdictCard.tsx`**: render exactly 5 lines in spec order. Rename "ACTION LOCK" → "DO THIS NOW". Add Copy button (copies the 5 lines as plain text).
- **`src/components/KillSwitchForm.tsx`**: 
  - Call new edge function `analyze-decision` instead of `mockAnalyze`.
  - Generate `anon_session_id` (UUID) stored in localStorage.
  - On 2nd decision attempt without auth → show auth modal (`requires_auth: true` from server).
  - After verdict, show "I acted on this" + outcome prompt (success / failure / mixed).
  - Surface 402/429 errors via toast.
- **`src/components/AuthModal.tsx`** (new): Supabase email+password signup/signin. On success, link `anon_session_id` → `user_id`.
- **`src/pages/Index.tsx`**: subtle "1 free decision used" indicator after first run.
- **`src/pages/Decision.tsx`** (new) + route `/decision/:id`: read-only shareable verdict view.

### 2. Backend — unified schema (rewrite `backend/docs_b/schema.sql`)
Aligns with product.md tables. Final tables:
- `sessions` (anon_session_id, user_id, free_decision_used, utm_source, first/last_seen)
- `decisions` (input_text, input_type, verdict, biggest_risk, what_breaks, do_this_now, confidence, latency_ms, model_version, session_id, user_id)
- `outcomes` (decision_id, result enum success/failure/mixed, note)
- `events` (session_id, user_id, event_type, payload jsonb) — logs `decision_submitted`, `verdict_generated`, `auth_required`, `user_logged_in`, `user_acted`, `outcome_logged`, `feedback_submitted`
- `profiles` + `user_roles` + `has_role()` (kept, security best-practice)
- Enums: `verdict_type`, `input_type`, `outcome_result`, `event_type`, `app_role`
- RLS: anon can insert/read own session row + own decisions (matched by `session_id`); authed users see own data; admins see all.
- **SQL Views** (KPI engine, exactly per spec): `daily_metrics`, `conversion_metrics`, `retention_metrics`, `performance_metrics`.
- Helper fns: `get_return_rate()`, `get_activation_rate()`, `get_structure_compliance()`, `link_anon_session(anon_id, user_id)`.

### 3. Backend — edge function doc (rewrite `backend/docs_b/edge-function-gemini.md`)
Update to reflect:
- **Lovable AI Gateway** (`google/gemini-3-flash-preview`) using `LOVABLE_API_KEY` — not raw Gemini API. (Per project guidance: prefer Lovable AI; user said "GEMINI API KEY" but the proper path on Lovable Cloud is the gateway, which serves Gemini.)
- Endpoint: `POST /functions/v1/analyze-decision`
- Request: `{ input_text, anon_session_id }`
- Server-side: validate session, check `free_decision_used`, return `{ requires_auth: true }` if gated, else call gateway with strict system prompt + tool-calling for structured 5-field output, run quality filter (regenerate once if vague), insert into `decisions`, log `decision_submitted` + `verdict_generated` events, set `free_decision_used = true`.
- Full TypeScript implementation, Zod validation, CORS, 402/429 handling, references to schema tables.
- Companion endpoints documented: `POST /functions/v1/log-outcome`, `POST /functions/v1/log-event`.

### 4. Frontend copy — surgical use cases
Tighten the audience chips in `Index.tsx` to product.md's stage-1 ICP only:
- **Indie Hackers** — pricing, hire/fire, launch timing
- **Freelancers** — accept/reject contracts, scope changes
- **Solo Operators** — vendor deals, irreversible spend
(Drop broader audiences that dilute focus.)

### 5. Docs
- `backend/docs_b/manual_tasks.md` (new): items requiring user action — enable Lovable Cloud, add `LOVABLE_API_KEY` (auto), confirm auth providers, deploy schema, deploy edge function.
- Keep `backend/docs_b/schema.sql` and `edge-function-gemini.md` as the single source of truth.

## File map
```text
NEW   src/components/AuthModal.tsx
NEW   src/components/OutcomeLogger.tsx
NEW   src/pages/Decision.tsx
NEW   backend/docs_b/manual_tasks.md
EDIT  src/lib/killswitch-schema.ts        (5-line contract + quality filter)
EDIT  src/components/VerdictCard.tsx      ("Do This Now" + Copy button)
EDIT  src/components/KillSwitchForm.tsx   (gateway call, gating, outcome)
EDIT  src/pages/Index.tsx                 (free-decision indicator, ICP chips)
EDIT  src/App.tsx                         (add /decision/:id route)
REWRITE backend/docs_b/schema.sql         (sessions/decisions/outcomes/events + views)
REWRITE backend/docs_b/edge-function-gemini.md  (Lovable AI Gateway, gating, events)
```

## Out of scope (this turn)
- Actually enabling Lovable Cloud / deploying the schema / deploying the edge function. Until Cloud is enabled, the frontend will fall back to `mockAnalyze` so the app stays functional. Approve enabling Cloud as the next step to flip on real verdicts + persistence.

