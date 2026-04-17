# Edge Function — `analyze-decision` (Lovable AI Gateway / Gemini)

> **Single source of truth** for the Decision Kill-Switch verdict engine.
> Deploy this once Lovable Cloud is enabled. Until then the frontend falls back
> to `mockAnalyze` in `src/lib/killswitch-schema.ts`.

---

## 1. Endpoint contract

| Field           | Value |
|-----------------|-------|
| **Path**        | `POST /functions/v1/analyze-decision` |
| **Auth**        | Public (anon allowed). JWT validated **in code** when present. |
| **CORS**        | Open (`*`) — frontend lives on `*.lovable.app`. |
| **Model**       | `google/gemini-3-flash-preview` via Lovable AI Gateway |
| **Secret used** | `LOVABLE_API_KEY` (auto-provisioned by Lovable Cloud — **do not ask the user for it**) |

### Request body

```json
{
  "input_text": "Should I increase price from $29 to $49 before launch?",
  "anon_session_id": "8f42b1c3-5d9e-4a7b-b2e1-9c3f4d5a6e7b"
}
```

### Response — verdict generated

```json
{
  "decision_id": "uuid",
  "output": {
    "verdict": "Proceed",
    "biggest_risk": "Conversion drops below break-even on the first cohort.",
    "what_breaks": "Conversion drops > 30% on the first 50 users.",
    "do_this_now": "Launch at $49 and track conversion on first 50 users.",
    "confidence": 78
  },
  "latency_ms": 1840
}
```

### Response — auth gate triggered

```json
{ "requires_auth": true }
```

### Response — error

HTTP `429` (rate limited) or `402` (credits exhausted) are surfaced verbatim
to the frontend, which renders a toast.

```json
{ "error": "Rate limited" }
```

---

## 2. Server-side flow

1. **CORS preflight** → return immediately on `OPTIONS`.
2. **Validate body** with Zod (`input_text` 1–4000 chars, `anon_session_id` UUID).
3. **Upsert session** in `public.sessions` (table from `schema.sql §3.3`).
4. **Gate check**: if `session.free_decision_used = true` AND no JWT in header
   → log `auth_required` event → return `{ requires_auth: true }`.
5. **Call Lovable AI Gateway** with strict system prompt + tool calling
   (forces structured 5-field output — never freeform text).
6. **Quality filter**: reject vague / hedged / multi-risk outputs.
   On failure regenerate **once**; mark `structure_compliant = false` if the
   second pass also fails.
7. **Persist** in `public.decisions` (table from `schema.sql §3.4`).
8. **Log events** `decision_submitted` + `verdict_generated`
   (`schema.sql §3.6`).
9. **Mark `free_decision_used = true`** on the session.
10. Return `{ decision_id, output, latency_ms }`.

---

## 3. Implementation — `supabase/functions/analyze-decision/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  input_text: z.string().min(1).max(4000),
  anon_session_id: z.string().uuid(),
});

const VerdictSchema = z.object({
  verdict: z.enum(["Proceed", "Pause", "Kill"]),
  biggest_risk: z.string().min(8).max(240),
  what_breaks: z.string().min(8).max(240),
  do_this_now: z.string().min(8).max(240),
  confidence: z.number().int().min(0).max(100),
});

const SYSTEM_PROMPT = `You are a high-stakes decision validator.

Output EXACTLY 5 structured fields via the provided tool. No prose, no hedging.

Rules:
- Be decisive. Default to KILL if unclear, weak, or asymmetric.
- Prioritize downside risk over upside.
- ONE risk only — never multiple.
- "do_this_now" must be a single immediate concrete action, not advice.
- Forbidden phrases: "it depends", "might", "maybe", "perhaps", "consider", "generally", "usually".

Evaluate using: asymmetric risk, reversibility, evidence strength, hidden downside.

Decide:
- PROCEED only if: capped downside, clear upside, reversible, timing matters.
- PAUSE if: missing one key variable, depends on external unknown, no urgency.
- KILL if: structural flaw, asymmetric downside, bad bet even if executed well.`;

const VAGUE = [/\bit depends\b/i, /\bmight\b/i, /\bmaybe\b/i, /\bperhaps\b/i, /\bconsider\b/i, /\bgenerally\b/i, /\busually\b/i];

function qualityCheck(o: z.infer<typeof VerdictSchema>): boolean {
  const blob = `${o.biggest_risk} ${o.what_breaks} ${o.do_this_now}`;
  if (VAGUE.some((re) => re.test(blob))) return false;
  if (/,/.test(o.biggest_risk) && /\band\b/i.test(o.biggest_risk)) return false;
  return true;
}

