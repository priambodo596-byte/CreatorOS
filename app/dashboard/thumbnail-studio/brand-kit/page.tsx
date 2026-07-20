'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Plus,
  Upload,
  Trash2,
  Edit3,
  Star,
  Eye,
  Copy,
  Check,
  Loader2,
  ImageIcon,
  Type,
  Droplet,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState, SearchInput } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────
type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
type FontSizeOption = 'small' | 'medium' | 'large';
type StylePreset = 'modern' | 'classic' | 'bold' | 'minimal' | 'gaming';

interface BrandKit {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  font_size: FontSizeOption;
  logo_position: LogoPosition;
  watermark_url: string | null;
  watermark_opacity: number;
  style_preset: StylePreset;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface BrandKitForm {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  font_size: FontSizeOption;
  logo_position: LogoPosition;
  watermark_url: string | null;
  watermark_opacity: number;
  style_preset: StylePreset;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FONT_FAMILIES = [
  'Inter, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Impact, sans-serif',
  'Roboto, sans-serif',
  'Poppins, sans-serif',
  'Montserrat, sans-serif',
  'Bebas Neue, sans-serif',
  'Oswald, sans-serif',
  'Anton, sans-serif',
];

const STYLE_PRESETS: { value: StylePreset; label: string; gradient: string }[] = [
  { value: 'modern', label: 'Modern', gradient: 'from-blue-500 to-cyan-400' },
  { value: 'classic', label: 'Classic', gradient: 'from-slate-600 to-slate-800' },
  { value: 'bold', label: 'Bold', gradient: 'from-red-500 to-orange-500' },
  { value: 'minimal', label: 'Minimal', gradient: 'from-gray-300 to-gray-500' },
  { value: 'gaming', label: 'Gaming', gradient: 'from-purple-600 to-pink-600' },
];

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'center', label: 'Center' },
];

const FONT_SIZES: { value: FontSizeOption; label: string; px: number }[] = [
  { value: 'small', label: 'Small', px: 24 },
  { value: 'medium', label: 'Medium', px: 42 },
  { value: 'large', label: 'Large', px: 64 },
];

