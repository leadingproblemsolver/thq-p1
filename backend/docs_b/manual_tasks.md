# Manual Tasks — Decision Kill-Switch

Anything that **cannot be automated** by the Lovable agent lives here.
Append a new entry whenever you discover a step that requires human action.

---

## ✅ Format

> **Task:** short title
> **Why manual:** reason it can't be done in code
> **Steps:** 1, 2, 3…
> **Expected result:** what success looks like
> **Acceptance criteria:** how to verify

---

## 1. Enable Lovable Cloud

- **Why manual:** A human must approve provisioning the backend (Postgres,
  Auth, Edge Functions, secrets store).
- **Steps:**
  1. In the Lovable chat, approve the prompt to **Enable Lovable Cloud**.
  2. Wait ~30 seconds for the project to provision.
- **Expected result:** `LOVABLE_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` appear in the secrets store.
- **Acceptance criteria:** `fetch_secrets` lists `LOVABLE_API_KEY`.

## 2. Deploy unified schema

- **Why manual:** Schema migrations modify production data structures and
  require explicit user approval through the migration tool.
- **Steps:**
  1. Open `backend/docs_b/schema.sql`.
  2. Apply via Lovable's migration flow (the agent will generate a migration
     when asked: *"deploy the schema"*).
  3. Approve the migration in the chat.
- **Expected result:** Tables `sessions`, `decisions`, `outcomes`, `events`,
  `profiles`, `user_roles` exist. Views `daily_metrics`, `conversion_metrics`,
  `retention_metrics`, `performance_metrics` exist.
- **Acceptance criteria:** `select count(*) from public.decisions;` returns 0
  without error.

## 3. Deploy `analyze-decision` edge function

- **Why manual:** Edge function deployment is triggered by the agent but
  needs Cloud enabled (task #1) first.
- **Steps:**
  1. Confirm task #1 is complete.
  2. Ask the agent: *"deploy the analyze-decision edge function"*.
  3. The agent will create `supabase/functions/analyze-decision/index.ts`
     using the spec in `backend/docs_b/edge-function-gemini.md`.
- **Expected result:** `POST /functions/v1/analyze-decision` returns a verdict
  in <5s.
- **Acceptance criteria:** Run a decision in the UI — a real Gemini-generated
  verdict appears (not a `mockAnalyze` fallback).

## 4. Confirm auth provider

- **Why manual:** Choosing email+password vs magic link vs Google is a
  product decision.
- **Steps:**
  1. Default: **Email + Password** (already wired in `AuthModal.tsx`).
  2. To add Google: enable in Lovable Cloud → Users → Auth Providers.
- **Expected result:** Signup from `AuthModal` succeeds and a row appears in
  `auth.users` + `public.profiles`.
- **Acceptance criteria:** After signup, `link_anon_session` RPC merges the
  anon `sessions` row into the new user.

## 5. Enable HIBP password protection

- **Why manual:** Auth security setting toggle.
- **Steps:**
  1. Cloud → Users → Auth Settings (gear icon) → Email settings.
  2. Activate **Password HIBP Check**.
- **Expected result:** Signup with a leaked password is rejected.
- **Acceptance criteria:** Try signing up with `password` — should fail.

## 6. (Optional) Promote first admin

- **Why manual:** Admin roles must never be self-assigned via the UI.
- **Steps:**
  1. After signing up your own account, run in the SQL editor:
     ```sql
     insert into public.user_roles (user_id, role)
     values ('<your-auth-uid>', 'admin');
     ```
- **Expected result:** Admin can read all rows in `events`, `decisions`,
  `sessions` (RLS bypass via `has_role`).
- **Acceptance criteria:** `select * from public.events limit 1;` returns a
  row when logged in as admin.
