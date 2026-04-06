import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VerdictCard from "@/components/VerdictCard";
import FeedbackModal from "@/components/FeedbackModal";
import { mockAnalyze, type KillSwitchOutput } from "@/lib/killswitch-schema";
import { toast } from "sonner";

export default function KillSwitchForm() {
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<KillSwitchOutput | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [decisionCount, setDecisionCount] = useState(0);

  const runKillSwitch = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setVerdict(null);
    setFeedbackGiven(false);

    const start = Date.now();

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const result = mockAnalyze(input);
    const elapsed = Date.now() - start;

    setVerdict(result);
    setLatencyMs(elapsed);
    setLoading(false);
  }, [input]);

  const handleFeedback = useCallback((feedback: string) => {
    setFeedbackGiven(true);
    setDecisionCount((c) => c + 1);
    toast.success("Decision locked and logged.", {
      description: `${decisionCount + 1} decisions classified.`,
    });
    console.log("Decision logged:", { verdict, feedback });
  }, [verdict, decisionCount]);

  const reset = useCallback(() => {
    setInput("");
    setVerdict(null);
    setFeedbackGiven(false);
    setLatencyMs(0);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Input area */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-semibold block">
          What are you about to act on?
        </label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the exact decision, claim, or deal you're about to execute..."
          disabled={loading || (!!verdict && !feedbackGiven)}
          className="min-h-[140px] bg-card border-border text-foreground font-mono text-sm placeholder:text-muted-foreground/50 resize-none focus:border-kill focus:ring-kill/20"
        />
      </div>

      {/* Action button */}
      {!verdict && (
        <Button
          onClick={runKillSwitch}
          disabled={loading || !input.trim()}
          variant="killswitch"
          size="lg"
          className="w-full h-14 text-base relative overflow-hidden"
        >
          {loading ? (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              RUNNING KILL-SWITCH...
            </motion.span>
          ) : (
            <>
              <span className="relative z-10">⚡ RUN KILL-SWITCH</span>
            </>
          )}
        </Button>
      )}

      {/* Verdict */}
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

            {!feedbackGiven && <FeedbackModal onSubmit={handleFeedback} />}

            {feedbackGiven && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="text-center text-xs text-muted-foreground uppercase tracking-widest">
                  ✓ Decision #{decisionCount} classified & locked
                </div>
                <Button
                  onClick={reset}
                  variant="outline"
                  className="w-full text-xs uppercase tracking-widest"
                >
                  Run Another Decision
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decision counter */}
      {decisionCount > 0 && !verdict && (
        <div className="text-center text-xs text-muted-foreground">
          {decisionCount} decision{decisionCount !== 1 ? 's' : ''} classified this session
        </div>
      )}
    </div>
  );
}
