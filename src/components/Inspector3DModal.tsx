import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Music,
  Plus,
  Printer,
  QrCode,
  RotateCw,
  Share2,
  Sliders,
  Sparkles,
  Square,
  Star,
  Sticker,
  Trash2,
  Type,
  Volume2,
  X,
  Youtube,
} from 'lucide-react';
import type {
  CustomSticker,
  CustomTexture,
  Photocard,
  PlacedSticker,
  TextureEffect,
} from '../types/kromacard';
import {
  downloadCardPNG,
  generateCardQRDataUrl,
  getCardDeepLink,
  renderCardBackDataUrl,
  renderCardFrontDataUrl,
} from '../utils/cardExporter';
import { HOLO_TEXTURE_COLLECTION } from '../utils/holoTextures';
import {
  detectMusicPlatform,
  extractYouTubeId,
  generateLinkQRDataUrl,
  normalizeExternalUrl,
} from '../utils/mediaLinks';
import { soundEngine } from '../utils/soundEngine';
import { Card3D } from './Card3D';
import { exportTextureImageAsPng } from './CustomTextureStudio';
import { DriveExportButton } from './DriveExportButton';
import { SocialShareModal } from './SocialShareModal';

interface Inspector3DModalProps {
  card: Photocard;
  stickers?: CustomSticker[];
  textures?: CustomTexture[];
  newStickerIds?: string[];
  isFavorite?: boolean;
  onToggleFavorite?: (card: Photocard) => void;
  onClose: () => void;
  onUpdateCardEffects?: (cardId: string, patch: Partial<Photocard>) => void;
  onOpenPrint: (card: Photocard) => void;
  onProposeTrade: (card: Photocard) => void;
  onNotifyToast: (msg: string) => void;
}

const ANGLE_PRESETS: { id: string; label: string; y: number; x: number }[] = [
  { id: 'front', label: 'Anverso', y: 0, x: 0 },
  { id: 'profile', label: 'Perfil 90°', y: 65, x: 4 },
  { id: 'back', label: 'Reverso', y: 180, x: 0 },
  { id: 'tilted', label: 'Inclinado', y: -24, x: 14 },
];

const TEXTURE_OPTIONS: { id: TextureEffect; label: string }[] = [
  { id: 'prism', label: 'Prisma Holo' },
  { id: 'stadium', label: 'Luz Estadio' },
  { id: 'gold-relief', label: 'Relieve Oro' },
  { id: 'carbon', label: 'Carbono' },
];

const QUICK_INSPECTOR_STICKERS = [
  '✨',
  '💖',
  '🔥',
  '🎤',
  '👑',
  '🎉',
  '🎃',
  '🎄',
  '💘',
  '🎂',
  '🥂',
  '🥳',
];

