import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VerdictCard from "@/components/VerdictCard";
import OutcomeLogger from "@/components/OutcomeLogger";
import AuthModal from "@/components/AuthModal";
import { mockAnalyze, qualityFilter, type KillSwitchOutput } from "@/lib/killswitch-schema";
import { toast } from "sonner";

const SESSION_KEY = "ks_anon_session_id";
const FREE_USED_KEY = "ks_free_decision_used";
const USER_KEY = "ks_user_id";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function KillSwitchForm() {
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<KillSwitchOutput | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState(false);
  const [decisionCount, setDecisionCount] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [anonSessionId, setAnonSessionId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [freeUsed, setFreeUsed] = useState(false);

  useEffect(() => {
    setAnonSessionId(getOrCreateSessionId());
    setFreeUsed(localStorage.getItem(FREE_USED_KEY) === "true");
    setUserId(localStorage.getItem(USER_KEY));
  }, []);

  const callAnalyze = useCallback(
    async (text: string): Promise<{ output: KillSwitchOutput; decision_id: string; latency_ms: number } | { requires_auth: true }> => {
      // ── Real path (post Lovable Cloud enablement) ──
      // const { data, error } = await supabase.functions.invoke('analyze-decision', {
      //   body: { input_text: text, anon_session_id: anonSessionId },
      // });
      // if (error) throw error;
      // if (data?.requires_auth) return { requires_auth: true };
      // return data;

      // ── Fallback: mock until Cloud is on ──
      const start = Date.now();
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));

      // Enforce 1-free gate client-side as parity with server contract
      if (freeUsed && !userId) return { requires_auth: true };

      let output = mockAnalyze(text);
      const q = qualityFilter(output);
      if (!q.ok) {
        // Regenerate once on quality failure
        output = mockAnalyze(text + " ");
      }
      return {
        output,
        decision_id: crypto.randomUUID(),
        latency_ms: Date.now() - start,
      };
    },
    [anonSessionId, freeUsed, userId]
  );

  const runKillSwitch = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setVerdict(null);
    setOutcomeLogged(false);

    try {
      const res = await callAnalyze(input);

      if ("requires_auth" in res && res.requires_auth) {
        setLoading(false);
        setAuthOpen(true);
        toast.message("Auth required", { description: "1 free decision used. Sign in to continue." });
        return;
      }

      if ("output" in res) {
        setVerdict(res.output);
        setDecisionId(res.decision_id);
        setLatencyMs(res.latency_ms);
        setDecisionCount((c) => c + 1);

        if (!userId && !freeUsed) {
          localStorage.setItem(FREE_USED_KEY, "true");
          setFreeUsed(true);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Surface AI gateway 402/429 errors per Lovable AI guidance
      if (/402|payment/i.test(msg)) {
        toast.error("Credits exhausted", { description: "Add funds in Workspace → Usage." });
      } else if (/429|rate/i.test(msg)) {
        toast.error("Rate limited", { description: "Try again in a moment." });
      } else {
        toast.error("Verdict failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [input, callAnalyze, userId, freeUsed]);

  const handleAuthSuccess = useCallback((uid: string) => {
    localStorage.setItem(USER_KEY, uid);
    setUserId(uid);
    // After auth, user can immediately run the queued decision
    setTimeout(() => runKillSwitch(), 100);
  }, [runKillSwitch]);

  const reset = useCallback(() => {
    setInput("");
    setVerdict(null);
    setDecisionId(null);
    setOutcomeLogged(false);
    setLatencyMs(0);
  }, []);

  const inputLocked = loading || (!!verdict && !outcomeLogged);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-semibold block">
          Paste the exact decision you're about to make
        </label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Should I increase price from $29 to $49 before launch?"
          disabled={inputLocked}
          className="min-h-[140px] bg-card border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/50 resize-none focus:border-kill focus:ring-kill/20"
        />
      </div>

      {!verdict && (
        <Button
          onClick={runKillSwitch}
          disabled={loading || !input.trim()}
          variant="killswitch"
          size="lg"
          className="w-full h-14 text-base relative overflow-hidden"
        >
          {loading ? (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
              RUNNING KILL-SWITCH...
            </motion.span>
          ) : (
            <span className="relative z-10">⚡ RUN KILL-SWITCH</span>
          )}
        </Button>
      )}

      {freeUsed && !userId && !verdict && (
        <p className="text-center text-[10px] uppercase tracking-widest text-pause/80 font-mono">
          1 free decision used · sign in to continue
        </p>
      )}

      <AnimatePresence>
        {verdict && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <VerdictCard verdict={verdict} latencyMs={latencyMs} />

            {!outcomeLogged && (
              <OutcomeLogger
                decisionId={decisionId}
                onLogged={() => setOutcomeLogged(true)}
              />
            )}

            {outcomeLogged && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="text-center text-xs text-muted-foreground uppercase tracking-widest">
                  ✓ Decision #{decisionCount} locked
                </div>
                <Button onClick={reset} variant="outline" className="w-full text-xs uppercase tracking-widest">
                  Run Another Decision
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {decisionCount > 0 && !verdict && (
        <div className="text-center text-xs text-muted-foreground">
          {decisionCount} decision{decisionCount !== 1 ? "s" : ""} classified this session
        </div>
      )}

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        anonSessionId={anonSessionId}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
