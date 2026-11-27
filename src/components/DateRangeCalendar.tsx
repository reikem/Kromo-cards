import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface DateRangeCalendarProps {
  fromDate: string; // YYYY-MM-DD or ''
  toDate: string; // YYYY-MM-DD or ''
  onChangeRange: (from: string, to: string) => void;
  onClear?: () => void;
  activeDateKeys?: Set<string>;
}

const WEEKDAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatShortEs(key: string): string {
  const dt = parseLocalDateKey(key);
  if (!dt) return '';
  return dt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  fromDate,
  toDate,
  onChangeRange,
  onClear,
  activeDateKeys,
}) => {
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const [hoverDate, setHoverDate] = useState<string>('');

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const initial = parseLocalDateKey(fromDate) || parseLocalDateKey(toDate) || new Date();
    return { year: initial.getFullYear(), month: initial.getMonth() };
  });

  useEffect(() => {
    const anchor = parseLocalDateKey(fromDate) || parseLocalDateKey(toDate);
    if (anchor) {
      setViewMonth({ year: anchor.getFullYear(), month: anchor.getMonth() });
    }
  }, [fromDate, toDate]);

  const monthLabel = useMemo(() => {
    const d = new Date(viewMonth.year, viewMonth.month, 1);
    const raw = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewMonth]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    // Monday-first index (0 = Mon, 6 = Sun)
    const leadingEmpty = (firstOfMonth.getDay() + 6) % 7;

    const cells: Array<{
      key: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    const prevMonthDays = new Date(viewMonth.year, viewMonth.month, 0).getDate();
    for (let i = leadingEmpty - 1; i >= 0; i -= 1) {
      const d = new Date(viewMonth.year, viewMonth.month - 1, prevMonthDays - i);
      cells.push({
        key: toLocalDateKey(d),
        day: d.getDate(),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(viewMonth.year, viewMonth.month, day);
      cells.push({
        key: toLocalDateKey(d),
        day,
        inCurrentMonth: true,
      });
    }

    const trailingCount = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= trailingCount; day += 1) {
      const d = new Date(viewMonth.year, viewMonth.month + 1, day);
      cells.push({
        key: toLocalDateKey(d),
        day,
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [viewMonth]);

  const isSelectingEnd = Boolean(fromDate && !toDate);

  const previewRange = useMemo(() => {
    if (fromDate && toDate) {
      return fromDate <= toDate
        ? { start: fromDate, end: toDate }
        : { start: toDate, end: fromDate };
    }
    if (fromDate && hoverDate) {
      return fromDate <= hoverDate
        ? { start: fromDate, end: hoverDate }
        : { start: hoverDate, end: fromDate };
    }
    if (fromDate) {
      return { start: fromDate, end: fromDate };
    }
    return null;
  }, [fromDate, toDate, hoverDate]);

  const handleDayClick = (dayKey: string) => {
    if (!fromDate || (fromDate && toDate)) {
      onChangeRange(dayKey, '');
      return;
    }
    if (dayKey < fromDate) {
      onChangeRange(dayKey, fromDate);
    } else {
      onChangeRange(fromDate, dayKey);
    }
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const jumpToToday = () => {
    const now = new Date();
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <div
      aria-label="Calendario selector de rango de fechas"
      className="bg-[#0B0D14] border border-white/10 rounded-2xl p-3.5 space-y-3"
    >
      {/* Top Status & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">
            {fromDate && toDate
              ? `${formatShortEs(fromDate)} → ${formatShortEs(toDate)}`
              : fromDate
                ? `Inicio: ${formatShortEs(fromDate)} (elige fin)`
                : 'Selecciona fecha inicio y fin'}
          </span>
        </div>

        {(fromDate || toDate) && onClear && (
          <button
            type="button"
            onClick={() => {
              setHoverDate('');
              onClear();
            }}
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mes anterior"
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">{monthLabel}</span>
          <button
            type="button"
            onClick={jumpToToday}
            className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-sky-300 transition-colors"
          >
            Hoy
          </button>
        </div>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Mes siguiente"
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_ES.map((wd) => (
          <div
            key={wd}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div
        className="grid grid-cols-7 gap-y-1"
        onMouseLeave={() => setHoverDate('')}
      >
        {calendarCells.map((cell) => {
          const isStart = previewRange ? cell.key === previewRange.start : false;
          const isEnd = previewRange ? cell.key === previewRange.end : false;
          const isSingle = isStart && isEnd;
          const isInRange = previewRange
            ? cell.key > previewRange.start && cell.key < previewRange.end
            : false;
          const isToday = cell.key === todayKey;
          const hasTradeActivity = activeDateKeys ? activeDateKeys.has(cell.key) : false;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => handleDayClick(cell.key)}
              onMouseEnter={() => {
                if (isSelectingEnd) setHoverDate(cell.key);
              }}
              aria-label={`Seleccionar ${cell.key}`}
              aria-pressed={isStart || isEnd}
              className={`relative h-8 flex flex-col items-center justify-center text-xs font-mono-num transition-colors ${
                isSingle
                  ? 'bg-sky-500 text-slate-950 font-extrabold rounded-lg shadow-sm'
                  : isStart
                    ? 'bg-sky-500 text-slate-950 font-extrabold rounded-l-lg'
                    : isEnd
                      ? 'bg-sky-500 text-slate-950 font-extrabold rounded-r-lg'
                      : isInRange
                        ? 'bg-sky-500/20 text-sky-100 font-semibold'
                        : cell.inCurrentMonth
                          ? 'text-slate-200 hover:bg-white/10 rounded-lg'
                          : 'text-slate-500 hover:bg-white/5 rounded-lg'
              } ${isToday && !isStart && !isEnd ? 'ring-1 ring-amber-400/70 rounded-lg' : ''}`}
            >
              <span className="leading-none">{cell.day}</span>
              {hasTradeActivity && (
                <span
                  className={`mt-0.5 w-1 h-1 rounded-full ${
                    isStart || isEnd ? 'bg-slate-950' : 'bg-emerald-400'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Hint */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Días con trueques</span>
        </span>
        <span>
          {isSelectingEnd
            ? 'Haz clic en la fecha final'
            : 'Clic en inicio y fin'}
        </span>
      </div>
    </div>
  );
};
