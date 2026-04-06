import { motion } from "framer-motion";
import KillSwitchForm from "@/components/KillSwitchForm";

const useCases = [
  { label: "Founders", example: "Should I take this term sheet?" },
  { label: "Operators", example: "Do I fire this vendor mid-sprint?" },
  { label: "Sales", example: "Is this deal worth the discount?" },
  { label: "Investors", example: "Does this thesis still hold?" },
  { label: "Freelancers", example: "Should I drop this client?" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-50" />

      {/* Moving banner overlay */}
      <div className="fixed top-0 left-0 right-0 z-40 overflow-hidden bg-kill/10 border-b border-kill/20 backdrop-blur-sm">
        <motion.div
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
          className="whitespace-nowrap py-1.5 text-xs tracking-widest text-kill/80 font-mono"
        >
          Our goal: turn your decision into a practical, high-impact fast — so you save time, cut costs, and avoid wasted effort.
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 pt-16 pb-12 sm:pt-24 sm:pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-kill/30 bg-kill/5 text-kill text-xs uppercase tracking-widest font-sans font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-kill animate-pulse" />
            Decision Auditor Active
          </div>
          <h1 className="font-sans text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Kill-Switch
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Paste the content you intend to act on. Get an immediate, non‑negotiable verdict
            identifying the single greatest risk and the one action that will either make or break it.
          </p>
        </motion.div>

        {/* Use-case chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl"
        >
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.06 }}
              className="group relative"
            >
              <span className="inline-block px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground uppercase tracking-widest cursor-default hover:border-kill/40 hover:text-foreground transition-colors">
                {uc.label}
              </span>
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                "{uc.example}"
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Main form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full"
        >
          <KillSwitchForm />
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-auto pt-16 pb-6 text-center text-xs text-muted-foreground/50 uppercase tracking-widest"
        >
          Every decision logged is ammunition for the next version
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
