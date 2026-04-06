import { motion } from "framer-motion";
import type { KillSwitchOutput } from "@/lib/killswitch-schema";

interface VerdictCardProps {
  verdict: KillSwitchOutput;
  latencyMs: number;
}

const verdictConfig = {
  Kill: { border: "border-kill", text: "text-kill", glow: "glow-kill", bg: "bg-kill/5" },
  Pause: { border: "border-pause", text: "text-pause", glow: "glow-pause", bg: "bg-pause/5" },
  Proceed: { border: "border-proceed", text: "text-proceed", glow: "glow-proceed", bg: "bg-proceed/5" },
};

export default function VerdictCard({ verdict, latencyMs }: VerdictCardProps) {
  const config = verdictConfig[verdict.verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative rounded-lg border-2 ${config.border} ${config.bg} ${config.glow} p-6 overflow-hidden`}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none" />

      <div className="relative space-y-4 font-mono text-sm">
        {/* Verdict line */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-baseline gap-3"
        >
          <span className="text-muted-foreground uppercase tracking-wider text-xs">Verdict</span>
          <span className={`text-2xl font-sans font-bold uppercase tracking-widest ${config.text}`}>
            {verdict.verdict}
          </span>
        </motion.div>

        {/* Confidence */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-baseline gap-3"
        >
          <span className="text-muted-foreground uppercase tracking-wider text-xs">Confidence</span>
          <span className="text-foreground font-bold">{verdict.confidence}%</span>
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden ml-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${verdict.confidence}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${config.text === 'text-kill' ? 'bg-kill' : config.text === 'text-pause' ? 'bg-pause' : 'bg-proceed'}`}
            />
          </div>
        </motion.div>

        <div className="border-t border-border/50 my-2" />

        {/* Risk fields */}
        {[
          { label: "Biggest Risk", value: verdict.biggest_risk, delay: 0.2 },
          { label: "What Breaks This", value: verdict.what_breaks, delay: 0.25 },
          { label: "Action Lock", value: verdict.action_lock, delay: 0.3 },
        ].map((field) => (
          <motion.div
            key={field.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: field.delay }}
          >
            <span className="text-muted-foreground uppercase tracking-wider text-xs block mb-1">
              {field.label}
            </span>
            <span className="text-foreground leading-relaxed">{field.value}</span>
          </motion.div>
        ))}

        <div className="border-t border-border/50 my-2" />

        {/* Meta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-4 text-xs text-muted-foreground"
        >
          <span>TYPE: {verdict.input_type.toUpperCase()}</span>
          <span>LATENCY: {latencyMs}ms</span>
          <span>{new Date().toISOString().slice(0, 19)}Z</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
