import React, { useState } from 'react';
import { Check, PartyPopper, Plus, Save, Shapes, Sparkles } from 'lucide-react';
import type {
  CelebrationTheme,
  CollectorUser,
  CommunityCategory,
  CustomFramePreset,
  FrameShape,
} from '../types/kromacard';
import {
  CELEBRATION_THEMES,
  COMMUNITY_CATEGORIES,
  FRAME_SHAPE_SPECS,
  getFrameShapeClipPath,
} from '../utils/frameShapes';

interface CustomFrameStudioProps {
  currentUser: CollectorUser;
  frames: CustomFramePreset[];
  activeShape: FrameShape;
  activeCelebration: CelebrationTheme;
  activePrimaryColor: string;
  activeSecondaryColor: string;
  activeCustomFrameId?: string;
  onSelectShape: (shape: FrameShape) => void;
  onApplyFramePreset: (preset: CustomFramePreset) => void;
  onCreateFrame: (frame: Partial<CustomFramePreset>) => Promise<CustomFramePreset>;
  onNotifyToast: (msg: string) => void;
}

export const CustomFrameStudio: React.FC<CustomFrameStudioProps> = ({
  currentUser,
  frames,
  activeShape,
  activeCelebration,
  activePrimaryColor,
  activeSecondaryColor,
  activeCustomFrameId,
  onSelectShape,
  onApplyFramePreset,
  onCreateFrame,
  onNotifyToast,
}) => {
  const [showCreator, setShowCreator] = useState(false);
  const [frameFilter, setFrameFilter] = useState<'all' | 'celebraciones' | 'comunidad'>('all');
  const [name, setName] = useState('');
  const [shape, setShape] = useState<FrameShape>(activeShape || 'rectangulo');
  const [celebration, setCelebration] = useState<CelebrationTheme>(
    activeCelebration || 'cumpleanos'
  );
  const [primaryColor, setPrimaryColor] = useState(activePrimaryColor || '#38BDF8');
  const [secondaryColor, setSecondaryColor] = useState(activeSecondaryColor || '#E879F9');
  const [accentColor, setAccentColor] = useState('#FDE68A');
  const [borderPattern, setBorderPattern] =
    useState<CustomFramePreset['borderPattern']>('festivo');
  const [category, setCategory] = useState<CommunityCategory>('celebraciones');
  const [sharePublic, setSharePublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const visibleFrames = frames.filter((f) => {
    if (!f.isPublic && f.authorId !== currentUser.id) return false;
    if (frameFilter === 'celebraciones') return f.celebrationTheme !== 'ninguna';
    if (frameFilter === 'comunidad') return f.authorId !== 'system';
    return true;
  });

  const handleSaveFrame = async () => {
    const cleanName =
      name.trim() ||
      `Marco ${CELEBRATION_THEMES.find((c) => c.id === celebration)?.label || 'Personalizado'}`;
    setSaving(true);
    try {
      const created = await onCreateFrame({
        name: cleanName,
        frameShape: shape,
        celebrationTheme: celebration,
        primaryColor,
        secondaryColor,
        accentColor,
        borderPattern,
        category,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        isPublic: sharePublic,
      });
      onApplyFramePreset(created);
      setName('');
      setShowCreator(false);
      onNotifyToast(
        sharePublic
          ? `Marco "${created.name}" creado, aplicado y compartido con la comunidad.`
          : `Marco "${created.name}" guardado y aplicado a tu carta.`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D14] border border-fuchsia-400/30 space-y-5">
      {/* 1. Frame Shapes */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div>
            <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Shapes className="w-4 h-4 text-sky-400" />
              <span>Forma del Marco de la Carta</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Elige siluetas especiales (Escudo, Boleto, Corazón, Diamante, Arco, Polaroid) para tu carta 3D y PNG.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreator((v) => !v)}
            className="min-h-[36px] px-3.5 rounded-xl bg-gradient-to-r from-fuchsia-400 to-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreator ? 'Cerrar Creador' : 'Crear y Compartir Marco'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {FRAME_SHAPE_SPECS.map((sp) => {
            const selected = activeShape === sp.id;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => {
                  onSelectShape(sp.id);
                  onNotifyToast(`Forma "${sp.label}" aplicada.`);
                }}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-colors ${
                  selected
                    ? 'bg-sky-500/20 border-sky-400 text-white'
                    : 'bg-[#131622] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div
                  className="w-8 h-11 rounded-md border border-white/30"
                  style={{
                    background: `linear-gradient(135deg, ${activePrimaryColor}, ${activeSecondaryColor})`,
                    clipPath: sp.clipPath,
                  }}
                />
                <div className="text-[11px] font-bold truncate w-full">{sp.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Frame Builder Drawer */}
      {showCreator && (
        <div className="p-4 rounded-2xl bg-[#131622] border border-fuchsia-400/35 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span>Diseña tu Marco Personalizado o de Celebración</span>
            </h5>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-4 flex flex-col items-center gap-2">
              <div
                className="w-32 aspect-[54/85] p-1.5 shadow-xl rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  clipPath: getFrameShapeClipPath(shape),
                }}
              >
                <div
                  className="w-full h-full bg-[#0F1322] rounded-xl flex flex-col items-center justify-center p-2 text-center"
                  style={{ clipPath: getFrameShapeClipPath(shape) }}
                >
                  <span className="text-2xl">
                    {CELEBRATION_THEMES.find((c) => c.id === celebration)?.emblem || '✨'}
                  </span>
                  <span className="text-[11px] font-bold text-white mt-1 truncate max-w-full">
                    {name.trim() || 'Tu Marco'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {FRAME_SHAPE_SPECS.find((s) => s.id === shape)?.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="sm:col-span-8 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="text-slate-400">Nombre del marco</span>
                  <input
                    type="text"
                    placeholder="Ej. Gala Cumpleaños Dorado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-white"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Forma del marco</span>
                  <select
                    value={shape}
                    onChange={(e) => setShape(e.target.value as FrameShape)}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-white"
                  >
                    {FRAME_SHAPE_SPECS.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.label} ({sp.desc})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Motivo / Celebración</span>
                  <select
                    value={celebration}
                    onChange={(e) => {
                      const next = e.target.value as CelebrationTheme;
                      setCelebration(next);
                      const spec = CELEBRATION_THEMES.find((c) => c.id === next);
                      if (spec) {
                        setPrimaryColor(spec.primaryColor);
                        setSecondaryColor(spec.secondaryColor);
                        setAccentColor(spec.accentColor);
                      }
                    }}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-white"
                  >
                    {CELEBRATION_THEMES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emblem} {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-slate-400">Categoría en Biblioteca</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CommunityCategory)}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-white"
                  >
                    {COMMUNITY_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center justify-between p-2 rounded-xl bg-[#0B0D14] border border-white/10">
                  <span className="text-slate-300">Color 1</span>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-xl bg-[#0B0D14] border border-white/10">
                  <span className="text-slate-300">Color 2</span>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-xl bg-[#0B0D14] border border-white/10">
                  <span className="text-slate-300">Acabado</span>
                  <select
                    value={borderPattern}
                    onChange={(e) =>
                      setBorderPattern(e.target.value as CustomFramePreset['borderPattern'])
                    }
                    className="bg-transparent text-white text-[11px] font-semibold outline-none"
                  >
                    <option value="festivo" className="bg-[#0B0D14]">Festivo</option>
                    <option value="prisma" className="bg-[#0B0D14]">Prisma</option>
                    <option value="metalico" className="bg-[#0B0D14]">Metálico</option>
                    <option value="neon" className="bg-[#0B0D14]">Neón</option>
                    <option value="solido" className="bg-[#0B0D14]">Sólido</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharePublic}
                    onChange={(e) => setSharePublic(e.target.checked)}
                    className="accent-fuchsia-400"
                  />
                  <span>Compartir este marco con toda la comunidad</span>
                </label>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveFrame()}
                  className="min-h-[38px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Guardando...' : 'Guardar y Aplicar Marco'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Celebration & Community Frames Collection */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <PartyPopper className="w-4 h-4" />
            <span>Marcos de Celebraciones y de la Comunidad ({visibleFrames.length})</span>
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'celebraciones', label: 'Celebraciones' },
                { id: 'comunidad', label: 'Creados por Fans' },
              ] as const
            ).map((flt) => (
              <button
                key={flt.id}
                type="button"
                onClick={() => setFrameFilter(flt.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                  frameFilter === flt.id
                    ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {flt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {visibleFrames.map((frm) => {
            const selected = activeCustomFrameId === frm.id;
            const cel = CELEBRATION_THEMES.find((c) => c.id === frm.celebrationTheme);
            const clip = getFrameShapeClipPath(frm.frameShape);
            return (
              <button
                key={frm.id}
                type="button"
                onClick={() => {
                  onApplyFramePreset(frm);
                  onNotifyToast(`Marco "${frm.name}" aplicado.`);
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  selected
                    ? 'border-sky-400 ring-2 ring-sky-400/40 bg-sky-500/10'
                    : 'border-white/10 bg-[#131622] hover:border-white/25'
                }`}
              >
                <div
                  className="w-10 h-14 rounded-lg p-[2px] shrink-0 flex items-center justify-center relative"
                  style={{
                    background: `linear-gradient(135deg, ${frm.primaryColor}, ${frm.secondaryColor})`,
                    clipPath: clip,
                  }}
                >
                  <div
                    className="w-full h-full bg-[#0B0D14] rounded-md flex items-center justify-center text-base"
                    style={clip ? { clipPath: clip } : undefined}
                  >
                    {cel?.emblem || '✨'}
                  </div>
                  {selected && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-white truncate">{frm.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {FRAME_SHAPE_SPECS.find((s) => s.id === frm.frameShape)?.label || 'Clásico'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">Por {frm.authorName}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
