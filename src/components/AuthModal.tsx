import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anonSessionId: string;
  onAuthSuccess: (userId: string) => void;
}

/**
 * Email + password auth modal. Used as the gate after the 1st free decision.
 *
 * Wiring (post Lovable Cloud enablement):
 *   1. Replace the mock `await fakeAuth(...)` block with `supabase.auth.signUp` /
 *      `supabase.auth.signInWithPassword` calls.
 *   2. On success, POST { anon_session_id, user_id } to /functions/v1/link-session
 *      (or call `link_anon_session` RPC) to merge the anon row into the user row.
 *   3. Log `user_logged_in` event via /functions/v1/log-event.
 */
export default function AuthModal({ open, onOpenChange, anonSessionId, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Enter a valid email and a password (6+ chars).");
      return;
    }
    setLoading(true);
    try {
      // TODO: Replace with real Supabase auth call once Lovable Cloud is enabled.
      // const { data, error } = mode === "signup"
      //   ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      //   : await supabase.auth.signInWithPassword({ email, password });
      await new Promise((r) => setTimeout(r, 600));
      const fakeUserId = crypto.randomUUID();
      onAuthSuccess(fakeUserId);
      toast.success(mode === "signup" ? "Account created. Decisions unlocked." : "Welcome back.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-kill/40 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl tracking-tight">
            {mode === "signup" ? "Unlock unlimited verdicts" : "Sign back in"}
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground">
            1 free decision used · auth required for the next call
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <Input
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="font-mono text-sm"
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="password (6+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="font-mono text-sm"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <Button
            type="submit"
            disabled={loading}
            variant="killswitch"
            className="w-full"
          >
            {loading ? "..." : mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
          </Button>
        </form>

        <AnimatePresence mode="wait">
          <motion.button
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mx-auto block"
            type="button"
          >
            {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
          </motion.button>
        </AnimatePresence>

        <p className="text-[10px] text-muted-foreground/60 text-center font-mono mt-1">
          session: {anonSessionId.slice(0, 8)}…
        </p>
      </DialogContent>
    </Dialog>
  );
}
