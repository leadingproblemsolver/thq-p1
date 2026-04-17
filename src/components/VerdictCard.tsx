import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { KillSwitchOutput } from "@/lib/killswitch-schema";

interface VerdictCardProps {
  verdict: KillSwitchOutput;
  latencyMs: number;
}

const verdictConfig = {
  Kill: { border: "border-kill", text: "text-kill", glow: "glow-kill", bg: "bg-kill/5", bar: "bg-kill" },
  Pause: { border: "border-pause", text: "text-pause", glow: "glow-pause", bg: "bg-pause/5", bar: "bg-pause" },
  Proceed: { border: "border-proceed", text: "text-proceed", glow: "glow-proceed", bg: "bg-proceed/5", bar: "bg-proceed" },
};

function format5Lines(v: KillSwitchOutput): string {
  return [
    `Verdict: ${v.verdict.toUpperCase()}`,
    `Biggest Risk: ${v.biggest_risk}`,
    `What Breaks This: ${v.what_breaks}`,
    `Do This Now: ${v.do_this_now}`,
    `Confidence: ${v.confidence}%`,
  ].join("\n");
}

export default function VerdictCard({ verdict, latencyMs }: VerdictCardProps) {
  const config = verdictConfig[verdict.verdict];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(format5Lines(verdict));
    setCopied(true);
    toast.success("Verdict copied to clipboard");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative rounded-lg border-2 ${config.border} ${config.bg} ${config.glow} p-6 overflow-hidden`}
    >
      <div className="absolute inset-0 scanline pointer-events-none" />

      <div className="relative space-y-4 font-mono text-sm">
        {/* Line 1 — Verdict */}
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

        <div className="border-t border-border/50 my-2" />

        {/* Lines 2-4 — Risk fields */}
        {[
          { label: "Biggest Risk", value: verdict.biggest_risk, delay: 0.18 },
          { label: "What Breaks This", value: verdict.what_breaks, delay: 0.24 },
          { label: "Do This Now", value: verdict.do_this_now, delay: 0.30 },
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

        {/* Line 5 — Confidence */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.36 }}
          className="flex items-baseline gap-3"
        >
          <span className="text-muted-foreground uppercase tracking-wider text-xs">Confidence</span>
          <span className="text-foreground font-bold">{verdict.confidence}%</span>
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden ml-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${verdict.confidence}%` }}
              transition={{ delay: 0.42, duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${config.bar}`}
            />
          </div>
        </motion.div>

        {/* Meta + Copy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between gap-4 pt-2 text-xs text-muted-foreground"
        >
          <span>LATENCY: {latencyMs}ms</span>
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="h-7 text-[10px] uppercase tracking-widest"
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy 5 Lines"}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
