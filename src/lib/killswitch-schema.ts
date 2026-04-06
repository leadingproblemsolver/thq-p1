import { z } from 'zod';

export const KillSwitchSchema = z.object({
  verdict: z.enum(['Proceed', 'Pause', 'Kill']),
  confidence: z.number().int().min(0).max(100),
  biggest_risk: z.string().max(120),
  what_breaks: z.string().max(120),
  action_lock: z.string().max(120),
  input_type: z.enum(['decision', 'claim', 'deal']),
});

export type KillSwitchOutput = z.infer<typeof KillSwitchSchema>;

// Mock analysis for demo (will be replaced with real LLM call)
export function mockAnalyze(input: string): KillSwitchOutput {
  const words = input.toLowerCase();
  
  // Simple heuristic mock
  const isRisky = words.includes('all') || words.includes('everything') || words.includes('quit') || words.includes('fire');
  const isDeal = words.includes('deal') || words.includes('contract') || words.includes('buy') || words.includes('sell') || words.includes('invest');
  const isClaim = words.includes('claim') || words.includes('said') || words.includes('heard') || words.includes('believe');
  
  const input_type = isDeal ? 'deal' : isClaim ? 'claim' : 'decision';
  
  if (isRisky) {
    return {
      verdict: 'Kill',
      confidence: 85 + Math.floor(Math.random() * 10),
      biggest_risk: 'Irreversible action with no fallback or recovery path identified.',
      what_breaks: 'One contradictory data point or missed dependency collapses the entire premise.',
      action_lock: 'List 3 specific rollback options before taking any action.',
      input_type,
    };
  }
  
  if (input.length < 30) {
    return {
      verdict: 'Pause',
      confidence: 60 + Math.floor(Math.random() * 15),
      biggest_risk: 'Insufficient context to evaluate — decision is underspecified.',
      what_breaks: 'Any unstated assumption about scope, timeline, or stakeholder impact.',
      action_lock: 'Write the decision in one complete sentence with expected outcome.',
      input_type,
    };
  }
  
  return {
    verdict: 'Proceed',
    confidence: 70 + Math.floor(Math.random() * 20),
    biggest_risk: 'Execution delay introduces opportunity cost exceeding inaction risk.',
    what_breaks: 'External dependency failing to deliver on the assumed timeline.',
    action_lock: 'Execute the first concrete step within the next 30 minutes.',
    input_type,
  };
}
