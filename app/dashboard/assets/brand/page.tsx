'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Star,
  Upload,
  Loader2,
  RefreshCw,
  Check,
  X,
  Image as ImageIcon,
  Type,
  Droplet,
  Layers,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
} from '@/components/dashboard/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { insertActivityLog } from '@/lib/automation';
import {
  type BrandKit,
  type BrandKitInput,
  fetchBrandKits,
  insertBrandKit,
  updateBrandKit,
  deleteBrandKit,
  setDefaultBrandKit,
  uploadBrandAsset,
  deleteBrandAsset,
  DEFAULT_BRAND_KIT,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LOGO_POSITION_OPTIONS,
  STYLE_PRESET_OPTIONS,
} from '@/lib/brand-assets';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const COLOR_FIELDS: Array<{ key: keyof BrandKitInput; label: string }> = [
  { key: 'primary_color', label: 'Primary' },
  { key: 'secondary_color', label: 'Secondary' },
  { key: 'accent_color', label: 'Accent' },
  { key: 'background_color', label: 'Background' },
  { key: 'text_color', label: 'Text' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandAssetsPage() {
  const { toast } = useToast();
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingKit, setEditingKit] = useState<BrandKit | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandKit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewKit, setPreviewKit] = useState<BrandKit | null>(null);

  // Editor form state
  const [formData, setFormData] = useState<BrandKitInput>(DEFAULT_BRAND_KIT);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const [logoStoragePath, setLogoStoragePath] = useState<string | null>(null);
  const [watermarkStoragePath, setWatermarkStoragePath] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchBrandKits();
      setKits(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand kits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Editor helpers ─────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingKit(null);
    setFormData(DEFAULT_BRAND_KIT);
    setLogoStoragePath(null);
    setWatermarkStoragePath(null);
    setShowEditor(true);
  }, []);

  const openEdit = useCallback((kit: BrandKit) => {
    setEditingKit(kit);
    const { id, user_id, created_at, updated_at, ...rest } = kit;
    setFormData(rest);
    setLogoStoragePath(null);
    setWatermarkStoragePath(null);
    setShowEditor(true);
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingKit(null);
  }, []);

  const updateField = useCallback(<K extends keyof BrandKitInput>(key: K, value: BrandKitInput[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ─── Upload logo ────────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Authentication required');

      const { url, path } = await uploadBrandAsset(file, userData.user.id, 'logos');
      updateField('logo_url', url);
      setLogoStoragePath(path);
      toast({ title: 'Logo uploaded' });
    } catch (err) {
      toast({
        title: 'Logo upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }, [updateField, toast]);

  const handleWatermarkUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingWatermark(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Authentication required');

      const { url, path } = await uploadBrandAsset(file, userData.user.id, 'watermarks');
      updateField('watermark_url', url);
      setWatermarkStoragePath(path);
      toast({ title: 'Watermark uploaded' });
    } catch (err) {
      toast({
        title: 'Watermark upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploadingWatermark(false);
      if (watermarkInputRef.current) watermarkInputRef.current.value = '';
    }
  }, [updateField, toast]);

  // ─── Save (create or update) ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingKit) {
        await updateBrandKit(editingKit.id, formData);
        await insertActivityLog({
          module: 'assets',
          action: 'brand_kit_updated',
          entity_type: 'brand_kit',
          entity_id: editingKit.id,
          details: { name: formData.name },
          level: 'success',
        });
        toast({ title: 'Brand kit updated' });
      } else {
        const created = await insertBrandKit(formData);
        await insertActivityLog({
          module: 'assets',
          action: 'brand_kit_created',
          entity_type: 'brand_kit',
          entity_id: created.id,
          details: { name: formData.name },
          level: 'success',
        });
        toast({ title: 'Brand kit created' });
      }
      closeEditor();
      await load();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [formData, editingKit, closeEditor, load, toast]);

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Clean up storage assets
      if (deleteTarget.logo_url) {
        try {
          const logoPath = deleteTarget.logo_url.match(/\/brand\/logos\/.+$/)?.[0];
          if (logoPath) await deleteBrandAsset(logoPath);
        } catch { /* non-fatal */ }
      }
      if (deleteTarget.watermark_url) {
        try {
          const wmPath = deleteTarget.watermark_url.match(/\/brand\/watermarks\/.+$/)?.[0];
          if (wmPath) await deleteBrandAsset(wmPath);
        } catch { /* non-fatal */ }
      }

      await deleteBrandKit(deleteTarget.id);
      await insertActivityLog({
        module: 'assets',
        action: 'brand_kit_deleted',
        entity_type: 'brand_kit',
        entity_id: deleteTarget.id,
        level: 'warning',
      });
      toast({ title: 'Brand kit deleted' });
      setKits((prev) => prev.filter((k) => k.id !== deleteTarget.id));
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, toast]);

  // ─── Duplicate ─────────────────────────────────────────────────────────────────

  const handleDuplicate = useCallback(async (kit: BrandKit) => {
    try {
      const { id, user_id, created_at, updated_at, ...rest } = kit;
      await insertBrandKit({ ...rest, name: `${kit.name} (Copy)`, is_default: false });
      await insertActivityLog({
        module: 'assets',
        action: 'brand_kit_duplicated',
        entity_type: 'brand_kit',
        details: { source_name: kit.name },
        level: 'info',
      });
      toast({ title: 'Brand kit duplicated' });
      await load();
    } catch (err) {
      toast({
        title: 'Duplicate failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [load, toast]);

  // ─── Set default ──────────────────────────────────────────────────────────────

  const handleSetDefault = useCallback(async (kit: BrandKit) => {
    try {
      await setDefaultBrandKit(kit.id);
      toast({ title: 'Default brand kit updated' });
      await load();
    } catch (err) {
      toast({
        title: 'Failed to set default',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [load, toast]);

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const filtered = kits.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Brand Assets"
        description="Manage your brand kits — colors, fonts, logos, and watermarks for thumbnails and videos."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-gradient-to-r from-primary to-accent text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Brand Kit
            </Button>
          </>
        }
      />

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search brand kits..." />
        </div>
        <Badge variant="secondary" className="w-fit">
          {kits.length} kit{kits.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState message="Loading brand kits..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Palette}
          title={kits.length === 0 ? 'No brand kits yet' : 'No matching kits'}
          description={
            kits.length === 0
              ? 'Create a brand kit to save your colors, fonts, logos, and watermarks for reuse across thumbnails and videos.'
              : 'Try adjusting your search.'
          }
          action={
            kits.length === 0 ? (
              <Button
                size="sm"
                onClick={openCreate}
                className="bg-gradient-to-r from-primary to-accent text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Brand Kit
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((kit, i) => (
              <motion.div
                key={kit.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="glass glass-hover group overflow-hidden p-0">
                  {/* Color strip preview */}
                  <div className="relative h-28 overflow-hidden" style={{ backgroundColor: kit.background_color }}>
                    <div className="absolute inset-0 flex">
                      <div className="flex-1" style={{ backgroundColor: kit.primary_color }} />
                      <div className="flex-1" style={{ backgroundColor: kit.secondary_color }} />
                      <div className="flex-1" style={{ backgroundColor: kit.accent_color }} />
                    </div>
                    {kit.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={kit.logo_url}
                        alt="logo"
                        className="absolute right-2 top-2 h-8 w-8 rounded object-contain bg-white/10 p-0.5"
                      />
                    )}
                    {kit.is_default && (
                      <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                        <Star className="mr-1 h-3 w-3" />
                        Default
                      </Badge>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={kit.name}>
                          {kit.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {kit.font_family} · {kit.style_preset}
                        </p>
                      </div>
                    </div>

                    {/* Color dots */}
                    <div className="mt-3 flex items-center gap-1.5">
                      {COLOR_FIELDS.map(({ key, label }) => (
                        <div
                          key={key}
                          className="h-5 w-5 rounded-full border border-border"
                          style={{ backgroundColor: kit[key] as string }}
                          title={label}
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {formatDate(kit.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewKit(kit)}
                        className="flex-1"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(kit)}
                        title="Edit"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(kit)}
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {!kit.is_default && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetDefault(kit)}
                          title="Set as default"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(kit)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Editor Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={showEditor} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingKit ? 'Edit Brand Kit' : 'Create Brand Kit'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Name */}
            <div>
              <Label className="mb-1.5 block">Brand Kit Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="My Brand Kit"
              />
            </div>

            {/* Logo & Watermark */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Logo</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
                    {formData.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formData.logo_url} alt="logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload Logo
                  </Button>
                  {formData.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateField('logo_url', null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">Watermark</Label>
                <input
                  ref={watermarkInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleWatermarkUpload}
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
                    {formData.watermark_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formData.watermark_url}
                        alt="watermark"
                        className="h-full w-full object-contain opacity-50"
                        style={{ opacity: formData.watermark_opacity / 100 }}
                      />
                    ) : (
                      <Layers className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => watermarkInputRef.current?.click()}
                    disabled={uploadingWatermark}
                  >
                    {uploadingWatermark ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload
                  </Button>
                  {formData.watermark_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateField('watermark_url', null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Watermark opacity */}
            {formData.watermark_url && (
              <div>
                <Label className="mb-1.5 block">
                  Watermark Opacity: {formData.watermark_opacity}%
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={formData.watermark_opacity}
                  onChange={(e) => updateField('watermark_opacity', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {/* Colors */}
            <div>
              <Label className="mb-3 block">
                <Droplet className="mr-1.5 inline h-4 w-4" />
                Brand Colors
              </Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData[key] as string}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                      />
                      <Input
                        value={formData[key] as string}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="h-9 flex-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div>
              <Label className="mb-3 block">
                <Type className="mr-1.5 inline h-4 w-4" />
                Typography
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Font Family</Label>
                  <Select
                    value={formData.font_family}
                    onValueChange={(v) => updateField('font_family', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Font Size</Label>
                  <Select
                    value={formData.font_size}
                    onValueChange={(v) => updateField('font_size', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_SIZE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Logo Position</Label>
                  <Select
                    value={formData.logo_position}
                    onValueChange={(v) => updateField('logo_position', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOGO_POSITION_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p.replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Style preset */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Style Preset</Label>
              <Select
                value={formData.style_preset}
                onValueChange={(v) => updateField('style_preset', v)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLE_PRESET_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default toggle */}
            <div className="flex items-center justify-between rounded-lg glass p-3">
              <div>
                <p className="text-sm font-medium">Set as default</p>
                <p className="text-xs text-muted-foreground">
                  This kit will be used automatically in thumbnail and video studios.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField('is_default', !formData.is_default)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  formData.is_default ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    formData.is_default ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editingKit ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editingKit ? 'Save Changes' : 'Create Kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={!!previewKit} onOpenChange={(open) => !open && setPreviewKit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewKit?.name}</DialogTitle>
          </DialogHeader>
          {previewKit && (
            <div className="space-y-4">
              {/* Preview card with brand colors */}
              <div
                className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl"
                style={{ backgroundColor: previewKit.background_color }}
              >
                <div className="absolute inset-0 flex">
                  <div className="flex-1" style={{ backgroundColor: previewKit.primary_color }} />
                  <div className="flex-1" style={{ backgroundColor: previewKit.secondary_color }} />
                  <div className="flex-1" style={{ backgroundColor: previewKit.accent_color }} />
                </div>
                <div className="relative z-10 text-center">
                  <p
                    className="font-display text-xl font-bold"
                    style={{ color: previewKit.text_color, fontFamily: previewKit.font_family }}
                  >
                    {previewKit.name}
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: previewKit.text_color, opacity: 0.7 }}
                  >
                    {previewKit.font_family} · {previewKit.style_preset}
                  </p>
                </div>
                {previewKit.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewKit.logo_url}
                    alt="logo"
                    className="absolute h-10 w-10 rounded bg-white/10 p-1 object-contain"
                    style={{
                      [previewKit.logo_position.includes('top') ? 'top' : 'bottom']: '8px',
                      [previewKit.logo_position.includes('left') ? 'left' : 'right']: '8px',
                    } as React.CSSProperties}
                  />
                )}
                {previewKit.watermark_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewKit.watermark_url}
                    alt="watermark"
                    className="absolute inset-0 m-auto h-20 w-20 object-contain"
                    style={{ opacity: previewKit.watermark_opacity / 100 }}
                  />
                )}
              </div>

              {/* Color details */}
              <div className="grid grid-cols-5 gap-2">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="text-center">
                    <div
                      className="mx-auto mb-1 h-8 w-8 rounded-lg border border-border"
                      style={{ backgroundColor: previewKit[key] as string }}
                    />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-mono text-xs">{previewKit[key] as string}</p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Font</p>
                  <p className="font-medium">{previewKit.font_family}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-medium capitalize">{previewKit.font_size}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Logo Position</p>
                  <p className="font-medium capitalize">{previewKit.logo_position.replace('-', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Style</p>
                  <p className="font-medium capitalize">{previewKit.style_preset}</p>
                </div>
                {previewKit.watermark_url && (
                  <div>
                    <p className="text-xs text-muted-foreground">Watermark Opacity</p>
                    <p className="font-medium">{previewKit.watermark_opacity}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete brand kit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and its
              associated logo and watermark files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
