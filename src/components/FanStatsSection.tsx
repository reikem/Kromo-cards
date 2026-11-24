import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeftRight, Disc3, Layers, TrendingUp } from 'lucide-react';
import type {
  Album,
  CollectorUser,
  ConcertBanner,
  Photocard,
  TradeOffer,
} from '../types/kromacard';

interface FanStatsSectionProps {
  currentUser: CollectorUser;
  cards: Photocard[];
  albums: Album[];
  trades: TradeOffer[];
  banners: ConcertBanner[];
}

const MONTH_NAMES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const GENRE_COLORS: Record<string, string> = {
  'Indie / Acústico': '#38BDF8',
  'K-Pop / Synth Pop': '#E879F9',
  'Rock / Anthem Estadio': '#FACC15',
  'Pop en Vivo': '#34D399',
};

function classifyConcertGenre(
  presetId?: string,
  textHint = ''
): keyof typeof GENRE_COLORS {
  const lower = textHint.toLowerCase();
  if (
    presetId === 'synth-arena' ||
    lower.includes('k-pop') ||
    lower.includes('lightstick') ||
    lower.includes('arena') ||
    lower.includes('neón') ||
    lower.includes('starlight')
  ) {
    return 'K-Pop / Synth Pop';
  }
  if (
    presetId === 'golden-anthem' ||
    lower.includes('himno') ||
    lower.includes('rock') ||
    lower.includes('campeones') ||
    lower.includes('copa')
  ) {
    return 'Rock / Anthem Estadio';
  }
  if (
    presetId === 'acoustic-stadium' ||
    lower.includes('acústic') ||
    lower.includes('acoustic') ||
    lower.includes('indie') ||
    lower.includes('elena vance') ||
    lower.includes('coldplay')
  ) {
    return 'Indie / Acústico';
  }
  return 'Pop en Vivo';
}

