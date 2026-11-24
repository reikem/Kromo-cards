import React, { useEffect, useState } from 'react';
import { Check, Printer, X } from 'lucide-react';
import type { Photocard } from '../types/kromacard';
import { renderCardBackDataUrl, renderCardFrontDataUrl } from '../utils/cardExporter';

interface PrintSheetModalProps {
  cards: Photocard[];
  initialCard?: Photocard;
  onClose: () => void;
}

interface RenderedPair {
  id: string;
  title: string;
  frontUrl: string;
  backUrl: string;
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({
  cards,
  initialCard,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialCard ? [initialCard.id] : cards.slice(0, 2).map((c) => c.id)
  );
  const [cardSize, setCardSize] = useState<'photocard' | 'trading'>('photocard');
  const [includeBack, setIncludeBack] = useState(true);
  const [renderedPairs, setRenderedPairs] = useState<RenderedPair[]>([]);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let active = true;
    const buildSheet = async () => {
      setIsRendering(true);
      const targets = cards.filter((c) => selectedIds.includes(c.id)).slice(0, 4);
      const results: RenderedPair[] = [];
      for (const c of targets) {
        const frontUrl = await renderCardFrontDataUrl(c);
        const backUrl = includeBack ? await renderCardBackDataUrl(c) : '';
        results.push({ id: c.id, title: c.title, frontUrl, backUrl });
      }
      if (active) {
        setRenderedPairs(results);
        setIsRendering(false);
      }
    };
    void buildSheet();
    return () => {
      active = false;
    };
  }, [cards, selectedIds, includeBack]);

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const widthMm = cardSize === 'photocard' ? 54 : 63;
  const heightMm = cardSize === 'photocard' ? 85 : 88;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md overflow-y-auto p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-[#131622] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-white">
              Pliego A4 Listo para Imprimir
            </h2>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Selecciona hasta 4 cartas. Incluye guías de corte y código QR escaneable en el reverso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Cartas en este pliego ({selectedIds.length}/4)
            </div>
            <div className="flex flex-wrap gap-2">
              {cards.map((c) => {
                const active = selectedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCard(c.id)}
                    className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                      active
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span className="truncate max-w-[150px]">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">Formato físico</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardSize('photocard')}
                  className={`min-h-[40px] rounded-xl text-xs font-semibold border ${
                    cardSize === 'photocard'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  54 × 85 mm
                </button>
                <button
                  type="button"
                  onClick={() => setCardSize('trading')}
                  className={`min-h-[40px] rounded-xl text-xs font-semibold border ${
                    cardSize === 'trading'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  63 × 88 mm
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={includeBack}
                onChange={(e) => setIncludeBack(e.target.checked)}
                className="w-4 h-4 accent-sky-400 rounded"
              />
              <span>Incluir reverso con QR y autógrafo</span>
            </label>
          </div>
        </div>

        {/* Printable A4 Canvas Preview */}
        <div className="mt-6 bg-slate-950/60 p-4 rounded-2xl border border-white/10 overflow-x-auto">
          <div
            id="a4-print-sheet"
            className="mx-auto bg-white text-slate-900 p-6 rounded-xl shadow-xl"
            style={{ width: '100%', maxWidth: '794px', minHeight: '520px' }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
              <div>
                <div className="font-display font-bold text-base text-slate-900">
                  Kromacard · Pliego Imprimible ({widthMm} × {heightMm} mm)
                </div>
                <div className="text-xs text-slate-500">
                  Recorta por la línea punteada y dobla o lamina a doble cara
                </div>
              </div>
              <span className="font-mono-num text-xs text-slate-500">300 DPI</span>
            </div>

            {isRendering ? (
              <div className="py-20 text-center text-sm text-slate-500">
                Preparando tarjetas en alta resolución con códigos QR...
              </div>
            ) : renderedPairs.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-500">
                Selecciona al menos una photocard arriba para armar tu hoja.
              </div>
            ) : (
              <div className="space-y-6">
                {renderedPairs.map((pair) => (
                  <div
                    key={pair.id}
                    className="flex flex-wrap items-center justify-center gap-4 pb-5 border-b border-dashed border-slate-300 last:border-b-0"
                  >
                    <div className="p-1.5 border border-dashed border-slate-400 rounded-xl">
                      <img
                        src={pair.frontUrl}
                        alt={`${pair.title} Anverso`}
                        style={{
                          width: `${widthMm * 3.1}px`,
                          height: `${heightMm * 3.1}px`,
                        }}
                        className="object-cover rounded-lg"
                      />
                      <div className="text-[10px] text-center text-slate-500 mt-1 font-mono-num">
                        ANVERSO · {pair.title}
                      </div>
                    </div>

                    {includeBack && pair.backUrl && (
                      <div className="p-1.5 border border-dashed border-slate-400 rounded-xl">
                        <img
                          src={pair.backUrl}
                          alt={`${pair.title} Reverso`}
                          style={{
                            width: `${widthMm * 3.1}px`,
                            height: `${heightMm * 3.1}px`,
                          }}
                          className="object-cover rounded-lg"
                        />
                        <div className="text-[10px] text-center text-slate-500 mt-1 font-mono-num">
                          REVERSO + QR ESCANEABLE
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-slate-200"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={renderedPairs.length === 0 || isRendering}
            className="min-h-[44px] px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Pliego A4 / Guardar PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
