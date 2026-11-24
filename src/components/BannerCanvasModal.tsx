import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  RotateCw,
  Save,
  Share2,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type {
  CollectorUser,
  ConcertBanner,
  CustomSticker,
  Photocard,
  VisibilityMode,
} from '../types/kromacard';
import { detectMusicPlatform } from '../utils/mediaLinks';
import { ImageSourceSection } from './ImageSourceSection';

type PosterFormat = 'banner' | 'square' | 'story';
type BgPattern = 'gradient' | 'solid' | 'spotlight';
type BorderPreset = 'none' | 'neon' | 'gold' | 'dashed';
type FontPreset = 'display' | 'hand' | 'mono';

interface TextLayer {
  id: string;
  kind: 'text';
  text: string;
  x: number; // 0..1
  y: number; // 0..1
  size: number; // logical px on 1200 base
  color: string;
  font: FontPreset;
  badgeBg: boolean;
  rotation: number;
}

interface StickerLayer {
  id: string;
  kind: 'sticker';
  content: string;
  isImage: boolean;
  bgColor?: string;
  textColor?: string;
  x: number; // 0..1
  y: number; // 0..1
  scale: number; // 0.5..2.6
  rotation: number;
}

type CanvasLayer = TextLayer | StickerLayer;

interface BannerCanvasModalProps {
  currentUser: CollectorUser;
  stickers: CustomSticker[];
  onClose: () => void;
  onSaveBanner: (banner: Partial<ConcertBanner>) => Promise<void>;
  onConvertToCard?: (draft: Partial<Photocard>) => void;
  onNotifyToast: (msg: string) => void;
}

const FORMAT_DIMENSIONS: Record<PosterFormat, { w: number; h: number; label: string }> = {
  banner: { w: 1200, h: 750, label: 'Pancarta 16:10' },
  square: { w: 1080, h: 1080, label: 'Cuadrado 1:1' },
  story: { w: 1080, h: 1520, label: 'Cartel 9:13' },
};

const COLOR_SWATCHES = [
  '#0B0D14',
  '#1E1B4B',
  '#38BDF8',
  '#E879F9',
  '#FACC15',
  '#F43F5E',
  '#10B981',
  '#FEF3C7',
  '#FFFFFF',
];

