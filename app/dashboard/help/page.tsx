'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  Mail,
  LifeBuoy,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Zap,
  Shield,
  Rocket,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, ErrorState } from '@/components/dashboard/shared';

// ─── Static Documentation Content ─────────────────────────────────────────────
// (Help text and FAQ are documentation, not mock data)

const DOC_LINKS = [
  {
    title: 'Getting Started Guide',
    description: 'Learn the basics of CreatorOS AI — from connecting your YouTube channel to creating your first AI-generated script.',
    href: 'https://docs.creatoros.ai/getting-started',
    icon: Rocket,
    color: 'text-primary',
    bg: 'bg-primary/10',
    badge: 'New User',
  },
  {
    title: 'AI Studio Documentation',
    description: 'Complete guide to the AI Studio — script generation, storyboards, hooks, CTAs, rewriting, and translation tools.',
    href: 'https://docs.creatoros.ai/ai-studio',
    icon: Lightbulb,
    color: 'text-accent',
    bg: 'bg-accent/10',
    badge: 'Popular',
  },
  {
    title: 'YouTube Integration',
    description: 'How to connect, sync, and publish to your YouTube channel. Covers the Data API, Analytics API, and auto-publishing.',
    href: 'https://docs.creatoros.ai/youtube-integration',
    icon: Zap,
    color: 'text-info',
    bg: 'bg-info/10',
  },
  {
    title: 'API Reference',
    description: 'Full REST API reference for developers. Authentication, endpoints, rate limits, and code examples in multiple languages.',
    href: 'https://docs.creatoros.ai/api-reference',
    icon: BookOpen,
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    title: 'Security & Privacy',
    description: 'How we protect your data, manage credentials, and handle OAuth tokens. SOC 2 compliance and GDPR resources.',
    href: 'https://docs.creatoros.ai/security',
    icon: Shield,
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    title: 'Changelog & Updates',
    description: 'Stay up to date with the latest features, improvements, and bug fixes shipped to CreatorOS AI.',
    href: 'https://docs.creatoros.ai/changelog',
    icon: Rocket,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
];

const FAQ_ITEMS = [
  {
    question: 'How do I connect my YouTube channel?',
    answer:
      'Navigate to the Analytics page and click "Connect YouTube". You will be redirected to Google OAuth to authorize CreatorOS AI. Once connected, we sync your channel data, videos, playlists, and analytics automatically. You can disconnect at any time from Settings → Integrations.',
  },
  {
    question: 'How does AI script generation work?',
    answer:
      'Go to AI Studio → Script, enter your topic or keywords, and select a tone and length. Our AI models (GPT-4o and Claude 3.5 Sonnet) generate a complete script with intro, body, and CTA. You can edit, rewrite, or translate the script before publishing. Each generation counts toward your plan\'s AI usage.',
  },
  {
    question: 'What file types can I upload to the Asset Manager?',
    answer:
      'The Asset Manager supports images (JPG, PNG, GIF, WebP, SVG), videos (MP4, MOV, WebM, AVI, MKV), audio (MP3, WAV, FLAC, AAC, OGG), and documents (PDF, DOC, DOCX, TXT, CSV, MD, PPT, XLS). Files are stored securely in Supabase Storage and linked to your account.',
  },
  {
    question: 'Can I schedule videos for automatic publishing?',
    answer:
      'Yes. Use the Publishing → Schedule page to pick a date and time. We publish directly to YouTube via the YouTube Data API. You can schedule from the Calendar view or from any project in the Projects page. Scheduled videos appear in your Content Calendar.',
  },
  {
    question: 'How is my data stored and protected?',
    answer:
      'All data is stored in Supabase (PostgreSQL) with Row Level Security enabled — only you can access your own data. OAuth tokens are encrypted at rest. We are SOC 2 Type II compliant and GDPR compliant. See our Security & Privacy documentation for full details.',
  },
  {
    question: 'What are the plan limits for AI generations and storage?',
    answer:
      'The Creator plan includes unlimited AI scripts and thumbnails, up to 5 team members, and 100 GB of storage. The Free plan includes 50 AI generations per month and 5 GB of storage. Check Settings → Billing to view your current usage and upgrade.',
  },
  {
    question: 'How do I invite team members to my workspace?',
    answer:
      'Go to Settings → Team and click "Invite". Enter the email address and select a role (Owner, Editor, or Writer). Team members get access to shared projects, analytics, and the AI Studio. You can remove members or change roles at any time.',
  },
  {
    question: 'Can I use CreatorOS AI without a YouTube channel?',
    answer:
      'Yes. You can use the AI Studio, Asset Manager, and SEO Studio without connecting a YouTube channel. However, Analytics, auto-publishing, and comment management require a connected channel. You can connect later at any time.',
  },
];

const CONTACT_INFO = [
  {
    label: 'Email Support',
    value: 'support@creatoros.ai',
    icon: Mail,
    href: 'mailto:support@creatoros.ai',
  },
  {
    label: 'Community Discord',
    value: 'discord.gg/creatoros',
    icon: MessageSquare,
    href: 'https://discord.gg/creatoros',
  },
  {
    label: 'Documentation',
    value: 'docs.creatoros.ai',
    icon: BookOpen,
    href: 'https://docs.creatoros.ai',
  },
];

const TICKET_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Issue' },
  { value: 'account', label: 'Account Issue' },
  { value: 'technical', label: 'Technical Problem' },
];