const DEFAULT_FORM: BrandKitForm = {
  name: '',
  logo_url: null,
  primary_color: '#6366f1',
  secondary_color: '#8b5cf6',
  accent_color: '#ec4899',
  background_color: '#0f0f1e',
  text_color: '#ffffff',
  font_family: 'Inter, sans-serif',
  font_size: 'medium',
  logo_position: 'top-left',
  watermark_url: null,
  watermark_opacity: 30,
  style_preset: 'modern',
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function BrandKitPage() {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandKitForm>(DEFAULT_FORM);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKit, setPreviewKit] = useState<BrandKit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Load brand kits ──────────────────────────────────────────────────────
  const loadBrandKits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data, error: fetchErr } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setBrandKits((data as BrandKit[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand kits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrandKits();
  }, [loadBrandKits]);

  // ─── Upload helpers ──────────────────────────────────────────────────────
  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'anonymous';
    const ext = file.name.split('.').pop();
    const path = `${userId}/brand-kit/${folder}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('assets').upload(path, file);
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, 'logos');
      setForm((prev) => ({ ...prev, logo_url: url }));
      toast({ title: 'Logo uploaded', description: file.name });
    } catch (err) {
      toast({
        title: 'Logo upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWatermark(true);
    try {
      const url = await uploadFile(file, 'watermarks');
      setForm((prev) => ({ ...prev, watermark_url: url }));
      toast({ title: 'Watermark uploaded', description: file.name });
    } catch (err) {
      toast({
        title: 'Watermark upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingWatermark(false);
      e.target.value = '';
    }
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a brand kit name', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;

      const record = {
        user_id: userId,
        name: form.name.trim(),
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        background_color: form.background_color,
        text_color: form.text_color,
        font_family: form.font_family,
        font_size: form.font_size,
        logo_position: form.logo_position,
        watermark_url: form.watermark_url,
        watermark_opacity: form.watermark_opacity,
        style_preset: form.style_preset,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateErr } = await supabase.from('brand_kits').update(record).eq('id', editingId);
        if (updateErr) throw updateErr;
        toast({ title: 'Brand kit updated', description: form.name });
      } else {
        const { error: insertErr } = await supabase.from('brand_kits').insert(record);
        if (insertErr) throw insertErr;
        toast({ title: 'Brand kit created', description: form.name });
      }

      setShowForm(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
      loadBrandKits();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (kit: BrandKit) => {
    setEditingId(kit.id);
    setForm({
      name: kit.name,
      logo_url: kit.logo_url,
      primary_color: kit.primary_color,
      secondary_color: kit.secondary_color,
      accent_color: kit.accent_color,
      background_color: kit.background_color,
      text_color: kit.text_color,
      font_family: kit.font_family,
      font_size: kit.font_size,
      logo_position: kit.logo_position,
      watermark_url: kit.watermark_url,
      watermark_opacity: kit.watermark_opacity,
      style_preset: kit.style_preset,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error: delErr } = await supabase.from('brand_kits').delete().eq('id', id);
      if (delErr) throw delErr;
      setBrandKits((prev) => prev.filter((k) => k.id !== id));
      setDeleteConfirm(null);
      toast({ title: 'Brand kit deleted' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      // Unset all defaults for this user
      await supabase.from('brand_kits').update({ is_default: false }).eq('user_id', userId);
      // Set new default
      const { error: updErr } = await supabase.from('brand_kits').update({ is_default: true }).eq('id', id);
      if (updErr) throw updErr;

      setBrandKits((prev) => prev.map((k) => ({ ...k, is_default: k.id === id })));
      toast({ title: 'Default brand kit set' });
    } catch (err) {
      toast({
        title: 'Failed to set default',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (kit: BrandKit) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { id, created_at, updated_at, is_default, ...rest } = kit;
      const { error: insertErr } = await supabase.from('brand_kits').insert({
        ...rest,
        user_id: userId,
        name: `${kit.name} (Copy)`,
        is_default: false,
      });
      if (insertErr) throw insertErr;
      toast({ title: 'Brand kit duplicated' });
      loadBrandKits();
    } catch (err) {
      toast({
        title: 'Duplicate failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleApplyToEditor = (kit: BrandKit) => {
    // Store the selected brand kit in sessionStorage for the editor to pick up
    sessionStorage.setItem('selectedBrandKit', JSON.stringify(kit));
    window.location.href = '/dashboard/thumbnail-studio/editor';
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  // ─── Filtered kits ──────────────────────────────────────────────────────────
  const filteredKits = brandKits.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── Color picker helper ───────────────────────────────────────────────────
  const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-sm" />
      </div>
    </div>
  );

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Brand Kit" description="Manage your brand identity for thumbnails" />
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading brand kits...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Brand Kit" description="Manage your brand identity for thumbnails" />
        <ErrorState message={error} onRetry={loadBrandKits} />
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Brand Kit"
        description="Manage your brand identity — colors, fonts, logos, and watermarks"
        actions={
          <Button
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="bg-gradient-to-r from-primary to-accent text-white"
          >
            {showForm ? (
              <>Cancel</>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> New Brand Kit
              </>
            )}
          </Button>
        }
      />

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="glass p-6">
              <div className="mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-semibold">
                  {editingId ? 'Edit Brand Kit' : 'Create New Brand Kit'}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Name */}
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label>Brand Kit Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. My Channel Brand"
                  />
                </div>

                {/* Style preset */}
                <div className="space-y-2">
                  <Label>Style Preset</Label>
                  <Select
                    value={form.style_preset}
                    onValueChange={(v) => setForm({ ...form, style_preset: v as StylePreset })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_PRESETS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <div className="flex items-center gap-2">
                            <div className={cn('h-4 w-4 rounded bg-gradient-to-br', s.gradient)} />
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font family */}
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={form.font_family}
                    onValueChange={(v) => setForm({ ...form, font_family: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          <span style={{ fontFamily: f }}>{f.split(',')[0]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font size */}
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select
                    value={form.font_size}
                    onValueChange={(v) => setForm({ ...form, font_size: v as FontSizeOption })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} ({s.px}px)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Logo position */}
                <div className="space-y-2">
                  <Label>Logo Position</Label>
                  <Select
                    value={form.logo_position}
                    onValueChange={(v) => setForm({ ...form, logo_position: v as LogoPosition })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOGO_POSITIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Colors */}
                <ColorField label="Primary Color" value={form.primary_color} onChange={(v) => setForm({ ...form, primary_color: v })} />
                <ColorField label="Secondary Color" value={form.secondary_color} onChange={(v) => setForm({ ...form, secondary_color: v })} />
                <ColorField label="Accent Color" value={form.accent_color} onChange={(v) => setForm({ ...form, accent_color: v })} />
                <ColorField label="Background Color" value={form.background_color} onChange={(v) => setForm({ ...form, background_color: v })} />
                <ColorField label="Text Color" value={form.text_color} onChange={(v) => setForm({ ...form, text_color: v })} />

                {/* Logo upload */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Upload Logo
                    </Button>
                    {form.logo_url && (
                      <>
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-border">
                          <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_url: null })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>

                {/* Watermark upload */}
                <div className="space-y-2">
                  <Label>Watermark</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => watermarkInputRef.current?.click()} disabled={uploadingWatermark}>
                      {uploadingWatermark ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Upload Watermark
                    </Button>
                    {form.watermark_url && (
                      <>
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-border">
                          <img src={form.watermark_url} alt="Watermark" className="h-full w-full object-contain" />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, watermark_url: null })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <input ref={watermarkInputRef} type="file" accept="image/*" className="hidden" onChange={handleWatermarkUpload} />
                </div>

                {/* Watermark opacity */}
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label>Watermark Opacity: {form.watermark_opacity}%</Label>
                  <Slider
                    value={[form.watermark_opacity]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => setForm({ ...form, watermark_opacity: v[0] })}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6">
                <Label className="mb-2 block">Live Preview</Label>
                <div
                  className="relative flex items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                    height: 160,
                  }}
                >
                  {form.logo_url && (
                    <img
                      src={form.logo_url}
                      alt="Logo"
                      className="absolute h-10 w-10 object-contain"
                      style={{
                        ...(form.logo_position === 'top-left' && { top: 12, left: 12 }),
                        ...(form.logo_position === 'top-right' && { top: 12, right: 12 }),
                        ...(form.logo_position === 'bottom-left' && { bottom: 12, left: 12 }),
                        ...(form.logo_position === 'bottom-right' && { bottom: 12, right: 12 }),
                        ...(form.logo_position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: form.font_family,
                      fontSize: FONT_SIZES.find((s) => s.value === form.font_size)?.px || 42,
                      color: form.text_color,
                      fontWeight: 700,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    Sample Text
                  </span>
                  {form.watermark_url && (
                    <img
                      src={form.watermark_url}
                      alt="Watermark"
                      className="absolute inset-0 m-auto h-16 w-16 object-contain"
                      style={{ opacity: form.watermark_opacity / 100 }}
                    />
                  )}
                  <div
                    className="absolute bottom-2 right-2 h-4 w-4 rounded-full"
                    style={{ background: form.accent_color }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent text-white">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  {editingId ? 'Update Brand Kit' : 'Create Brand Kit'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      {brandKits.length > 0 && (
        <div className="max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Search brand kits..." />
        </div>
      )}

      {/* Brand kits grid */}
      {brandKits.length === 0 && !showForm ? (
        <EmptyState
          icon={Palette}
          title="No brand kits yet"
          description="Create your first brand kit to maintain consistent styling across all your thumbnails."
          action={
            <Button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-primary to-accent text-white">
              <Plus className="mr-2 h-4 w-4" /> Create Brand Kit
            </Button>
          }
        />
      ) : filteredKits.length === 0 ? (
        <EmptyState icon={Palette} title="No matching brand kits" description="Try a different search term." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredKits.map((kit, i) => (
            <motion.div
              key={kit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass glass-hover overflow-hidden">
                {/* Preview */}
                <div
                  className="relative flex h-32 items-center justify-center overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${kit.primary_color}, ${kit.secondary_color})`,
                  }}
                >
                  {kit.logo_url && (
                    <img
                      src={kit.logo_url}
                      alt="Logo"
                      className="absolute h-8 w-8 object-contain"
                      style={{
                        ...(kit.logo_position === 'top-left' && { top: 8, left: 8 }),
                        ...(kit.logo_position === 'top-right' && { top: 8, right: 8 }),
                        ...(kit.logo_position === 'bottom-left' && { bottom: 8, left: 8 }),
                        ...(kit.logo_position === 'bottom-right' && { bottom: 8, right: 8 }),
                        ...(kit.logo_position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: kit.font_family,
                      fontSize: FONT_SIZES.find((s) => s.value === kit.font_size)?.px || 42,
                      color: kit.text_color,
                      fontWeight: 700,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    Sample
                  </span>
                  {kit.watermark_url && (
                    <img
                      src={kit.watermark_url}
                      alt="Watermark"
                      className="absolute inset-0 m-auto h-12 w-12 object-contain"
                      style={{ opacity: kit.watermark_opacity / 100 }}
                    />
                  )}
                  {kit.is_default && (
                    <div className="absolute left-2 top-2">
                      <Badge className="bg-primary text-white">
                        <Star className="mr-1 h-3 w-3 fill-current" /> Default
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="truncate font-display text-base font-semibold">{kit.name}</h3>
                    <Badge variant="secondary" className="capitalize">{kit.style_preset}</Badge>
                  </div>

                  {/* Color swatches */}
                  <div className="mb-3 flex items-center gap-1.5">
                    <Droplet className="h-3.5 w-3.5 text-muted-foreground" />
                    {[
                      kit.primary_color,
                      kit.secondary_color,
                      kit.accent_color,
                      kit.background_color,
                      kit.text_color,
                    ].map((color, idx) => (
                      <div
                        key={idx}
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  <p className="mb-3 text-xs text-muted-foreground">
                    Font: {kit.font_family.split(',')[0]} · Size: {kit.font_size} · Logo: {kit.logo_position}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setPreviewKit(kit)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleApplyToEditor(kit)}>
                      <Wand2 className="mr-1 h-3.5 w-3.5" /> Apply
                    </Button>
                    {!kit.is_default && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(kit.id)}>
                        <Star className="mr-1 h-3.5 w-3.5" /> Set Default
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(kit)}>
                      <Edit3 className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(kit)}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                    </Button>
                    {deleteConfirm === kit.id ? (
                      <>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(kit.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Confirm
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(kit.id)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {previewKit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPreviewKit(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl"
            >
              <Card className="glass p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">{previewKit.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewKit(null)}>
                    ✕
                  </Button>
                </div>

                {/* Large preview */}
                <div
                  className="relative mb-4 flex h-48 items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${previewKit.primary_color}, ${previewKit.secondary_color})`,
                  }}
                >
                  {previewKit.logo_url && (
                    <img
                      src={previewKit.logo_url}
                      alt="Logo"
                      className="absolute h-14 w-14 object-contain"
                      style={{
                        ...(previewKit.logo_position === 'top-left' && { top: 12, left: 12 }),
                        ...(previewKit.logo_position === 'top-right' && { top: 12, right: 12 }),
                        ...(previewKit.logo_position === 'bottom-left' && { bottom: 12, left: 12 }),
                        ...(previewKit.logo_position === 'bottom-right' && { bottom: 12, right: 12 }),
                        ...(previewKit.logo_position === 'center' && { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: previewKit.font_family,
                      fontSize: FONT_SIZES.find((s) => s.value === previewKit.font_size)?.px || 42,
                      color: previewKit.text_color,
                      fontWeight: 700,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    Your Title Here
                  </span>
                  {previewKit.watermark_url && (
                    <img
                      src={previewKit.watermark_url}
                      alt="Watermark"
                      className="absolute inset-0 m-auto h-20 w-20 object-contain"
                      style={{ opacity: previewKit.watermark_opacity / 100 }}
                    />
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Style Preset</Label>
                    <p className="font-medium capitalize">{previewKit.style_preset}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Font Family</Label>
                    <p className="font-medium" style={{ fontFamily: previewKit.font_family }}>
                      {previewKit.font_family.split(',')[0]}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Font Size</Label>
                    <p className="font-medium capitalize">{previewKit.font_size}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Logo Position</Label>
                    <p className="font-medium">{LOGO_POSITIONS.find((p) => p.value === previewKit.logo_position)?.label}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Watermark Opacity</Label>
                    <p className="font-medium">{previewKit.watermark_opacity}%</p>
                  </div>
                </div>

                {/* Color palette */}
                <div className="mt-4">
                  <Label className="mb-2 block text-xs text-muted-foreground">Color Palette</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Primary', color: previewKit.primary_color },
                      { label: 'Secondary', color: previewKit.secondary_color },
                      { label: 'Accent', color: previewKit.accent_color },
                      { label: 'Background', color: previewKit.background_color },
                      { label: 'Text', color: previewKit.text_color },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-2 rounded-lg glass p-2">
                        <div className="h-6 w-6 rounded-full border border-border" style={{ background: c.color }} />
                        <div>
                          <p className="text-xs font-medium">{c.label}</p>
                          <p className="text-xs font-mono text-muted-foreground">{c.color}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPreviewKit(null)}>
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handleApplyToEditor(previewKit);
                    }}
                    className="bg-gradient-to-r from-primary to-accent text-white"
                  >
                    <Wand2 className="mr-2 h-4 w-4" /> Apply to Editor
                  </Button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
