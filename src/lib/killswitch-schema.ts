import { z } from 'zod';

// Strict 5-line contract per product.md
export const KillSwitchSchema = z.object({
  verdict: z.enum(['Proceed', 'Pause', 'Kill']),
  biggest_risk: z.string().min(8).max(180),
  what_breaks: z.string().min(8).max(180),
  do_this_now: z.string().min(8).max(180),
  confidence: z.number().int().min(0).max(100),
});

export type KillSwitchOutput = z.infer<typeof KillSwitchSchema>;

// Server response envelope (mirrors edge function contract)
export const AnalyzeResponseSchema = z.object({
  requires_auth: z.boolean().optional(),
  decision_id: z.string().uuid().optional(),
  output: KillSwitchSchema.optional(),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// Quality filter — reject vague / hedged / multi-risk outputs.
// Returns { ok: true } or { ok: false, reason } so callers can regenerate.
// ─────────────────────────────────────────────────────────────
const VAGUE_PATTERNS = [
  /\bit depends\b/i,
  /\bmight\b/i,
  /\bmaybe\b/i,
  /\bperhaps\b/i,
  /\bconsider\b/i,
  /\bgenerally\b/i,
  /\busually\b/i,
  /\bthinking about\b/i,
];

export function qualityFilter(o: KillSwitchOutput): { ok: true } | { ok: false; reason: string } {
  const blob = `${o.biggest_risk} ${o.what_breaks} ${o.do_this_now}`;
  for (const re of VAGUE_PATTERNS) {
    if (re.test(blob)) return { ok: false, reason: `vague language: ${re}` };
  }
  // Multiple risks = "and" + a comma in biggest_risk → likely two failure modes
  if (/,/.test(o.biggest_risk) && /\band\b/i.test(o.biggest_risk)) {
    return { ok: false, reason: 'multiple risks in biggest_risk' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Mock analyzer — used as fallback when Lovable Cloud is not enabled.
// Will be replaced by edge function `analyze-decision` once Cloud is on.
// ─────────────────────────────────────────────────────────────
export function mockAnalyze(input: string): KillSwitchOutput {
  const w = input.toLowerCase();
  const isRisky = /\b(all|everything|quit|fire|irrevers|loan|bet|crypto|savings)\b/.test(w);
  const hasNumbers = /\$|\d/.test(input);
  const isShort = input.trim().length < 30;

  if (isRisky) {
    return {
      verdict: 'Kill',
      biggest_risk: 'Asymmetric downside with no rollback path if execution slips.',
      what_breaks: 'A single contradicting data point invalidates the entire premise.',
      do_this_now: 'Write 3 specific rollback options on paper before any action.',
      confidence: 88,
    };
  }
  if (isShort) {
    return {
      verdict: 'Pause',
      biggest_risk: 'Decision is undefined — scope and outcome are unstated.',
      what_breaks: 'A clear, specific action is provided with measurable outcome.',
      do_this_now: 'Rewrite the decision in one sentence with target metric.',
      confidence: 95,
    };
  }
  return {
    verdict: 'Proceed',
    biggest_risk: hasNumbers
      ? 'Conversion drops below break-even on the first cohort.'
      : 'Execution delay introduces opportunity cost exceeding inaction risk.',
    what_breaks: 'External dependency fails to deliver on the assumed timeline.',
    do_this_now: 'Execute the first concrete step within the next 30 minutes.',
    confidence: 78,
  };
}
