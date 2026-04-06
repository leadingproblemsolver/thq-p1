# Decision Kill-Switch

*The ruthless 5-second decision auditor that forces clarity before action.*

Stop shipping bad decisions. Paste what you're about to act on → get an instant, non-negotiable verdict that surfaces the biggest risk and the one action that breaks or protects it.

Built as a hyper-minimal, data-first SPA that turns every input into a weaponized, queryable event while delivering an inelastic "I must see this before I proceed" moment.

## Core Promise (Weeks 1–2 MVP)

One fixed output. Zero fluff. Every use logged. Metrics auto-verified.

*Exact 5-Line Output Structure (100% enforced):*

Verdict: Proceed / Pause / Kill Confidence: XX% Biggest Risk: [single sentence, max 18 words] What Breaks This: [single sentence, max 18 words] Action Lock: [exact next micro-step right now]
## Validation Pathway (External Anchors – Must Hit 100%)

1. User pastes real “what you’re about to act on” → triggers genuine decision moment.
2. Fixed-structure verdict delivered in <10s → user cannot continue without seeing Proceed/Pause/Kill.
3. Every request auto-logged with input type (decision/claim/deal) / verdict / confidence / timestamp.
4. Output explicitly surfaces “Biggest Risk” + “What Breaks This” → drives repeatable protective habit.

## Success Gates (Phase 1 Exit Criteria)

- *100%* of outputs match the exact 5-line structure (schema-enforced, no exceptions).
- User verbatim feedback contains real-test phrases (“I should run this before I act” or equivalent).
- Minimum *50* logged classified decisions.
- Activation rate ≥ *40%* (sign-ups completing first verdict).
- Return rate ≥ *30%* (users returning within 48h).

Phase 2 (Outcome Tracker + RAG over past decisions) unlocks automatically when gates flip green.

## Tech Stack (Hyperefficient & Integratable)

- *Frontend*: Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui + Vercel Edge
- *Backend/DB*: Supabase (Postgres + pgvector + Auth + Edge Functions + Realtime)
- *LLM*: xAI Grok-4-fast-non-reasoning (structured outputs via Vercel AI SDK) with graceful fallback
- *Observability*: PostHog for activation, return rate, latency, and behavioral events
- *Data Engine*: Every decision stored with embedding for future similarity search and fine-tuning

Total infra for early users: under $20/month. API-first design for easy embedding into larger platforms.

## Key Features (80/20 – Only What Moves Metrics)

- Single textarea + red “RUN KILL-SWITCH” button
- Instant classification (decision / claim / deal)
- Mandatory post-verdict feedback to close the loop
- Auto-logging with latency tracking
- Private /metrics dashboard showing live activation, return rate, data volume, and compliance
- Dark, surgical UI with red “Kill” accents and micro-animations

Everything else is cut until gates are met.

## How It Works (User Flow)

1. Sign in (magic link via Supabase)
2. Paste the exact decision, claim, or deal you're about to execute
3. Click *RUN KILL-SWITCH*
4. Receive the 5-line verdict in <10s
5. Provide 1-sentence feedback (required)
6. Decision is automatically classified, embedded, and stored

Repeat. Build the protective muscle. Watch the flywheel spin.

## For Builders & Integrators

- Fully open API endpoint: POST /api/analyze
- Row-level security ensures users only see their own data
- Exportable decision logs + embeddings ready for RAG or analysis
- Designed to slot into broader decision intelligence umbrellas

## Metrics Engine (Auto-Verified on Every Use)

- Structure compliance (100%)
- Median time to clarity (<10s)
- Activation & 48h return rate
- Classified decision volume
- Verbatim feedback quality

All tracked in real time. Green lights unlock the next phase.

## Roadmap Tease (Post-Phase 1)

- Personal decision history with similarity search
- Outcome Tracker (link verdicts to real results)
- Anonymized benchmark dataset
- Fine-tuning loop on high-confidence kills/pauses

## Get Started

```bash
# Clone and run (full surgical setup in repo root)
git clone 
cd decision-kill-switch
pnpm install
cp .env.example .env.local
# Add your XAI_API_KEY and Supabase keys
pnpm dev
See IMPLEMENTATION.md for the complete surgical code kit (schema, API route, UI component, Supabase migrations).

Built surgically precise.
Data-first. Habit-forming. Ready to scale.
Every decision logged is ammunition for the next version.
Questions? Paste your biggest upcoming decision here and run the switch.
This product.md is complete, self-contained, and ready to drop into the repo root. It directly encodes the Validation Pathway, exact structure, success gates, tech decisions, and 80/20 focus while remaining concise and action-oriented. It serves both internal alignment and external early users/integrators.