export const Inspector3DModal: React.FC<Inspector3DModalProps> = ({
  card,
  stickers = [],
  textures = [],
  newStickerIds = [],
  isFavorite = false,
  onToggleFavorite,
  onClose,
  onUpdateCardEffects,
  onOpenPrint,
  onProposeTrade,
  onNotifyToast,
}) => {
  const [rotateY, setRotateY] = useState(0);
  const [rotateX, setRotateX] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [shine, setShine] = useState(card.shineIntensity);
  const [texture, setTexture] = useState<TextureEffect>(card.texture);
  const [customTextureUrl, setCustomTextureUrl] = useState<string | undefined>(
    card.customTextureUrl
  );
  const [holoCategory, setHoloCategory] = useState<'all' | 'clasico' | 'festivo'>('all');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [downloadingSide, setDownloadingSide] = useState<'front' | 'back' | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);

  // Live Conmemorative Editor States (Stickers, Text, Messages, YouTube & Music Links)
  const [editTab, setEditTab] = useState<'stickers' | 'text' | 'media'>('stickers');
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>(card.stickers || []);
  const [customBadgeText, setCustomBadgeText] = useState('');
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [subtitleDraft, setSubtitleDraft] = useState(card.subtitle);
  const [messageDraft, setMessageDraft] = useState(card.authorMessage || '');
  const [youtubeDraft, setYoutubeDraft] = useState(card.youtubeUrl || '');
  const [musicDraft, setMusicDraft] = useState(card.musicLinkUrl || '');
  const [qrMode, setQrMode] = useState<'music' | 'youtube' | 'card'>(
    card.musicLinkUrl ? 'music' : card.youtubeUrl ? 'youtube' : 'card'
  );
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');

  const stickerSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setShine(card.shineIntensity);
    setTexture(card.texture);
    setCustomTextureUrl(card.customTextureUrl);
    setPlacedStickers(card.stickers || []);
    setTitleDraft(card.title);
    setSubtitleDraft(card.subtitle);
    setMessageDraft(card.authorMessage || '');
    setYoutubeDraft(card.youtubeUrl || '');
    setMusicDraft(card.musicLinkUrl || '');
  }, [
    card.id,
    card.shineIntensity,
    card.texture,
    card.customTextureUrl,
    card.stickers,
    card.title,
    card.subtitle,
    card.authorMessage,
    card.youtubeUrl,
    card.musicLinkUrl,
  ]);

  useEffect(() => {
    return () => {
      if (stickerSaveTimerRef.current) {
        clearTimeout(stickerSaveTimerRef.current);
      }
      soundEngine.stopSnippet();
    };
  }, []);

  useEffect(() => {
    if (!gyroEnabled) return;
    const onOrient = (ev: DeviceOrientationEvent) => {
      if (ev.gamma !== null && ev.beta !== null) {
        setRotateY(Math.max(-45, Math.min(45, ev.gamma)));
        setRotateX(Math.max(-30, Math.min(30, ev.beta - 45)));
      }
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [gyroEnabled]);

  const activeQrTarget =
    qrMode === 'music' && musicDraft.trim()
      ? normalizeExternalUrl(musicDraft)
      : qrMode === 'youtube' && youtubeDraft.trim()
        ? normalizeExternalUrl(youtubeDraft)
        : getCardDeepLink(card.id);

  useEffect(() => {
    let active = true;
    const loadQr = async () => {
      try {
        const url =
          qrMode === 'card' || !activeQrTarget
            ? await generateCardQRDataUrl(card.id)
            : await generateLinkQRDataUrl(activeQrTarget);
        if (active) setQrPreviewUrl(url);
      } catch {
        if (active) setQrPreviewUrl('');
      }
    };
    void loadQr();
    return () => {
      active = false;
    };
  }, [activeQrTarget, card.id, qrMode]);

  const previewCard: Photocard = {
    ...card,
    title: titleDraft,
    subtitle: subtitleDraft,
    authorMessage: messageDraft,
    stickers: placedStickers,
    youtubeUrl: youtubeDraft.trim() || undefined,
    musicLinkUrl: musicDraft.trim() || undefined,
    musicPlatformLabel: musicDraft.trim() ? detectMusicPlatform(musicDraft) : undefined,
    shineIntensity: shine,
    texture,
    customTextureUrl,
  };

  const persistStickers = (next: PlacedSticker[], immediate = false) => {
    setPlacedStickers(next);
    if (!onUpdateCardEffects) return;
    if (stickerSaveTimerRef.current) {
      clearTimeout(stickerSaveTimerRef.current);
    }
    if (immediate) {
      onUpdateCardEffects(card.id, { stickers: next });
    } else {
      stickerSaveTimerRef.current = window.setTimeout(() => {
        onUpdateCardEffects(card.id, { stickers: next });
      }, 320);
    }
  };

  const handleAddEmojiOrBadgeSticker = (
    content: string,
    name: string,
    isImage = false,
    bgColor?: string,
    textColor?: string
  ) => {
    const nextSticker: PlacedSticker = {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      stickerId: `insp-${Date.now()}`,
      name,
      content,
      isImage,
      x: 50 + Math.round((Math.random() - 0.5) * 34),
      y: 34 + Math.round((Math.random() - 0.5) * 28),
      scale: 1,
      rotation: Math.round((Math.random() - 0.5) * 14),
      bgColor,
      textColor,
    };
    const nextList = [...placedStickers, nextSticker];
    setAutoSpin(false);
    setRotateY(0);
    setRotateX(0);
    persistStickers(nextList, true);
    onNotifyToast(`Sticker "${name}" añadido. Puedes arrastrarlo sobre la tarjeta 3D.`);
  };

  const handleSaveTextAndMessage = () => {
    onUpdateCardEffects?.(card.id, {
      title: titleDraft.trim() || card.title,
      subtitle: subtitleDraft.trim(),
      authorMessage: messageDraft.trim(),
    });
    onNotifyToast('Texto y mensaje conmemorativo guardados en tu photocard.');
  };

  const handleSaveYoutube = () => {
    const clean = youtubeDraft.trim();
    if (clean && !extractYouTubeId(clean)) {
      onNotifyToast('Pega un enlace válido de YouTube (youtube.com, shorts o youtu.be).');
      return;
    }
    onUpdateCardEffects?.(card.id, { youtubeUrl: clean || undefined });
    if (clean) setQrMode('youtube');
    onNotifyToast(clean ? 'Video de YouTube vinculado a la tarjeta.' : 'Enlace de YouTube eliminado.');
  };

  const handleSaveMusicLink = () => {
    const clean = musicDraft.trim();
    const platform = clean ? detectMusicPlatform(clean) : undefined;
    onUpdateCardEffects?.(card.id, {
      musicLinkUrl: clean || undefined,
      musicPlatformLabel: platform,
    });
    if (clean) setQrMode('music');
    onNotifyToast(
      clean
        ? `Enlace de ${platform} guardado con código QR listo para exportar.`
        : 'Enlace musical eliminado.'
    );
  };

  const handleCopyActiveLink = async () => {
    if (!activeQrTarget) return;
    try {
      await navigator.clipboard.writeText(activeQrTarget);
      onNotifyToast('Enlace copiado al portapapeles.');
    } catch {
      onNotifyToast(`Enlace: ${activeQrTarget}`);
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrPreviewUrl) return;
    const a = document.createElement('a');
    a.href = qrPreviewUrl;
    a.download = `qr-${qrMode}-${card.serialCode.toLowerCase()}.png`;
    a.click();
    onNotifyToast('Código QR descargado en PNG.');
  };

  const handleFlip = () => {
    soundEngine.playCardFlip();
    setAutoSpin(false);
    setRotateY((prev) => (Math.abs(prev % 360) > 90 && Math.abs(prev % 360) < 270 ? 0 : 180));
  };

  const handleShare = async () => {
    const shareUrl = getCardDeepLink(card.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${titleDraft} — Kromacard`,
          text: `Mira esta photocard 3D de ${titleDraft} (${card.location})`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotifyToast('Enlace 3D y QR copiado para compartir en tus redes.');
    } catch {
      onNotifyToast(`Enlace listo: ${shareUrl}`);
    }
  };

  const handleDownload = async (side: 'front' | 'back') => {
    setDownloadingSide(side);
    try {
      await downloadCardPNG(previewCard, side);
      onNotifyToast(`Imagen 300 DPI (${side === 'front' ? 'Anverso' : 'Reverso + QR'}) descargada.`);
    } finally {
      setDownloadingSide(null);
    }
  };

  const toggleAudio = () => {
    if (!card.concert) return;
    if (isPlayingAudio) {
      soundEngine.stopSnippet();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      soundEngine.playSnippet(card.concert.audioPresetId, card.concert.customAudioUrl, () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const youtubeId = extractYouTubeId(youtubeDraft);
  const filteredHoloCollection =
    holoCategory === 'all'
      ? HOLO_TEXTURE_COLLECTION
      : HOLO_TEXTURE_COLLECTION.filter((h) => h.category === holoCategory);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0D14]/95 backdrop-blur-md overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 md:py-8 pb-24">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(previewCard)}
                aria-pressed={isFavorite}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  isFavorite
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{isFavorite ? 'Guardada Offline' : 'Favorita Offline'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setGyroEnabled((v) => !v)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                gyroEnabled
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{gyroEnabled ? 'Giroscopio Activo' : 'Giroscopio'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar visor"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title Header */}
        <div className="mt-5 mb-6">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white">
            Inspección 3D Conmemorativa
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {card.serialCode} · {titleDraft} · {card.location}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive 3D Stage */}
          <div className="lg:col-span-6 lg:sticky lg:top-6 space-y-5">
            <div className="relative overflow-hidden bg-[#131622] border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col items-center">
              {previewCard.backBackdropUrl && (
                <>
                  <img
                    src={previewCard.backBackdropUrl}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-[#0B0D14]/70 via-[#0B0D14]/45 to-[#131622]/90 pointer-events-none"
                    aria-hidden="true"
                  />
                </>
              )}
              <div className="relative z-10 w-full">
                <Card3D
                  card={previewCard}
                  rotateY={rotateY}
                  rotateX={rotateX}
                  autoSpin={autoSpin}
                  onStickerDrag={(stickerId, x, y) => {
                    const next = placedStickers.map((s) =>
                      s.id === stickerId ? { ...s, x, y } : s
                    );
                    persistStickers(next, false);
                  }}
                  onQrClick={handleShare}
                />
              </div>

              <div className="relative z-10 w-full grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleFlip}
                  className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                  <span>Voltear Tarjeta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSpin((v) => !v)}
                  className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                    autoSpin
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <RotateCw className="w-4 h-4" />
                  <span>{autoSpin ? 'Detener Giro' : 'Giro Continuo'}</span>
                </button>
              </div>
            </div>

            {/* Embedded YouTube Moment Player (when attached) */}
            {youtubeId && (
              <div className="bg-[#131622] border border-rose-400/25 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <Youtube className="w-4 h-4" />
                    <span>Momento Grabado en YouTube</span>
                  </span>
                  <a
                    href={normalizeExternalUrl(youtubeDraft)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <span>Abrir en YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                    title={`Video de ${titleDraft}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Customization (Stickers, Text, YouTube/Music QR), Lighting, Holographic Foils & Actions */}
          <div className="lg:col-span-6 space-y-5">
            {/* NEW: Conmemorative Customizer inside Inspector 3D */}
            <div className="bg-[#131622] border border-sky-400/25 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-display font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <span>Personalizar Recuerdo en Vivo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Añade stickers, edita textos o vincula tu video de YouTube y canción de Spotify.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0B0D14] rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setEditTab('stickers')}
                  className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    editTab === 'stickers' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  <Sticker className="w-3.5 h-3.5" />
                  <span>Stickers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('text')}
                  className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    editTab === 'text' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Texto y Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('media')}
                  className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    editTab === 'media' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>Video y Música</span>
                </button>
              </div>

              {/* SUB-TAB: STICKERS */}
              {editTab === 'stickers' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-6 gap-1.5">
                    {QUICK_INSPECTOR_STICKERS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddEmojiOrBadgeSticker(emoji, `Sticker ${emoji}`, false)}
                        className="min-h-[38px] rounded-xl bg-[#0B0D14] hover:bg-white/10 border border-white/10 text-lg flex items-center justify-center transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {stickers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                      {[
                        ...stickers.filter((s) => newStickerIds.includes(s.id)).reverse(),
                        ...stickers.filter((s) => !newStickerIds.includes(s.id)),
                      ].map((stk) => {
                        const isNew = newStickerIds.includes(stk.id);
                        return (
                          <button
                            key={stk.id}
                            type="button"
                            onClick={() =>
                              handleAddEmojiOrBadgeSticker(
                                stk.content,
                                stk.name,
                                stk.isImage,
                                stk.bgColor,
                                stk.textColor
                              )
                            }
                            className={`min-h-[32px] px-2.5 rounded-xl border text-[11px] flex items-center gap-1.5 transition-colors ${
                              isNew
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100 ring-1 ring-emerald-400/50'
                                : 'bg-[#0B0D14] hover:bg-white/10 border-white/10 text-slate-200'
                            }`}
                          >
                            {stk.isImage ? (
                              <img src={stk.content} alt={stk.name} className="w-4 h-4 object-contain" />
                            ) : (
                              <span>{stk.content}</span>
                            )}
                            <span>{stk.name}</span>
                            {isNew && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 text-[8px] font-extrabold">
                                NUEVO
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Etiqueta sticker (ej. PRIMERA FILA, HALLOWEEN)"
                      value={customBadgeText}
                      onChange={(e) => setCustomBadgeText(e.target.value)}
                      className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const txt = customBadgeText.trim();
                        if (!txt) return;
                        handleAddEmojiOrBadgeSticker(txt.toUpperCase(), txt.toUpperCase(), false);
                        setCustomBadgeText('');
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Poner</span>
                    </button>
                  </div>

                  {placedStickers.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/10 max-h-36 overflow-y-auto">
                      <div className="text-[11px] text-slate-400">
                        Stickers en la carta ({placedStickers.length}) · Arrástralos sobre la foto 3D
                      </div>
                      {placedStickers.map((ps) => (
                        <div
                          key={ps.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#0B0D14] border border-white/10"
                        >
                          <span className="text-xs text-white truncate">{ps.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="range"
                              min={0.6}
                              max={2}
                              step={0.1}
                              value={ps.scale}
                              onChange={(e) => {
                                const scale = Number(e.target.value);
                                const next = placedStickers.map((item) =>
                                  item.id === ps.id ? { ...item, scale } : item
                                );
                                persistStickers(next, false);
                              }}
                              aria-label={`Escala de ${ps.name}`}
                              className="w-16 accent-sky-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                persistStickers(
                                  placedStickers.filter((item) => item.id !== ps.id),
                                  true
                                )
                              }
                              aria-label={`Eliminar ${ps.name}`}
                              className="p-1 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB: TEXT & COMMEMORATIVE MESSAGE */}
              {editTab === 'text' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="space-y-1 text-[11px]">
                      <span className="text-slate-400">Título de la carta</span>
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1 text-[11px]">
                      <span className="text-slate-400">Subtítulo o frase</span>
                      <input
                        type="text"
                        value={subtitleDraft}
                        onChange={(e) => setSubtitleDraft(e.target.value)}
                        className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1 text-[11px]">
                    <span className="text-slate-400">Mensaje conmemorativo (aparece en el reverso)</span>
                    <textarea
                      rows={3}
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      placeholder="Escribe tu recuerdo, dedicatoria o crónica del momento..."
                      className="w-full p-2.5 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTextAndMessage}
                      className="min-h-[38px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Guardar Textos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoSpin(false);
                        setRotateY(180);
                        setRotateX(0);
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                    >
                      Ver en Reverso
                    </button>
                  </div>
                </div>
              )}

              {/* SUB-TAB: YOUTUBE VIDEO + MUSIC LINK + QR EXPORT */}
              {editTab === 'media' && (
                <div className="space-y-4">
                  {/* YouTube Link */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                      <Youtube className="w-3.5 h-3.5" />
                      <span>Link de YouTube del momento que grabaste</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://youtube.com/watch?v=... o youtu.be/..."
                        value={youtubeDraft}
                        onChange={(e) => setYoutubeDraft(e.target.value)}
                        className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveYoutube}
                        className="min-h-[38px] px-3.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shrink-0"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  {/* Spotify / Music Platform Link */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-emerald-300 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Link de Spotify u otra plataforma musical</span>
                      </span>
                      {musicDraft.trim() && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                          {detectMusicPlatform(musicDraft)}
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://open.spotify.com/track/..."
                        value={musicDraft}
                        onChange={(e) => setMusicDraft(e.target.value)}
                        className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleSaveMusicLink}
                        className="min-h-[38px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>

                  {/* QR Generator & Direct Link Export */}
                  <div className="p-3.5 rounded-xl bg-[#0B0D14] border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>Exportar QR o Enlace Directo</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {musicDraft.trim() && (
                          <button
                            type="button"
                            onClick={() => setQrMode('music')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                              qrMode === 'music'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-white/5 text-slate-300'
                            }`}
                          >
                            QR Música
                          </button>
                        )}
                        {youtubeDraft.trim() && (
                          <button
                            type="button"
                            onClick={() => setQrMode('youtube')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                              qrMode === 'youtube'
                                ? 'bg-rose-500 text-white'
                                : 'bg-white/5 text-slate-300'
                            }`}
                          >
                            QR Video
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQrMode('card')}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                            qrMode === 'card'
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-white/5 text-slate-300'
                          }`}
                        >
                          QR Carta 3D
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3.5">
                      {qrPreviewUrl && (
                        <div className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0">
                          <img
                            src={qrPreviewUrl}
                            alt="Código QR exportable"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-2 w-full">
                        <div className="text-[11px] text-slate-400 truncate">
                          {activeQrTarget}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadQrPng}
                            disabled={!qrPreviewUrl}
                            className="min-h-[34px] px-3 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-bold flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar QR PNG</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyActiveLink()}
                            className="min-h-[34px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-semibold flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Link</span>
                          </button>
                          {activeQrTarget && (
                            <a
                              href={activeQrTarget}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[34px] px-3 rounded-lg bg-white/5 hover:bg-white/10 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Abrir</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Angle Presets & Manual Slider */}
            <div className="bg-[#131622] border border-white/10 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-400 mb-3">Ángulos de vista</div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {ANGLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setAutoSpin(false);
                      setRotateY(preset.y);
                      setRotateX(preset.x);
                    }}
                    className={`min-h-[40px] px-2 rounded-xl text-xs font-semibold transition-colors ${
                      rotateY === preset.y && !autoSpin
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  Control manual de grados
                </span>
                <span className="font-mono-num text-sky-400 font-semibold">{Math.round(rotateY)}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                value={rotateY}
                onChange={(e) => {
                  setAutoSpin(false);
                  setRotateY(Number(e.target.value));
                }}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            {/* Real-time Texture & Brillo + 10 HD Holographic Foils (including Festive) */}
            <div className="bg-[#131622] border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span>Intensidad de brillo holográfico</span>
                  <span className="font-mono-num text-amber-400 font-semibold">{shine}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={shine}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setShine(val);
                    onUpdateCardEffects?.(card.id, { shineIntensity: val });
                  }}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2.5">
                    Acabados y texturas en tiempo real
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEXTURE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCustomTextureUrl(undefined);
                          setTexture(opt.id);
                          onUpdateCardEffects?.(card.id, {
                            texture: opt.id,
                            customTextureUrl: undefined,
                          });
                        }}
                        className={`min-h-[44px] px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                          !customTextureUrl && texture === opt.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {textures.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-sky-300 mb-2">
                      Texturas Personalizadas (Comunidad y Propias)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {textures.map((tex) => {
                        const active = customTextureUrl === tex.imageUrl;
                        return (
                          <div
                            key={tex.id}
                            className={`rounded-xl overflow-hidden border bg-[#0B0D14] ${
                              active ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-white/10'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setCustomTextureUrl(tex.imageUrl);
                                onUpdateCardEffects?.(card.id, {
                                  customTextureUrl: tex.imageUrl,
                                });
                              }}
                              className="w-full text-left"
                            >
                              <img
                                src={tex.imageUrl}
                                alt={tex.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-11 object-cover"
                              />
                              <div className="px-1.5 pt-1 text-[9px] font-semibold text-white truncate">
                                {tex.name}
                              </div>
                            </button>
                            <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void exportTextureImageAsPng(tex.imageUrl, tex.name);
                                  onNotifyToast(`Textura "${tex.name}" descargada en PNG.`);
                                }}
                                className="py-1 rounded bg-white/5 hover:bg-white/10 text-[9px] font-semibold text-sky-300 flex items-center justify-center gap-0.5"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>PNG</span>
                              </button>
                              <DriveExportButton
                                compact
                                source={tex.imageUrl}
                                fileNameBase={`textura-${tex.name}`}
                                description={`Textura "${tex.name}" de Kromacard`}
                                label="Drive"
                                onNotifyToast={onNotifyToast}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-fuchsia-300">
                      Láminas Holográficas HD (Estadio y Fiestas)
                    </span>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: 'all', label: `Todas (${HOLO_TEXTURE_COLLECTION.length})` },
                          { id: 'clasico', label: 'Clásicas' },
                          { id: 'festivo', label: 'Fiestas y Fechas' },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setHoloCategory(cat.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                            holoCategory === cat.id
                              ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {filteredHoloCollection.map((holo) => {
                      const active = !customTextureUrl && texture === holo.id;
                      return (
                        <button
                          key={holo.id}
                          type="button"
                          title={`${holo.label} — ${holo.subtitle}`}
                          onClick={() => {
                            setCustomTextureUrl(undefined);
                            setTexture(holo.id);
                            onUpdateCardEffects?.(card.id, {
                              texture: holo.id,
                              customTextureUrl: undefined,
                            });
                          }}
                          className={`rounded-xl overflow-hidden border transition-all ${
                            active
                              ? 'border-sky-400 ring-2 ring-sky-400/40'
                              : 'border-white/10 opacity-85 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={holo.imageUrl}
                            alt={holo.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-11 object-cover"
                          />
                          <div className="px-1 py-1 text-[9px] font-semibold text-white truncate bg-[#0B0D14]">
                            {holo.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Audio & Ticket Info */}
            {card.concert?.enabled && (
              <div className="bg-[#131622] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-sky-400">
                      Setlist y Boleto · {card.concert.tourName}
                    </div>
                    <div className="text-sm font-bold text-white truncate mt-0.5">
                      {card.concert.favoriteSong}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {card.concert.zone} · {card.concert.seatOrRow} · {card.concert.ticketCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAudio}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors ${
                      isPlayingAudio
                        ? 'bg-rose-500 text-white'
                        : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                    }`}
                  >
                    {isPlayingAudio ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-4 h-4" />}
                    <span>{isPlayingAudio ? 'Detener' : 'Escuchar'}</span>
                  </button>
                </div>

                {/* Live Waveform Indicator */}
                <div className="mt-3 flex items-end gap-1 h-6">
                  {[16, 24, 14, 22, 18, 24, 12, 20, 15, 24, 18, 12, 22, 16, 20, 14].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-200 ${
                        isPlayingAudio ? 'bg-sky-400 animate-pulse' : 'bg-white/15'
                      }`}
                      style={{
                        height: isPlayingAudio ? `${h}px` : `${Math.max(4, h * 0.45)}px`,
                        animationDelay: `${i * 75}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Technical Collection Sheet */}
            <div className="bg-[#131622] border border-white/10 rounded-2xl p-5">
              <div className="text-xs font-semibold text-slate-400 mb-3">Ficha técnica de colección</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Material sugerido</div>
                  <div className="font-semibold text-slate-100">PVC / Papel 350g</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Tamaño real</div>
                  <div className="font-semibold text-slate-100 font-mono-num">54 × 85 mm</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Ingresada en</div>
                  <div className="font-semibold text-slate-100 truncate">{card.location}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Edición</div>
                  <div className="font-semibold text-slate-100">{card.editionLabel}</div>
                </div>
              </div>
            </div>

            {/* Print, Export, Share & Trade Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDownload('front')}
                disabled={downloadingSide !== null}
                className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>{downloadingSide === 'front' ? 'Generando...' : 'Descargar Anverso PNG'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('back')}
                disabled={downloadingSide !== null}
                className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Music className="w-4 h-4 text-amber-400" />
                <span>{downloadingSide === 'back' ? 'Generando...' : 'Descargar Reverso + QR'}</span>
              </button>
              <DriveExportButton
                source={() =>
                  Math.abs(rotateY % 360) > 90 && Math.abs(rotateY % 360) < 270
                    ? renderCardBackDataUrl(previewCard)
                    : renderCardFrontDataUrl(previewCard)
                }
                fileNameBase={`${card.serialCode}-${Math.abs(rotateY % 360) > 90 && Math.abs(rotateY % 360) < 270 ? 'reverso' : 'anverso'}`}
                description={`Photocard "${titleDraft}" (${card.serialCode}) exportada desde Kromacard 3D`}
                label="Guardar Card en Drive"
                className="min-h-[46px] px-4 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-sm font-bold flex items-center justify-center gap-2 transition-colors sm:col-span-2"
                onNotifyToast={onNotifyToast}
              />
              <button
                type="button"
                onClick={() => onOpenPrint(previewCard)}
                className="min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity sm:col-span-2"
              >
                <Printer className="w-4 h-4" />
                <span>Listo para Imprimir · Exportar Pliego A4</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSocialShare(true)}
                className="min-h-[44px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir en Redes</span>
              </button>
              <button
                type="button"
                onClick={() => onProposeTrade(previewCard)}
                className="min-h-[44px] px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Intercambiar / Regalar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSocialShare && (
        <SocialShareModal
          card={previewCard}
          onClose={() => setShowSocialShare(false)}
          onNotifyToast={onNotifyToast}
        />
      )}
    </div>
  );
};
