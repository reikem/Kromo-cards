import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= safePage - 1 && p <= safePage + 1)
    ) {
      pages.push(p);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
      <div className="text-xs text-slate-400 font-mono-num">
        Mostrando {startIdx}–{endIdx} de {totalItems}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Anterior</span>
        </button>

        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const showGap = prev !== undefined && p - prev > 1;
          return (
            <React.Fragment key={p}>
              {showGap && (
                <span className="px-1.5 text-xs text-slate-500">…</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-h-[36px] min-w-[36px] px-2.5 rounded-xl text-xs font-mono-num font-bold transition-colors ${
                  p === safePage
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
                }`}
              >
                {p}
              </button>
            </React.Fragment>
          );
        })}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
