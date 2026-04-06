import { motion } from "framer-motion";
import KillSwitchForm from "@/components/KillSwitchForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline pointer-events-none z-50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-12 sm:py-20">
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
            Paste what you're about to act on. Get an instant, non-negotiable verdict
            that surfaces the biggest risk and the one action that breaks or protects it.
          </p>
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
