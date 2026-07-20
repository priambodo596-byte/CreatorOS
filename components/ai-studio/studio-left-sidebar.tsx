'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Star,
  FileText,
  Trash2,
  Pin,
  PinOff,
  Clock,
  Loader2,
  Sparkles,
  Zap,
  PenLine,
  Clapperboard,
  Link2,
  Languages,
  Edit3,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import {
  BUILTIN_PROMPTS,
  Conversation,
  SavedDocument,
  SavedPrompt,
  STUDIO_MODES,
} from '@/lib/ai-studio-models';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StudioLeftSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onSelectPrompt: (content: string) => void;
  onSelectDocument: (doc: SavedDocument) => void;
  mode: string;
}

type TabId = 'chats' | 'prompts' | 'files';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'prompts', label: 'Prompts', icon: Sparkles },
  { id: 'files', label: 'Files', icon: FileText },
];

// Map builtin prompt icon string -> lucide component
const ICON_MAP: Record<string, typeof PenLine> = {
  'pen-line': PenLine,
  zap: Zap,
  clapperboard: Clapperboard,
  'trending-up': TrendingUp,
  link: Link2,
  languages: Languages,
  'edit-3': Edit3,
  'message-square': MessageSquare,
};

function getIcon(name: string): typeof PenLine {
  return ICON_MAP[name] ?? Sparkles;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StudioLeftSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onSelectPrompt,
  onSelectDocument,
  mode,
}: StudioLeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chats');
  const [search, setSearch] = useState('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);

  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);

  const [busyId, setBusyId] = useState<string | null>(null);

  // ---------- Load conversations ----------
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, mode, model, pinned, created_at, updated_at')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load conversations:', error.message);
        setConversations([]);
        return;
      }
      setConversations((data ?? []) as Conversation[]);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // ---------- Load saved prompts ----------
  const loadSavedPrompts = useCallback(async () => {
    setLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('id, title, content, category, favorite')
        .eq('builtin', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load prompts:', error.message);
        setSavedPrompts([]);
        return;
      }
      setSavedPrompts((data ?? []) as SavedPrompt[]);
    } catch (err) {
      console.error('Failed to load prompts:', err);
      setSavedPrompts([]);
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  // ---------- Load documents ----------
  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('ai_documents')
        .select('id, title, type, content, model, favorite, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load documents:', error.message);
        setDocuments([]);
        return;
      }
      setDocuments((data ?? []) as SavedDocument[]);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadSavedPrompts();
    loadDocuments();
  }, [loadConversations, loadSavedPrompts, loadDocuments]);

  // ---------- Actions ----------
  const togglePin = useCallback(
    async (conv: Conversation) => {
      setBusyId(conv.id);
      const next = !conv.pinned;
      // Optimistic update
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, pinned: next } : c))
      );
      try {
        const { error } = await supabase
          .from('ai_conversations')
          .update({ pinned: next })
          .eq('id', conv.id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to toggle pin:', err);
        // Revert
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, pinned: conv.pinned } : c))
        );
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (conv: Conversation) => {
      setBusyId(conv.id);
      try {
        const { error } = await supabase
          .from('ai_conversations')
          .delete()
          .eq('id', conv.id);
        if (error) throw error;

        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (activeConversationId === conv.id) {
          onSelectConversation('');
        }
      } catch (err) {
        console.error('Failed to delete conversation:', err);
      } finally {
        setBusyId(null);
      }
    },
    [activeConversationId, onSelectConversation]
  );

  const togglePromptFavorite = useCallback(async (prompt: SavedPrompt) => {
    setBusyId(prompt.id);
    const next = !prompt.favorite;
    setSavedPrompts((prev) =>
      prev.map((p) => (p.id === prompt.id ? { ...p, favorite: next } : p))
    );
    try {
      const { error } = await supabase
        .from('ai_prompts')
        .update({ favorite: next })
        .eq('id', prompt.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle prompt favorite:', err);
      setSavedPrompts((prev) =>
        prev.map((p) => (p.id === prompt.id ? { ...p, favorite: prompt.favorite } : p))
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const toggleDocumentFavorite = useCallback(async (doc: SavedDocument) => {
    setBusyId(doc.id);
    const next = !doc.favorite;
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, favorite: next } : d))
    );
    try {
      const { error } = await supabase
        .from('ai_documents')
        .update({ favorite: next })
        .eq('id', doc.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle document favorite:', err);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, favorite: doc.favorite } : d))
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  // ---------- Derived / filtered data ----------
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBuiltinPrompts = BUILTIN_PROMPTS.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSavedPrompts = savedPrompts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDocuments = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.content.toLowerCase().includes(search.toLowerCase())
  );

  // Group documents by type
  const documentsByType = filteredDocuments.reduce<
    Record<string, SavedDocument[]>
  >((acc, doc) => {
    const key = doc.type ?? 'chat';
    (acc[key] ??= []).push(doc);
    return acc;
  }, {});

  const favoriteBuiltin = filteredBuiltinPrompts; // builtin prompts have no favorite flag
  const favoriteSavedPrompts = filteredSavedPrompts.filter((p) => p.favorite);
  const favoriteDocuments = filteredDocuments.filter((d) => d.favorite);

  // ---------- Render helpers ----------
  const renderEmpty = (message: string, icon: typeof MessageSquare) => {
    const Icon = icon;
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <div className="rounded-full glass p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    );
  };

  const renderChats = () => {
    if (loadingConversations) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading conversations…
        </div>
      );
    }
    if (filteredConversations.length === 0) {
      return renderEmpty(
        search ? 'No conversations match your search.' : 'No conversations yet. Start a new chat!',
        MessageSquare
      );
    }
    return (
      <div className="space-y-1">
        {filteredConversations.map((conv) => {
          const isActive = conv.id === activeConversationId;
          const modeConfig = STUDIO_MODES.find((m) => m.id === conv.mode);
          return (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectConversation(conv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectConversation(conv.id);
                }
              }}
              className={cn(
                'group glass glass-hover relative flex cursor-pointer items-start gap-2 rounded-lg p-2.5 transition-all',
                'scrollbar-thin',
                isActive && 'glass-strong border-primary/40 ring-1 ring-primary/30'
              )}
            >
              <div className="mt-0.5 flex-shrink-0">
                {conv.pinned ? (
                  <Pin className="h-4 w-4 text-primary" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      isActive ? 'text-foreground' : 'text-foreground/80'
                    )}
                  >
                    {conv.title || 'Untitled conversation'}
                  </p>
                  {modeConfig && (
                    <span
                      className={cn(
                        'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        modeConfig.bg,
                        modeConfig.color
                      )}
                    >
                      {modeConfig.label}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(conv.updated_at)}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(conv);
                  }}
                  disabled={busyId === conv.id}
                  title={conv.pinned ? 'Unpin conversation' : 'Pin conversation'}
                >
                  {conv.pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv);
                  }}
                  disabled={busyId === conv.id}
                  title="Delete conversation"
                >
                  {busyId === conv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPromptItem = (
    title: string,
    content: string,
    icon: typeof PenLine,
    color: string,
    isFavorite: boolean,
    onSelect: () => void,
    onFavorite?: () => void,
    busy?: boolean
  ) => {
    const Icon = icon;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className="group glass glass-hover flex cursor-pointer items-start gap-2 rounded-lg p-2.5 transition-all"
      >
        <div className={cn('mt-0.5 flex-shrink-0', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground/90">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {content}
          </p>
        </div>
        {onFavorite && (
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'h-7 w-7 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
              isFavorite && 'opacity-100'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            disabled={busy}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  isFavorite ? 'fill-warning text-warning' : 'text-muted-foreground'
                )}
              />
            )}
          </Button>
        )}
      </div>
    );
  };

  const renderPrompts = () => {
    if (loadingPrompts) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading prompts…
        </div>
      );
    }

    const hasBuiltin = filteredBuiltinPrompts.length > 0;
    const hasSaved = filteredSavedPrompts.length > 0;
    const hasFavorites = favoriteSavedPrompts.length > 0;

    if (!hasBuiltin && !hasSaved) {
      return renderEmpty(
        search ? 'No prompts match your search.' : 'No prompts available.',
        Sparkles
      );
    }

    return (
      <div className="space-y-4">
        {/* Favorites */}
        {hasFavorites && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="h-3 w-3 fill-warning text-warning" />
              Favorites
            </p>
            <div className="space-y-1">
              {favoriteSavedPrompts.map((p) =>
                renderPromptItem(
                  p.title,
                  p.content,
                  Sparkles,
                  'text-warning',
                  true,
                  () => onSelectPrompt(p.content),
                  () => togglePromptFavorite(p),
                  busyId === p.id
                )
              )}
            </div>
          </div>
        )}

        {/* Saved prompts */}
        {hasSaved && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <PenLine className="h-3 w-3" />
              Your Prompts
            </p>
            <div className="space-y-1">
              {filteredSavedPrompts
                .filter((p) => !p.favorite)
                .map((p) =>
                  renderPromptItem(
                    p.title,
                    p.content,
                    Sparkles,
                    'text-primary',
                    false,
                    () => onSelectPrompt(p.content),
                    () => togglePromptFavorite(p),
                    busyId === p.id
                  )
                )}
            </div>
          </div>
        )}

        {/* Builtin prompts */}
        {hasBuiltin && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Builtin Prompts
            </p>
            <div className="space-y-1">
              {favoriteBuiltin.map((p) =>
                renderPromptItem(
                  p.title,
                  p.content,
                  getIcon(p.icon),
                  p.color,
                  false,
                  () => onSelectPrompt(p.content)
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFiles = () => {
    if (loadingDocuments) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading documents…
        </div>
      );
    }

    if (filteredDocuments.length === 0) {
      return renderEmpty(
        search ? 'No documents match your search.' : 'No saved documents yet.',
        FileText
      );
    }

    const typeKeys = Object.keys(documentsByType).sort();

    return (
      <div className="space-y-4">
        {/* Favorites */}
        {favoriteDocuments.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="h-3 w-3 fill-warning text-warning" />
              Favorites
            </p>
            <div className="space-y-1">
              {favoriteDocuments.map((doc) => {
                const modeConfig = STUDIO_MODES.find((m) => m.id === doc.type);
                return renderPromptItem(
                  doc.title,
                  doc.content,
                  FileText,
                  'text-warning',
                  true,
                  () => onSelectDocument(doc),
                  () => toggleDocumentFavorite(doc),
                  busyId === doc.id
                );
              })}
            </div>
          </div>
        )}

        {/* Grouped by type */}
        {typeKeys.map((typeKey) => {
          const modeConfig = STUDIO_MODES.find((m) => m.id === typeKey);
          const label = modeConfig?.label ?? typeKey;
          const items = (documentsByType[typeKey] ?? []).filter((d) => !d.favorite);
          if (items.length === 0) return null;
          return (
            <div key={typeKey}>
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {modeConfig ? (
                  <span className={modeConfig.color}>
                    {(() => {
                      const Icon = getIcon(modeConfig.icon);
                      return <Icon className="h-3 w-3" />;
                    })()}
                  </span>
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                {label}
              </p>
              <div className="space-y-1">
                {items.map((doc) =>
                  renderPromptItem(
                    doc.title,
                    doc.content,
                    FileText,
                    modeConfig?.color ?? 'text-muted-foreground',
                    false,
                    () => onSelectDocument(doc),
                    () => toggleDocumentFavorite(doc),
                    busyId === doc.id
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---------- Main render ----------
  return (
    <aside className="glass-strong flex h-full w-full flex-col rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">AI Studio</h2>
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-8 gap-1.5"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 px-2 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'glass-strong text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/40 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}…`}
            className="glass h-9 w-full rounded-md border border-border/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-3">
        {activeTab === 'chats' && renderChats()}
        {activeTab === 'prompts' && renderPrompts()}
        {activeTab === 'files' && renderFiles()}
      </div>

      {/* Footer mode indicator */}
      <div className="border-t border-border/50 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">Mode:</span>
          <span className="font-semibold text-foreground/80">
            {STUDIO_MODES.find((m) => m.id === mode)?.label ?? mode}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default StudioLeftSidebar;
