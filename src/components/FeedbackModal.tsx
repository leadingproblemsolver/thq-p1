import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackModalProps {
  onSubmit: (feedback: string) => void;
}

export default function FeedbackModal({ onSubmit }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className="rounded-lg border border-border bg-card p-5 space-y-3"
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-semibold">
        Feedback Required
      </p>
      <p className="text-sm text-muted-foreground">
        One sentence: how does this verdict change what you do next?
      </p>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="e.g. I should run this before I act on anything this big..."
        className="min-h-[72px] bg-background border-border text-foreground font-mono text-sm resize-none"
      />
      <Button
        onClick={() => onSubmit(feedback)}
        disabled={feedback.trim().length < 5}
        variant="outline"
        className="w-full text-xs uppercase tracking-widest"
      >
        Submit & Lock Decision
      </Button>
    </motion.div>
  );
}