const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recentTickets, setRecentTickets] = useState<
    Array<{ id: string; subject: string; status: string; created_at: string }>
  >([]);

  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
  });

  const handleFieldChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('You must be signed in to submit a support ticket');

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: form.subject.trim(),
          category: form.category,
          priority: form.priority,
          message: form.message.trim(),
          status: 'open',
        })
        .select('id, subject, status, created_at')
        .single();

      if (error) throw error;

      setSubmitted(true);
      setRecentTickets((prev) => [data, ...prev]);
      setForm({ subject: '', category: 'general', priority: 'medium', message: '' });

      toast({
        title: 'Ticket submitted',
        description: 'We will get back to you within 24 hours.',
      });

      // Reset success state after a few seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit ticket';
      setSubmitError(msg);
      toast({
        title: 'Submission failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Help & Support"
        description="Find answers, browse documentation, or reach out to our support team."
      />

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CONTACT_INFO.map((contact, i) => (
          <motion.div
            key={contact.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <a href={contact.href} target="_blank" rel="noopener noreferrer" className="block">
              <Card className="glass glass-hover p-5 transition-colors hover:border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <contact.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{contact.label}</p>
                    <p className="text-xs text-muted-foreground">{contact.value}</p>
                  </div>
                </div>
              </Card>
            </a>
          </motion.div>
        ))}
      </div>

      {/* Documentation Links */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass p-6">
          <div className="mb-5 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Documentation</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOC_LINKS.map((doc, i) => (
              <motion.a
                key={doc.title}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl glass p-4 transition-colors hover:border-primary/30"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${doc.bg}`}>
                    <doc.icon className={`h-5 w-5 ${doc.color}`} />
                  </div>
                  {doc.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {doc.badge}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <h3 className="text-sm font-medium group-hover:text-primary transition-colors">
                    {doc.title}
                  </h3>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
              </motion.a>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* FAQ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass p-6">
          <div className="mb-5 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-semibold">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </motion.div>

      {/* Support Ticket Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass p-6">
          <div className="mb-5 flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-info" />
            <h2 className="font-display text-lg font-semibold">Submit a Support Ticket</h2>
          </div>

          {/* Success state */}
          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/10 p-4">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Ticket submitted successfully!</p>
                    <p className="text-xs text-muted-foreground">
                      Our team will review your request and respond within 24 hours.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <ErrorState
                  message={submitError}
                  onRetry={() => setSubmitError(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Subject */}
              <div className="md:col-span-2">
                <Label htmlFor="subject" className="mb-1.5 block">
                  Subject
                </Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => handleFieldChange('subject', e.target.value)}
                  placeholder="Briefly describe your issue"
                  required
                  maxLength={200}
                />
              </div>

              {/* Category */}
              <div>
                <Label className="mb-1.5 block">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => handleFieldChange('category', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div>
                <Label className="mb-1.5 block">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => handleFieldChange('priority', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((pri) => (
                      <SelectItem key={pri.value} value={pri.value}>
                        {pri.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message */}
              <div className="md:col-span-2">
                <Label htmlFor="message" className="mb-1.5 block">
                  Message
                </Label>
                <Textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => handleFieldChange('message', e.target.value)}
                  placeholder="Describe your issue or question in detail. Include any error messages, steps to reproduce, and relevant screenshots."
                  required
                  rows={6}
                  maxLength={5000}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.message.length} / 5000 characters
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm({ subject: '', category: 'general', priority: 'medium', message: '' })}
                disabled={submitting}
              >
                Clear
              </Button>
              <Button
                type="submit"
                disabled={submitting || !form.subject.trim() || !form.message.trim()}
                className="bg-gradient-to-r from-primary to-accent text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Recent tickets */}
          {recentTickets.length > 0 && (
            <div className="mt-6 border-t border-border/50 pt-4">
              <p className="mb-3 text-sm font-medium">Recently Submitted</p>
              <div className="space-y-2">
                {recentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-lg glass p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={
                          ticket.status === 'open'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-success/15 text-success'
                        }
                      >
                        {ticket.status}
                      </Badge>
                      <span className="text-sm font-medium">{ticket.subject}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Footer help banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass p-6">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
              <LifeBuoy className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-semibold">Still need help?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Our support team is available 24/7. Submit a ticket above or email us directly at{' '}
                <a
                  href="mailto:support@creatoros.ai"
                  className="font-medium text-primary hover:underline"
                >
                  support@creatoros.ai
                </a>
                . Average response time is under 2 hours.
              </p>
            </div>
            <a href="mailto:support@creatoros.ai">
              <Button variant="outline" className="bg-gradient-to-r from-primary to-accent text-white">
                <Mail className="mr-2 h-4 w-4" />
                Email Support
              </Button>
            </a>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
