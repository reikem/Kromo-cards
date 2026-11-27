import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Flame,
  Gem,
  Gift,
  History,
  Layers,
  Palette,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sticker,
  Store,
  Tag,
  Timer,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
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
import type {
  CollectorUser,
  CommunityCategory,
  CustomSticker,
  CustomTexture,
  ImageFilterConfig,
  Photocard,
  TradeOffer,
} from '../types/kromacard';
import {
  COMMUNITY_CATEGORIES,
  formatRemainingTime,
  getCommunityCategoryLabel,
} from '../utils/frameShapes';
import type { PushPermissionState } from '../utils/pushNotifications';
import { Card3D } from './Card3D';
import { exportTextureImageAsPng } from './CustomTextureStudio';
import { DateRangeCalendar, toLocalDateKey } from './DateRangeCalendar';
import { DriveExportButton } from './DriveExportButton';
import { PaginationControls } from './PaginationControls';

interface TradeBazaarViewProps {
  currentUser: CollectorUser;
  users: CollectorUser[];
  cards: Photocard[];
  trades: TradeOffer[];
  filters: ImageFilterConfig[];
  stickers: CustomSticker[];
  textures: CustomTexture[];
  newStickerIds?: string[];
  preselectedTargetCard?: Photocard | null;
  pushPermission?: PushPermissionState;
  pushTesting?: boolean;
  onEnablePush?: () => Promise<void> | void;
  onTestPush?: () => Promise<void> | void;
  onClearPreselected?: () => void;
  onToggleCardTradeable?: (
    cardId: string,
    tradeable: boolean,
    tradeWishNote?: string,
    tradeCategory?: CommunityCategory,
    tradeExpiresAt?: string
  ) => Promise<void> | void;
  onProposeTrade: (payload: {
    type: 'swap' | 'gift';
    fromUserId: string;
    toUserId: string;
    offeredCardId?: string;
    requestedCardId: string;
    message: string;
  }) => Promise<void>;
  onRespondTrade: (tradeId: string, action: 'accept' | 'decline') => Promise<void>;
  onInspectCard: (card: Photocard) => void;
  onUseInStudio: () => void;
  onOpenStickerStudio?: () => void;
  onNotifyToast?: (msg: string) => void;
}

type BazaarCategoryFilter =
  | 'all'
  | 'musica'
  | 'eventos'
  | 'colecciones-especiales'
  | 'deportes';

type CardRarityTier = 'mitica' | 'ultra-rara' | 'rara' | 'comun';

const BAZAAR_CATEGORY_OPTIONS: { id: BazaarCategoryFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'musica', label: 'Música' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'colecciones-especiales', label: 'Colecciones Especiales' },
  { id: 'deportes', label: 'Deportes' },
];

const RARITY_OPTIONS: {
  id: 'all' | CardRarityTier;
  label: string;
  badgeClass: string;
}[] = [
  { id: 'all', label: 'Todas las rarezas', badgeClass: 'text-slate-200' },
  {
    id: 'mitica',
    label: 'Mítica / Limitada',
    badgeClass: 'bg-amber-400/15 border-amber-400/40 text-amber-300',
  },
  {
    id: 'ultra-rara',
    label: 'Ultra Rara Holo',
    badgeClass: 'bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-300',
  },
  {
    id: 'rara',
    label: 'Rara Especial',
    badgeClass: 'bg-sky-500/15 border-sky-400/40 text-sky-300',
  },
  {
    id: 'comun',
    label: 'Estándar',
    badgeClass: 'bg-white/10 border-white/15 text-slate-300',
  },
];

function getCardEffectiveCategory(card: Photocard): CommunityCategory {
  if (card.tradeCategory) return card.tradeCategory;
  if (card.frameStyle === 'gold') return 'deportes';
  if (card.concert?.enabled) return 'musica';
  return 'eventos';
}

function matchesBazaarCategory(card: Photocard, filter: BazaarCategoryFilter): boolean {
  if (filter === 'all') return true;
  const cat = getCardEffectiveCategory(card);
  if (filter === 'musica') return cat === 'musica';
  if (filter === 'eventos') return cat === 'eventos';
  if (filter === 'deportes') return cat === 'deportes';
  if (filter === 'colecciones-especiales') {
    const edition = (card.editionLabel || '').toLowerCase();
    return (
      cat === 'edicion-limitada' ||
      cat === 'celebraciones' ||
      cat === 'fantasia' ||
      Boolean(card.customFrameId) ||
      (card.frameCelebration !== undefined && card.frameCelebration !== 'ninguna') ||
      edition.includes('limit') ||
      edition.includes('especial') ||
      edition.includes('vip')
    );
  }
  return true;
}

