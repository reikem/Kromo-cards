import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Palette,
  Plus,
  Sparkles,
  Sticker,
  Type,
} from 'lucide-react';
import type { CollectorUser, CommunityCategory, CustomSticker } from '../types/kromacard';
import { COMMUNITY_CATEGORIES } from '../utils/frameShapes';
import { ImageSourceSection } from './ImageSourceSection';

interface StickerCreatorViewProps {
  currentUser: CollectorUser;
  stickers: CustomSticker[];
  newStickerIds: string[];
  returnCardTitle?: string;
  onBackToStudio: () => void;
  onCreateSticker: (sticker: Partial<CustomSticker>) => Promise<CustomSticker>;
  onCreateAndAttachToCard?: (sticker: Partial<CustomSticker>) => Promise<CustomSticker>;
  onNotifyToast: (msg: string) => void;
}

const QUICK_EMOJIS = [
  '✨',
  '👑',
  '💖',
  '🔥',
  '🎤',
  '🎫',
  '🌟',
  '🦋',
  '🎀',
  '⚡',
  '💿',
  '🪩',
];

const BADGE_COLOR_PRESETS = [
  { label: 'Oro VIP', bg: '#F59E0B', text: '#0B0D14' },
  { label: 'Cian Neón', bg: '#38BDF8', text: '#0B0D14' },
  { label: 'Fucsia Tour', bg: '#E879F9', text: '#0B0D14' },
  { label: 'Esmeralda', bg: '#10B981', text: '#0B0D14' },
  { label: 'Carmesí', bg: '#F43F5E', text: '#FFFFFF' },
  { label: 'Obsidiana', bg: '#1E293B', text: '#F8FAFC' },
];