async function callGateway(input: string): Promise<z.infer<typeof VerdictSchema>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Decision:\n${input}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "emit_verdict",
          description: "Emit the strict 5-field decision verdict.",
          parameters: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["Proceed", "Pause", "Kill"] },
              biggest_risk: { type: "string", minLength: 8, maxLength: 240 },
              what_breaks:  { type: "string", minLength: 8, maxLength: 240 },
              do_this_now:  { type: "string", minLength: 8, maxLength: 240 },
              confidence:   { type: "integer", minimum: 0, maximum: 100 },
            },
            required: ["verdict", "biggest_risk", "what_breaks", "do_this_now", "confidence"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_verdict" } },
    }),
  });

  if (resp.status === 429) throw new Error("429: Rate limited");
  if (resp.status === 402) throw new Error("402: Payment required");
  if (!resp.ok) throw new Error(`Gateway ${resp.status}`);

  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool call returned");
  return VerdictSchema.parse(JSON.parse(args));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = BodySchema.parse(await req.json());
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve authed user (if any) from JWT
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = data.user?.id ?? null;
    }

    // Upsert session
    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .upsert(
        { anon_session_id: body.anon_session_id, user_id: userId, last_seen_at: new Date().toISOString() },
        { onConflict: "anon_session_id" }
      )
      .select()
      .single();
    if (sErr) throw sErr;

    // Gate
    if (session.free_decision_used && !userId) {
      await supabase.from("events").insert({
        session_id: session.id,
        event_type: "auth_required",
        payload: { reason: "free_quota_used" },
      });
      return new Response(JSON.stringify({ requires_auth: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("events").insert({
      session_id: session.id, user_id: userId,
      event_type: "decision_submitted",
      payload: { len: body.input_text.length },
    });

    // Generate (with single regenerate on quality failure)
    const t0 = Date.now();
    let output = await callGateway(body.input_text);
    let compliant = qualityCheck(output);
    if (!compliant) {
      output = await callGateway(body.input_text + "\n\nBe more decisive and specific.");
      compliant = qualityCheck(output);
    }
    const latency = Date.now() - t0;

    // Persist
    const { data: decision, error: dErr } = await supabase
      .from("decisions")
      .insert({
        session_id: session.id,
        user_id: userId,
        input_text: body.input_text,
        verdict: output.verdict,
        biggest_risk: output.biggest_risk,
        what_breaks: output.what_breaks,
        do_this_now: output.do_this_now,
        confidence: output.confidence,
        latency_ms: latency,
        model_version: "google/gemini-3-flash-preview",
        structure_compliant: compliant,
      })
      .select()
      .single();
    if (dErr) throw dErr;

    await Promise.all([
      supabase.from("events").insert({
        session_id: session.id, user_id: userId,
        event_type: "verdict_generated",
        payload: { decision_id: decision.id, verdict: output.verdict, confidence: output.confidence, compliant },
      }),
      supabase.from("sessions").update({ free_decision_used: true }).eq("id", session.id),
    ]);

    return new Response(JSON.stringify({
      decision_id: decision.id, output, latency_ms: latency,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const status = msg.startsWith("429") ? 429 : msg.startsWith("402") ? 402 : 500;
    console.error("analyze-decision error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

## 4. Companion endpoints (deploy alongside)

### `POST /functions/v1/log-outcome`
```json
{ "decision_id": "uuid", "result": "success" | "failure" | "mixed", "note": "optional" }
```
Inserts into `public.outcomes` and emits `outcome_logged` event.

### `POST /functions/v1/log-event`
```json
{ "anon_session_id": "uuid", "event_type": "user_acted", "payload": {} }
```
Generic event logger for client-side analytics (used by `OutcomeLogger.tsx`,
`AuthModal.tsx`).

### `POST /functions/v1/link-session`
```json
{ "anon_session_id": "uuid" }
```
Authed-only. Calls the `link_anon_session` RPC from `schema.sql §7` to merge
the anon row into the user account on signup/signin.

---

## 5. References

- **Schema** → `backend/docs_b/schema.sql`
  - Sessions: `§3.3` · Decisions: `§3.4` · Outcomes: `§3.5` · Events: `§3.6`
  - KPI views: `§8` · Helper RPCs: `§7`, `§9`
- **Frontend wiring** → `src/components/KillSwitchForm.tsx` (`callAnalyze`)
- **Manual setup steps** → `backend/docs_b/manual_tasks.md`
- **Lovable AI docs** → https://docs.lovable.dev/features/ai
