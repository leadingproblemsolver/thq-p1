import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type OutcomeResult = "success" | "failure" | "mixed";

interface OutcomeLoggerProps {
  decisionId: string | null;
  onLogged: (result: OutcomeResult) => void;
}

/**
 * 1-click outcome capture per product.md §6 step 5.
 * Wiring: POST { decision_id, result } to /functions/v1/log-outcome.
 */
export default function OutcomeLogger({ decisionId, onLogged }: OutcomeLoggerProps) {
  const [acted, setActed] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleResult = async (result: OutcomeResult) => {
    setSubmitted(true);
    // TODO (post Cloud): supabase.functions.invoke('log-outcome', { body: { decision_id, result } })
    console.log("[outcome]", { decisionId, result });
    toast.success("Outcome locked. Next decision sharper.");
    onLogged(result);
  };

  if (submitted) return null;

  if (acted === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <p className="text-xs uppercase tracking-widest text-muted-foreground text-center">
          Did you act on this?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setActed(true)} variant="outline" className="text-xs uppercase tracking-widest">
            Yes, I acted
          </Button>
          <Button onClick={() => setActed(false)} variant="ghost" className="text-xs uppercase tracking-widest">
            Not yet
          </Button>
        </div>
      </motion.div>
    );
  }

  if (acted === false) {
    // Log silently as no-action and dismiss
    onLogged("mixed");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground text-center">
        How did it land?
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => handleResult("success")} variant="outline" className="text-xs uppercase tracking-widest border-proceed/40 hover:bg-proceed/10">
          Success
        </Button>
        <Button onClick={() => handleResult("mixed")} variant="outline" className="text-xs uppercase tracking-widest border-pause/40 hover:bg-pause/10">
          Mixed
        </Button>
        <Button onClick={() => handleResult("failure")} variant="outline" className="text-xs uppercase tracking-widest border-kill/40 hover:bg-kill/10">
          Failure
        </Button>
      </div>
    </motion.div>
  );
}
