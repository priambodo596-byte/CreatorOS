'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  CreditCard,
  KeyRound,
  Cpu,
  Bell,
  Plug,
  Users,
  Settings as SettingsIcon,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Youtube,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

const AI_MODELS = [
  { name: 'GPT-4o', provider: 'OpenAI', status: 'active', usage: '68%' },
  { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'active', usage: '22%' },
  { name: 'DALL-E 3', provider: 'OpenAI', status: 'active', usage: '8%' },
  { name: 'ElevenLabs v2', provider: 'ElevenLabs', status: 'inactive', usage: '0%' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string; bio: string } | null>(null);
  const [authUser, setAuthUser] = useState<{ email: string; id: string } | null>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const [ytConnected, setYtConnected] = useState(false);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setLoading(false);
      return;
    }
    setAuthUser({ email: userData.user.email || '', id: userData.user.id });

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('full_name, avatar_url, bio')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
      setFullName(profileData.full_name || '');
      setBio(profileData.bio || '');
      setAvatarUrl(profileData.avatar_url || '');
    } else {
      setProfile({ full_name: '', avatar_url: '', bio: '' });
      setFullName(userData.user.email?.split('@')[0] || '');
    }
    setLoading(false);
  }, []);

  const loadTeam = useCallback(async () => {
    setLoadingTeam(true);
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('invited_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load team', description: error.message, variant: 'destructive' });
    } else {
      setTeamMembers(data || []);
    }
    setLoadingTeam(false);
  }, [toast]);

  const loadApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load API keys', description: error.message, variant: 'destructive' });
    } else {
      setApiKeys(data || []);
    }
    setLoadingKeys(false);
  }, [toast]);

  const loadIntegrations = useCallback(async () => {
    setLoadingIntegrations(true);
    const { data } = await supabase
      .from('youtube_connections')
      .select('id')
      .maybeSingle();
    setYtConnected(!!data);
    setLoadingIntegrations(false);
  }, []);

  useEffect(() => {
    loadData();
    loadTeam();
    loadApiKeys();
    loadIntegrations();
  }, [loadData, loadTeam, loadApiKeys, loadIntegrations]);

  const handleSaveProfile = async () => {
    if (!authUser) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: authUser.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        bio,
        updated_at: new Date().toISOString(),
      });
    setSavingProfile(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile saved' });
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('team_members')
      .insert({ email: inviteEmail.trim(), role: inviteRole, status: 'pending' });
    if (error) {
      toast({ title: 'Invite failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invitation sent', description: `Invited ${inviteEmail} as ${inviteRole}.` });
    setInviteEmail('');
    setShowInviteDialog(false);
    loadTeam();
  };

  const handleRemoveMember = async (id: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    toast({ title: 'Member removed' });
  };

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    const rawKey = `cos_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = btoa(rawKey);
    const { data, error } = await supabase
      .from('api_keys')
      .insert({ name: newKeyName.trim(), key_prefix: keyPrefix, key_hash: keyHash })
      .select('id, name, key_prefix, last_used_at, created_at')
      .single();
    if (error || !data) {
      toast({ title: 'Failed to generate key', description: error?.message, variant: 'destructive' });
      return;
    }
    setApiKeys((prev) => [data, ...prev]);
    setGeneratedKey(rawKey);
    setNewKeyName('');
    toast({ title: 'API key generated', description: 'Copy it now - you won\'t see it again.' });
  };

  const handleDeleteKey = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    toast({ title: 'API key revoked' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile, team, billing, and integrations.</p>
        </div>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading settings…</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, team, billing, and integrations.</p>
      </motion.div>

      <Tabs defaultValue="profile">
        <TabsList className="glass flex-wrap">
          <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="workspace"><SettingsIcon className="mr-1.5 h-4 w-4" />Workspace</TabsTrigger>
          <TabsTrigger value="team"><Users className="mr-1.5 h-4 w-4" />Team</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="mr-1.5 h-4 w-4" />Billing</TabsTrigger>
          <TabsTrigger value="api"><KeyRound className="mr-1.5 h-4 w-4" />API Keys</TabsTrigger>
          <TabsTrigger value="models"><Cpu className="mr-1.5 h-4 w-4" />AI Models</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="mr-1.5 h-4 w-4" />Integrations</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card className="glass p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">Profile Settings</h2>
            <div className="mb-6 flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                <AvatarFallback>{fullName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="avatar-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !authUser) return;
                    const path = `avatars/${authUser.id}/${file.name}`;
                    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
                    if (upErr) {
                      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
                      return;
                    }
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
                    setAvatarUrl(urlData.publicUrl);
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('avatar-upload')?.click()}>
                  Change Avatar
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Full Name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Email</label>
                <Input value={authUser?.email || ''} disabled className="opacity-60" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm text-muted-foreground">Avatar URL</label>
                <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm text-muted-foreground">Bio</label>
                <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { if (profile) { setFullName(profile.full_name); setBio(profile.bio); setAvatarUrl(profile.avatar_url); } }}>Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Workspace */}
        <TabsContent value="workspace">
          <Card className="glass p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">Workspace Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Workspace Name</label>
                <Input defaultValue="My Studio" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Default Language</label>
                <Input defaultValue="English" />
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                {[
                  { label: 'Dark Mode', desc: 'Use dark theme by default', on: true },
                  { label: 'Auto-save drafts', desc: 'Automatically save your work', on: true },
                  { label: 'AI suggestions', desc: 'Show AI suggestions in editor', on: true },
                  { label: 'Beta features', desc: 'Enable experimental features', on: false },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-center justify-between rounded-lg glass p-4">
                    <div>
                      <p className="text-sm font-medium">{setting.label}</p>
                      <p className="text-xs text-muted-foreground">{setting.desc}</p>
                    </div>
                    <Switch defaultChecked={setting.on} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <Card className="glass p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Team Members</h2>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={() => setShowInviteDialog(true)}>
                <Plus className="mr-1.5 h-4 w-4" />Invite
              </Button>
            </div>
            {loadingTeam ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading team…</span>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No team members yet. Invite collaborators to join your workspace.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 rounded-xl glass p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{member.email.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.email}</p>
                      <p className="text-xs text-muted-foreground">Invited {new Date(member.invited_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="secondary" className={cn(member.role === 'owner' && 'bg-primary/15 text-primary')}>
                      {member.role}
                    </Badge>
                    <Badge variant="outline" className={cn(member.status === 'pending' && 'bg-warning/10 text-warning', member.status === 'active' && 'bg-success/10 text-success')}>
                      {member.status}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <div className="space-y-4">
            <Card className="glass p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Current Plan</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Manage your subscription</p>
                </div>
                <Badge className="bg-gradient-to-r from-primary to-accent text-white">Free</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'AI Scripts', used: '0', total: '10' },
                  { label: 'Thumbnails', used: '0', total: '5' },
                  { label: 'Team Members', used: String(teamMembers.length), total: '3' },
                  { label: 'Storage', used: '0 GB', total: '1 GB' },
                ].map((usage) => (
                  <div key={usage.label} className="rounded-xl glass p-4">
                    <p className="text-xs text-muted-foreground">{usage.label}</p>
                    <p className="mt-1 text-sm font-medium">{usage.used} / {usage.total}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="outline">Upgrade Plan</Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card className="glass p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">API Keys</h2>
              <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white" onClick={() => { setGeneratedKey(null); setShowKeyDialog(true); }}>
                <Plus className="mr-1.5 h-4 w-4" />Generate Key
              </Button>
            </div>
            {loadingKeys ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading API keys…</span>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <KeyRound className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No API keys yet. Generate one to access the API.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="rounded-xl glass p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{apiKey.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(apiKey.created_at).toLocaleDateString()}
                          {apiKey.last_used_at && ` · Last used ${new Date(apiKey.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="rounded-lg glass px-3 py-1.5 text-xs font-mono">
                          {showKey ? apiKey.key_prefix : `${apiKey.key_prefix.slice(0, 8)}••••`}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(apiKey.key_prefix)}>
                          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(apiKey.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* AI Models */}
        <TabsContent value="models">
          <Card className="glass p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">AI Model Configuration</h2>
            <div className="space-y-3">
              {AI_MODELS.map((model) => (
                <div key={model.name} className="flex items-center justify-between rounded-xl glass p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Usage: {model.usage}</span>
                    <Badge variant="secondary" className={model.status === 'active' ? 'bg-success/15 text-success' : ''}>
                      {model.status}
                    </Badge>
                    <Switch defaultChecked={model.status === 'active'} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="glass p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">Notification Preferences</h2>
            <div className="space-y-3">
              {[
                { label: 'Video published', desc: 'When a video is successfully published', on: true },
                { label: 'AI generation complete', desc: 'When AI finishes generating content', on: true },
                { label: 'Trending topic alert', desc: 'When a new trending topic is detected', on: true },
                { label: 'Weekly analytics report', desc: 'Weekly summary of your channel performance', on: false },
                { label: 'Team activity', desc: 'When team members make changes', on: true },
                { label: 'Billing reminders', desc: 'Payment and subscription notifications', on: true },
              ].map((notif) => (
                <div key={notif.label} className="flex items-center justify-between rounded-lg glass p-4">
                  <div>
                    <p className="text-sm font-medium">{notif.label}</p>
                    <p className="text-xs text-muted-foreground">{notif.desc}</p>
                  </div>
                  <Switch defaultChecked={notif.on} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <Card className="glass p-6">
            <h2 className="mb-6 font-display text-lg font-semibold">Integrations</h2>
            {loadingIntegrations ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading integrations…</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-destructive to-warning text-white">
                      <Youtube className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className={ytConnected ? 'bg-success/15 text-success' : ''}>
                      {ytConnected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">YouTube</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sync channel data and analytics</p>
                  <Button variant={ytConnected ? 'outline' : 'default'} size="sm" className="mt-3 w-full" asChild>
                    <a href="/dashboard">{ytConnected ? 'Manage' : 'Connect'}</a>
                  </Button>
                </div>
                {[
                  { name: 'OpenAI', connected: false, icon: '✦', color: 'from-success to-info' },
                  { name: 'Anthropic', connected: false, icon: '✦', color: 'from-accent to-primary' },
                  { name: 'ElevenLabs', connected: false, icon: '♪', color: 'from-info to-accent' },
                  { name: 'Zapier', connected: false, icon: '⚡', color: 'from-warning to-destructive' },
                  { name: 'Slack', connected: false, icon: '#', color: 'from-info to-success' },
                ].map((int) => (
                  <div key={int.name} className="rounded-xl glass p-4 hover:border-primary/30 transition-colors">
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${int.color} text-lg font-bold text-white`}>
                        {int.icon}
                      </div>
                      <Badge variant="secondary" className={int.connected ? 'bg-success/15 text-success' : ''}>
                        {int.connected ? 'Connected' : 'Not Connected'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{int.name}</p>
                    <Button variant={int.connected ? 'outline' : 'default'} size="sm" className="mt-3 w-full" disabled>
                      {int.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email Address</label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" type="email" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite}><Plus className="mr-2 h-4 w-4" />Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle>{generatedKey ? 'API Key Generated' : 'Generate API Key'}</DialogTitle>
          </DialogHeader>
          {generatedKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-warning/10 p-3">
                <p className="text-xs text-warning">Copy your API key now. You won&apos;t be able to see it again.</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg glass px-3 py-2 text-xs font-mono break-all">{generatedKey}</code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedKey)}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Key Name</label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production API" />
              </div>
            </div>
          )}
          <DialogFooter>
            {generatedKey ? (
              <Button onClick={() => { setShowKeyDialog(false); setGeneratedKey(null); setNewKeyName(''); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowKeyDialog(false)}>Cancel</Button>
                <Button onClick={handleGenerateKey}>Generate</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
