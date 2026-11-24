import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BellRing,
  Check,
  Clock,
  Download,
  Filter,
  Flame,
  Gem,
  Gift,
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
  X,
} from 'lucide-react';
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
  const [tab, setTab] = useState<'bazaar' | 'trades' | 'assets'>('bazaar');
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

  const findUser = (id: string) => users.find((u) => u.id === id);
  const findCard = (id?: string) => cards.find((c) => c.id === id);

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