export const FanStatsSection: React.FC<FanStatsSectionProps> = ({
  currentUser,
  cards,
  albums,
  trades,
  banners,
}) => {
  const myCards = useMemo(
    () => cards.filter((c) => c.ownerId === currentUser.id),
    [cards, currentUser.id]
  );

  const myAlbums = useMemo(
    () => albums.filter((a) => a.ownerId === currentUser.id),
    [albums, currentUser.id]
  );

  const myBanners = useMemo(
    () => banners.filter((b) => b.ownerId === currentUser.id),
    [banners, currentUser.id]
  );

  const myTrades = useMemo(
    () =>
      trades.filter(
        (t) => t.fromUserId === currentUser.id || t.toUserId === currentUser.id
      ),
    [trades, currentUser.id]
  );

  const completedTradesCount = useMemo(
    () => myTrades.filter((t) => t.status === 'completed').length,
    [myTrades]
  );

  // 1. Collection growth timeline (monthly cumulative photocards & concert items)
  const growthData = useMemo(() => {
    const events: { timestamp: number; label: string; isCard: boolean; isMemory: boolean }[] = [];

    myCards.forEach((c) => {
      const ts = Date.parse(c.createdAt) || Date.now();
      const d = new Date(ts);
      events.push({
        timestamp: ts,
        label: `${MONTH_NAMES_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        isCard: true,
        isMemory: Boolean(c.concert?.enabled),
      });
    });

    myAlbums.forEach((a) => {
      const ts = Date.parse(a.createdAt) || Date.now();
      const d = new Date(ts);
      events.push({
        timestamp: ts,
        label: `${MONTH_NAMES_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        isCard: false,
        isMemory: true,
      });
    });

    myBanners.forEach((b) => {
      const ts = Date.parse(b.createdAt) || Date.now();
      const d = new Date(ts);
      events.push({
        timestamp: ts,
        label: `${MONTH_NAMES_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        isCard: false,
        isMemory: true,
      });
    });

    events.sort((a, b) => a.timestamp - b.timestamp);

    const grouped = new Map<string, { cardsAdded: number; memoriesAdded: number }>();
    events.forEach((ev) => {
      const prev = grouped.get(ev.label) || { cardsAdded: 0, memoriesAdded: 0 };
      grouped.set(ev.label, {
        cardsAdded: prev.cardsAdded + (ev.isCard ? 1 : 0),
        memoriesAdded: prev.memoriesAdded + (ev.isMemory ? 1 : 0),
      });
    });

    const points: { periodo: string; cartas: number; recuerdos: number }[] = [];
    let runningCards = 0;
    let runningMemories = 0;

    if (grouped.size <= 1) {
      points.push({ periodo: 'Inicio', cartas: 0, recuerdos: 0 });
    }

    grouped.forEach((val, label) => {
      runningCards += val.cardsAdded;
      runningMemories += val.memoriesAdded;
      points.push({
        periodo: label,
        cartas: runningCards,
        recuerdos: runningMemories,
      });
    });

    if (points.length === 0) {
      return [
        { periodo: 'Inicio', cartas: 0, recuerdos: 0 },
        { periodo: 'Actual', cartas: myCards.length, recuerdos: myAlbums.length },
      ];
    }

    return points;
  }, [myAlbums, myBanners, myCards]);

  // 2. Exchanged cards & trade status breakdown
  const tradeChartData = useMemo(() => {
    const swapsCompleted = myTrades.filter(
      (t) => t.type === 'swap' && t.status === 'completed'
    ).length;
    const gifts = myTrades.filter((t) => t.type === 'gift').length;
    const pending = myTrades.filter((t) => t.status === 'pending').length;
    const sentByMe = myTrades.filter((t) => t.fromUserId === currentUser.id).length;
    const receivedByMe = myTrades.filter((t) => t.toUserId === currentUser.id).length;

    return [
      { categoria: 'Completados', cantidad: swapsCompleted, fill: '#34D399' },
      { categoria: 'Regalos', cantidad: gifts, fill: '#FACC15' },
      { categoria: 'Enviados', cantidad: sentByMe, fill: '#38BDF8' },
      { categoria: 'Recibidos', cantidad: receivedByMe, fill: '#E879F9' },
      { categoria: 'Pendientes', cantidad: pending, fill: '#94A3B8' },
    ];
  }, [currentUser.id, myTrades]);

  // 3. Music genre distribution across attended concerts (cards + banners + concert albums)
  const genreData = useMemo(() => {
    const counts = new Map<string, number>();

    myCards.forEach((c) => {
      if (!c.concert?.enabled) return;
      const genre = classifyConcertGenre(
        c.concert.audioPresetId,
        `${c.concert.artist} ${c.concert.tourName} ${c.concert.favoriteSong} ${c.title}`
      );
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });

    myBanners.forEach((b) => {
      const genre = classifyConcertGenre(
        b.audioPresetId,
        `${b.artistOrTour} ${b.songTitle} ${b.title}`
      );
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });

    myAlbums.forEach((a) => {
      if (a.category !== 'concert' && a.category !== 'idol') return;
      const genre = classifyConcertGenre(
        a.category === 'idol' ? 'synth-arena' : 'acoustic-stadium',
        `${a.title} ${a.description}`
      );
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });

    // If user hasn't registered a concert card yet, derive initial distribution from favoriteArtist & attended community concerts
    if (counts.size === 0) {
      const fallbackGenre = classifyConcertGenre(undefined, currentUser.favoriteArtist);
      counts.set(fallbackGenre, 1);
    }

    const total = Array.from(counts.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
      color: GENRE_COLORS[name] || '#38BDF8',
    }));
  }, [currentUser.favoriteArtist, myAlbums, myBanners, myCards]);

  const totalConcertsAttended = useMemo(() => {
    const uniqueEvents = new Set<string>();
    myCards.forEach((c) => {
      if (c.concert?.enabled) uniqueEvents.add(c.concert.tourName || c.location);
    });
    myBanners.forEach((b) => uniqueEvents.add(b.artistOrTour || b.venue));
    return Math.max(uniqueEvents.size, genreData.reduce((acc, g) => acc + g.value, 0));
  }, [genreData, myBanners, myCards]);

  return (
    <section className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            <span>Estadísticas del Fan</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evolución de tu bóveda de photocards, trueques realizados y géneros musicales vividos en conciertos.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="px-3.5 py-2 rounded-2xl bg-[#0B0D14] border border-white/10">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-sky-400" />
              <span>Colección</span>
            </div>
            <div className="font-mono-num text-base font-bold text-white mt-0.5">
              {myCards.length}
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-[#0B0D14] border border-white/10">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
              <span>Trueques</span>
            </div>
            <div className="font-mono-num text-base font-bold text-white mt-0.5">
              {completedTradesCount}
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-[#0B0D14] border border-white/10">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Disc3 className="w-3 h-3 text-fuchsia-400" />
              <span>Conciertos</span>
            </div>
            <div className="font-mono-num text-base font-bold text-white mt-0.5">
              {totalConcertsAttended}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Collection Growth (AreaChart) */}
        <div className="lg:col-span-5 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Crecimiento de la Colección</h4>
              <p className="text-[11px] text-slate-400">
                Cartas y recuerdos acumulados por periodo
              </p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCartas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradRecuerdos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E879F9" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#E879F9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis
                  dataKey="periodo"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#131622',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cartas"
                  name="Photocards"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  fill="url(#gradCartas)"
                />
                <Area
                  type="monotone"
                  dataKey="recuerdos"
                  name="Recuerdos / Giras"
                  stroke="#E879F9"
                  strokeWidth={2}
                  fill="url(#gradRecuerdos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Exchanged Cards & Trade Activity (BarChart) */}
        <div className="lg:col-span-4 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white">Cartas Intercambiadas</h4>
            <p className="text-[11px] text-slate-400">
              Resumen de trueques, regalos y solicitudes
            </p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tradeChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    backgroundColor: '#131622',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
                <Bar dataKey="cantidad" name="Cartas" radius={[8, 8, 0, 0]} maxBarSize={36}>
                  {tradeChartData.map((entry) => (
                    <Cell key={entry.categoria} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Music Genre Distribution by Concerts (PieChart) */}
        <div className="lg:col-span-3 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <h4 className="text-sm font-bold text-white">Géneros por Conciertos</h4>
            <p className="text-[11px] text-slate-400">
              Distribución musical de eventos asistidos
            </p>
          </div>

          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genreData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={62}
                  paddingAngle={4}
                  stroke="none"
                >
                  {genreData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#131622',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#F8FAFC',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5">
            {genreData.map((g) => (
              <div key={g.name} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-300 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="font-mono-num font-bold text-white shrink-0">
                  {g.value} ({g.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