export const StickerCreatorView: React.FC<StickerCreatorViewProps> = ({
  currentUser,
  stickers,
  newStickerIds,
  returnCardTitle,
  onBackToStudio,
  onCreateSticker,
  onCreateAndAttachToCard,
  onNotifyToast,
}) => {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [stickerName, setStickerName] = useState('');
  const [stickerText, setStickerText] = useState('VIP 2025');
  const [bgColor, setBgColor] = useState('#F59E0B');
  const [textColor, setTextColor] = useState('#0B0D14');
  const [stickerImage, setStickerImage] = useState('');
  const [stickerCategory, setStickerCategory] = useState<CommunityCategory>('musica');
  const [sharePublic, setSharePublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const newIdsSet = useMemo(() => new Set(newStickerIds), [newStickerIds]);

  const orderedStickers = useMemo(() => {
    const newOnes = stickers.filter((s) => newIdsSet.has(s.id)).reverse();
    const rest = stickers.filter((s) => !newIdsSet.has(s.id));
    return [...newOnes, ...rest];
  }, [stickers, newIdsSet]);

  const buildPayload = (): Partial<CustomSticker> | null => {
    if (mode === 'image') {
      if (!stickerImage) {
        onNotifyToast('Primero sube una imagen PNG o cárgala desde Google Drive.');
        return null;
      }
      return {
        name: stickerName.trim() || 'Sticker PNG Propio',
        content: stickerImage,
        isImage: true,
        category: stickerCategory,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        isPublic: sharePublic,
      };
    }

    const content = stickerText.trim() || '✨';
    return {
      name: stickerName.trim() || content,
      content,
      isImage: false,
      category: stickerCategory,
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      isPublic: sharePublic,
      bgColor,
      textColor,
    };
  };

  const resetForm = () => {
    setStickerName('');
    setStickerImage('');
  };

  const handleSaveOnly = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      const created = await onCreateSticker(payload);
      resetForm();
      onNotifyToast(
        `Sticker "${created.name}" creado y agregado a los stickers de Photocards.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndAttach = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      if (onCreateAndAttachToCard) {
        const created = await onCreateAndAttachToCard(payload);
        resetForm();
        onNotifyToast(
          `Sticker "${created.name}" creado, marcado como nuevo y añadido a tu Photocard.`
        );
      } else {
        const created = await onCreateSticker(payload);
        resetForm();
        onNotifyToast(
          `Sticker "${created.name}" agregado a los stickers de Photocards.`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isEmojiOnly = mode === 'text' && stickerText.trim().length <= 2;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="rounded-3xl bg-[#131622] border border-white/10 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Sticker className="w-4 h-4" />
            <span>Estudio Independiente de Stickers</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Crea tu Sticker para Photocards
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Diseña insignias de texto, combinaciones de emojis o sube imágenes PNG / Google Drive. Al crearlo, se añade automáticamente a la biblioteca de stickers de tus photocards y se resalta en color verde como <strong className="text-emerald-300">NUEVO</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToStudio}
          className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold flex items-center gap-2 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-sky-400" />
          <span>
            {returnCardTitle
              ? `Volver a "${returnCardTitle}"`
              : 'Ir al Estudio 3D de Cartas'}
          </span>
        </button>
      </div>

      {returnCardTitle && (
        <div className="rounded-2xl bg-sky-500/10 border border-sky-400/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200">
          <span>
            Borrador de Photocard guardado: <strong className="text-white">{returnCardTitle}</strong>. Al pulsar crear, el sticker se agregará directo a tu carta y a tu galería de stickers.
          </span>
        </div>
      )}

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Sticker Preview Card */}
        <div className="lg:col-span-5 bg-[#131622] border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Vista Previa sobre Photocard</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-extrabold">
              NUEVO
            </span>
          </div>

          <div className="w-56 aspect-[54/76] rounded-2xl p-2 bg-gradient-to-br from-sky-400 via-fuchsia-400 to-amber-300 shadow-2xl">
            <div className="relative w-full h-full rounded-xl bg-[#0E1220] overflow-hidden flex flex-col items-center justify-center p-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(56,189,248,0.22),transparent_60%),radial-gradient(circle_at_75%_80%,rgba(232,121,249,0.2),transparent_55%)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                {mode === 'image' ? (
                  stickerImage ? (
                    <img
                      src={stickerImage}
                      alt={stickerName || 'Vista previa sticker'}
                      className="w-28 h-28 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.65)]"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center text-[11px] text-slate-400 text-center px-2">
                      Sube una imagen PNG o desde Drive
                    </div>
                  )
                ) : isEmojiOnly ? (
                  <span className="text-6xl drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]">
                    {stickerText.trim() || '✨'}
                  </span>
                ) : (
                  <span
                    className="px-4 py-1.5 rounded-xl font-display text-lg font-extrabold tracking-wide shadow-[0_8px_22px_rgba(0,0,0,0.5)] text-center max-w-[185px] break-words"
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    {stickerText.trim() || 'VIP 2025'}
                  </span>
                )}
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <div className="text-xs font-bold text-white truncate">
                  {stickerName.trim() ||
                    (mode === 'image' ? 'Sticker PNG' : stickerText.trim() || 'Sticker')}
                </div>
                <div className="text-[10px] text-slate-400">
                  Listo para arrastrar en 3D
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sticker Creator Form */}
        <div className="lg:col-span-7 bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-white">
              Configura tu Sticker
            </h2>
            <div className="flex items-center gap-1 p-1 bg-[#0B0D14] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  mode === 'text'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Texto / Emoji</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('image')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  mode === 'image'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Imagen PNG / Drive</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs">
              <span className="text-slate-300 font-semibold">Nombre del sticker</span>
              <input
                type="text"
                placeholder="Ej. Sello Gira Mundial, Corona Dorada"
                value={stickerName}
                onChange={(e) => setStickerName(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-1.5 text-xs">
              <span className="text-slate-300 font-semibold">Categoría en Biblioteca</span>
              <select
                value={stickerCategory}
                onChange={(e) => setStickerCategory(e.target.value as CommunityCategory)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              >
                {COMMUNITY_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === 'text' ? (
            <div className="space-y-4">
              <label className="block space-y-1.5 text-xs">
                <span className="text-slate-300 font-semibold">
                  Texto corto o Emoji del sticker
                </span>
                <input
                  type="text"
                  maxLength={24}
                  placeholder="Ej. VIP 2025, ENCORE, ★"
                  value={stickerText}
                  onChange={(e) => setStickerText(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400">
                  Emojis rápidos
                </span>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setStickerText(em)}
                      className={`min-h-[38px] rounded-xl border text-lg flex items-center justify-center transition-colors ${
                        stickerText === em
                          ? 'bg-sky-500/20 border-sky-400'
                          : 'bg-[#0B0D14] border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {!isEmojiOnly && (
                <div className="space-y-3 pt-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span>Colores de la etiqueta</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setBgColor(preset.bg);
                          setTextColor(preset.text);
                        }}
                        className="min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold border border-white/15"
                        style={{ backgroundColor: preset.bg, color: preset.text }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0D14] border border-white/10">
                      <span className="text-slate-300">Fondo</span>
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#0B0D14] border border-white/10">
                      <span className="text-slate-300">Texto</span>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ImageSourceSection
              title="Sube una imagen PNG o cárgala desde Google Drive"
              subtitle="PNG con fondo transparente o foto limpia para tu sticker"
              compact
              onSelectImage={(dataUrl, fileName) => {
                setStickerImage(dataUrl);
                if (!stickerName.trim() && fileName) {
                  setStickerName(fileName.replace(/\.[^.]+$/, ''));
                }
              }}
              onNotifyToast={onNotifyToast}
            />
          )}

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={sharePublic}
              onChange={(e) => setSharePublic(e.target.checked)}
              className="w-4 h-4 accent-emerald-400"
            />
            <span>Compartir también con la comunidad de coleccionistas</span>
          </label>

          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-white/10">
            {onCreateAndAttachToCard ? (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSaveAndAttach()}
                  className="min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 hover:opacity-95 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Creando...'
                      : 'Crear y Agregar a mi Photocard'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSaveOnly()}
                  className="min-h-[46px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Solo Guardar en Stickers</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSaveOnly()}
                className="min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 hover:opacity-95 disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Creando...'
                    : 'Crear y Agregar a Stickers de Photocards'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Photocard Stickers Gallery with Distinct Highlight for New Stickers */}
      <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              Stickers Disponibles en tus Photocards ({orderedStickers.length})
            </h3>
            <p className="text-xs text-slate-400">
              Los stickers que acabas de crear aparecen resaltados en color verde esmeralda y listos para arrastrar en el Estudio 3D.
            </p>
          </div>
          {newStickerIds.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold">
              {newStickerIds.length}{' '}
              {newStickerIds.length === 1 ? 'sticker nuevo' : 'stickers nuevos'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {orderedStickers.map((stk) => {
            const isNew = newIdsSet.has(stk.id);
            return (
              <div
                key={stk.id}
                className={`relative p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                  isNew
                    ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                    : 'bg-[#0B0D14] border-white/10'
                }`}
              >
                {isNew && (
                  <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-extrabold tracking-wide shadow">
                    NUEVO
                  </span>
                )}
                {stk.isImage ? (
                  <img
                    src={stk.content}
                    alt={stk.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-contain"
                  />
                ) : stk.content.length <= 2 ? (
                  <span className="text-2xl leading-none">{stk.content}</span>
                ) : (
                  <span
                    className="px-2.5 py-0.5 rounded-md text-[11px] font-display font-bold max-w-full truncate"
                    style={{
                      backgroundColor: stk.bgColor || '#F59E0B',
                      color: stk.textColor || '#0B0D14',
                    }}
                  >
                    {stk.content}
                  </span>
                )}
                <div className="w-full">
                  <div
                    className={`text-xs font-bold truncate ${
                      isNew ? 'text-emerald-200' : 'text-white'
                    }`}
                  >
                    {stk.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Por {stk.authorName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