const QUICK_EMOJIS = [
  '💖',
  '✨',
  '🎤',
  '🌟',
  '🫶',
  '🔥',
  '🎶',
  '👑',
  '🎉',
  '🎃',
  '🎄',
  '💘',
  '🎂',
  '🥂',
  '🥳',
  '🎊',
  '⚡',
  '🦋',
];

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const BannerCanvasModal: React.FC<BannerCanvasModalProps> = ({
  currentUser,
  stickers,
  onClose,
  onSaveBanner,
  onConvertToCard,
  onNotifyToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const dragStateRef = useRef<{
    layerId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [activeTool, setActiveTool] = useState<'colors' | 'text' | 'stickers'>('text');
  const [format, setFormat] = useState<PosterFormat>('banner');
  const [bgPattern, setBgPattern] = useState<BgPattern>('spotlight');
  const [borderPreset, setBorderPreset] = useState<BorderPreset>('neon');
  const [primaryColor, setPrimaryColor] = useState('#1E1B4B');
  const [secondaryColor, setSecondaryColor] = useState('#E879F9');
  const [bgPhotoUrl, setBgPhotoUrl] = useState<string | null>(null);

  const [layers, setLayers] = useState<CanvasLayer[]>([
    {
      id: 'txt-main',
      kind: 'text',
      text: '¡GRACIAS POR ESTA NOCHE!',
      x: 0.5,
      y: 0.42,
      size: 74,
      color: '#FFFFFF',
      font: 'display',
      badgeBg: false,
      rotation: -2,
    },
    {
      id: 'txt-sub',
      kind: 'text',
      text: 'PISTA VIP · PRIMERA FILA',
      x: 0.5,
      y: 0.64,
      size: 38,
      color: '#FACC15',
      font: 'mono',
      badgeBg: true,
      rotation: 0,
    },
    {
      id: 'stk-init-1',
      kind: 'sticker',
      content: '💖',
      isImage: false,
      x: 0.16,
      y: 0.25,
      scale: 1.3,
      rotation: -12,
    },
    {
      id: 'stk-init-2',
      kind: 'sticker',
      content: '✨',
      isImage: false,
      x: 0.85,
      y: 0.27,
      scale: 1.35,
      rotation: 10,
    },
  ]);
  const [selectedId, setSelectedId] = useState<string>('txt-main');
  const [newTextDraft, setNewTextDraft] = useState('');

  // Save to Concerts / Events metadata
  const [showSaveMeta, setShowSaveMeta] = useState(false);
  const [bannerTour, setBannerTour] = useState('Concierto / Evento 2025');
  const [bannerVenue, setBannerVenue] = useState('Estadio Monumental');
  const [bannerYoutubeUrl, setBannerYoutubeUrl] = useState('');
  const [bannerMusicUrl, setBannerMusicUrl] = useState('');
  const [bannerVisibility, setBannerVisibility] = useState<VisibilityMode>('public');
  const [saving, setSaving] = useState(false);

  const selectedLayer = layers.find((l) => l.id === selectedId) || null;
  const dims = FORMAT_DIMENSIONS[format];

  const getCachedImage = useCallback((src: string): Promise<HTMLImageElement | null> => {
    const existing = loadedImagesRef.current.get(src);
    if (existing && existing.complete) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImagesRef.current.set(src, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }, []);

  const renderPosterToCanvas = useCallback(
    async (targetCanvas: HTMLCanvasElement, showSelectionBox: boolean) => {
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      const W = dims.w;
      const H = dims.h;
      if (targetCanvas.width !== W || targetCanvas.height !== H) {
        targetCanvas.width = W;
        targetCanvas.height = H;
      }

      ctx.clearRect(0, 0, W, H);

      // 1. Background
      if (bgPattern === 'solid') {
        ctx.fillStyle = primaryColor;
        ctx.fillRect(0, 0, W, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(1, secondaryColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Optional uploaded background photo
      if (bgPhotoUrl) {
        const bgImg = await getCachedImage(bgPhotoUrl);
        if (bgImg) {
          ctx.save();
          ctx.globalAlpha = 0.42;
          const sc = Math.max(W / bgImg.width, H / bgImg.height);
          const dw = bgImg.width * sc;
          const dh = bgImg.height * sc;
          ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
          ctx.restore();
        }
      }

      // Spotlight stage rays + confetti speckles
      if (bgPattern === 'spotlight') {
        ctx.save();
        const beam1 = ctx.createRadialGradient(W * 0.2, 0, 20, W * 0.2, 0, H * 0.95);
        beam1.addColorStop(0, 'rgba(255,255,255,0.28)');
        beam1.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = beam1;
        ctx.fillRect(0, 0, W, H);

        const beam2 = ctx.createRadialGradient(W * 0.82, H * 0.1, 15, W * 0.82, H * 0.1, H * 0.85);
        beam2.addColorStop(0, 'rgba(56,189,248,0.26)');
        beam2.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = beam2;
        ctx.fillRect(0, 0, W, H);

        // Deterministic confetti sparkles
        for (let i = 0; i < 36; i++) {
          const sx = ((i * 197 + 43) % 100) / 100 * W;
          const sy = ((i * 313 + 71) % 100) / 100 * H;
          const sr = 2.5 + (i % 4) * 1.4;
          ctx.fillStyle = i % 3 === 0 ? 'rgba(250,204,21,0.55)' : 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Border preset
      if (borderPreset !== 'none') {
        ctx.save();
        const pad = 28;
        if (borderPreset === 'neon') {
          const borderGrad = ctx.createLinearGradient(0, 0, W, H);
          borderGrad.addColorStop(0, '#38BDF8');
          borderGrad.addColorStop(0.5, '#E879F9');
          borderGrad.addColorStop(1, '#FACC15');
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 14;
          drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 34);
          ctx.stroke();
        } else if (borderPreset === 'gold') {
          const goldGrad = ctx.createLinearGradient(0, 0, W, H);
          goldGrad.addColorStop(0, '#F6DB85');
          goldGrad.addColorStop(0.5, '#FFF5CC');
          goldGrad.addColorStop(1, '#C8922A');
          ctx.strokeStyle = goldGrad;
          ctx.lineWidth = 16;
          drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 28);
          ctx.stroke();
        } else if (borderPreset === 'dashed') {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 8;
          ctx.setLineDash([22, 14]);
          drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 30);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Draw layers in order
      for (const layer of layers) {
        const px = layer.x * W;
        const py = layer.y * H;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        let boxW = 120;
        let boxH = 80;

        if (layer.kind === 'text') {
          const fontFamily =
            layer.font === 'mono'
              ? '"JetBrains Mono", monospace'
              : layer.font === 'hand'
              ? 'Georgia, "Times New Roman", serif'
              : '"Outfit", "Plus Jakarta Sans", sans-serif';
          const fontStyle = layer.font === 'hand' ? 'italic 700' : '800';
          ctx.font = `${fontStyle} ${layer.size}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const lines = layer.text.split('\n');
          const lineHeight = layer.size * 1.16;
          const maxLineWidth = Math.max(
            60,
            ...lines.map((line) => ctx.measureText(line || ' ').width)
          );
          boxW = maxLineWidth + 44;
          boxH = lines.length * lineHeight + 24;

          if (layer.badgeBg) {
            ctx.fillStyle = 'rgba(11, 13, 20, 0.72)';
            drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 20);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 3;
            ctx.stroke();
          } else {
            ctx.shadowColor = 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetY = 4;
          }

          ctx.fillStyle = layer.color;
          const startY = -((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, idx) => {
            ctx.fillText(line, 0, startY + idx * lineHeight);
          });
        } else {
          const sSize = Math.round(92 * layer.scale);
          if (layer.isImage) {
            const img = await getCachedImage(layer.content);
            boxW = sSize;
            boxH = sSize;
            if (img) {
              ctx.drawImage(img, -sSize / 2, -sSize / 2, sSize, sSize);
            }
          } else if (layer.content.length <= 3) {
            ctx.font = `${sSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            boxW = sSize * 1.1;
            boxH = sSize * 1.1;
            ctx.fillText(layer.content, 0, 0);
          } else {
            const pillFontSize = Math.round(28 * layer.scale);
            ctx.font = `800 ${pillFontSize}px "Outfit", sans-serif`;
            const tw = ctx.measureText(layer.content).width;
            boxW = tw + 40;
            boxH = pillFontSize + 28;
            ctx.fillStyle = layer.bgColor || '#38BDF8';
            drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 16);
            ctx.fill();
            ctx.fillStyle = layer.textColor || '#0B0D14';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(layer.content, 0, 1);
          }
        }

        if (showSelectionBox && layer.id === selectedId) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 8]);
          drawRoundedRect(ctx, -boxW / 2 - 10, -boxH / 2 - 10, boxW + 20, boxH + 20, 14);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 4. Subtle Kromacard corner signature on exports
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`KROMACARD · ${currentUser.handle}`, W - 44, H - 38);
      ctx.restore();
    },
    [
      bgPattern,
      bgPhotoUrl,
      borderPreset,
      currentUser.handle,
      dims.h,
      dims.w,
      getCachedImage,
      layers,
      primaryColor,
      secondaryColor,
      selectedId,
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void renderPosterToCanvas(canvas, true);
  }, [renderPosterToCanvas]);

  const getCanvasPointNormalized = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { nx: 0.5, ny: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      nx: Math.max(0.04, Math.min(0.96, (clientX - rect.left) / rect.width)),
      ny: Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height)),
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { nx, ny } = getCanvasPointNormalized(e.clientX, e.clientY);
    // Hit test from topmost layer down
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const hitW = layer.kind === 'text' ? 0.24 : 0.1 * layer.scale;
      const hitH = layer.kind === 'text' ? 0.12 : 0.12 * layer.scale;
      if (Math.abs(nx - layer.x) <= hitW && Math.abs(ny - layer.y) <= hitH) {
        setSelectedId(layer.id);
        setActiveTool(layer.kind === 'text' ? 'text' : 'stickers');
        dragStateRef.current = {
          layerId: layer.id,
          offsetX: nx - layer.x,
          offsetY: ny - layer.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const { nx, ny } = getCanvasPointNormalized(e.clientX, e.clientY);
    setLayers((prev) =>
      prev.map((l) =>
        l.id === drag.layerId
          ? {
              ...l,
              x: Math.max(0.06, Math.min(0.94, nx - drag.offsetX)),
              y: Math.max(0.08, Math.min(0.92, ny - drag.offsetY)),
            }
          : l
      )
    );
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const updateSelectedLayer = (patch: Partial<TextLayer> | Partial<StickerLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedId ? ({ ...l, ...patch } as CanvasLayer) : l))
    );
  };

  const addTextLayer = () => {
    const text = newTextDraft.trim() || '¡TE QUIERO ÍDOLO!';
    const id = `txt-${Date.now()}`;
    const newLayer: TextLayer = {
      id,
      kind: 'text',
      text,
      x: 0.5,
      y: 0.5,
      size: 62,
      color: '#FFFFFF',
      font: 'display',
      badgeBg: false,
      rotation: 0,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setNewTextDraft('');
    setActiveTool('text');
  };

  const addStickerLayer = (
    content: string,
    isImage = false,
    bgColor?: string,
    textColor?: string
  ) => {
    const id = `stk-${Date.now()}-${Math.floor(Math.random() * 99)}`;
    const newLayer: StickerLayer = {
      id,
      kind: 'sticker',
      content,
      isImage,
      bgColor,
      textColor,
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
      scale: 1.25,
      rotation: Math.round((Math.random() - 0.5) * 20),
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(id);
    setActiveTool('stickers');
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    setLayers((prev) => {
      const remaining = prev.filter((l) => l.id !== selectedLayer.id);
      if (remaining.length > 0) {
        setSelectedId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  };

  const exportCleanPngDataUrl = async (): Promise<string> => {
    const offscreen = document.createElement('canvas');
    offscreen.width = dims.w;
    offscreen.height = dims.h;
    await renderPosterToCanvas(offscreen, false);
    return offscreen.toDataURL('image/png');
  };

  const handleDownloadPng = async () => {
    const dataUrl = await exportCleanPngDataUrl();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cartel-kromacard-${Date.now()}.png`;
    a.click();
    onNotifyToast('Cartel digital exportado en PNG listo para imprimir o compartir.');
  };

  const handleShareImage = async () => {
    const dataUrl = await exportCleanPngDataUrl();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'cartel-concierto-kromacard.png', { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({
            title: 'Mi cartel de concierto — Kromacard',
            text: 'Diseñé este cartel digital para el concierto en Kromacard.',
            files: [file],
          });
          onNotifyToast('Cartel compartido correctamente.');
          return;
        }
      } catch {
        // Fallback to download
      }
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cartel-kromacard-${Date.now()}.png`;
    a.click();
    onNotifyToast('Imagen PNG descargada para compartir en tus redes.');
  };

  const handleSaveToConcerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataUrl = await exportCleanPngDataUrl();
      const firstText = layers.find((l): l is TextLayer => l.kind === 'text')?.text || 'Mi Cartel Digital';
      await onSaveBanner({
        title: firstText.replace(/\n/g, ' ').slice(0, 60),
        artistOrTour: bannerTour.trim() || 'Concierto / Evento',
        venue: bannerVenue.trim() || 'Estadio / Evento',
        date: new Date().toLocaleDateString('es-ES'),
        photoUrl: dataUrl,
        story: 'Cartel digital diseñado en el lienzo interactivo de Kromacard.',
        idolReaction: '¡Listo para iluminar el escenario o la fiesta!',
        songTitle: 'Canción Favorita del Evento',
        audioPresetId: 'acoustic-stadium',
        youtubeUrl: bannerYoutubeUrl.trim() || undefined,
        musicLinkUrl: bannerMusicUrl.trim() || undefined,
        visibility: bannerVisibility,
        ownerId: currentUser.id,
        ownerName: currentUser.displayName,
      });
      onNotifyToast('Cartel guardado en tu galería de Conciertos y Eventos.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToPhotocard = async () => {
    if (!onConvertToCard) return;
    setSaving(true);
    try {
      const dataUrl = await exportCleanPngDataUrl();
      const firstText = layers.find((l): l is TextLayer => l.kind === 'text')?.text || 'Mi Cartel Digital';
      const cleanTitle = firstText.replace(/\n/g, ' ').slice(0, 48);
      onConvertToCard({
        title: cleanTitle,
        subtitle: bannerTour.trim() || 'Cartel Conmemorativo 3D',
        ratingOrBadge: '99',
        categoryLabel: 'CARTEL',
        countryFlag: '🎤',
        location: bannerVenue.trim() || 'Estadio / Evento',
        eventDate: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        editionLabel: 'Cartel Edición 3D',
        photoUrl: dataUrl,
        frameStyle: 'holo',
        primaryColor,
        secondaryColor,
        texture: 'holo-prism-shards',
        shineIntensity: 85,
        authorMessage: 'Cartel creado en Kromacard y convertido en Photocard 3D coleccionable.',
        youtubeUrl: bannerYoutubeUrl.trim() || undefined,
        musicLinkUrl: bannerMusicUrl.trim() || undefined,
        musicPlatformLabel: bannerMusicUrl.trim() ? detectMusicPlatform(bannerMusicUrl) : undefined,
        visibility: bannerVisibility,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl bg-[#131622] border border-white/15 overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-fuchsia-400" />
              <span>Editor de Carteles · Concierto, Evento o Photocard 3D</span>
            </h3>
            <p className="text-xs text-slate-400">
              Diseña tu cartel con textos, colores y pegatinas, expórtalo o conviértelo en tu propia Photocard 3D completa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor de lienzo"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6">
          {/* Left: Interactive Canvas Stage */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Format Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#0B0D14] border border-white/10 rounded-xl">
                {(Object.keys(FORMAT_DIMENSIONS) as PosterFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                      format === fmt
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {FORMAT_DIMENSIONS[fmt].label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-mono-num">
                {dims.w}×{dims.h}px
              </span>
            </div>

            {/* Canvas Wrapper */}
            <div className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3 flex items-center justify-center min-h-[300px] sm:min-h-[380px]">
              <canvas
                ref={canvasRef}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                className="max-w-full max-h-[440px] w-auto h-auto rounded-xl shadow-2xl cursor-grab active:cursor-grabbing touch-none"
              />
            </div>

            {/* Export / Share / Save / Convert to 3D Photocard Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPng()}
                className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Exportar PNG</span>
              </button>

              <button
                type="button"
                onClick={() => void handleShareImage()}
                className="min-h-[42px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2"
              >
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>Compartir</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSaveMeta((v) => !v)}
                className="min-h-[42px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cartel</span>
              </button>

              {onConvertToCard && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConvertToPhotocard()}
                  className="min-h-[42px] flex-1 px-4 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Convertir en Photocard 3D</span>
                </button>
              )}
            </div>

            {showSaveMeta && (
              <form
                onSubmit={(e) => void handleSaveToConcerts(e)}
                className="p-4 rounded-2xl bg-[#0B0D14] border border-amber-400/30 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                <input
                  type="text"
                  placeholder="Concierto, Evento o Fiesta"
                  value={bannerTour}
                  onChange={(e) => setBannerTour(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Estadio, Salón o Lugar"
                  value={bannerVenue}
                  onChange={(e) => setBannerVenue(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                />
                <input
                  type="url"
                  placeholder="Link YouTube del momento (opcional)"
                  value={bannerYoutubeUrl}
                  onChange={(e) => setBannerYoutubeUrl(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                />
                <input
                  type="url"
                  placeholder="Link Spotify / música (opcional)"
                  value={bannerMusicUrl}
                  onChange={(e) => setBannerMusicUrl(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                />
                <div className="sm:col-span-2 flex gap-2">
                  <select
                    value={bannerVisibility}
                    onChange={(e) => setBannerVisibility(e.target.value as VisibilityMode)}
                    className="min-h-[38px] flex-1 px-2.5 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                  >
                    <option value="public">Público</option>
                    <option value="friends">Solo Amigos</option>
                    <option value="private">Privado</option>
                  </select>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[38px] px-5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                  >
                    {saving ? '...' : 'Publicar Cartel'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Tool Controls */}
          <div className="lg:col-span-5 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
            {/* Tool Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#131622] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTool('text')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  activeTool === 'text' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Texto</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('colors')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  activeTool === 'colors' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Colores</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('stickers')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  activeTool === 'stickers' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                <Sticker className="w-4 h-4" />
                <span>Pegatinas</span>
              </button>
            </div>

            {/* TOOL: COLORS & BACKGROUND */}
            {activeTool === 'colors' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Estilo de Fondo
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'spotlight', label: 'Estadio' },
                        { id: 'gradient', label: 'Degradado' },
                        { id: 'solid', label: 'Sólido' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBgPattern(opt.id)}
                        className={`min-h-[38px] rounded-xl border text-xs font-semibold ${
                          bgPattern === opt.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-[#131622] border-white/10 text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300">Color Principal</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      aria-label="Selector color principal"
                      className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_SWATCHES.map((hex) => (
                      <button
                        key={`p-${hex}`}
                        type="button"
                        onClick={() => setPrimaryColor(hex)}
                        style={{ backgroundColor: hex }}
                        aria-label={`Color principal ${hex}`}
                        className={`w-7 h-7 rounded-lg border-2 ${
                          primaryColor === hex ? 'border-white scale-110' : 'border-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {bgPattern !== 'solid' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-300">Color Secundario</span>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        aria-label="Selector color secundario"
                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((hex) => (
                        <button
                          key={`s-${hex}`}
                          type="button"
                          onClick={() => setSecondaryColor(hex)}
                          style={{ backgroundColor: hex }}
                          aria-label={`Color secundario ${hex}`}
                          className={`w-7 h-7 rounded-lg border-2 ${
                            secondaryColor === hex ? 'border-white scale-110' : 'border-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                    Marco del Cartel
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'neon', label: 'Holo' },
                        { id: 'gold', label: 'Oro' },
                        { id: 'dashed', label: 'Punteado' },
                        { id: 'none', label: 'Limpio' },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBorderPreset(b.id)}
                        className={`min-h-[36px] rounded-xl border text-[11px] font-semibold ${
                          borderPreset === b.id
                            ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200'
                            : 'bg-[#131622] border-white/10 text-slate-300'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <ImageSourceSection
                    title="Foto de fondo para el cartel (Opcional)"
                    subtitle="Archivo local o Google Drive"
                    compact
                    onSelectImage={(dataUrl) => {
                      setBgPhotoUrl(dataUrl);
                      onNotifyToast('Foto de fondo aplicada al lienzo del cartel.');
                    }}
                    onNotifyToast={onNotifyToast}
                  />
                  {bgPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setBgPhotoUrl(null)}
                      className="min-h-[36px] px-3 rounded-xl bg-white/5 text-xs text-rose-300"
                    >
                      Quitar foto de fondo
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TOOL: TEXT LAYERS */}
            {activeTool === 'text' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe una frase para añadir..."
                    value={newTextDraft}
                    onChange={(e) => setNewTextDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTextLayer();
                      }
                    }}
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={addTextLayer}
                    className="min-h-[40px] px-3.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir</span>
                  </button>
                </div>

                {selectedLayer?.kind === 'text' ? (
                  <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-400">Texto seleccionado</span>
                      <button
                        type="button"
                        onClick={deleteSelectedLayer}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={selectedLayer.text}
                      onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                    />

                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'display', label: 'Impacto' },
                          { id: 'hand', label: 'Cartel' },
                          { id: 'mono', label: 'Ticket' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateSelectedLayer({ font: f.id })}
                          className={`min-h-[34px] rounded-lg text-[11px] font-semibold ${
                            selectedLayer.font === f.id
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-[#0B0D14] text-slate-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_SWATCHES.map((hex) => (
                        <button
                          key={`tc-${hex}`}
                          type="button"
                          onClick={() => updateSelectedLayer({ color: hex })}
                          style={{ backgroundColor: hex }}
                          aria-label={`Color texto ${hex}`}
                          className={`w-6 h-6 rounded-md border ${
                            selectedLayer.color === hex ? 'border-sky-400 scale-110' : 'border-white/20'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                        aria-label="Color texto personalizado"
                        className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] text-slate-300">
                        Tamaño ({selectedLayer.size}px)
                        <input
                          type="range"
                          min={24}
                          max={120}
                          value={selectedLayer.size}
                          onChange={(e) => updateSelectedLayer({ size: Number(e.target.value) })}
                          className="w-full accent-sky-400 mt-1"
                        />
                      </label>
                      <label className="text-[11px] text-slate-300">
                        Inclinación ({selectedLayer.rotation}°)
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          value={selectedLayer.rotation}
                          onChange={(e) =>
                            updateSelectedLayer({ rotation: Number(e.target.value) })
                          }
                          className="w-full accent-fuchsia-400 mt-1"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLayer.badgeBg}
                        onChange={(e) => updateSelectedLayer({ badgeBg: e.target.checked })}
                        className="accent-sky-400"
                      />
                      <span>Mostrar caja de fondo detrás del texto</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Toca un texto en el lienzo o añade una nueva frase para editar su fuente, color y tamaño.
                  </p>
                )}
              </div>
            )}

            {/* TOOL: STICKERS */}
            {activeTool === 'stickers' && (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-2">
                    Pegatinas rápidas de concierto
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addStickerLayer(emoji, false)}
                        className="min-h-[40px] rounded-xl bg-[#131622] hover:bg-white/10 text-xl flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {stickers.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 mb-2">
                      Pegatinas de la comunidad Kromacard
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {stickers.map((stk) => (
                        <button
                          key={stk.id}
                          type="button"
                          onClick={() =>
                            addStickerLayer(stk.content, stk.isImage, stk.bgColor, stk.textColor)
                          }
                          className="min-h-[34px] px-2.5 rounded-xl bg-[#131622] hover:bg-white/10 border border-white/10 text-xs text-white flex items-center gap-1.5"
                        >
                          {stk.isImage ? (
                            <img
                              src={stk.content}
                              alt={stk.name}
                              className="w-5 h-5 rounded object-cover"
                            />
                          ) : (
                            <span>{stk.content}</span>
                          )}
                          <span className="text-[11px] text-slate-300">{stk.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLayer?.kind === 'sticker' && (
                  <div className="p-3.5 rounded-xl bg-[#131622] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-fuchsia-300 flex items-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Pegatina seleccionada</span>
                      </span>
                      <button
                        type="button"
                        onClick={deleteSelectedLayer}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] text-slate-300">
                        Escala ({selectedLayer.scale.toFixed(1)}×)
                        <input
                          type="range"
                          min={0.5}
                          max={2.6}
                          step={0.1}
                          value={selectedLayer.scale}
                          onChange={(e) =>
                            updateSelectedLayer({ scale: Number(e.target.value) })
                          }
                          className="w-full accent-sky-400 mt-1"
                        />
                      </label>
                      <label className="text-[11px] text-slate-300">
                        Rotación ({selectedLayer.rotation}°)
                        <input
                          type="range"
                          min={-60}
                          max={60}
                          value={selectedLayer.rotation}
                          onChange={(e) =>
                            updateSelectedLayer({ rotation: Number(e.target.value) })
                          }
                          className="w-full accent-fuchsia-400 mt-1"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Layer List */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>Capas en el lienzo ({layers.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {layers.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(l.id);
                      setActiveTool(l.kind === 'text' ? 'text' : 'stickers');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium truncate max-w-[150px] border ${
                      selectedId === l.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-[#131622] border-white/10 text-slate-300'
                    }`}
                  >
                    {l.kind === 'text' ? `T: ${l.text}` : l.isImage ? 'Sticker IMG' : l.content}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
