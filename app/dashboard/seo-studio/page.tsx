'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2,
  Sparkles,
  Copy,
  Check,
  Hash,
  Type,
  FileText,
  Clock,
  Target,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TITLES = [
  { text: 'I Built an AI App in 24 Hours (Shocking Results)', score: 92, length: 48 },
  { text: 'This AI Tool Will Replace Your Entire Workflow', score: 88, length: 47 },
  { text: '10 AI Tools You Didn\'t Know Existed in 2026', score: 85, length: 45 },
  { text: 'How AI Changed My Content Strategy Forever', score: 82, length: 43 },
  { text: 'The AI Revolution Is Here (And It\'s Insane)', score: 87, length: 42 },
];

const DESCRIPTION = `In this video, I build an AI-powered application from scratch in just 24 hours. Watch as I use cutting-edge AI tools to design, code, and deploy a fully functional app.

🚀 What you'll learn:
- How to use AI for rapid prototyping
- Best AI coding tools for developers
- Tips for deploying AI applications
- Real-world AI use cases

🔗 Links:
- GitHub: https://github.com/example
- Twitter: https://twitter.com/example
- Newsletter: https://example.com

#AI #ArtificialIntelligence #Tech #Programming #AI2026`;

const TAGS = ['AI', 'artificial intelligence', 'AI tools 2026', 'AI app', 'build AI app', 'AI development', 'machine learning', 'AI coding', 'no-code AI', 'AI tutorial', 'tech news', 'AI revolution', 'future of AI', 'AI automation', 'GPT', 'ChatGPT', 'AI programming'];

const HASHTAGS = ['#AI', '#ArtificialIntelligence', '#AITools', '#Tech2026', '#AIApp', '#MachineLearning', '#NoCode', '#AIDevelopment', '#FutureTech', '#AIRevolution'];

const TIMESTAMPS = [
  { time: '0:00', label: 'Intro' },
  { time: '0:30', label: 'The Challenge' },
  { time: '2:15', label: 'Choosing AI Tools' },
  { time: '5:40', label: 'Building the App' },
  { time: '12:30', label: 'Testing & Deployment' },
  { time: '18:00', label: 'Results & Thoughts' },
  { time: '20:00', label: 'What\'s Next?' },
];

export default function SEOStudioPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            SEO Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Optimize your videos for YouTube search and discovery with AI.
          </p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent text-white">
          <Sparkles className="mr-2 h-4 w-4" />
          Optimize All
        </Button>
      </motion.div>

      {/* SEO Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="relative mx-auto h-24 w-24">
                <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-primary/20">
                  <div className="text-center">
                    <p className="font-display text-3xl font-bold text-primary">92</p>
                    <p className="text-xs text-muted-foreground">/100</p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium">Overall SEO Score</p>
            </div>
            {[
              { label: 'Title', score: 95, icon: Type },
              { label: 'Description', score: 88, icon: FileText },
              { label: 'Tags', score: 91, icon: Hash },
            ].map((item) => (
              <div key={item.label} className="rounded-xl glass p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="font-display text-lg font-bold text-success">{item.score}</span>
                </div>
                <Progress value={item.score} className="h-2" />
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <Tabs defaultValue="titles">
        <TabsList className="glass">
          <TabsTrigger value="titles">Title Generator</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          <TabsTrigger value="timestamps">Timestamps</TabsTrigger>
        </TabsList>

        {/* Titles */}
        <TabsContent value="titles" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Titles</h2>
              <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
            </div>
            <div className="space-y-3">
              {TITLES.map((title, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="font-display text-sm font-bold text-primary">{title.score}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{title.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{title.length} chars · {title.length < 60 ? 'Optimal length' : 'Too long'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copy(title.text, `title-${i}`)}>
                    {copied === `title-${i}` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Description */}
        <TabsContent value="description" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Description</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
                <Button variant="outline" size="sm" onClick={() => copy(DESCRIPTION, 'desc')}>
                  {copied === 'desc' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Textarea
              defaultValue={DESCRIPTION}
              rows={18}
              className="glass font-mono text-sm"
            />
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Characters: {DESCRIPTION.length}</span>
              <Badge variant="secondary" className="bg-success/15 text-success">SEO Score: 88/100</Badge>
              <Badge variant="secondary">Has timestamps</Badge>
              <Badge variant="secondary">Has links</Badge>
              <Badge variant="secondary">Has hashtags</Badge>
            </div>
          </Card>
        </TabsContent>

        {/* Tags */}
        <TabsContent value="tags" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Tags</h2>
              <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:border-primary/30 transition-colors">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span>{tag}</span>
                  <button onClick={() => copy(tag, `tag-${i}`)} className="text-muted-foreground hover:text-foreground">
                    {copied === `tag-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl glass p-3 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-medium">AI Tip:</span>
              </div>
              <p className="mt-1 text-muted-foreground">Use a mix of broad and specific tags. Your top 3 tags should match your title keywords for best search visibility.</p>
            </div>
          </Card>
        </TabsContent>

        {/* Hashtags */}
        <TabsContent value="hashtags" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Hashtags</h2>
              <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {HASHTAGS.map((tag, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-sm hover:border-primary/30 transition-colors">
                  <Hash className="h-3 w-3 text-primary" />
                  <span>{tag.replace('#', '')}</span>
                  <button onClick={() => copy(tag, `hash-${i}`)} className="text-muted-foreground hover:text-foreground">
                    {copied === `hash-${i}` ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">YouTube allows up to 15 hashtags in the description. The first 3 appear above the title.</p>
          </Card>
        </TabsContent>

        {/* Timestamps */}
        <TabsContent value="timestamps" className="space-y-4">
          <Card className="glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">AI-Generated Timestamps</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
                <Button variant="outline" size="sm" onClick={() => copy(TIMESTAMPS.map(t => `${t.time} ${t.label}`).join('\n'), 'ts')}>
                  {copied === 'ts' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {TIMESTAMPS.map((ts, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg glass p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-medium text-primary">{ts.time}</span>
                  </div>
                  <span className="text-sm">{ts.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
