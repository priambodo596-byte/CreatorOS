'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Command,
  Save,
  History,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import {
  StudioMode,
  STUDIO_MODES,
  AI_MODELS,
  ChatMessage,
  SavedDocument,
  getModelById,
  getModeById,
} from '@/lib/ai-studio-models';
import { StudioLeftSidebar } from '@/components/ai-studio/studio-left-sidebar';
import { StudioRightSidebar } from '@/components/ai-studio/studio-right-sidebar';
import { StudioBottomToolbar } from '@/components/ai-studio/studio-bottom-toolbar';
import { ModePanel } from '@/components/ai-studio/studio-mode-panels';

export default function AIStudioPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [mode, setMode] = useState<StudioMode>('chat');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(70);
  const [creativity, setCreativity] = useState(80);
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState('Casual');
  const [audience, setAudience] = useState('General');

  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canContinue, setCanContinue] = useState(false);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Set mode from URL params
  useEffect(() => {
    const modeParam = searchParams.get('mode') as StudioMode;
    if (modeParam && STUDIO_MODES.some((m) => m.id === modeParam)) {
      setMode(modeParam);
    }
  }, [searchParams]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setRightSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content, title, mode]);

  const handleNewConversation = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        title: `New ${getModeById(mode)?.label ?? 'Chat'}`,
        mode,
        model,
      })
      .select('*')
      .single();

    if (error || !data) {
      toast({ title: 'Failed to create conversation', description: error?.message, variant: 'destructive' });
      return;
    }

    setActiveConversationId(data.id);
    setMessages([]);
    setContent('');
    setTitle('');
  }, [mode, model, toast]);

  const handleSelectConversation = useCallback(async (id: string) => {
    if (!id) {
      setActiveConversationId(null);
      setMessages([]);
      setContent('');
      return;
    }
    setActiveConversationId(id);
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(
        data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          reasoning: m.metadata?.reasoning,
          timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          attachments: m.attachments || [],
        })),
      );
      const conv = data[0];
      if (conv?.metadata?.content) setContent(conv.metadata.content);
    }
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    if (activeConversationId) {
      await supabase.from('ai_messages').insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: text,
      });
    }

    // Simulate AI streaming response
    const aiResponse = generateSimulatedResponse(text, mode);
    const aiMsgId = (Date.now() + 1).toString();
    let streamedContent = '';

    const streamInterval = setInterval(() => {
      const words = aiResponse.split(' ');
      const targetLength = Math.min(streamedContent.split(' ').length + 3, words.length);
      streamedContent = words.slice(0, targetLength).join(' ');

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === aiMsgId);
        if (existing) {
          return prev.map((m) => (m.id === aiMsgId ? { ...m, content: streamedContent } : m));
        }
        return [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant' as const,
            content: streamedContent,
            timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          },
        ];
      });

      if (targetLength >= words.length) {
        clearInterval(streamInterval);
        setIsGenerating(false);
        setCanContinue(true);
        if (activeConversationId) {
          supabase.from('ai_messages').insert({
            conversation_id: activeConversationId,
            role: 'assistant',
            content: aiResponse,
          });
        }
      }
    }, 50);
  }, [activeConversationId, isGenerating, mode]);

  const handleGenerate = useCallback(() => {
    if (mode === 'chat') {
      handleSendMessage(content);
    } else {
      setIsGenerating(true);
      setCanContinue(false);
      setTimeout(() => {
        setIsGenerating(false);
        setCanContinue(true);
      }, 2000);
    }
  }, [mode, content, handleSendMessage]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    toast({ title: 'Generation stopped' });
  }, [toast]);

  const handleContinue = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast({ title: 'Continuing generation...' });
    }, 1500);
  }, [toast]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      toast({ title: 'Nothing to save', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('ai_documents').insert({
      title: title || `Untitled ${getModeById(mode)?.label ?? 'Document'}`,
      type: mode,
      content,
      model,
      metadata: { language, tone, audience },
    });
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document saved' });
    }
  }, [content, title, mode, model, language, tone, audience, toast]);

  const handleSelectPrompt = useCallback((promptContent: string) => {
    setContent(promptContent);
    if (mode === 'chat') {
      handleSendMessage(promptContent);
    }
  }, [mode, handleSendMessage]);

  const handleSelectDocument = useCallback((doc: SavedDocument) => {
    setContent(doc.content);
    setTitle(doc.title);
    if (doc.type !== mode) {
      setMode(doc.type);
    }
    toast({ title: `Loaded: ${doc.title}` });
  }, [mode, toast]);

  const currentModel = getModelById(model);
  const currentMode = getModeById(mode);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background/50">
      {/* Left Sidebar */}
      <AnimatePresence>
        {leftSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden border-r border-border/50"
          >
            <StudioLeftSidebar
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onSelectPrompt={handleSelectPrompt}
              onSelectDocument={handleSelectDocument}
              mode={mode}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-12 items-center justify-between border-b border-border/50 glass-strong px-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setLeftSidebarOpen((prev) => !prev)}
            >
              {leftSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>

            {/* Mode tabs */}
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin">
              {STUDIO_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                    mode === m.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', mode === m.id ? m.bg : 'bg-muted-foreground/30')} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Model badge */}
            <Badge variant="outline" className="gap-1.5 text-xs">
              {currentModel && (
                <>
                  <span className={cn('h-1.5 w-1.5 rounded-full', currentModel.bg)} />
                  {currentModel.name}
                </>
              )}
            </Badge>

            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleSave} title="Save (Ctrl+S)">
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShowVersionHistory((prev) => !prev)}
              title="Version History"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setRightSidebarOpen((prev) => !prev)}
            >
              {rightSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Editor area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Title input */}
          {mode !== 'chat' && (
            <div className="px-6 pt-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Untitled ${currentMode?.label ?? 'Document'}`}
                className="w-full bg-transparent font-display text-xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          )}

          {/* Mode panel */}
          <div className="flex-1 overflow-hidden">
            <ModePanel
              mode={mode}
              content={content}
              setContent={setContent}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              messages={messages}
              onSendMessage={handleSendMessage}
              model={model}
              language={language}
              tone={tone}
              audience={audience}
              temperature={temperature}
            />
          </div>

          {/* Bottom toolbar */}
          <StudioBottomToolbar
            model={model}
            setModel={setModel}
            temperature={temperature}
            setTemperature={setTemperature}
            creativity={creativity}
            setCreativity={setCreativity}
            language={language}
            setLanguage={setLanguage}
            tone={tone}
            setTone={setTone}
            audience={audience}
            setAudience={setAudience}
            onGenerate={handleGenerate}
            onStop={handleStop}
            onContinue={handleContinue}
            isGenerating={isGenerating}
            canContinue={canContinue}
            canGenerate={!!content.trim() || mode === 'chat'}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <AnimatePresence>
        {rightSidebarOpen && !isFullscreen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden border-l border-border/50"
          >
            <StudioRightSidebar
              content={content}
              title={title}
              mode={mode}
              model={model}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <CommandPalette
            mode={mode}
            setMode={setMode}
            model={model}
            setModel={setModel}
            onClose={() => setShowCommandPalette(false)}
            onNewConversation={handleNewConversation}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

function CommandPalette({
  mode,
  setMode,
  model,
  setModel,
  onClose,
  onNewConversation,
  onSave,
}: {
  mode: StudioMode;
  setMode: (m: StudioMode) => void;
  model: string;
  setModel: (m: string) => void;
  onClose: () => void;
  onNewConversation: () => void;
  onSave: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = [
    ...STUDIO_MODES.map((m) => ({
      label: `Switch to ${m.label}`,
      icon: m.icon,
      action: () => { setMode(m.id); onClose(); },
      category: 'Mode',
    })),
    ...AI_MODELS.map((m) => ({
      label: `Use ${m.name}`,
      icon: m.icon,
      action: () => { setModel(m.id); onClose(); },
      category: 'Model',
    })),
    { label: 'New Conversation', icon: 'plus', action: () => { onNewConversation(); onClose(); }, category: 'Action' },
    { label: 'Save Document', icon: 'save', action: () => { onSave(); onClose(); }, category: 'Action' },
  ];

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="fixed left-1/2 top-1/3 z-50 w-full max-w-xl -translate-x-1/2"
      >
        <div className="glass-strong rounded-2xl border border-border/50 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
            <Command className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
                if (e.key === 'Enter' && filtered[0]) filtered[0].action();
              }}
            />
            <kbd className="rounded glass px-1.5 py-0.5 text-xs text-muted-foreground">ESC</kbd>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin p-2">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No commands found</p>
            ) : (
              filtered.map((cmd, i) => (
                <button
                  key={i}
                  onClick={cmd.action}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg glass">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="flex-1">{cmd.label}</span>
                  <Badge variant="outline" className="text-xs">{cmd.category}</Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Simulated AI Response ────────────────────────────────────────────────────

function generateSimulatedResponse(prompt: string, mode: StudioMode): string {
  const responses: Record<StudioMode, string> = {
    chat: `Here's my response to "${prompt}":\n\nBased on your request, I'd recommend the following approach:\n\n1. **Start with research** - Understanding your audience is key\n2. **Create a hook** - The first 15 seconds matter most\n3. **Structure your content** - Use clear sections and transitions\n4. **End with a strong CTA** - Tell viewers exactly what to do next\n\nWould you like me to elaborate on any of these points?`,
    script: `**HOOK (0:00-0:15)**\n"What if I told you that everything you know about ${prompt} is wrong? In the next 10 minutes, I'll show you exactly why..."\n\n**INTRODUCTION (0:15-0:30)**\nHey everyone, welcome back to the channel. Today we're diving deep into ${prompt}, and by the end of this video, you'll have a completely new perspective.\n\n**MAIN CONTENT (0:30-8:00)**\nLet's break this down into 5 key points:\n\n1. **The Foundation** - Understanding the basics\n2. **The Problem** - Why most people get this wrong\n3. **The Solution** - A step-by-step framework\n4. **Real Examples** - Case studies and proof\n5. **The Results** - What happens when you apply this\n\n**CTA (8:00-8:30)**\nIf this video helped you, hit that subscribe button and drop a comment with your biggest takeaway. I'll see you in the next one!`,
    storyboard: `**Scene 1** (0:00-0:05)\nVisual: Close-up of speaker looking directly at camera\nCamera: Medium shot, eye level\nAudio: Hook delivery with dramatic pause\n\n**Scene 2** (0:05-0:15)\nVisual: B-roll of topic-related footage\nCamera: Wide establishing shot\nAudio: Voiceover introducing the topic\n\n**Scene 3** (0:15-0:30)\nVisual: Text overlay with key points\nCamera: Static with text animation\nAudio: Main content delivery`,
    hooks: `1. "What if everything you know about ${prompt} is wrong?"\n   - Emotional Trigger: Curiosity\n   - Click Probability: 87%\n   - Estimated Retention: 92%\n\n2. "I tried ${prompt} for 30 days. Here's what happened."\n   - Emotional Trigger: FOMO\n   - Click Probability: 84%\n   - Estimated Retention: 88%\n\n3. "The truth about ${prompt} nobody tells you"\n   - Emotional Trigger: Mystery\n   - Click Probability: 82%\n   - Estimated Retention: 85%\n\n4. "Stop doing ${prompt} like this immediately"\n   - Emotional Trigger: Urgency\n   - Click Probability: 79%\n   - Estimated Retention: 81%\n\n5. "How ${prompt} changed my life in 30 days"\n   - Emotional Trigger: Inspiration\n   - Click Probability: 76%\n   - Estimated Retention: 78%`,
    cta: `1. **Subscribe CTA**: "If you found this helpful, hit subscribe and the bell icon so you never miss an upload!"\n   - Placement: End of video\n   - Engagement Score: 85%\n\n2. **Comment CTA**: "Drop a comment below with your biggest takeaway from this video!"\n   - Placement: Mid-video + end\n   - Engagement Score: 78%\n\n3. **Link CTA**: "Check the description for all the resources I mentioned in this video."\n   - Placement: Throughout video\n   - Engagement Score: 72%\n\n4. **Like CTA**: "If this video helped you, smash that like button. It really helps the channel!"\n   - Placement: End of video\n   - Engagement Score: 80%`,
    rewrite: `Here's the rewritten version:\n\nThe original content has been transformed with a more engaging, viral-oriented style. Key changes include:\n\n- Stronger opening hook with curiosity gap\n- Shorter, punchier sentences for better pacing\n- More emotional language and personal anecdotes\n- Clearer call-to-action with urgency\n- Improved readability and flow\n\nThe rewritten content maintains your core message while optimizing for engagement and retention.`,
    translate: `Here's the translation:\n\nThe content has been translated while preserving:\n- Original tone and voice\n- SEO keywords and structure\n- Formatting (headings, lists, bold)\n- Emotional resonance and impact\n\nTranslation notes: Some cultural references have been adapted for the target audience while maintaining the original meaning.`,
  };
  return responses[mode] || responses.chat;
}
