import React, { useMemo, useState } from 'react';
import {
  Clock,
  Flame,
  Heart,
  ImagePlus,
  Layers,
  Library,
  Paintbrush,
  Palette,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Sticker,
} from 'lucide-react';
import type {
  CollectorUser,
  CommunityCategory,
  ConcertBanner,
  CustomBackdrop,
  CustomFramePreset,
  CustomSticker,
  CustomTexture,
  LikableAssetKind,
  Photocard,
} from '../types/kromacard';
import {
  CELEBRATION_THEMES,
  COMMUNITY_CATEGORIES,
  FRAME_SHAPE_SPECS,
  getCommunityCategoryLabel,
  getFrameShapeClipPath,
} from '../utils/frameShapes';
import { Card3D } from './Card3D';
import { ImageSourceSection } from './ImageSourceSection';
import { PaginationControls } from './PaginationControls';

export type LibraryAssetSection =
  | 'all'
  | 'cards'
  | 'backdrops'
  | 'textures'
  | 'stickers'
  | 'banners'
  | 'frames';

interface CommunityLibraryViewProps {
  currentUser: CollectorUser;
  users: CollectorUser[];
  cards: Photocard[];
  backdrops: CustomBackdrop[];
  textures: CustomTexture[];
  stickers: CustomSticker[];
  banners: ConcertBanner[];
  frames: CustomFramePreset[];
  newStickerIds?: string[];
  onLikeAsset: (kind: LikableAssetKind, id: string) => Promise<void> | void;
  onCreateBackdrop: (backdrop: Partial<CustomBackdrop>) => Promise<CustomBackdrop>;
  onInspectCard: (card: Photocard) => void;
  onUseFrameInStudio: (frame: CustomFramePreset) => void;
  onUseBackdropInStudio: (backdrop: CustomBackdrop) => void;
  onUseTextureInStudio: (texture: CustomTexture) => void;
  onUseStickerInStudio: (sticker: CustomSticker) => void;
  onCreateCardFromBanner: (banner: ConcertBanner) => void;
  onOpenStudioTab: (tab: 'photo' | 'frame' | 'stickers' | 'back') => void;
  onOpenStickerStudio: () => void;
  onOpenBannerCreator: () => void;
  onNotifyToast: (msg: string) => void;
}

interface UnifiedLibraryItem {
  uid: string;
  kind: LikableAssetKind;
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  category: CommunityCategory;
  likes: number;
  createdAt: string;
  raw:
    | Photocard
    | CustomBackdrop
    | CustomTexture
    | CustomSticker
    | ConcertBanner
    | CustomFramePreset;
}

const PAGE_SIZE = 9;

