'use client';

import { motion } from 'framer-motion';
import { Sparkles, X, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function AICopilot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white neon-glow transition-transform hover:scale-110"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Copilot panel */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl glass-strong p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Copilot</p>
                <p className="text-xs text-muted-foreground">Ask me anything</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 max-h-64 overflow-y-auto scrollbar-thin space-y-2">
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <p className="mb-1 font-medium text-primary">AI Copilot</p>
              <p className="text-muted-foreground">
                Hi! I can help you with script ideas, SEO optimization, trend analysis, and more. What would you like to work on?
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Ask AI Copilot..."
              className="min-h-[44px] resize-none"
              rows={1}
            />
            <Button size="icon" className="shrink-0 bg-gradient-to-r from-primary to-accent text-white">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </>
  );
}
