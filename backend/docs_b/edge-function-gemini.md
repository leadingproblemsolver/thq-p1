# Edge Function: `analyze-decision` — Gemini API Integration

> **Purpose**: Receives a raw decision string from the client, calls the Google Gemini API for structured analysis, validates the response against the Kill-Switch Zod schema, and returns a 5-line verdict.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Secret Setup](#secret-setup)
4. [Function Code](#function-code)
5. [Deployment](#deployment)
6. [Client Integration](#client-integration)
7. [Schema Reference](#schema-reference)
8. [Error Handling](#error-handling)
9. [Cost & Rate Limits](#cost--rate-limits)

---

## Architecture

```
┌──────────────┐        ┌────────────────────┐        ┌──────────────────┐
│   Frontend   │ ──►    │  Edge Function     │ ──►    │  Gemini API      │
│  (React)     │ POST   │  analyze-decision  │ POST   │  gemini-2.0-flash│
│              │ ◄──    │  + JWT validation  │ ◄──    │  JSON mode       │
└──────────────┘ JSON   └────────────────────┘ JSON   └──────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │  Supabase DB  │
                        │  decisions    │
                        └───────────────┘
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| Supabase project | Connected via Lovable Cloud |
| Gemini API key | From [Google AI Studio](https://aistudio.google.com/apikey) |
| Schema deployed | `backend/docs_b/schema.sql` applied to Supabase |

---

## Secret Setup

Store the Gemini API key as a **runtime secret** (not a build secret):

```
Secret name: GEMINI_API_KEY
Value: your-gemini-api-key-from-google-ai-studio
```

> Use the Lovable secrets tool or Supabase Dashboard → Edge Functions → Secrets.

---

## Function Code

**File**: `supabase/functions/analyze-decision/index.ts`

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

// ── Schema (mirrors frontend) ──────────────────────────────
const VerdictSchema = z.object({
  verdict: z.enum(["Proceed", "Pause", "Kill"]),
  confidence: z.number().int().min(0).max(100),
  biggest_risk: z.string().max(120),
  what_breaks: z.string().max(120),
  action_lock: z.string().max(120),
  input_type: z.enum(["decision", "claim", "deal"]),
});

const RequestSchema = z.object({
  input: z.string().min(1).max(5000),
  session_id: z.string().uuid().optional(),
});

// ── System Prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `You are Kill-Switch, a ruthless decision auditor. You receive a decision, claim, or deal that a user is about to act on. Your job is to return a structured 5-line verdict.

Rules:
1. Classify input_type as "decision", "claim", or "deal".
2. Assign verdict: "Kill" (stop immediately), "Pause" (needs more info), or "Proceed" (execute now).
3. confidence: 0-100 integer. Be honest — low confidence is fine.
4. biggest_risk: ≤120 chars. The single most dangerous thing about acting on this.
5. what_breaks: ≤120 chars. The one assumption or dependency that, if wrong, collapses everything.
6. action_lock: ≤120 chars. The one concrete action the user must take before (or instead of) acting.

Respond ONLY with valid JSON matching this exact shape:
{
  "verdict": "Kill" | "Pause" | "Proceed",
  "confidence": <number>,
  "biggest_risk": "<string>",
  "what_breaks": "<string>",
  "action_lock": "<string>",
  "input_type": "decision" | "claim" | "deal"
}`;

// ── Handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    // Validate JWT (optional — allows anon usage)
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims) {
        userId = data.claims.sub as string;
      }
    }

    // ── Input validation ───────────────────────────────────
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { input, session_id } = parsed.data;
    const start = Date.now();

    // ── Call Gemini API ────────────────────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: input }] },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errBody);
      throw new Error(`Gemini API returned ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Empty response from Gemini");
    }

    // ── Parse & validate verdict ───────────────────────────
    const verdictParsed = VerdictSchema.safeParse(JSON.parse(rawText));
    if (!verdictParsed.success) {
      console.error("Schema validation failed:", verdictParsed.error);
      throw new Error("LLM output did not match expected schema");
    }

    const verdict = verdictParsed.data;
    const latencyMs = Date.now() - start;

    // ── Log to database ────────────────────────────────────
    const { error: insertError } = await supabase.from("decisions").insert({
      user_id: userId,
      raw_input: input,
      input_type: verdict.input_type,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      biggest_risk: verdict.biggest_risk,
      what_breaks: verdict.what_breaks,
      action_lock: verdict.action_lock,
      latency_ms: latencyMs,
      model_version: "gemini-2.0-flash",
      session_id: session_id ?? null,
    });

    if (insertError) {
      console.error("DB insert error:", insertError);
      // Don't fail the request — verdict was generated successfully
    }

    // ── Return verdict ─────────────────────────────────────
    return new Response(
      JSON.stringify({ ...verdict, latency_ms: latencyMs }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

---

## Deployment

### Via Lovable Cloud

1. Create the file at `supabase/functions/analyze-decision/index.ts`
2. Add `GEMINI_API_KEY` as a runtime secret
3. Deploy automatically via Lovable Cloud

### Via Supabase CLI (manual)

```bash
# From project root
supabase functions deploy analyze-decision --no-verify-jwt
```

---

## Client Integration

### Frontend call pattern

```typescript
// src/lib/api.ts
import { supabase } from "@/integrations/supabase/client";

export async function analyzeDecision(input: string, sessionId?: string) {
  const { data, error } = await supabase.functions.invoke("analyze-decision", {
    body: { input, session_id: sessionId },
  });

  if (error) throw new Error(error.message);
  return data as KillSwitchOutput & { latency_ms: number };
}
```

### Replace mock in KillSwitchForm.tsx

```typescript
// Replace mockAnalyze(input) with:
import { analyzeDecision } from "@/lib/api";

const result = await analyzeDecision(input, sessionId);
setVerdict(result);
setLatencyMs(result.latency_ms);
```

---

## Schema Reference

The edge function output is validated against this Zod schema (shared between frontend and backend):

| Field | Type | Constraint | Description |
|---|---|---|---|
| `verdict` | enum | `Proceed \| Pause \| Kill` | The non-negotiable recommendation |
| `confidence` | integer | 0–100 | Model's self-assessed certainty |
| `biggest_risk` | string | ≤120 chars | Single greatest risk of acting |
| `what_breaks` | string | ≤120 chars | The assumption that collapses everything |
| `action_lock` | string | ≤120 chars | One concrete action before proceeding |
| `input_type` | enum | `decision \| claim \| deal` | Classification of user input |

---

## Error Handling

| Status | Cause | Client Action |
|---|---|---|
| `400` | Invalid input (empty, too long) | Show validation error |
| `401` | JWT expired or invalid | Re-authenticate user |
| `500` + `GEMINI_API_KEY not configured` | Missing secret | Admin must add secret |
| `500` + `Gemini API returned 429` | Rate limited | Retry with backoff |
| `500` + `Schema validation failed` | LLM hallucinated bad JSON | Retry once, then show fallback |

---

## Cost & Rate Limits

| Model | Input | Output | RPM (free tier) |
|---|---|---|---|
| `gemini-2.0-flash` | $0.10/1M tokens | $0.40/1M tokens | 15 RPM |
| `gemini-2.5-pro` | $1.25/1M tokens | $10/1M tokens | 5 RPM |

**Estimated cost per decision**: ~$0.0002 (flash) — ~200 input tokens, ~80 output tokens.

> For production: use `gemini-2.0-flash` for speed + cost. Reserve `gemini-2.5-pro` for a future "deep analysis" mode.

---

## Use-Case Mapping (Frontend → Backend)

| Audience | Example Input | Expected Verdict Pattern |
|---|---|---|
| **Founders** | "Should I take this term sheet at $8M pre?" | `deal` → high-confidence Kill/Proceed |
| **Operators** | "Fire the vendor mid-sprint and bring in-house" | `decision` → Kill (irreversible) |
| **Sales** | "Give 40% discount to close Q4" | `deal` → Pause (needs more context) |
| **Investors** | "This thesis assumes 30% CAGR for 5 years" | `claim` → Kill/Pause (challenge assumptions) |
| **Freelancers** | "Drop this client who pays 60% of revenue" | `decision` → Pause (concentration risk) |
