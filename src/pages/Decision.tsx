import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import VerdictCard from "@/components/VerdictCard";
import { Button } from "@/components/ui/button";
import type { KillSwitchOutput } from "@/lib/killswitch-schema";

/**
 * Read-only shareable verdict view at /decision/:id.
 *
 * Wiring (post Lovable Cloud enablement):
 *   const { data } = await supabase.from('decisions').select('*').eq('id', id).single();
 * RLS allows public read of single decision rows by id (see schema.sql).
 */
const PLACEHOLDER: KillSwitchOutput = {
  verdict: "Pause",
  biggest_risk: "Decision context not loaded — backend is not connected yet.",
  what_breaks: "Lovable Cloud must be enabled to fetch this decision from the database.",
  do_this_now: "Enable Lovable Cloud and deploy schema.sql to activate shareable verdicts.",
  confidence: 95,
};

export default function Decision() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 scanline pointer-events-none z-50" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 space-y-1 text-center"
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            decision · {id?.slice(0, 8)}…
          </p>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">
            Locked Verdict
          </h1>
        </motion.div>

        <VerdictCard verdict={PLACEHOLDER} latencyMs={0} />

        <div className="mt-6 text-center">
          <Link to="/">
            <Button variant="outline" className="text-xs uppercase tracking-widest">
              Run your own decision →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
