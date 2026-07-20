'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type,
  Image as ImageIcon,
  Shapes,
  Filter,
  Undo2,
  Redo2,
  Download,
  Save,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Layers,
  Plus,
  Upload,
  Eye,
  EyeOff,
  Loader2,
  Wand2,
  ArrowRight,
  Circle,
  Square,
  Bold,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { PageHeader, EmptyState, ErrorState } from '@/components/dashboard/shared';

// ─── Types ──────────────────────────────────────────────────────────────────
type LayerType = 'text' | 'image' | 'shape' | 'filter';
type ShapeKind = 'arrow' | 'circle' | 'rectangle';
type FilterKind = 'brightness' | 'contrast' | 'saturation' | 'blur';

interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  align: 'left' | 'center' | 'right';
}

interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;
  filters: Record<FilterKind, number>;
}

interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

interface FilterLayer extends BaseLayer {
  type: 'filter';
  filters: Record<FilterKind, number>;
}

type Layer = TextLayer | ImageLayer | ShapeLayer | FilterLayer;

interface Template {
  id: string;
  name: string;
  icon: typeof Wand2;
  gradient: string;
  layers: Omit<Layer, 'id'>[];
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CANVAS_W = 1280;
const CANVAS_H = 720;
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

const PRESET_TEMPLATES: Template[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    icon: Sparkles,
    gradient: 'from-purple-600 to-pink-600',
    layers: [
      {
        type: 'text',
        name: 'EPIC TITLE',
        visible: true,
        x: 60,
        y: 500,
        width: 800,
        height: 120,
        rotation: 0,
        opacity: 1,
        text: 'EPIC MOMENT!',
        fontFamily: 'Anton, sans-serif',
        fontSize: 96,
        color: '#FFD700',
        fontWeight: 900,
        shadow: true,
        shadowColor: '#000000',
        shadowBlur: 8,
        stroke: true,
        strokeColor: '#000000',
        strokeWidth: 4,
        align: 'left',
      } as Omit<TextLayer, 'id'>,
    ],
  },
  {
    id: 'vlog',
    name: 'Vlog',
    icon: ImageIcon,
    gradient: 'from-blue-500 to-cyan-400',
    layers: [
      {
        type: 'text',
        name: 'Vlog Title',
        visible: true,
        x: 40,
        y: 40,
        width: 900,
        height: 80,
        rotation: 0,
        opacity: 1,
        text: 'My Day in the Life',
        fontFamily: 'Poppins, sans-serif',
        fontSize: 56,
        color: '#FFFFFF',
        fontWeight: 700,
        shadow: true,
        shadowColor: '#000000',
        shadowBlur: 6,
        stroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        align: 'left',
      } as Omit<TextLayer, 'id'>,
    ],
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    icon: Wand2,
    gradient: 'from-green-500 to-emerald-500',
    layers: [
      {
        type: 'text',
        name: 'How To',
        visible: true,
        x: 60,
        y: 560,
        width: 1000,
        height: 100,
        rotation: 0,
        opacity: 1,
        text: 'How to Build It Step by Step',
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 64,
        color: '#FFFFFF',
        fontWeight: 800,
        shadow: true,
        shadowColor: '#1a1a2e',
        shadowBlur: 10,
        stroke: true,
        strokeColor: '#1a1a2e',
        strokeWidth: 3,
        align: 'left',
      } as Omit<TextLayer, 'id'>,
    ],
  },
  {
    id: 'review',
    name: 'Review',
    icon: Bold,
    gradient: 'from-orange-500 to-red-500',
    layers: [
      {
        type: 'text',
        name: 'REVIEW',
        visible: true,
        x: 60,
        y: 40,
        width: 600,
        height: 100,
        rotation: 0,
        opacity: 1,
        text: 'HONEST REVIEW',
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: 88,
        color: '#FF4757',
        fontWeight: 700,
        shadow: true,
        shadowColor: '#000000',
        shadowBlur: 6,
        stroke: true,
        strokeColor: '#FFFFFF',
        strokeWidth: 2,
        align: 'left',
      } as Omit<TextLayer, 'id'>,
    ],
  },
  {
    id: 'news',
    name: 'News',
    icon: Type,
    gradient: 'from-slate-700 to-slate-900',
    layers: [
      {
        type: 'text',
        name: 'Breaking',
        visible: true,
        x: 40,
        y: 40,
        width: 1200,
        height: 120,
        rotation: 0,
        opacity: 1,
        text: 'BREAKING NEWS',
        fontFamily: 'Oswald, sans-serif',
        fontSize: 72,
        color: '#FFFFFF',
        fontWeight: 700,
        shadow: false,
        shadowColor: '#000000',
        shadowBlur: 0,
        stroke: false,
        strokeColor: '#000000',
        strokeWidth: 0,
        align: 'center',
      } as Omit<TextLayer, 'id'>,
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
let layerIdCounter = 0;
function genLayerId(): string {
  layerIdCounter += 1;
  return `layer_${Date.now()}_${layerIdCounter}`;
}

function createTextLayer(partial?: Partial<TextLayer>): TextLayer {
  return {
    id: genLayerId(),
    type: 'text',
    name: 'Text Layer',
    visible: true,
    x: 100,
    y: 100,
    width: 400,
    height: 80,
    rotation: 0,
    opacity: 1,
    text: 'Your Text Here',
    fontFamily: 'Inter, sans-serif',
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 700,
    shadow: true,
    shadowColor: '#000000',
    shadowBlur: 4,
    stroke: false,
    strokeColor: '#000000',
    strokeWidth: 2,
    align: 'center',
    ...partial,
  };
}

function createImageLayer(src: string, partial?: Partial<ImageLayer>): ImageLayer {
  return {
    id: genLayerId(),
    type: 'image',
    name: 'Image Layer',
    visible: true,
    x: 50,
    y: 50,
    width: 400,
    height: 300,
    rotation: 0,
    opacity: 1,
    src,
    filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
    ...partial,
  };
}

function createShapeLayer(partial?: Partial<ShapeLayer>): ShapeLayer {
  return {
    id: genLayerId(),
    type: 'shape',
    name: 'Shape Layer',
    visible: true,
    x: 200,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    shape: 'rectangle',
    fill: '#FF4757',
    stroke: '#FFFFFF',
    strokeWidth: 3,
    ...partial,
  };
}

function createFilterLayer(partial?: Partial<FilterLayer>): FilterLayer {
  return {
    id: genLayerId(),
    type: 'filter',
    name: 'Filter Layer',
    visible: true,
    x: 0,
    y: 0,
    width: CANVAS_W,
    height: CANVAS_H,
    rotation: 0,
    opacity: 0.5,
    filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
    ...partial,
  };
}

function buildCssFilter(filters: Record<FilterKind, number>): string {
  return [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `blur(${filters.blur}px)`,
  ].join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ThumbnailEditorPage() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [history, setHistory] = useState<Layer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<LayerType>('text');
  const [dragInfo, setDragInfo] = useState<{
    layerId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedId) || null;

  // ─── History ──────────────────────────────────────────────────────────────
  const pushHistory = useCallback((next: Layer[]) => {
    setHistory((prev) => {
      const newHist = [...prev.slice(0, historyIndex + 1), next];
      // cap history at 50
      if (newHist.length > 50) newHist.shift();
      return newHist;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setLayers(prev);
      setHistoryIndex(historyIndex - 1);
      toast({ title: 'Undo', description: 'Reverted last action' });
    }
  }, [history, historyIndex, toast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setLayers(next);
      setHistoryIndex(historyIndex + 1);
      toast({ title: 'Redo', description: 'Reapplied action' });
    }
  }, [history, historyIndex, toast]);

  // ─── Load existing draft ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadDraft() {
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
          .from('assets')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('type', 'thumbnail_draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!cancelled && data?.metadata) {
          const meta = data.metadata as { layers?: Layer[]; bgColor?: string; bgImage?: string };
          if (meta.layers) setLayers(meta.layers);
          if (meta.bgColor) setBgColor(meta.bgColor);
          if (meta.bgImage) setBgImage(meta.bgImage);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load draft';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Layer operations ─────────────────────────────────────────────────────
  const addLayer = useCallback(
    (layer: Layer) => {
      const next = [...layers, layer];
      setLayers(next);
      setSelectedId(layer.id);
      pushHistory(next);
    },
    [layers, pushHistory],
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));
    },
    [],
  );

  const commitLayerUpdate = useCallback(
    (id: string, patch: Partial<Layer>) => {
      const next = layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l));
      setLayers(next);
      pushHistory(next);
    },
    [layers, pushHistory],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      const next = layers.filter((l) => l.id !== id);
      setLayers(next);
      if (selectedId === id) setSelectedId(null);
      pushHistory(next);
      toast({ title: 'Layer deleted' });
    },
    [layers, selectedId, pushHistory, toast],
  );

  // Apply brand kit from sessionStorage (set by Brand Kit page) on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('selectedBrandKit');
      if (!stored) return;
      const kit = JSON.parse(stored) as {
        primaryColor?: string;
        bgColor?: string;
        text_color?: string;
        font_family?: string;
        font_size?: number;
        logo_url?: string;
      };
      if (kit.bgColor) setBgColor(kit.bgColor);
      if (kit.logo_url) {
        addLayer(createImageLayer(kit.logo_url, { name: 'Brand Logo' }));
      }
      if (kit.primaryColor || kit.text_color || kit.font_family) {
        const textLayer = createTextLayer();
        if (kit.text_color) textLayer.color = kit.text_color;
        else if (kit.primaryColor) textLayer.color = kit.primaryColor;
        if (kit.font_family) textLayer.fontFamily = kit.font_family;
        if (kit.font_size) textLayer.fontSize = kit.font_size;
        addLayer(textLayer);
      }
      sessionStorage.removeItem('selectedBrandKit');
      toast({ title: 'Brand kit applied', description: 'Brand colors and assets loaded into the editor.' });
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLayer]);

  const duplicateLayer = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const copy = { ...layer, id: genLayerId(), name: `${layer.name} copy`, x: layer.x + 20, y: layer.y + 20 } as Layer;
      const next = [...layers, copy];
      setLayers(next);
      setSelectedId(copy.id);
      pushHistory(next);
      toast({ title: 'Layer duplicated' });
    },
    [layers, pushHistory, toast],
  );

  const moveLayer = useCallback(
    (id: string, dir: 'up' | 'down') => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const swap = dir === 'up' ? idx + 1 : idx - 1;
      if (swap < 0 || swap >= layers.length) return;
      const next = [...layers];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      setLayers(next);
      pushHistory(next);
    },
    [layers, pushHistory],
  );

  // ─── Tool actions ──────────────────────────────────────────────────────────
  const handleAddText = () => addLayer(createTextLayer());
  const handleAddShape = (shape: ShapeKind) => {
    const partial: Partial<ShapeLayer> = { shape, name: `${shape} shape` };
    if (shape === 'arrow') partial.width = 300;
    addLayer(createShapeLayer(partial));
  };
  const handleAddFilter = () => addLayer(createFilterLayer());

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || 'anonymous';
      const ext = file.name.split('.').pop();
      const path = `${userId}/overlays/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('assets').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
      addLayer(createImageLayer(urlData.publicUrl, { name: file.name.replace(/\.[^/.]+$/, '') }));
      toast({ title: 'Image added', description: file.name });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || 'anonymous';
      const ext = file.name.split('.').pop();
      const path = `${userId}/backgrounds/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('assets').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
      setBgImage(urlData.publicUrl);
      toast({ title: 'Background set', description: file.name });
    } catch (err) {
      toast({
        title: 'Background upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      e.target.value = '';
    }
  };

  const applyTemplate = (tpl: Template) => {
    const newLayers: Layer[] = tpl.layers.map((l) => ({ ...l, id: genLayerId() } as Layer));
    setLayers(newLayers);
    pushHistory(newLayers);
    setSelectedId(newLayers[0]?.id ?? null);
    toast({ title: 'Template applied', description: `${tpl.name} template loaded` });
  };

  // ─── Drag to move layers ───────────────────────────────────────────────────
  const handleLayerMouseDown = (e: React.MouseEvent, layer: Layer) => {
    e.stopPropagation();
    setSelectedId(layer.id);
    setDragInfo({
      layerId: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
    });
  };

  useEffect(() => {
    if (!dragInfo) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragInfo.startX;
      const dy = e.clientY - dragInfo.startY;
      updateLayer(dragInfo.layerId, { x: dragInfo.origX + dx, y: dragInfo.origY + dy });
    };
    const handleUp = () => {
      // commit to history
      const current = layers.find((l) => l.id === dragInfo.layerId);
      if (current) {
        const next = layers.map((l) => (l.id === dragInfo.layerId ? current : l));
        pushHistory(next);
      }
      setDragInfo(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragInfo]);

  // ─── Export ─────────────────────────────────────────────────────────────────
  const exportThumbnail = async (format: 'png' | 'jpg') => {
    setExporting(true);
    try {
      // Use the canvas API to capture the DOM-based canvas
      // For production, you'd use html2canvas or a server-side renderer
      // Here we generate a data URL from the current state as a simplified export
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // Background
      if (bgImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bgImage;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // Draw layers
      for (const layer of layers) {
        if (!layer.visible) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
        ctx.rotate((layer.rotation * Math.PI) / 180);
        ctx.translate(-layer.width / 2, -layer.height / 2);

        if (layer.type === 'text') {
          ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
          ctx.fillStyle = layer.color;
          ctx.textAlign = layer.align;
          ctx.textBaseline = 'middle';
          if (layer.shadow) {
            ctx.shadowColor = layer.shadowColor;
            ctx.shadowBlur = layer.shadowBlur;
          }
          if (layer.stroke) {
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = layer.strokeWidth;
            ctx.strokeText(layer.text, layer.width / 2, layer.height / 2);
          }
          ctx.fillText(layer.text, layer.width / 2, layer.height / 2);
        } else if (layer.type === 'shape') {
          ctx.fillStyle = layer.fill;
          ctx.strokeStyle = layer.stroke;
          ctx.lineWidth = layer.strokeWidth;
          if (layer.shape === 'rectangle') {
            ctx.fillRect(0, 0, layer.width, layer.height);
            ctx.strokeRect(0, 0, layer.width, layer.height);
          } else if (layer.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(layer.width / 2, layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (layer.shape === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(0, layer.height / 2);
            ctx.lineTo(layer.width - 30, layer.height / 2);
            ctx.lineTo(layer.width - 30, layer.height / 2 - 20);
            ctx.lineTo(layer.width, layer.height / 2);
            ctx.lineTo(layer.width - 30, layer.height / 2 + 20);
            ctx.lineTo(layer.width - 30, layer.height / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, 0.92);
      const link = document.createElement('a');
      link.download = `thumbnail-${Date.now()}.${format}`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Exported', description: `Thumbnail exported as ${format.toUpperCase()}` });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  // ─── Save to Supabase ──────────────────────────────────────────────────────
  const saveToSupabase = async () => {
    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error('Not authenticated');
      const userId = userData.user.id;

      // Export canvas as data URL for storage
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const previewBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));

      let previewPath: string | null = null;
      if (previewBlob) {
        previewPath = `${userId}/thumbnails/preview-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from('assets').upload(previewPath, previewBlob);
        if (upErr) {
          console.warn('Preview upload failed:', upErr.message);
          previewPath = null;
        }
      }

      const draftRecord = {
        user_id: userId,
        type: 'thumbnail_draft',
        name: `Thumbnail Draft ${new Date().toLocaleDateString()}`,
        url: previewPath ? supabase.storage.from('assets').getPublicUrl(previewPath).data.publicUrl : null,
        metadata: { layers, bgColor, bgImage },
      };

      // Upsert: check if draft exists
      const { data: existing } = await supabase
        .from('assets')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'thumbnail_draft')
        .maybeSingle();

      let dbErr;
      if (existing?.id) {
        const { error } = await supabase.from('assets').update({ ...draftRecord, updated_at: new Date().toISOString() }).eq('id', existing.id);
        dbErr = error;
      } else {
        const { error } = await supabase.from('assets').insert(draftRecord);
        dbErr = error;
      }

      if (dbErr) throw dbErr;
      toast({ title: 'Saved', description: 'Thumbnail draft saved to Supabase' });
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

  // ─── Render layer on canvas ────────────────────────────────────────────────
  const renderLayer = (layer: Layer) => {
    if (!layer.visible) return null;
    const isSelected = layer.id === selectedId;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      opacity: layer.opacity,
      transform: `rotate(${layer.rotation}deg)`,
      cursor: 'move',
      border: isSelected ? '2px solid #6366f1' : '2px solid transparent',
    };

    if (layer.type === 'text') {
      return (
        <div
          key={layer.id}
          style={baseStyle}
          onMouseDown={(e) => handleLayerMouseDown(e, layer)}
          className="flex items-center"
        >
          <span
            style={{
              fontFamily: layer.fontFamily,
              fontSize: layer.fontSize,
              color: layer.color,
              fontWeight: layer.fontWeight,
              textAlign: layer.align,
              width: '100%',
              textShadow: layer.shadow ? `${layer.shadowBlur}px ${layer.shadowBlur}px ${layer.shadowColor}` : 'none',
              WebkitTextStroke: layer.stroke ? `${layer.strokeWidth}px ${layer.strokeColor}` : 'none',
              lineHeight: 1.1,
              pointerEvents: 'none',
            }}
          >
            {layer.text}
          </span>
        </div>
      );
    }

    if (layer.type === 'image') {
      return (
        <div key={layer.id} style={baseStyle} onMouseDown={(e) => handleLayerMouseDown(e, layer)} className="overflow-hidden">
          <img
            src={layer.src}
            alt={layer.name}
            className="h-full w-full object-cover"
            style={{ filter: buildCssFilter(layer.filters) }}
            draggable={false}
          />
        </div>
      );
    }

    if (layer.type === 'shape') {
      return (
        <div key={layer.id} style={baseStyle} onMouseDown={(e) => handleLayerMouseDown(e, layer)}>
          {layer.shape === 'rectangle' && (
            <div
              className="h-full w-full"
              style={{ background: layer.fill, border: `${layer.strokeWidth}px solid ${layer.stroke}` }}
            />
          )}
          {layer.shape === 'circle' && (
            <div
              className="h-full w-full rounded-full"
              style={{ background: layer.fill, border: `${layer.strokeWidth}px solid ${layer.stroke}` }}
            />
          )}
          {layer.shape === 'arrow' && (
            <svg viewBox="0 0 300 60" className="h-full w-full" preserveAspectRatio="none">
              <path
                d="M0,30 L250,30 L250,10 L300,30 L250,50 L250,30 Z"
                fill={layer.fill}
                stroke={layer.stroke}
                strokeWidth={layer.strokeWidth}
              />
            </svg>
          )}
        </div>
      );
    }

    if (layer.type === 'filter') {
      return (
        <div
          key={layer.id}
          style={{
            ...baseStyle,
            pointerEvents: 'none',
            background: `rgba(0,0,0,0)`,
            backdropFilter: buildCssFilter(layer.filters),
          }}
        />
      );
    }

    return null;
  };

  // ─── Properties panel ──────────────────────────────────────────────────────
  const renderProperties = () => {
    if (!selectedLayer) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Select a layer to edit its properties</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Common props */}
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={selectedLayer.name}
            onChange={(e) => updateLayer(selectedLayer.id, { name: e.target.value })}
            onBlur={() => commitLayerUpdate(selectedLayer.id, { name: selectedLayer.name })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">X</Label>
            <Input
              type="number"
              value={Math.round(selectedLayer.x)}
              onChange={(e) => updateLayer(selectedLayer.id, { x: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Y</Label>
            <Input
              type="number"
              value={Math.round(selectedLayer.y)}
              onChange={(e) => updateLayer(selectedLayer.id, { y: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Width</Label>
            <Input
              type="number"
              value={Math.round(selectedLayer.width)}
              onChange={(e) => updateLayer(selectedLayer.id, { width: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height</Label>
            <Input
              type="number"
              value={Math.round(selectedLayer.height)}
              onChange={(e) => updateLayer(selectedLayer.id, { height: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Opacity: {Math.round(selectedLayer.opacity * 100)}%</Label>
          <Slider
            value={[selectedLayer.opacity * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => updateLayer(selectedLayer.id, { opacity: v[0] / 100 })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Rotation: {selectedLayer.rotation}°</Label>
          <Slider
            value={[selectedLayer.rotation]}
            min={-180}
            max={180}
            step={1}
            onValueChange={(v) => updateLayer(selectedLayer.id, { rotation: v[0] })}
          />
        </div>

        {/* Text-specific */}
        {selectedLayer.type === 'text' && (
          <>
            <div className="space-y-2">
              <Label>Text Content</Label>
              <Textarea
                value={selectedLayer.text}
                onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={selectedLayer.fontFamily}
                onValueChange={(v) => commitLayerUpdate(selectedLayer.id, { fontFamily: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.split(',')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Font Size: {selectedLayer.fontSize}px</Label>
              <Slider
                value={[selectedLayer.fontSize]}
                min={12}
                max={144}
                step={1}
                onValueChange={(v) => updateLayer(selectedLayer.id, { fontSize: v[0] })}
              />
            </div>
            <div className="space-y-2">
              <Label>Font Weight: {selectedLayer.fontWeight}</Label>
              <Slider
                value={[selectedLayer.fontWeight]}
                min={100}
                max={900}
                step={100}
                onValueChange={(v) => updateLayer(selectedLayer.id, { fontWeight: v[0] })}
              />
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.color}
                  onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input
                  value={selectedLayer.color}
                  onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alignment</Label>
              <Select
                value={selectedLayer.align}
                onValueChange={(v) => commitLayerUpdate(selectedLayer.id, { align: v as TextLayer['align'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg glass p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLayer.shadow}
                  onChange={(e) => commitLayerUpdate(selectedLayer.id, { shadow: e.target.checked })}
                />
                Shadow
              </label>
              {selectedLayer.shadow && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedLayer.shadowColor}
                      onChange={(e) => updateLayer(selectedLayer.id, { shadowColor: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-border"
                    />
                    <Label className="text-xs">Shadow Color</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Blur: {selectedLayer.shadowBlur}px</Label>
                    <Slider
                      value={[selectedLayer.shadowBlur]}
                      min={0}
                      max={30}
                      step={1}
                      onValueChange={(v) => updateLayer(selectedLayer.id, { shadowBlur: v[0] })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2 rounded-lg glass p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedLayer.stroke}
                  onChange={(e) => commitLayerUpdate(selectedLayer.id, { stroke: e.target.checked })}
                />
                Stroke
              </label>
              {selectedLayer.stroke && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedLayer.strokeColor}
                      onChange={(e) => updateLayer(selectedLayer.id, { strokeColor: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-border"
                    />
                    <Label className="text-xs">Stroke Color</Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Width: {selectedLayer.strokeWidth}px</Label>
                    <Slider
                      value={[selectedLayer.strokeWidth]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={(v) => updateLayer(selectedLayer.id, { strokeWidth: v[0] })}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Image-specific */}
        {selectedLayer.type === 'image' && (
          <div className="space-y-3 rounded-lg glass p-3">
            <Label className="text-sm font-medium">Filters</Label>
            {(['brightness', 'contrast', 'saturation', 'blur'] as FilterKind[]).map((fk) => (
              <div key={fk} className="space-y-1">
                <Label className="text-xs capitalize">
                  {fk}: {selectedLayer.filters[fk]}
                  {fk !== 'blur' ? '%' : 'px'}
                </Label>
                <Slider
                  value={[selectedLayer.filters[fk]]}
                  min={fk === 'blur' ? 0 : 0}
                  max={fk === 'blur' ? 20 : 200}
                  step={1}
                  onValueChange={(v) =>
                    updateLayer(selectedLayer.id, {
                      filters: { ...selectedLayer.filters, [fk]: v[0] },
                    } as Partial<ImageLayer>)
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Shape-specific */}
        {selectedLayer.type === 'shape' && (
          <>
            <div className="space-y-2">
              <Label>Shape</Label>
              <Select
                value={selectedLayer.shape}
                onValueChange={(v) => commitLayerUpdate(selectedLayer.id, { shape: v as ShapeKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rectangle">Rectangle</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                  <SelectItem value="arrow">Arrow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fill Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.fill}
                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input
                  value={selectedLayer.fill}
                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stroke Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.stroke}
                  onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
                />
                <Input
                  value={selectedLayer.stroke}
                  onChange={(e) => updateLayer(selectedLayer.id, { stroke: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stroke Width: {selectedLayer.strokeWidth}px</Label>
              <Slider
                value={[selectedLayer.strokeWidth]}
                min={0}
                max={20}
                step={1}
                onValueChange={(v) => updateLayer(selectedLayer.id, { strokeWidth: v[0] })}
              />
            </div>
          </>
        )}

        {/* Filter-specific */}
        {selectedLayer.type === 'filter' && (
          <div className="space-y-3 rounded-lg glass p-3">
            <Label className="text-sm font-medium">Filter Values</Label>
            {(['brightness', 'contrast', 'saturation', 'blur'] as FilterKind[]).map((fk) => (
              <div key={fk} className="space-y-1">
                <Label className="text-xs capitalize">
                  {fk}: {selectedLayer.filters[fk]}
                  {fk !== 'blur' ? '%' : 'px'}
                </Label>
                <Slider
                  value={[selectedLayer.filters[fk]]}
                  min={0}
                  max={fk === 'blur' ? 20 : 200}
                  step={1}
                  onValueChange={(v) =>
                    updateLayer(selectedLayer.id, {
                      filters: { ...selectedLayer.filters, [fk]: v[0] },
                    } as Partial<FilterLayer>)
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t border-border/50 pt-3">
          <Button variant="outline" size="sm" onClick={() => duplicateLayer(selectedLayer.id)}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button variant="destructive" size="sm" onClick={() => deleteLayer(selectedLayer.id)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>
    );
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Thumbnail Editor" description="Design click-worthy YouTube thumbnails" />
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading editor...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader title="Thumbnail Editor" description="Design click-worthy YouTube thumbnails" />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Thumbnail Editor"
        description="Design click-worthy YouTube thumbnails with layers, shapes, and filters"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Undo
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <Redo2 className="mr-1.5 h-4 w-4" /> Redo
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportThumbnail('png')} disabled={exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportThumbnail('jpg')} disabled={exporting}>
              <Download className="mr-1.5 h-4 w-4" /> JPG
            </Button>
            <Button size="sm" onClick={saveToSupabase} disabled={saving} className="bg-gradient-to-r from-primary to-accent text-white">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save
            </Button>
          </>
        }
      />

      {/* Templates */}
      <Card className="glass p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Preset Templates</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              className="group flex items-center gap-2 rounded-xl glass px-4 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5"
            >
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br', tpl.gradient)}>
                <tpl.icon className="h-4 w-4 text-white" />
              </div>
              {tpl.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Main editor layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_280px]">
        {/* Left panel: Tools + Layers */}
        <div className="space-y-4">
          {/* Tools */}
          <Card className="glass p-4">
            <h3 className="mb-3 text-sm font-semibold">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={activeTool === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveTool('text');
                  handleAddText();
                }}
              >
                <Type className="mr-1.5 h-4 w-4" /> Text
              </Button>
              <Button
                variant={activeTool === 'image' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveTool('image');
                  fileInputRef.current?.click();
                }}
              >
                <ImageIcon className="mr-1.5 h-4 w-4" /> Image
              </Button>
              <Button
                variant={activeTool === 'shape' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveTool('shape');
                  handleAddShape('rectangle');
                }}
              >
                <Square className="mr-1.5 h-4 w-4" /> Rect
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddShape('circle')}>
                <Circle className="mr-1.5 h-4 w-4" /> Circle
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddShape('arrow')} className="col-span-2">
                <ArrowRight className="mr-1.5 h-4 w-4" /> Arrow
              </Button>
              <Button
                variant={activeTool === 'filter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveTool('filter');
                  handleAddFilter();
                }}
                className="col-span-2"
              >
                <Filter className="mr-1.5 h-4 w-4" /> Add Filter Layer
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </Card>

          {/* Layers list */}
          <Card className="glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Layers</h3>
              <Badge variant="secondary">{layers.length}</Badge>
            </div>
            {layers.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No layers yet. Add one to start.</p>
            ) : (
              <div className="space-y-1">
                {[...layers].reverse().map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedId(layer.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition',
                      selectedId === layer.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <span className="flex-1 truncate">
                      {layer.type === 'text' && <Type className="mr-1 inline h-3 w-3" />}
                      {layer.type === 'image' && <ImageIcon className="mr-1 inline h-3 w-3" />}
                      {layer.type === 'shape' && <Shapes className="mr-1 inline h-3 w-3" />}
                      {layer.type === 'filter' && <Filter className="mr-1 inline h-3 w-3" />}
                      {layer.name}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLayer(layer.id, 'up');
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveLayer(layer.id, 'down');
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Center: Canvas */}
        <Card className="glass p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Canvas (1280 × 720)</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">BG:</Label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-border"
              />
              <Button variant="outline" size="sm" onClick={() => bgInputRef.current?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> BG Image
              </Button>
              {bgImage && (
                <Button variant="ghost" size="sm" onClick={() => setBgImage(null)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            </div>
          </div>
          <div className="overflow-auto rounded-xl bg-muted/20 p-4">
            <div
              ref={canvasRef}
              onClick={() => setSelectedId(null)}
              className="relative mx-auto shadow-2xl"
              style={{
                width: '100%',
                maxWidth: CANVAS_W,
                aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                background: bgImage ? `url(${bgImage}) center/cover` : bgColor,
              }}
            >
              {layers.map(renderLayer)}
              {layers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-white/30" />
                    <p className="mt-2 text-sm text-white/40">Add layers to start designing</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right panel: Properties */}
        <Card className="glass p-4">
          <h3 className="mb-3 text-sm font-semibold">Properties</h3>
          {renderProperties()}
        </Card>
      </div>
    </div>
  );
}
