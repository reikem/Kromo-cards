import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Share2, Sliders, X } from 'lucide-react';
import type { Photocard } from '../types/kromacard';
import {
  downloadSocialSharePNG,
  getCardDeepLink,
  renderSocialShare3DDataUrl,
  shareSocialCanvasNative,
  SOCIAL_PRESETS,
  type SocialPreset,
} from '../utils/cardExporter';

interface SocialShareModalProps {
  card: Photocard;
  onClose: () => void;
  onNotifyToast: (msg: string) => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  card,
  onClose,
  onNotifyToast,
}) => {
  const [preset, setPreset] = useState<SocialPreset>('instagram-post');
  const [angleDeg, setAngleDeg] = useState<number>(-18);
  const [showBackPeek, setShowBackPeek] = useState<boolean>(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [rendering, setRendering] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setRendering(true);
    const timer = window.setTimeout(() => {
      void renderSocialShare3DDataUrl(card, preset, angleDeg, showBackPeek)
        .then((url) => {
          if (active) {
            setPreviewUrl(url);
            setRendering(false);
          }
        })
        .catch(() => {
          if (active) setRendering(false);
        });
    }, 90);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [card, preset, angleDeg, showBackPeek]);

  const activeSpec = SOCIAL_PRESETS.find((p) => p.id === preset) || SOCIAL_PRESETS[0];

  const handleDownload = async () => {
    await downloadSocialSharePNG(card, preset, angleDeg, showBackPeek);
    onNotifyToast(`Imagen 3D optimizada para ${activeSpec.label} descargada.`);
  };

  const handleShareNative = async () => {
    const outcome = await shareSocialCanvasNative(card, preset, angleDeg, showBackPeek);
    if (outcome === 'shared') {
      onNotifyToast('Diseño 3D compartido en tus redes.');
    } else {
      onNotifyToast(`Imagen 3D guardada (${activeSpec.dimensionsLabel}) lista para publicar.`);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getCardDeepLink(card.id));
      setCopiedLink(true);
      onNotifyToast('Enlace directo 3D copiado al portapapeles.');
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onNotifyToast('No se pudo copiar el enlace.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md overflow-y-auto p-4 md:p-8 flex items-start md:items-center justify-center">
      <div className="w-full max-w-4xl bg-[#131622] border border-white/15 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Compartir en Redes Sociales
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Genera un lienzo temporal con tu carta en perspectiva 3D y QR optimizado para Instagram o Twitter / X.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar compartir en redes"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Preview Canvas */}
          <div className="lg:col-span-7 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[320px]">
            {rendering || !previewUrl ? (
              <div className="py-24 text-center space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-400">
                  Renderizando diseño 3D en canvas temporal ({activeSpec.dimensionsLabel})...
                </p>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={`Vista previa 3D para ${activeSpec.label}`}
                className="max-h-[420px] w-auto rounded-xl shadow-2xl object-contain"
              />
            )}
            <div className="mt-3 text-[11px] font-mono-num text-slate-400">
              {activeSpec.label} · {activeSpec.dimensionsLabel}
            </div>
          </div>

          {/* Controls */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Formato de red social
              </div>
              <div className="space-y-2">
                {SOCIAL_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreset(item.id)}
                    className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                      preset === item.id
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="font-mono-num text-[11px] text-slate-400">
                      {item.dimensionsLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0B0D14] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  Ángulo 3D de la tarjeta
                </span>
                <span className="font-mono-num text-sky-400 font-semibold">{angleDeg}°</span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                value={angleDeg}
                onChange={(e) => setAngleDeg(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={showBackPeek}
                  onChange={(e) => setShowBackPeek(e.target.checked)}
                  className="w-4 h-4 accent-sky-400 rounded"
                />
                <span>Incluir reverso con estadísticas y autógrafo detrás</span>
              </label>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={rendering || !previewUrl}
                className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Imagen PNG</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleShareNative}
                  disabled={rendering || !previewUrl}
                  className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4 text-sky-400" />
                  <span>Compartir</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copiado' : 'Copiar Enlace'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