function getCardRarity(card: Photocard): {
  tier: CardRarityTier;
  label: string;
  badgeClass: string;
} {
  const ed = (card.editionLabel || '').toLowerCase();
  if (
    card.frameStyle === 'gold' ||
    card.tradeCategory === 'edicion-limitada' ||
    ed.includes('limit') ||
    ed.includes('#01') ||
    (card.shineIntensity >= 89 && Boolean(card.customFrameId))
  ) {
    return {
      tier: 'mitica',
      label: 'Mítica',
      badgeClass: 'bg-amber-400/15 border-amber-400/40 text-amber-300',
    };
  }
  if (
    card.frameStyle === 'holo' ||
    card.texture.startsWith('holo-') ||
    Boolean(card.customTextureUrl) ||
    card.shineIntensity >= 80
  ) {
    return {
      tier: 'ultra-rara',
      label: 'Ultra Rara',
      badgeClass: 'bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-300',
    };
  }
  if (
    card.frameStyle === 'stadium' ||
    (card.frameCelebration && card.frameCelebration !== 'ninguna') ||
    card.stickers.length >= 2
  ) {
    return {
      tier: 'rara',
      label: 'Rara',
      badgeClass: 'bg-sky-500/15 border-sky-400/40 text-sky-300',
    };
  }
  return {
    tier: 'comun',
    label: 'Estándar',
    badgeClass: 'bg-white/10 border-white/15 text-slate-300',
  };
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const raw = value === undefined || value === null ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

function formatAvgDurationEs(ms: number | null): string {
  if (ms === null || Number.isNaN(ms) || ms < 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '< 1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export const TradeBazaarView: React.FC<TradeBazaarViewProps> = ({
  currentUser,
  users,
  cards,
  trades,
  filters,
  stickers,
  textures,
  newStickerIds = [],
  preselectedTargetCard,
  pushPermission = 'default',
  pushTesting = false,
  onEnablePush,
  onTestPush,
  onClearPreselected,
  onToggleCardTradeable,
  onProposeTrade,
  onRespondTrade,
  onInspectCard,
  onUseInStudio,
  onOpenStickerStudio,
  onNotifyToast,
}) => {
  const [tab, setTab] = useState<'bazaar' | 'trades' | 'history' | 'assets'>('bazaar');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState<'all' | 'timed' | 'friends'>('all');
  const [categoryFilter, setCategoryFilter] = useState<BazaarCategoryFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | CardRarityTier>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'expiring' | 'popular'>('recent');
  const [marketPage, setMarketPage] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showMyListings, setShowMyListings] = useState(false);
  const [wishNoteDrafts, setWishNoteDrafts] = useState<Record<string, string>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CommunityCategory>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>({});
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | 'completed' | 'declined' | 'pending'
  >('all');
  const [historyDatePreset, setHistoryDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [showHistoryStats, setShowHistoryStats] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [targetCard, setTargetCard] = useState<Photocard | null>(preselectedTargetCard || null);
  const [giftMode, setGiftMode] = useState(false);
  const [giftRecipientId, setGiftRecipientId] = useState(
    users.find((u) => u.id !== currentUser.id)?.id || ''
  );
  const [offeredCardId, setOfferedCardId] = useState('');
  const [tradeMessage, setTradeMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myCards = cards.filter((c) => c.ownerId === currentUser.id);
  const myListedCount = myCards.filter((c) => c.tradeable).length;
  const communityTradeable = cards.filter(
    (c) => c.ownerId !== currentUser.id && c.tradeable
  );
  const timedTradeCount = communityTradeable.filter(
    (c) => Boolean(c.tradeExpiresAt) && !formatRemainingTime(c.tradeExpiresAt, nowMs).expired
  ).length;
  const myRelatedTrades = trades.filter(
    (t) => t.fromUserId === currentUser.id || t.toUserId === currentUser.id
  );
  const pendingTradesCount = myRelatedTrades.filter((t) => t.status === 'pending').length;
  const incomingPendingCount = myRelatedTrades.filter(
    (t) => t.toUserId === currentUser.id && t.status === 'pending'
  ).length;
  const completedTradesCount = trades.filter((t) => t.status === 'completed').length;
  const myCompletedTradesCount = myRelatedTrades.filter((t) => t.status === 'completed').length;
  const myDeclinedTradesCount = myRelatedTrades.filter((t) => t.status === 'declined').length;
  const myHistoryTrades = useMemo(
    () =>
      [...myRelatedTrades].sort(
        (a, b) =>
          new Date(b.resolvedAt || b.createdAt).getTime() -
          new Date(a.resolvedAt || a.createdAt).getTime()
      ),
    [myRelatedTrades]
  );

  const tradeActivityDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const tr of myHistoryTrades) {
      const dt = new Date(tr.resolvedAt || tr.createdAt);
      if (!Number.isNaN(dt.getTime())) {
        keys.add(toLocalDateKey(dt));
      }
    }
    return keys;
  }, [myHistoryTrades]);

  const selectHistoryDatePreset = (
    preset: 'all' | 'today' | '7d' | '30d' | 'custom'
  ) => {
    setHistoryDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setHistoryDateFrom('');
      setHistoryDateTo('');
    } else if (preset === 'today') {
      const key = toLocalDateKey(now);
      setHistoryDateFrom(key);
      setHistoryDateTo(key);
    } else if (preset === '7d') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setHistoryDateFrom(toLocalDateKey(start));
      setHistoryDateTo(toLocalDateKey(now));
    } else if (preset === '30d') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setHistoryDateFrom(toLocalDateKey(start));
      setHistoryDateTo(toLocalDateKey(now));
    }
  };

  const findUser = (id: string) => users.find((u) => u.id === id);
  const findCard = (id?: string) => cards.find((c) => c.id === id);

  const filteredHistoryTrades = useMemo(() => {
    const now = new Date();
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const fromCustomMs = historyDateFrom
      ? new Date(`${historyDateFrom}T00:00:00`).getTime()
      : null;
    const toCustomMs = historyDateTo
      ? new Date(`${historyDateTo}T23:59:59.999`).getTime()
      : null;

    return myHistoryTrades.filter((tr) => {
      if (historyStatusFilter !== 'all' && tr.status !== historyStatusFilter) {
        return false;
      }

      const effectiveIso = tr.resolvedAt || tr.createdAt;
      const effectiveMs = new Date(effectiveIso).getTime();

      if (historyDatePreset === 'today') {
        if (effectiveMs < startOfTodayMs) return false;
      } else if (historyDatePreset === '7d') {
        if (effectiveMs < Date.now() - 7 * 24 * 3600 * 1000) return false;
      } else if (historyDatePreset === '30d') {
        if (effectiveMs < Date.now() - 30 * 24 * 3600 * 1000) return false;
      } else if (historyDatePreset === 'custom') {
        if (fromCustomMs !== null && !Number.isNaN(fromCustomMs) && effectiveMs < fromCustomMs) {
          return false;
        }
        if (toCustomMs !== null && !Number.isNaN(toCustomMs) && effectiveMs > toCustomMs) {
          return false;
        }
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const fromUser = findUser(tr.fromUserId);
        const toUser = findUser(tr.toUserId);
        const offCard = findCard(tr.offeredCardId);
        const reqCard = findCard(tr.requestedCardId);
        return (
          tr.verificationCode.toLowerCase().includes(q) ||
          tr.message.toLowerCase().includes(q) ||
          (fromUser?.displayName || '').toLowerCase().includes(q) ||
          (toUser?.displayName || '').toLowerCase().includes(q) ||
          (offCard?.title || '').toLowerCase().includes(q) ||
          (offCard?.serialCode || '').toLowerCase().includes(q) ||
          (reqCard?.title || '').toLowerCase().includes(q) ||
          (reqCard?.serialCode || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    myHistoryTrades,
    historyStatusFilter,
    historyDatePreset,
    historyDateFrom,
    historyDateTo,
    historySearch,
    users,
    cards,
  ]);

  const hasHistoryFilters =
    historyStatusFilter !== 'all' ||
    historyDatePreset !== 'all' ||
    historySearch.trim().length > 0;

  const resetHistoryFilters = () => {
    setHistoryStatusFilter('all');
    setHistoryDatePreset('all');
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistorySearch('');
  };

  const tradeStats = useMemo(() => {
    const completed = myHistoryTrades.filter((t) => t.status === 'completed');
    const declined = myHistoryTrades.filter((t) => t.status === 'declined');
    const pending = myHistoryTrades.filter((t) => t.status === 'pending');
    const resolved = completed.length + declined.length;
    const acceptanceRate = resolved > 0 ? Math.round((completed.length / resolved) * 100) : 0;

    const swaps = myHistoryTrades.filter((t) => t.type === 'swap').length;
    const gifts = myHistoryTrades.filter((t) => t.type === 'gift').length;
    const sent = myHistoryTrades.filter((t) => t.fromUserId === currentUser.id).length;
    const received = myHistoryTrades.filter((t) => t.toUserId === currentUser.id).length;

    const resolutionDurations: number[] = [];
    for (const tr of [...completed, ...declined]) {
      if (!tr.resolvedAt) continue;
      const startMs = Date.parse(tr.createdAt);
      const endMs = Date.parse(tr.resolvedAt);
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
        resolutionDurations.push(endMs - startMs);
      }
    }
    const avgMs =
      resolutionDurations.length > 0
        ? resolutionDurations.reduce((acc, v) => acc + v, 0) / resolutionDurations.length
        : null;

    const partnerCounts = new Map<
      string,
      { userId: string; total: number; completed: number }
    >();
    for (const tr of myHistoryTrades) {
      const partnerId = tr.fromUserId === currentUser.id ? tr.toUserId : tr.fromUserId;
      if (!partnerId || partnerId === currentUser.id) continue;
      const prev = partnerCounts.get(partnerId) || {
        userId: partnerId,
        total: 0,
        completed: 0,
      };
      prev.total += 1;
      if (tr.status === 'completed') prev.completed += 1;
      partnerCounts.set(partnerId, prev);
    }
    const topPartners = Array.from(partnerCounts.values())
      .sort((a, b) => b.total - a.total || b.completed - a.completed)
      .slice(0, 3)
      .map((entry) => ({
        ...entry,
        user: users.find((u) => u.id === entry.userId),
      }));

    const statusPieData = [
      { name: 'Aceptados', value: completed.length, color: '#34D399' },
      { name: 'Rechazados', value: declined.length, color: '#FB7185' },
      { name: 'Pendientes', value: pending.length, color: '#FBBF24' },
    ].filter((item) => item.value > 0);

    const monthKeys = new Set<string>();
    for (const tr of myHistoryTrades) {
      const d = new Date(tr.resolvedAt || tr.createdAt);
      if (!Number.isNaN(d.getTime())) {
        monthKeys.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    }
    const groupByDay = monthKeys.size <= 1;

    const periodMap = new Map<
      string,
      { sortTs: number; periodo: string; aceptados: number; rechazados: number; pendientes: number }
    >();
    for (const tr of myHistoryTrades) {
      const d = new Date(tr.resolvedAt || tr.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = groupByDay
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = groupByDay
        ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      const sortTs = groupByDay
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        : new Date(d.getFullYear(), d.getMonth(), 1).getTime();

      const bucket = periodMap.get(key) || {
        sortTs,
        periodo: label,
        aceptados: 0,
        rechazados: 0,
        pendientes: 0,
      };
      if (tr.status === 'completed') bucket.aceptados += 1;
      else if (tr.status === 'declined') bucket.rechazados += 1;
      else bucket.pendientes += 1;
      periodMap.set(key, bucket);
    }

    const timelineData = Array.from(periodMap.values()).sort((a, b) => a.sortTs - b.sortTs);

    return {
      total: myHistoryTrades.length,
      completedCount: completed.length,
      declinedCount: declined.length,
      pendingCount: pending.length,
      resolvedCount: resolved,
      acceptanceRate,
      swaps,
      gifts,
      sent,
      received,
      avgResolutionLabel: formatAvgDurationEs(avgMs),
      topPartner: topPartners[0] || null,
      topPartners,
      statusPieData,
      timelineData,
    };
  }, [myHistoryTrades, currentUser.id, users]);

  const handleDownloadHistoryCsv = (subset: TradeOffer[], scopeLabel: string) => {
    if (subset.length === 0) {
      onNotifyToast?.('No hay registros de trueques para exportar en CSV.');
      return;
    }

    const headers = [
      'ID Trueque',
      'Código Verificación',
      'Estado',
      'Tipo',
      'Rol del Usuario',
      'Remitente',
      'Handle Remitente',
      'Destinatario',
      'Handle Destinatario',
      'Carta Ofrecida / Regalada',
      'Serial Carta Ofrecida',
      'Carta Solicitada',
      'Serial Carta Solicitada',
      'Mensaje',
      'Fecha Solicitud (ISO)',
      'Fecha Resolución (ISO)',
    ];

    const rows = subset.map((tr) => {
      const fromUser = findUser(tr.fromUserId);
      const toUser = findUser(tr.toUserId);
      const offCard = findCard(tr.offeredCardId);
      const reqCard = findCard(tr.requestedCardId);

      const estadoLabel =
        tr.status === 'completed'
          ? 'Aceptado / Finalizado'
          : tr.status === 'declined'
            ? 'Rechazado'
            : 'Pendiente';
      const tipoLabel = tr.type === 'gift' ? 'Regalo directo' : 'Trueque bilateral';
      const rolLabel =
        tr.fromUserId === currentUser.id ? 'Enviado por ti' : 'Recibido por ti';

      return [
        tr.id,
        tr.verificationCode,
        estadoLabel,
        tipoLabel,
        rolLabel,
        fromUser?.displayName || tr.fromUserId,
        fromUser?.handle || '',
        toUser?.displayName || tr.toUserId,
        toUser?.handle || '',
        offCard?.title || tr.offeredCardId || '—',
        offCard?.serialCode || '',
        tr.type === 'gift' ? 'N/A (Regalo)' : reqCard?.title || tr.requestedCardId,
        tr.type === 'gift' ? '' : reqCard?.serialCode || '',
        tr.message || '',
        tr.createdAt,
        tr.resolvedAt || '',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanHandle = (currentUser.handle || currentUser.id)
      .replace(/^@/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateSlug = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `kromacard-historial-trueques-${cleanHandle}-${dateSlug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onNotifyToast?.(
      `Resumen ${scopeLabel} exportado en CSV (${subset.length} intercambios).`
    );
  };

  const filteredMarketplace = useMemo(() => {
    const filtered = communityTradeable.filter((card) => {
      if (!matchesBazaarCategory(card, categoryFilter)) {
        return false;
      }
      if (rarityFilter !== 'all' && getCardRarity(card).tier !== rarityFilter) {
        return false;
      }
      if (marketFilter === 'timed') {
        if (!card.tradeExpiresAt) return false;
        if (formatRemainingTime(card.tradeExpiresAt, nowMs).expired) return false;
      }
      if (marketFilter === 'friends' && !currentUser.friends.includes(card.ownerId)) {
        return false;
      }
      if (marketSearch.trim()) {
        const q = marketSearch.toLowerCase();
        const owner = findUser(card.ownerId);
        return (
          card.title.toLowerCase().includes(q) ||
          card.subtitle.toLowerCase().includes(q) ||
          card.location.toLowerCase().includes(q) ||
          card.serialCode.toLowerCase().includes(q) ||
          (card.tradeWishNote || '').toLowerCase().includes(q) ||
          (owner?.displayName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'popular') {
        return (b.likes || 0) - (a.likes || 0);
      }
      if (sortBy === 'expiring') {
        const ae = a.tradeExpiresAt ? new Date(a.tradeExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const be = b.tradeExpiresAt ? new Date(b.tradeExpiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ae - be;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    communityTradeable,
    categoryFilter,
    rarityFilter,
    marketFilter,
    marketSearch,
    sortBy,
    nowMs,
    currentUser.friends,
    users,
  ]);

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    rarityFilter !== 'all' ||
    marketFilter !== 'all' ||
    marketSearch.trim().length > 0;

  const resetAllFilters = () => {
    setCategoryFilter('all');
    setRarityFilter('all');
    setMarketFilter('all');
    setMarketSearch('');
    setMarketPage(1);
  };

  const MARKET_PAGE_SIZE = 6;
  const totalMarketPages = Math.max(1, Math.ceil(filteredMarketplace.length / MARKET_PAGE_SIZE));
  const safeMarketPage = Math.min(marketPage, totalMarketPages);
  const pagedMarketplace = filteredMarketplace.slice(
    (safeMarketPage - 1) * MARKET_PAGE_SIZE,
    safeMarketPage * MARKET_PAGE_SIZE
  );

  const openSwapModal = (card: Photocard) => {
    setGiftMode(false);
    setTargetCard(card);
    setOfferedCardId(myCards[0]?.id || '');
    setTradeMessage(`Hola, me encantaría intercambiar por "${card.title}".`);
  };

  const openGiftModal = () => {
    setGiftMode(true);
    setTargetCard(null);
    setOfferedCardId(myCards[0]?.id || '');
    setTradeMessage('¡Te envío esta photocard de regalo para tu álbum!');
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offeredCardId) return;
    setSubmitting(true);
    try {
      if (giftMode) {
        await onProposeTrade({
          type: 'gift',
          fromUserId: currentUser.id,
          toUserId: giftRecipientId,
          offeredCardId,
          requestedCardId: offeredCardId,
          message: tradeMessage,
        });
        setGiftMode(false);
      } else if (targetCard) {
        await onProposeTrade({
          type: 'swap',
          fromUserId: currentUser.id,
          toUserId: targetCard.ownerId,
          offeredCardId,
          requestedCardId: targetCard.id,
          message: tradeMessage,
        });
        setTargetCard(null);
        onClearPreselected?.();
      }
      setTab('trades');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Gift & Push CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2.5">
            <Store className="w-6 h-6 text-sky-400" />
            <span>Mercado de Trueques e Intercambios</span>
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Publica tus cartas repetidas, busca intercambios seguros con verificación en tiempo real y descarga texturas, filtros y stickers de la comunidad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pushPermission !== 'unsupported' && pushPermission !== 'denied' && (
            <button
              type="button"
              disabled={pushTesting}
              onClick={() => {
                if (pushPermission === 'granted') {
                  void onTestPush?.();
                } else {
                  void onEnablePush?.();
                }
              }}
              className={`min-h-[44px] px-4 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 ${
                pushPermission === 'granted'
                  ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-white/5 border-white/10 text-sky-300 hover:bg-white/10'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>
                {pushTesting
                  ? 'Alerta push en 4s...'
                  : pushPermission === 'granted'
                  ? 'Probar Push 2º Plano'
                  : 'Activar Alertas Push'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setTab('bazaar');
              setShowMyListings((v) => !v);
            }}
            className={`min-h-[44px] px-4 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              showMyListings
                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
            }`}
          >
            <Tag className="w-4 h-4 text-sky-400" />
            <span>Mis Cartas en Mercado ({myListedCount})</span>
          </button>

          <button
            type="button"
            onClick={openGiftModal}
            disabled={myCards.length === 0}
            className="min-h-[44px] px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Gift className="w-4 h-4" />
            <span>Regalar una Card</span>
          </button>
        </div>
      </div>

      {/* Trade & Bazaar Live Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#131622] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">Intercambios Disponibles</div>
          <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-sky-400 mt-1">
            {communityTradeable.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {filteredMarketplace.length} según filtros · {myListedCount} tuyas
          </div>
        </div>
        <div className="bg-[#131622] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">Intercambios Pendientes</div>
          <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-amber-300 mt-1">
            {pendingTradesCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {incomingPendingCount > 0
              ? `${incomingPendingCount} por responder`
              : 'Sin respuestas pendientes'}
          </div>
        </div>
        <div className="bg-[#131622] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">Intercambios Completados</div>
          <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">
            {completedTradesCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {myCompletedTradesCount} completados contigo
          </div>
        </div>
        <div className="bg-[#131622] border border-white/10 rounded-2xl p-4">
          <div className="text-[11px] text-slate-400">Ofertas Tiempo Límite ⚡</div>
          <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-fuchsia-400 mt-1">
            {timedTradeCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Total historial: {trades.length}
          </div>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#131622] border border-white/10 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setTab('bazaar')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'bazaar' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Escaparate de Trueque ({communityTradeable.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('trades')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'trades' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Trueques y Regalos ({myRelatedTrades.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            tab === 'history' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Historial ({myHistoryTrades.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('assets')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'assets' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
          }`}
        >
          Texturas, Filtros y Stickers
        </button>
      </div>

      {/* TAB 1: Marketplace */}
      {tab === 'bazaar' && (
        <div className="space-y-6">
          {/* Seller Management Drawer for My Cards */}
          {showMyListings && (
            <div className="bg-[#131622] border border-sky-400/30 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Publicar o Retirar tus Cartas del Mercado
                  </h3>
                  <p className="text-xs text-slate-400">
                    Marca qué photocards aceptan ofertas de intercambio y escribe qué buscas a cambio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMyListings(false)}
                  className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {myCards.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Aún no tienes cartas en tu bóveda para publicar.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {myCards.map((card) => {
                    const wishValue =
                      wishNoteDrafts[card.id] !== undefined
                        ? wishNoteDrafts[card.id]
                        : card.tradeWishNote || '';
                    const catValue =
                      categoryDrafts[card.id] || card.tradeCategory || 'musica';
                    const durationVal = durationDrafts[card.id] ?? 0;
                    const computeExpiry = (hours: number) =>
                      hours > 0
                        ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
                        : undefined;
                    return (
                      <div
                        key={card.id}
                        className="p-3.5 rounded-2xl bg-[#0B0D14] border border-white/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={card.photoUrl}
                              alt={card.title}
                              referrerPolicy="no-referrer"
                              className="w-11 h-14 rounded-lg object-cover border border-white/15 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {card.title}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono-num">
                                {card.serialCode} · {getCommunityCategoryLabel(catValue)}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !card.tradeable;
                              void onToggleCardTradeable?.(
                                card.id,
                                nextState,
                                wishValue,
                                catValue,
                                nextState ? computeExpiry(durationVal) ?? card.tradeExpiresAt : undefined
                              );
                              onNotifyToast?.(
                                nextState
                                  ? `"${card.title}" publicada en el Mercado de Trueques.`
                                  : `"${card.title}" retirada del Mercado de Trueques.`
                              );
                            }}
                            className={`min-h-[34px] px-3 rounded-xl text-[11px] font-bold shrink-0 transition-colors ${
                              card.tradeable
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-white/10 text-slate-300 hover:bg-white/15'
                            }`}
                          >
                            {card.tradeable ? 'En Mercado' : 'Publicar'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={catValue}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => ({
                                ...prev,
                                [card.id]: e.target.value as CommunityCategory,
                              }))
                            }
                            aria-label="Categoría en mercado"
                            className="min-h-[34px] px-2.5 rounded-lg bg-[#131622] border border-white/10 text-[11px] text-white"
                          >
                            {COMMUNITY_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={durationVal}
                            onChange={(e) =>
                              setDurationDrafts((prev) => ({
                                ...prev,
                                [card.id]: Number(e.target.value),
                              }))
                            }
                            aria-label="Tiempo límite de publicación"
                            className="min-h-[34px] px-2.5 rounded-lg bg-[#131622] border border-white/10 text-[11px] text-white"
                          >
                            <option value={0}>Sin límite de tiempo</option>
                            <option value={1}>Límite 1 hora ⚡</option>
                            <option value={6}>Límite 6 horas</option>
                            <option value={24}>Límite 24 horas</option>
                            <option value={72}>Límite 3 días</option>
                          </select>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="¿Qué buscas a cambio? (ej. Cartas de giras 2025)"
                            value={wishValue}
                            onChange={(e) =>
                              setWishNoteDrafts((prev) => ({
                                ...prev,
                                [card.id]: e.target.value,
                              }))
                            }
                            className="flex-1 min-h-[34px] px-2.5 rounded-lg bg-[#131622] border border-white/10 text-[11px] text-white placeholder:text-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void onToggleCardTradeable?.(
                                card.id,
                                true,
                                wishValue.trim(),
                                catValue,
                                durationVal > 0 ? computeExpiry(durationVal) : card.tradeExpiresAt
                              );
                              onNotifyToast?.('Opciones de intercambio guardadas en el mercado.');
                            }}
                            className="min-h-[34px] px-3 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-bold"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Structured Bazaar Category, Rarity & Search Filter Panel */}
          <section
            aria-label="Panel de filtrado por categorías y rareza"
            className="bg-[#131622] border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-400 shrink-0" />
                <h3 className="font-display text-sm font-bold text-white">
                  Filtrar Intercambios del Bazaar
                </h3>
                <span className="font-mono-num px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[11px] font-bold text-sky-300">
                  {filteredMarketplace.length} / {communityTradeable.length} intercambios
                </span>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="min-h-[32px] px-3 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Categorías */}
              <div className="lg:col-span-6 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Categoría
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BAZAAR_CATEGORY_OPTIONS.map((cat) => {
                    const count = communityTradeable.filter((c) =>
                      matchesBazaarCategory(c, cat.id)
                    ).length;
                    const active = categoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(cat.id);
                          setMarketPage(1);
                        }}
                        className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100'
                            : 'bg-[#0B0D14] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className="font-mono-num text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rareza */}
              <div className="lg:col-span-6 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-amber-300" />
                  <span>Rareza</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RARITY_OPTIONS.map((rar) => {
                    const count =
                      rar.id === 'all'
                        ? communityTradeable.length
                        : communityTradeable.filter(
                            (c) => getCardRarity(c).tier === rar.id
                          ).length;
                    const active = rarityFilter === rar.id;
                    return (
                      <button
                        key={rar.id}
                        type="button"
                        onClick={() => {
                          setRarityFilter(rar.id);
                          setMarketPage(1);
                        }}
                        className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-[#0B0D14] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <span>{rar.label}</span>
                        <span className="font-mono-num text-[10px] opacity-75">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Availability, Sort & Search */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B0D14] border border-white/10 rounded-xl w-fit">
                {(
                  [
                    { id: 'all', label: 'Todo' },
                    { id: 'timed', label: `Tiempo Límite ⚡ (${timedTradeCount})` },
                    { id: 'friends', label: 'Solo Amigos' },
                  ] as const
                ).map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => {
                      setMarketFilter(flt.id);
                      setMarketPage(1);
                    }}
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                      marketFilter === flt.id
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#0B0D14] border border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSortBy('recent')}
                    className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                      sortBy === 'recent' ? 'bg-sky-500 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Recientes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('expiring')}
                    className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                      sortBy === 'expiring' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>Por Vencer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('popular')}
                    className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                      sortBy === 'popular' ? 'bg-fuchsia-400 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Populares</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar carta, dueño, serial..."
                    value={marketSearch}
                    onChange={(e) => {
                      setMarketSearch(e.target.value);
                      setMarketPage(1);
                    }}
                    className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {filteredMarketplace.length === 0 ? (
            <div className="bg-[#131622] border border-white/10 rounded-3xl p-10 text-center space-y-2">
              <Sparkles className="w-7 h-7 text-sky-400 mx-auto" />
              <div className="text-sm font-bold text-white">
                No hay cartas con ese filtro en el mercado
              </div>
              <p className="text-xs text-slate-400">
                Prueba otra categoría o rareza, o publica una de tus cartas repetidas.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pagedMarketplace.map((card) => {
                  const owner = findUser(card.ownerId);
                  const timer = formatRemainingTime(card.tradeExpiresAt, nowMs);
                  const catLabel = getCommunityCategoryLabel(getCardEffectiveCategory(card));
                  const rarity = getCardRarity(card);
                  return (
                    <div
                      key={card.id}
                      className="bg-[#131622] border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
                    >
                      <Card3D card={card} compact onCardClick={() => onInspectCard(card)} />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="truncate">
                            {catLabel} · <strong className="text-slate-200">{owner?.displayName}</strong>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${rarity.badgeClass}`}
                            >
                              {rarity.label}
                            </span>
                            <span className="font-mono-num text-sky-400">{card.serialCode}</span>
                          </div>
                        </div>

                        {timer.isTimed && (
                          <div
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono-num font-bold flex items-center justify-between ${
                              timer.expired
                                ? 'bg-rose-500/10 border-rose-400/30 text-rose-300'
                                : 'bg-amber-400/10 border-amber-400/30 text-amber-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Timer className="w-3.5 h-3.5" />
                              <span>Tiempo límite</span>
                            </span>
                            <span>{timer.label}</span>
                          </div>
                        )}

                        {card.tradeWishNote && (
                          <div className="px-3 py-2 rounded-xl bg-[#0B0D14] border border-amber-400/20 text-[11px] text-amber-200">
                            <span className="font-bold text-amber-300">Busca a cambio: </span>
                            {card.tradeWishNote}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectCard(card)}
                            className="min-h-[42px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                          >
                            Inspeccionar 3D
                          </button>
                          <button
                            type="button"
                            onClick={() => openSwapModal(card)}
                            disabled={myCards.length === 0 || timer.expired}
                            className="min-h-[42px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>{timer.expired ? 'Finalizada' : 'Proponer Trueque'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <PaginationControls
                currentPage={safeMarketPage}
                totalItems={filteredMarketplace.length}
                pageSize={MARKET_PAGE_SIZE}
                onPageChange={(p) => setMarketPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Active & Completed Trades */}
      {tab === 'trades' && (
        <div className="space-y-4">
          {myRelatedTrades.length === 0 ? (
            <div className="bg-[#131622] border border-white/10 rounded-3xl p-10 text-center text-sm text-slate-400">
              Aún no tienes solicitudes de trueque o regalos activos.
            </div>
          ) : (
            myRelatedTrades.map((tr) => {
              const fromUser = findUser(tr.fromUserId);
              const toUser = findUser(tr.toUserId);
              const reqCard = findCard(tr.requestedCardId);
              const offCard = findCard(tr.offeredCardId);
              const isIncomingPending = tr.toUserId === currentUser.id && tr.status === 'pending';

              return (
                <div
                  key={tr.id}
                  className="bg-[#131622] border border-white/10 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                      <span className="font-mono-num text-sky-300 font-semibold">
                        {tr.verificationCode}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300 font-semibold">
                        {tr.type === 'gift' ? 'Regalo directo' : 'Trueque bilateral'}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span
                        className={
                          tr.status === 'completed'
                            ? 'text-emerald-400 font-semibold'
                            : tr.status === 'declined'
                              ? 'text-rose-400 font-semibold'
                              : 'text-amber-300 font-semibold'
                        }
                      >
                        {tr.status === 'completed'
                          ? 'Completado y transferido'
                          : tr.status === 'declined'
                            ? 'Rechazado'
                            : 'Pendiente de confirmación'}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-white">
                      {fromUser?.displayName} → {toUser?.displayName}
                    </div>
                    <div className="text-xs text-slate-300">
                      {tr.type === 'gift'
                        ? `Carta regalada: "${offCard?.title || reqCard?.title}"`
                        : `Ofrece "${offCard?.title}" por "${reqCard?.title}"`}
                    </div>
                    <p className="text-xs text-slate-400 italic">“{tr.message}”</p>
                  </div>

                  {isIncomingPending && (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRespondTrade(tr.id, 'decline')}
                        className="min-h-[42px] px-4 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>Rechazar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRespondTrade(tr.id, 'accept')}
                        className="min-h-[42px] px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Verificar e Intercambiar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2B: Detailed Trade History with Date Filter */}
      {tab === 'history' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setHistoryStatusFilter('all')}
              className={`text-left bg-[#131622] border rounded-2xl p-4 transition-colors ${
                historyStatusFilter === 'all'
                  ? 'border-sky-400/60 ring-1 ring-sky-400/30'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <div className="text-[11px] text-slate-400">Total en tu Historial</div>
              <div className="font-mono-num text-2xl font-extrabold text-white mt-1">
                {myHistoryTrades.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {filteredHistoryTrades.length} mostrados ahora
              </div>
            </button>
            <button
              type="button"
              onClick={() => setHistoryStatusFilter('completed')}
              className={`text-left bg-[#131622] border rounded-2xl p-4 transition-colors ${
                historyStatusFilter === 'completed'
                  ? 'border-emerald-400/70 ring-1 ring-emerald-400/30'
                  : 'border-emerald-400/20 hover:border-emerald-400/45'
              }`}
            >
              <div className="text-[11px] text-emerald-300">Aceptados / Finalizados</div>
              <div className="font-mono-num text-2xl font-extrabold text-emerald-400 mt-1">
                {myCompletedTradesCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Intercambios y regalos exitosos
              </div>
            </button>
            <button
              type="button"
              onClick={() => setHistoryStatusFilter('declined')}
              className={`text-left bg-[#131622] border rounded-2xl p-4 transition-colors ${
                historyStatusFilter === 'declined'
                  ? 'border-rose-400/70 ring-1 ring-rose-400/30'
                  : 'border-rose-400/20 hover:border-rose-400/45'
              }`}
            >
              <div className="text-[11px] text-rose-300">Rechazados</div>
              <div className="font-mono-num text-2xl font-extrabold text-rose-400 mt-1">
                {myDeclinedTradesCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Solicitudes declinadas
              </div>
            </button>
            <button
              type="button"
              onClick={() => setHistoryStatusFilter('pending')}
              className={`text-left bg-[#131622] border rounded-2xl p-4 transition-colors ${
                historyStatusFilter === 'pending'
                  ? 'border-amber-400/70 ring-1 ring-amber-400/30'
                  : 'border-amber-400/20 hover:border-amber-400/45'
              }`}
            >
              <div className="text-[11px] text-amber-300">Pendientes</div>
              <div className="font-mono-num text-2xl font-extrabold text-amber-400 mt-1">
                {pendingTradesCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {incomingPendingCount > 0
                  ? `${incomingPendingCount} esperando tu respuesta`
                  : 'En espera de confirmación'}
              </div>
            </button>
          </div>

          {/* Trade Statistics Section */}
          <section
            aria-label="Estadísticas de trueque"
            className="bg-[#131622] border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Estadísticas de Trueques</span>
                    <span className="font-mono-num px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-300">
                      {tradeStats.acceptanceRate}% éxito
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Métricas de aceptación, balance de intercambios, tiempos de cierre y actividad temporal.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowHistoryStats((v) => !v)}
                className="min-h-[34px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 hover:border-white/25 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <span>{showHistoryStats ? 'Ocultar gráficos' : 'Ver estadísticas'}</span>
                {showHistoryStats ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>

            {showHistoryStats && (
              <div className="space-y-4 pt-2 border-t border-white/10">
                {/* 4 Analytical Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tasa de Aceptación</span>
                    </div>
                    <div className="font-mono-num text-xl font-extrabold text-emerald-400 mt-1">
                      {tradeStats.acceptanceRate}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {tradeStats.completedCount} de {tradeStats.resolvedCount} resueltos
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                      <span>Balance de Flujo</span>
                    </div>
                    <div className="font-mono-num text-xl font-extrabold text-sky-300 mt-1">
                      {tradeStats.sent} env · {tradeStats.received} rec
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {tradeStats.swaps} trueques · {tradeStats.gifts} regalos
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-amber-300" />
                      <span>Tiempo Medio de Cierre</span>
                    </div>
                    <div className="font-mono-num text-xl font-extrabold text-amber-300 mt-1">
                      {tradeStats.avgResolutionLabel}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Desde solicitud hasta resolución
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3.5">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>Socio Principal</span>
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-white truncate mt-1.5">
                      {tradeStats.topPartner?.user?.displayName || 'Sin registros'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {tradeStats.topPartner
                        ? `${tradeStats.topPartner.total} trueques (${tradeStats.topPartner.completed} aceptados)`
                        : 'Propón un intercambio para comenzar'}
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                {myHistoryTrades.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Bar Chart: Activity Over Time */}
                    <div className="lg:col-span-7 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white">
                            Actividad de Trueques por Fecha
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Aceptados, rechazados y pendientes según fecha de movimiento
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            Aceptados
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-400" />
                            Rechazados
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            Pendientes
                          </span>
                        </div>
                      </div>

                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={tradeStats.timelineData}
                            margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(255,255,255,0.07)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="periodo"
                              tick={{ fill: '#94A3B8', fontSize: 10 }}
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
                              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                              contentStyle={{
                                backgroundColor: '#131622',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#F8FAFC',
                              }}
                            />
                            <Bar
                              dataKey="aceptados"
                              name="Aceptados"
                              stackId="trades"
                              fill="#34D399"
                              radius={[0, 0, 0, 0]}
                              maxBarSize={32}
                            />
                            <Bar
                              dataKey="rechazados"
                              name="Rechazados"
                              stackId="trades"
                              fill="#FB7185"
                              radius={[0, 0, 0, 0]}
                              maxBarSize={32}
                            />
                            <Bar
                              dataKey="pendientes"
                              name="Pendientes"
                              stackId="trades"
                              fill="#FBBF24"
                              radius={[6, 6, 0, 0]}
                              maxBarSize={32}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Donut + Top Partners */}
                    <div className="lg:col-span-5 bg-[#0B0D14] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          Distribución de Resultados y Socios
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Proporción de estados y coleccionistas más activos contigo
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="h-36 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={tradeStats.statusPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={32}
                                outerRadius={54}
                                paddingAngle={4}
                                stroke="none"
                              >
                                {tradeStats.statusPieData.map((entry) => (
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

                        <div className="space-y-2">
                          {tradeStats.statusPieData.map((s) => {
                            const pct =
                              tradeStats.total > 0
                                ? Math.round((s.value / tradeStats.total) * 100)
                                : 0;
                            return (
                              <div
                                key={s.name}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="flex items-center gap-1.5 text-slate-300">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span>{s.name}</span>
                                </span>
                                <span className="font-mono-num font-bold text-white">
                                  {s.value} ({pct}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {tradeStats.topPartners.length > 0 && (
                        <div className="pt-2.5 border-t border-white/10 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Top Coleccionistas en Trueques
                          </div>
                          {tradeStats.topPartners.map((p) => (
                            <div
                              key={p.userId}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-5 h-5 rounded-full text-[10px] font-extrabold text-slate-950 flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: p.user?.avatarColor || '#38BDF8' }}
                                >
                                  {(p.user?.displayName || 'C').slice(0, 1).toUpperCase()}
                                </span>
                                <span className="text-slate-200 truncate">
                                  {p.user?.displayName || p.userId}
                                </span>
                              </span>
                              <span className="font-mono-num text-[11px] text-sky-300 font-semibold shrink-0">
                                {p.completed}/{p.total} aceptados
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Filter Bar: Visual Chip Status Selector + Date Presets + Custom Date Range + Search + CSV Export */}
          <section
            aria-label="Filtros del historial de trueques"
            className="bg-[#131622] border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-sky-400 shrink-0" />
                <h3 className="font-display text-sm font-bold text-white">
                  Historial Detallado de Trueques
                </h3>
                <span className="font-mono-num px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[11px] font-bold text-sky-300">
                  {filteredHistoryTrades.length} registros
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasHistoryFilters && (
                  <button
                    type="button"
                    onClick={resetHistoryFilters}
                    className="min-h-[34px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>Limpiar filtros</span>
                  </button>
                )}

                {hasHistoryFilters &&
                  filteredHistoryTrades.length > 0 &&
                  filteredHistoryTrades.length !== myHistoryTrades.length && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadHistoryCsv(filteredHistoryTrades, 'filtrado')
                      }
                      className="min-h-[34px] px-3 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-300" />
                      <span>CSV filtrado ({filteredHistoryTrades.length})</span>
                    </button>
                  )}

                <button
                  type="button"
                  disabled={myHistoryTrades.length === 0}
                  onClick={() =>
                    handleDownloadHistoryCsv(myHistoryTrades, 'completo')
                  }
                  className="min-h-[36px] px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Descargar CSV Completo ({myHistoryTrades.length})</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7 space-y-4">
                {/* Selector de filtros visuales tipo chip */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Filtrar por Estado
                  </div>
                  <div
                    role="group"
                    aria-label="Selector visual de estado de trueques"
                    className="flex flex-wrap items-center gap-2"
                  >
                    {(
                      [
                        {
                          id: 'all',
                          label: 'Todos',
                          count: myHistoryTrades.length,
                          icon: <Sparkles className="w-3.5 h-3.5" />,
                          activeClass:
                            'bg-sky-500 text-slate-950 border-sky-400 shadow-sm shadow-sky-500/25',
                          inactiveClass:
                            'bg-[#0B0D14] border-white/15 text-slate-200 hover:border-sky-400/50 hover:text-white',
                          countActiveClass: 'bg-slate-950/20 text-slate-950',
                          countInactiveClass: 'bg-white/10 text-slate-300',
                        },
                        {
                          id: 'completed',
                          label: 'Aceptados',
                          count: myCompletedTradesCount,
                          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                          activeClass:
                            'bg-emerald-400 text-slate-950 border-emerald-300 shadow-sm shadow-emerald-500/25',
                          inactiveClass:
                            'bg-emerald-500/10 border-emerald-400/25 text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/50',
                          countActiveClass: 'bg-slate-950/20 text-slate-950',
                          countInactiveClass: 'bg-emerald-400/15 text-emerald-300',
                        },
                        {
                          id: 'declined',
                          label: 'Rechazados',
                          count: myDeclinedTradesCount,
                          icon: <XCircle className="w-3.5 h-3.5" />,
                          activeClass:
                            'bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-500/25',
                          inactiveClass:
                            'bg-rose-500/10 border-rose-400/25 text-rose-200 hover:bg-rose-500/20 hover:border-rose-400/50',
                          countActiveClass: 'bg-black/25 text-white',
                          countInactiveClass: 'bg-rose-400/15 text-rose-300',
                        },
                        {
                          id: 'pending',
                          label: 'Pendientes',
                          count: pendingTradesCount,
                          icon: <Clock className="w-3.5 h-3.5" />,
                          activeClass:
                            'bg-amber-400 text-slate-950 border-amber-300 shadow-sm shadow-amber-500/25',
                          inactiveClass:
                            'bg-amber-400/10 border-amber-400/25 text-amber-200 hover:bg-amber-400/20 hover:border-amber-400/50',
                          countActiveClass: 'bg-slate-950/20 text-slate-950',
                          countInactiveClass: 'bg-amber-400/15 text-amber-300',
                        },
                      ] as const
                    ).map((chip) => {
                      const active = historyStatusFilter === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setHistoryStatusFilter(chip.id)}
                          className={`min-h-[38px] pl-3 pr-2.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            active ? chip.activeClass : chip.inactiveClass
                          }`}
                        >
                          {chip.icon}
                          <span>{chip.label}</span>
                          <span
                            className={`font-mono-num px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              active ? chip.countActiveClass : chip.countInactiveClass
                            }`}
                          >
                            {chip.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rango de fechas rápido */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>Atajos de Fecha</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'Todas las fechas' },
                        { id: 'today', label: 'Hoy' },
                        { id: '7d', label: 'Últimos 7 días' },
                        { id: '30d', label: 'Últimos 30 días' },
                        { id: 'custom', label: 'Rango en calendario' },
                      ] as const
                    ).map((preset) => {
                      const active = historyDatePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => selectHistoryDatePreset(preset.id)}
                          className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100'
                              : 'bg-[#0B0D14] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Date Inputs + Text Search */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <label className="space-y-1 text-xs">
                    <span className="text-slate-400 block">Desde</span>
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={(e) => {
                        setHistoryDateFrom(e.target.value);
                        setHistoryDatePreset('custom');
                      }}
                      aria-label="Filtrar historial desde fecha"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="text-slate-400 block">Hasta</span>
                    <input
                      type="date"
                      value={historyDateTo}
                      onChange={(e) => {
                        setHistoryDateTo(e.target.value);
                        setHistoryDatePreset('custom');
                      }}
                      aria-label="Filtrar historial hasta fecha"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                    />
                  </label>
                </div>

                <label className="space-y-1 text-xs block">
                  <span className="text-slate-400 block">Buscar en historial</span>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Código VER, carta, usuario..."
                      aria-label="Buscar en historial de trueques"
                      className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white placeholder:text-slate-500"
                    />
                  </div>
                </label>
              </div>

              {/* Simple Calendar Range Selector */}
              <div className="lg:col-span-5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Selector de Rango en Calendario</span>
                </div>
                <DateRangeCalendar
                  fromDate={historyDateFrom}
                  toDate={historyDateTo}
                  activeDateKeys={tradeActivityDateKeys}
                  onChangeRange={(from, to) => {
                    setHistoryDateFrom(from);
                    setHistoryDateTo(to);
                    setHistoryDatePreset('custom');
                  }}
                  onClear={() => selectHistoryDatePreset('all')}
                />
              </div>
            </div>
          </section>

          {/* Detailed History List */}
          {filteredHistoryTrades.length === 0 ? (
            <div className="bg-[#131622] border border-white/10 rounded-3xl p-10 text-center space-y-2">
              <History className="w-7 h-7 text-sky-400 mx-auto" />
              <div className="text-sm font-bold text-white">
                {myHistoryTrades.length === 0
                  ? 'Aún no tienes trueques finalizados o rechazados'
                  : 'No hay trueques en ese rango de fecha o filtro'}
              </div>
              <p className="text-xs text-slate-400">
                {myHistoryTrades.length === 0
                  ? 'Cuando aceptes, completes o rechaces un intercambio o regalo, aparecerá aquí con su fecha y código verificado.'
                  : 'Prueba seleccionando "Todas las fechas" o limpiando los filtros activos.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistoryTrades.map((tr) => {
                const fromUser = findUser(tr.fromUserId);
                const toUser = findUser(tr.toUserId);
                const offCard = findCard(tr.offeredCardId);
                const reqCard = findCard(tr.requestedCardId);
                const isCompleted = tr.status === 'completed';
                const isPending = tr.status === 'pending';
                const iWasRecipient = tr.toUserId === currentUser.id;
                const resolvedIso = tr.resolvedAt || tr.createdAt;
                const resolvedFormatted = new Date(resolvedIso).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const createdFormatted = new Date(tr.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                const statusLabel = isCompleted
                  ? tr.type === 'gift'
                    ? iWasRecipient
                      ? 'Regalo Recibido · Finalizado'
                      : 'Regalo Enviado · Finalizado'
                    : iWasRecipient
                      ? 'Aceptado por ti · Finalizado'
                      : 'Aceptado · Intercambio Finalizado'
                  : isPending
                    ? iWasRecipient
                      ? 'Pendiente · Por responder'
                      : 'Pendiente · Esperando respuesta'
                    : iWasRecipient
                      ? 'Rechazado por ti'
                      : 'Rechazado por destinatario';

                return (
                  <article
                    key={tr.id}
                    className={`bg-[#131622] border rounded-3xl p-5 space-y-4 ${
                      isCompleted
                        ? 'border-emerald-400/25'
                        : isPending
                          ? 'border-amber-400/30'
                          : 'border-rose-400/25'
                    }`}
                  >
                    {/* Top Metadata Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2.5 py-1 rounded-full border font-bold flex items-center gap-1.5 ${
                            isCompleted
                              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                              : isPending
                                ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                                : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : isPending ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{statusLabel}</span>
                        </span>

                        <span className="font-mono-num px-2.5 py-1 rounded-lg bg-[#0B0D14] border border-white/10 text-sky-300 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                          <span>{tr.verificationCode}</span>
                        </span>

                        <span className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 font-semibold">
                          {tr.type === 'gift' ? 'Regalo directo' : 'Trueque bilateral'}
                        </span>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 font-mono-num">
                        {isPending ? (
                          <div className="text-amber-200 font-semibold">
                            Enviado: {resolvedFormatted}
                          </div>
                        ) : (
                          <>
                            <div className="text-slate-200 font-semibold">
                              Cerrado: {resolvedFormatted}
                            </div>
                            <div>Solicitud: {createdFormatted}</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Participants & Exchanged Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-center">
                      {/* Offered Card */}
                      <div className="p-3 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center gap-3 min-w-0">
                        {offCard ? (
                          <img
                            src={offCard.photoUrl}
                            alt={offCard.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-16 rounded-xl object-cover border border-white/15 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {tr.type === 'gift' ? 'Regalo enviado por' : 'Carta ofrecida por'}{' '}
                            <span className="text-sky-300">
                              {fromUser?.id === currentUser.id
                                ? 'Ti'
                                : fromUser?.displayName || 'Coleccionista'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {offCard?.title || 'Carta no disponible'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono-num">
                              {offCard?.serialCode || tr.offeredCardId || '—'}
                            </span>
                            {offCard && (
                              <button
                                type="button"
                                onClick={() => onInspectCard(offCard)}
                                className="text-sky-400 hover:text-sky-300 font-semibold"
                              >
                                Ver 3D →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Connector */}
                      <div className="flex items-center justify-center">
                        <div
                          className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                            isCompleted
                              ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                              : isPending
                                ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                                : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                          }`}
                        >
                          {tr.type === 'gift' ? (
                            <Gift className="w-4 h-4" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Requested Card / Recipient */}
                      <div className="p-3 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center gap-3 min-w-0">
                        {tr.type === 'gift' ? (
                          <div
                            className="w-12 h-16 rounded-xl border border-white/15 flex items-center justify-center text-base font-extrabold text-slate-950 shrink-0"
                            style={{ backgroundColor: toUser?.avatarColor || '#38BDF8' }}
                          >
                            {(toUser?.displayName || 'F').slice(0, 1).toUpperCase()}
                          </div>
                        ) : reqCard ? (
                          <img
                            src={reqCard.photoUrl}
                            alt={reqCard.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-16 rounded-xl object-cover border border-white/15 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {tr.type === 'gift' ? 'Destinatario' : 'Carta solicitada a'}{' '}
                            <span className="text-fuchsia-300">
                              {toUser?.id === currentUser.id
                                ? 'Ti'
                                : toUser?.displayName || 'Coleccionista'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {tr.type === 'gift'
                              ? toUser?.displayName || 'Coleccionista'
                              : reqCard?.title || 'Carta no disponible'}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono-num">
                              {tr.type === 'gift'
                                ? toUser?.handle || ''
                                : reqCard?.serialCode || tr.requestedCardId}
                            </span>
                            {tr.type !== 'gift' && reqCard && (
                              <button
                                type="button"
                                onClick={() => onInspectCard(reqCard)}
                                className="text-sky-400 hover:text-sky-300 font-semibold"
                              >
                                Ver 3D →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Message & Pending Quick Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {tr.message ? (
                        <div className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl bg-[#0B0D14] border border-white/5 text-xs text-slate-300 italic">
                          “{tr.message}”
                        </div>
                      ) : (
                        <div />
                      )}

                      {isPending && iWasRecipient && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRespondTrade(tr.id, 'decline')}
                            className="min-h-[38px] px-3.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRespondTrade(tr.id, 'accept')}
                            className="min-h-[38px] px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aceptar e Intercambiar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Shared Community Textures, Filters & Stickers */}
      {tab === 'assets' && (
        <div className="space-y-6">
          {/* Community Custom Textures */}
          <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-300" />
                <span>Texturas Personalizadas de la Comunidad ({textures.length})</span>
              </h3>
              <button
                type="button"
                onClick={onUseInStudio}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300"
              >
                Crear / Subir en Estudio →
              </button>
            </div>
            {textures.length === 0 ? (
              <p className="text-xs text-slate-400">
                Aún no hay texturas compartidas. ¡Crea la primera desde el Estudio 3D!
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {textures.map((tex) => (
                  <div
                    key={tex.id}
                    className="rounded-2xl overflow-hidden bg-[#0B0D14] border border-white/10 flex flex-col justify-between"
                  >
                    <div>
                      <img
                        src={tex.imageUrl}
                        alt={tex.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-2.5">
                        <div className="text-xs font-bold text-white truncate">{tex.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Por {tex.authorName}
                        </div>
                      </div>
                    </div>
                    <div className="px-2.5 pb-2.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          void exportTextureImageAsPng(tex.imageUrl, tex.name);
                          onNotifyToast?.(`Textura "${tex.name}" exportada en PNG.`);
                        }}
                        className="flex-1 min-h-[30px] rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-semibold text-sky-300 flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
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
                      <button
                        type="button"
                        onClick={onUseInStudio}
                        className="min-h-[30px] px-2 rounded-lg bg-sky-500 text-slate-950 text-[10px] font-bold"
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-sky-400" />
                  <span>Filtros de la Comunidad</span>
                </h3>
                <button
                  type="button"
                  onClick={onUseInStudio}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  Abrir en Estudio →
                </button>
              </div>
              <div className="space-y-2.5">
                {filters.map((f) => (
                  <div
                    key={f.id}
                    className="p-3.5 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{f.name}</div>
                      <div className="text-xs text-slate-400">
                        Creado por {f.authorName} · Contraste {f.contrast}% · Saturación {f.saturate}%
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onUseInStudio}
                      className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                    >
                      Usar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Sticker className="w-5 h-5 text-fuchsia-400" />
                  <span>Stickers Compartidos</span>
                </h3>
                <button
                  type="button"
                  onClick={onOpenStickerStudio || onUseInStudio}
                  className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  Crear Sticker →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ...stickers.filter((s) => newStickerIds.includes(s.id)).reverse(),
                  ...stickers.filter((s) => !newStickerIds.includes(s.id)),
                ].map((s) => {
                  const isNew = newStickerIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={onUseInStudio}
                      className={`relative p-3 rounded-2xl border flex flex-col items-center gap-1.5 text-center transition-colors ${
                        isNew
                          ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/50'
                          : 'bg-[#0B0D14] border-white/10 hover:border-fuchsia-400/50'
                      }`}
                    >
                      {isNew && (
                        <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-extrabold">
                          NUEVO
                        </span>
                      )}
                      {s.isImage ? (
                        <img src={s.content} alt={s.name} className="w-9 h-9 object-contain" />
                      ) : s.content.length <= 2 ? (
                        <span className="text-2xl leading-none">{s.content}</span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-bold truncate max-w-full"
                          style={{
                            backgroundColor: s.bgColor || '#F59E0B',
                            color: s.textColor || '#0B0D14',
                          }}
                        >
                          {s.content}
                        </span>
                      )}
                      <span className={`text-xs font-semibold truncate w-full ${isNew ? 'text-emerald-200' : 'text-white'}`}>
                        {s.name}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate w-full">Por {s.authorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Propose Swap or Gift */}
      {(targetCard || giftMode) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitOffer}
            className="w-full max-w-md bg-[#131622] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">
                {giftMode ? 'Regalar Photocard' : `Intercambiar por "${targetCard?.title}"`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setTargetCard(null);
                  setGiftMode(false);
                  onClearPreselected?.();
                }}
                className="p-2 rounded-xl bg-white/5 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {giftMode && (
              <label className="block space-y-1 text-xs">
                <span className="text-slate-400">Destinatario (Amigo o Fan)</span>
                <select
                  value={giftRecipientId}
                  onChange={(e) => setGiftRecipientId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                >
                  {users
                    .filter((u) => u.id !== currentUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.handle})
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="block space-y-1 text-xs">
              <span className="text-slate-400">
                {giftMode ? 'Elige la carta que vas a regalar' : 'Tu carta para ofrecer a cambio'}
              </span>
              <select
                value={offeredCardId}
                onChange={(e) => setOfferedCardId(e.target.value)}
                required
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              >
                {myCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.serialCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-xs">
              <span className="text-slate-400">Mensaje de dedicatoria</span>
              <textarea
                rows={3}
                value={tradeMessage}
                onChange={(e) => setTradeMessage(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
            </label>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTargetCard(null);
                  setGiftMode(false);
                  onClearPreselected?.();
                }}
                className="min-h-[42px] px-4 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !offeredCardId}
                className="min-h-[42px] px-5 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold"
              >
                {submitting ? 'Enviando...' : giftMode ? 'Enviar Regalo Verificado' : 'Enviar Solicitud Segura'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