export const CommunityLibraryView: React.FC<CommunityLibraryViewProps> = ({
  currentUser,
  users,
  cards,
  backdrops,
  textures,
  stickers,
  banners,
  frames,
  newStickerIds = [],
  onLikeAsset,
  onCreateBackdrop,
  onInspectCard,
  onUseFrameInStudio,
  onUseBackdropInStudio,
  onUseTextureInStudio,
  onUseStickerInStudio,
  onCreateCardFromBanner,
  onOpenStudioTab,
  onOpenStickerStudio,
  onOpenBannerCreator,
  onNotifyToast,
}) => {
  const [section, setSection] = useState<LibraryAssetSection>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CommunityCategory>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent'>('popular');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Share Backdrop inline drawer
  const [showBackdropForm, setShowBackdropForm] = useState(false);
  const [bgName, setBgName] = useState('');
  const [bgAtmosphere, setBgAtmosphere] = useState('');
  const [bgCategory, setBgCategory] = useState<CommunityCategory>('eventos');
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [savingBg, setSavingBg] = useState(false);

  const findUserName = (id: string, fallback = 'Coleccionista') =>
    users.find((u) => u.id === id)?.displayName || fallback;

  const unifiedItems = useMemo<UnifiedLibraryItem[]>(() => {
    const list: UnifiedLibraryItem[] = [];

    if (section === 'all' || section === 'cards') {
      cards.forEach((c) => {
        if (c.visibility !== 'public' && c.ownerId !== currentUser.id) return;
        list.push({
          uid: `card-${c.id}`,
          kind: 'card',
          id: c.id,
          title: c.title,
          subtitle: c.subtitle || c.location,
          authorName: findUserName(c.ownerId),
          category: c.tradeCategory || (c.concert?.enabled ? 'musica' : 'eventos'),
          likes: c.likes || 0,
          createdAt: c.createdAt,
          raw: c,
        });
      });
    }

    if (section === 'all' || section === 'backdrops') {
      backdrops.forEach((b) => {
        if (!b.isPublic && b.authorId !== currentUser.id) return;
        list.push({
          uid: `backdrop-${b.id}`,
          kind: 'backdrop',
          id: b.id,
          title: b.name,
          subtitle: b.atmosphere,
          authorName: b.authorName,
          category: b.category || 'eventos',
          likes: b.likes || 0,
          createdAt: b.createdAt,
          raw: b,
        });
      });
    }

    if (section === 'all' || section === 'textures') {
      textures.forEach((t) => {
        if (!t.isPublic && t.authorId !== currentUser.id) return;
        list.push({
          uid: `texture-${t.id}`,
          kind: 'texture',
          id: t.id,
          title: t.name,
          subtitle: `Patrón ${t.patternType}`,
          authorName: t.authorName,
          category: t.category || 'fantasia',
          likes: t.likes || 0,
          createdAt: t.createdAt,
          raw: t,
        });
      });
    }

    if (section === 'all' || section === 'stickers') {
      stickers.forEach((s) => {
        if (!s.isPublic && s.authorId !== currentUser.id) return;
        list.push({
          uid: `sticker-${s.id}`,
          kind: 'sticker',
          id: s.id,
          title: s.name,
          subtitle: s.isImage ? 'Sticker Ilustrado' : 'Sticker Tipográfico / Emoji',
          authorName: s.authorName,
          category: s.category || 'musica',
          likes: s.likes || 0,
          createdAt: s.createdAt || '2024-10-20T10:00:00.000Z',
          raw: s,
        });
      });
    }

    if (section === 'all' || section === 'banners') {
      banners.forEach((ban) => {
        if (ban.visibility !== 'public' && ban.ownerId !== currentUser.id) return;
        list.push({
          uid: `banner-${ban.id}`,
          kind: 'banner',
          id: ban.id,
          title: ban.title,
          subtitle: `${ban.artistOrTour} · ${ban.venue}`,
          authorName: ban.ownerName,
          category: ban.category || 'eventos',
          likes: ban.likes || 0,
          createdAt: ban.createdAt,
          raw: ban,
        });
      });
    }

    if (section === 'all' || section === 'frames') {
      frames.forEach((frm) => {
        if (!frm.isPublic && frm.authorId !== currentUser.id) return;
        const shapeLabel =
          FRAME_SHAPE_SPECS.find((s) => s.id === frm.frameShape)?.label || 'Clásico';
        list.push({
          uid: `frame-${frm.id}`,
          kind: 'frame',
          id: frm.id,
          title: frm.name,
          subtitle: `Forma ${shapeLabel}`,
          authorName: frm.authorName,
          category: frm.category || 'celebraciones',
          likes: frm.likes || 0,
          createdAt: frm.createdAt,
          raw: frm,
        });
      });
    }

    const q = search.trim().toLowerCase();
    const filtered = list.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q) {
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.authorName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'popular') {
        if (b.likes !== a.likes) return b.likes - a.likes;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [
    section,
    categoryFilter,
    sortBy,
    search,
    cards,
    backdrops,
    textures,
    stickers,
    banners,
    frames,
    currentUser.id,
    users,
  ]);

  const totalPages = Math.max(1, Math.ceil(unifiedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = unifiedItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSaveBackdrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgName.trim() || !bgImageUrl) {
      onNotifyToast('Agrega un nombre y una imagen para compartir el fondo.');
      return;
    }
    setSavingBg(true);
    try {
      await onCreateBackdrop({
        name: bgName.trim(),
        atmosphere: bgAtmosphere.trim() || 'Escenario compartido por la comunidad',
        category: bgCategory,
        imageUrl: bgImageUrl,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        isPublic: true,
      });
      setBgName('');
      setBgAtmosphere('');
      setBgImageUrl('');
      setShowBackdropForm(false);
      setSection('backdrops');
      setPage(1);
      onNotifyToast('Fondo compartido en la Biblioteca de la Comunidad.');
    } finally {
      setSavingBg(false);
    }
  };

  const SECTION_TABS: { id: LibraryAssetSection; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todo', icon: <Library className="w-3.5 h-3.5" /> },
    { id: 'cards', label: `Cromos (${cards.length})`, icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'backdrops', label: `Fondos (${backdrops.length})`, icon: <ImagePlus className="w-3.5 h-3.5" /> },
    { id: 'textures', label: `Texturas (${textures.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'stickers', label: `Stickers (${stickers.length})`, icon: <Sticker className="w-3.5 h-3.5" /> },
    { id: 'banners', label: `Carteles (${banners.length})`, icon: <Paintbrush className="w-3.5 h-3.5" /> },
    { id: 'frames', label: `Marcos y Formas (${frames.length})`, icon: <Shapes className="w-3.5 h-3.5" /> },
  ];

  const kindLabel = (kind: LikableAssetKind) => {
    switch (kind) {
      case 'card':
        return 'Cromo';
      case 'backdrop':
        return 'Fondo';
      case 'texture':
        return 'Textura';
      case 'sticker':
        return 'Sticker';
      case 'banner':
        return 'Cartel';
      case 'frame':
        return 'Marco';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Create Actions */}
      <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-semibold text-sky-400">
            Biblioteca Creativa de la Comunidad · {unifiedItems.length} creaciones disponibles
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cromos, Fondos, Texturas, Stickers, Carteles y Marcos
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Explora recursos creados y compartidos por todos los coleccionistas. Filtra por categoría, ordena por popularidad o más recientes y aplícalos directo en tu Estudio 3D.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenStudioTab('frame')}
            className="min-h-[40px] px-3.5 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
          >
            <Shapes className="w-3.5 h-3.5" />
            <span>Crear Marco / Textura</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBackdropForm((v) => !v)}
            className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Subir Fondo</span>
          </button>
          <button
            type="button"
            onClick={onOpenStickerStudio}
            className="min-h-[40px] px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Sticker className="w-3.5 h-3.5" />
            <span>Crear Sticker</span>
          </button>
          <button
            type="button"
            onClick={onOpenBannerCreator}
            className="min-h-[40px] px-3.5 rounded-xl bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Crear Cartel</span>
          </button>
        </div>
      </div>

      {/* Inline Share Backdrop Drawer */}
      {showBackdropForm && (
        <form
          onSubmit={handleSaveBackdrop}
          className="bg-[#131622] border border-sky-400/35 rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-white">
              Compartir Fondo para Cartas con la Comunidad
            </h3>
            <button
              type="button"
              onClick={() => setShowBackdropForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Nombre del fondo (ej. Noche Festival)"
              value={bgName}
              onChange={(e) => setBgName(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Descripción breve o atmósfera"
              value={bgAtmosphere}
              onChange={(e) => setBgAtmosphere(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
            />
            <select
              value={bgCategory}
              onChange={(e) => setBgCategory(e.target.value as CommunityCategory)}
              className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
            >
              {COMMUNITY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <ImageSourceSection
            title="Imagen del fondo (archivo o Google Drive)"
            subtitle="Se mostrará en las capas traseras del Estudio 3D y en esta Biblioteca"
            compact
            onSelectImage={(url) => setBgImageUrl(url)}
            onNotifyToast={onNotifyToast}
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={savingBg || !bgImageUrl}
              className="min-h-[40px] px-5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold disabled:opacity-50"
            >
              {savingBg ? 'Publicando...' : 'Publicar Fondo en Biblioteca'}
            </button>
          </div>
        </form>
      )}

      {/* Section Tabs (All / Cards / Backdrops / Textures / Stickers / Banners / Frames) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#131622] border border-white/10 rounded-2xl">
        {SECTION_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSection(t.id);
              setPage(1);
            }}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              section === t.id
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Category Filter, Sort & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131622] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setPage(1);
              }}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold ${
                categoryFilter === 'all'
                  ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todas las categorías
            </button>
            {COMMUNITY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat.id);
                  setPage(1);
                }}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold ${
                  categoryFilter === cat.id
                    ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Popular vs Recent Sort */}
          <div className="flex items-center gap-1 p-1 bg-[#131622] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSortBy('popular');
                setPage(1);
              }}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                sortBy === 'popular'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Más Populares</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy('recent');
                setPage(1);
              }}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                sortBy === 'recent'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recientes</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar título o autor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {pagedItems.length === 0 ? (
        <div className="bg-[#131622] border border-white/10 rounded-3xl p-12 text-center space-y-3">
          <Library className="w-8 h-8 text-sky-400 mx-auto" />
          <div className="text-base font-bold text-white">
            No se encontraron creaciones con ese filtro
          </div>
          <p className="text-xs text-slate-400">
            Prueba otra categoría, limpia la búsqueda o comparte tu propia creación.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pagedItems.map((item) => {
            if (item.kind === 'card') {
              const card = item.raw as Photocard;
              return (
                <article
                  key={item.uid}
                  className="bg-[#131622] border border-white/10 rounded-3xl p-4 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
                >
                  <Card3D
                    card={card}
                    compact
                    onCardClick={() => onInspectCard(card)}
                  />
                  <div className="space-y-2.5">
                    <div className="text-xs text-slate-400 truncate">
                      {kindLabel(item.kind)} · {getCommunityCategoryLabel(item.category)} · Por {item.authorName}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void onLikeAsset('card', card.id)}
                        className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs font-mono-num text-rose-300 flex items-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>{item.likes}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectCard(card)}
                        className="flex-1 min-h-[36px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold"
                      >
                        Ver en 3D
                      </button>
                    </div>
                  </div>
                </article>
              );
            }

            if (item.kind === 'frame') {
              const frm = item.raw as CustomFramePreset;
              const cel = CELEBRATION_THEMES.find((c) => c.id === frm.celebrationTheme);
              const clip = getFrameShapeClipPath(frm.frameShape);
              return (
                <article
                  key={item.uid}
                  className="bg-[#131622] border border-white/10 rounded-3xl p-5 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-20 h-28 rounded-2xl p-1.5 shrink-0 flex items-center justify-center shadow-lg overflow-hidden"
                      style={{
                        background: frm.frameImageUrl
                          ? `url(${frm.frameImageUrl}) center/cover no-repeat`
                          : `linear-gradient(135deg, ${frm.primaryColor}, ${frm.secondaryColor})`,
                        clipPath: clip,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#0B0D14]/80 rounded-xl flex flex-col items-center justify-center"
                        style={clip ? { clipPath: clip } : undefined}
                      >
                        <span className="text-2xl">{frm.frameImageUrl ? '🖼️' : cel?.emblem || '✨'}</span>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] font-semibold text-amber-300">
                        {kindLabel(item.kind)} · {getCommunityCategoryLabel(item.category)}
                      </div>
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {item.title}
                      </h3>
                      <div className="text-xs text-slate-400 truncate">
                        {item.subtitle} · {cel?.label || 'Estándar'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Por {item.authorName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => void onLikeAsset('frame', frm.id)}
                      className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs font-mono-num text-rose-300 flex items-center gap-1.5"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>{item.likes}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseFrameInStudio(frm)}
                      className="flex-1 min-h-[36px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Usar Marco en Estudio</span>
                    </button>
                  </div>
                </article>
              );
            }

            if (item.kind === 'sticker') {
              const stk = item.raw as CustomSticker;
              const isNew = newStickerIds.includes(stk.id);
              return (
                <article
                  key={item.uid}
                  className={`rounded-3xl p-5 border flex flex-col justify-between gap-4 transition-colors ${
                    isNew
                      ? 'bg-emerald-500/10 border-emerald-400/50'
                      : 'bg-[#131622] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center justify-center shrink-0">
                      {stk.isImage ? (
                        <img
                          src={stk.content}
                          alt={stk.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 object-contain"
                        />
                      ) : stk.content.length <= 2 ? (
                        <span className="text-3xl">{stk.content}</span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-bold"
                          style={{
                            backgroundColor: stk.bgColor || '#F59E0B',
                            color: stk.textColor || '#0B0D14',
                          }}
                        >
                          {stk.content}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] font-semibold text-emerald-300">
                        {kindLabel(item.kind)} · {getCommunityCategoryLabel(item.category)}
                      </div>
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {item.title}
                      </h3>
                      <div className="text-xs text-slate-400 truncate">
                        Por {item.authorName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => void onLikeAsset('sticker', stk.id)}
                      className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs font-mono-num text-rose-300 flex items-center gap-1.5"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>{item.likes}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseStickerInStudio(stk)}
                      className="flex-1 min-h-[36px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Sticker className="w-3.5 h-3.5" />
                      <span>Añadir en Estudio 3D</span>
                    </button>
                  </div>
                </article>
              );
            }

            // backdrop, texture, or banner -> visual image card
            const imageUrl =
              item.kind === 'backdrop'
                ? (item.raw as CustomBackdrop).imageUrl
                : item.kind === 'texture'
                  ? (item.raw as CustomTexture).imageUrl
                  : (item.raw as ConcertBanner).photoUrl;

            return (
              <article
                key={item.uid}
                className="bg-[#131622] border border-white/10 rounded-3xl overflow-hidden flex flex-col justify-between hover:border-white/20 transition-colors"
              >
                <div>
                  <div className="relative h-40 bg-slate-900">
                    <img
                      src={imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131622] via-black/20 to-transparent" />
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="text-[11px] font-semibold text-sky-400">
                      {kindLabel(item.kind)} · {getCommunityCategoryLabel(item.category)}
                    </div>
                    <h3 className="font-display text-base font-bold text-white truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{item.subtitle}</p>
                    <div className="text-[11px] text-slate-500">Por {item.authorName}</div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void onLikeAsset(item.kind, item.id)}
                    className="min-h-[36px] px-3 rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 text-xs font-mono-num text-rose-300 flex items-center gap-1.5"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>{item.likes}</span>
                  </button>

                  {item.kind === 'backdrop' && (
                    <button
                      type="button"
                      onClick={() => onUseBackdropInStudio(item.raw as CustomBackdrop)}
                      className="flex-1 min-h-[36px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold"
                    >
                      Usar Fondo en Estudio
                    </button>
                  )}
                  {item.kind === 'texture' && (
                    <button
                      type="button"
                      onClick={() => onUseTextureInStudio(item.raw as CustomTexture)}
                      className="flex-1 min-h-[36px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold"
                    >
                      Aplicar Textura 3D
                    </button>
                  )}
                  {item.kind === 'banner' && (
                    <button
                      type="button"
                      onClick={() => onCreateCardFromBanner(item.raw as ConcertBanner)}
                      className="flex-1 min-h-[36px] rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold"
                    >
                      Convertir en Card 3D
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls
        currentPage={safePage}
        totalItems={unifiedItems.length}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
};
