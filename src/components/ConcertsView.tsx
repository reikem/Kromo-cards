import React, { useEffect, useState } from 'react';
import {
  Disc3,
  Download,
  ExternalLink,
  FolderPlus,
  Globe,
  Heart,
  ImagePlus,
  Link2,
  Lock,
  Music,
  Paintbrush,
  Plus,
  Sparkles,
  Square,
  Users,
  Volume2,
  Youtube,
} from 'lucide-react';
import type {
  Album,
  CollectorUser,
  CommunityCategory,
  ConcertBanner,
  CustomSticker,
  Photocard,
  VisibilityMode,
} from '../types/kromacard';
import { COMMUNITY_CATEGORIES, getCommunityCategoryLabel } from '../utils/frameShapes';
import { detectMusicPlatform, normalizeExternalUrl } from '../utils/mediaLinks';
import { AUDIO_PRESETS, soundEngine } from '../utils/soundEngine';
import { BannerCanvasModal } from './BannerCanvasModal';
import { ImageSourceSection } from './ImageSourceSection';

interface ConcertsViewProps {
  currentUser: CollectorUser;
  cards: Photocard[];
  albums: Album[];
  banners: ConcertBanner[];
  stickers?: CustomSticker[];
  autoOpenCanvas?: boolean;
  onClearAutoOpenCanvas?: () => void;
  onCreateAlbum: (album: Partial<Album>) => Promise<void>;
  onUpdateAlbumVisibility: (albumId: string, visibility: VisibilityMode) => Promise<void>;
  onCreateBanner: (banner: Partial<ConcertBanner>) => Promise<void>;
  onCreateCardFromBanner?: (draft: Partial<Photocard>) => void;
  onInspectCard: (card: Photocard) => void;
  onSelectAlbumFilter: (albumId: string) => void;
  onNotifyToast: (msg: string) => void;
}

export const ConcertsView: React.FC<ConcertsViewProps> = ({
  currentUser,
  cards,
  albums,
  banners,
  stickers = [],
  autoOpenCanvas = false,
  onClearAutoOpenCanvas,
  onCreateAlbum,
  onUpdateAlbumVisibility,
  onCreateBanner,
  onCreateCardFromBanner,
  onInspectCard,
  onSelectAlbumFilter,
  onNotifyToast,
}) => {
  const [ticketTilt, setTicketTilt] = useState({ x: 50, y: 50 });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [showCanvasEditor, setShowCanvasEditor] = useState(false);

  useEffect(() => {
    if (autoOpenCanvas) {
      setShowCanvasEditor(true);
      onClearAutoOpenCanvas?.();
    }
  }, [autoOpenCanvas, onClearAutoOpenCanvas]);

  // Album Form State
  const [albTitle, setAlbTitle] = useState('');
  const [albDesc, setAlbDesc] = useState('');
  const [albLocation, setAlbLocation] = useState('');
  const [albCategory, setAlbCategory] = useState<Album['category']>('concert');
  const [albVisibility, setAlbVisibility] = useState<VisibilityMode>('public');

  // Banner (Cartel) Form State
  const [banTitle, setBanTitle] = useState('');
  const [banTour, setBanTour] = useState('');
  const [banVenue, setBanVenue] = useState('');
  const [banDate, setBanDate] = useState('');
  const [banStory, setBanStory] = useState('');
  const [banReaction, setBanReaction] = useState('');
  const [banSong, setBanSong] = useState('Luces en el Cielo (Acústico)');
  const [banPresetId, setBanPresetId] = useState('acoustic-stadium');
  const [banYoutubeUrl, setBanYoutubeUrl] = useState('');
  const [banMusicUrl, setBanMusicUrl] = useState('');
  const [createCardToo, setCreateCardToo] = useState(true);
  const [banPhoto, setBanPhoto] = useState('/src/assets/images/handmade_fan_banner_1795353654555.jpg');
  const [banCategory, setBanCategory] = useState<CommunityCategory>('eventos');
  const [banVisibility, setBanVisibility] = useState<VisibilityMode>('public');

  const concertCards = cards.filter((c) => c.concert?.enabled);
  const featuredCard = concertCards[0] || cards[0];

  const handleToggleAudio = (id: string, presetId: string, customUrl?: string) => {
    if (playingId === id) {
      soundEngine.stopSnippet();
      setPlayingId(null);
    } else {
      setPlayingId(id);
      soundEngine.playSnippet(presetId, customUrl, () => setPlayingId(null));
    }
  };

  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albTitle.trim()) return;
    await onCreateAlbum({
      title: albTitle.trim(),
      description: albDesc.trim() || 'Colección personalizada en Kromacard.',
      location: albLocation.trim() || 'Ubicación del recuerdo',
      category: albCategory,
      visibility: albVisibility,
      ownerId: currentUser.id,
      coverPhotoUrl: featuredCard?.photoUrl || '/src/assets/images/kpop_concert_crowd_1795353654618.jpg',
    });
    setAlbTitle('');
    setAlbDesc('');
    setAlbLocation('');
    setShowAlbumForm(false);
    onNotifyToast('Álbum personalizado creado.');
  };

  const buildBannerCardDraft = (b: {
    title: string;
    artistOrTour: string;
    venue: string;
    date: string;
    photoUrl: string;
    story: string;
    songTitle: string;
    audioPresetId: string;
    youtubeUrl?: string;
    musicLinkUrl?: string;
    visibility: VisibilityMode;
  }): Partial<Photocard> => ({
    title: b.title,
    subtitle: b.artistOrTour || 'Cartel Conmemorativo 3D',
    ratingOrBadge: '99',
    categoryLabel: 'CARTEL',
    countryFlag: '🎤',
    location: b.venue || 'Estadio / Evento',
    eventDate: b.date || new Date().toLocaleDateString('es-ES'),
    editionLabel: 'Cartel Edición 3D',
    photoUrl: b.photoUrl,
    frameStyle: 'holo',
    primaryColor: '#38BDF8',
    secondaryColor: '#E879F9',
    texture: 'holo-prism-shards',
    shineIntensity: 85,
    authorMessage: b.story,
    youtubeUrl: b.youtubeUrl,
    musicLinkUrl: b.musicLinkUrl,
    musicPlatformLabel: b.musicLinkUrl ? detectMusicPlatform(b.musicLinkUrl) : undefined,
    visibility: b.visibility,
    concert: {
      enabled: true,
      tourName: b.artistOrTour || 'Concierto o Evento',
      artist: b.artistOrTour || 'Evento en Vivo',
      zone: 'Cartel Fan / Evento',
      access: 'Acceso General',
      seatOrRow: b.venue || 'Grada',
      dateTime: b.date || '',
      ticketCode: `BNR-${Math.floor(1000 + Math.random() * 9000)}`,
      favoriteSong: b.songTitle || 'Canción Favorita',
      audioPresetId: b.audioPresetId || 'acoustic-stadium',
    },
  });

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTitle.trim()) return;
    const bannerPayload: Partial<ConcertBanner> = {
      title: banTitle.trim(),
      artistOrTour: banTour.trim() || 'Concierto / Evento',
      venue: banVenue.trim() || 'Estadio / Recinto',
      date: banDate.trim() || new Date().toLocaleDateString('es-ES'),
      photoUrl: banPhoto,
      story: banStory.trim() || 'Cartel hecho con cariño para celebrar este momento especial.',
      idolReaction: banReaction.trim() || '¡Momento inolvidable frente al escenario!',
      songTitle: banSong.trim() || 'Canción del Encore',
      audioPresetId: banPresetId,
      youtubeUrl: banYoutubeUrl.trim() || undefined,
      musicLinkUrl: banMusicUrl.trim() || undefined,
      category: banCategory,
      visibility: banVisibility,
      ownerId: currentUser.id,
      ownerName: currentUser.displayName,
    };
    await onCreateBanner(bannerPayload);
    const savedCopy = {
      title: bannerPayload.title!,
      artistOrTour: bannerPayload.artistOrTour!,
      venue: bannerPayload.venue!,
      date: bannerPayload.date!,
      photoUrl: bannerPayload.photoUrl!,
      story: bannerPayload.story!,
      songTitle: bannerPayload.songTitle!,
      audioPresetId: bannerPayload.audioPresetId!,
      youtubeUrl: bannerPayload.youtubeUrl,
      musicLinkUrl: bannerPayload.musicLinkUrl,
      visibility: bannerPayload.visibility!,
    };
    setBanTitle('');
    setBanTour('');
    setBanVenue('');
    setBanStory('');
    setBanReaction('');
    setBanYoutubeUrl('');
    setBanMusicUrl('');
    setShowBannerForm(false);
    if (createCardToo && onCreateCardFromBanner) {
      onCreateCardFromBanner(buildBannerCardDraft(savedCopy));
      onNotifyToast('Cartel guardado y abierto en Estudio 3D como Photocard.');
    } else {
      onNotifyToast('Tu cartel de concierto o evento ha sido guardado.');
    }
  };

  const visibilityLabel = (v: VisibilityMode) => {
    if (v === 'public') return 'Público';
    if (v === 'friends') return 'Solo Amigos';
    return 'Privado';
  };

  const visibilityIcon = (v: VisibilityMode) => {
    if (v === 'public') return <Globe className="w-3.5 h-3.5 text-sky-400" />;
    if (v === 'friends') return <Users className="w-3.5 h-3.5 text-fuchsia-400" />;
    return <Lock className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div className="space-y-10">
      {/* 1. Active Holographic Ticket + Setlist Audio Moments */}
      {featuredCard?.concert?.enabled && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTicketTilt({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
            className="lg:col-span-6 relative rounded-3xl overflow-hidden border border-white/15 bg-[#131622] p-6 flex flex-col justify-between shadow-xl"
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-45 mix-blend-screen"
              style={{
                background: `radial-gradient(circle at ${ticketTilt.x}% ${ticketTilt.y}%, rgba(56,189,248,0.35), rgba(232,121,249,0.2) 35%, transparent 70%)`,
              }}
            />

            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-sky-400">
                  Boleto Holográfico Activo · {featuredCard.concert.tourName}
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white mt-1">
                  {featuredCard.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onInspectCard(featuredCard)}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white shrink-0"
              >
                Ver Card 3D
              </button>
            </div>

            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-4 my-6 pt-5 border-t border-dashed border-white/15">
              <div>
                <div className="text-[11px] text-slate-400">Zona y Acceso</div>
                <div className="text-sm font-semibold text-white mt-0.5">{featuredCard.concert.zone}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Ubicación</div>
                <div className="text-sm font-semibold text-white mt-0.5">{featuredCard.concert.seatOrRow}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Fecha</div>
                <div className="text-sm font-semibold text-white mt-0.5">{featuredCard.eventDate}</div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between gap-4 pt-3 border-t border-white/10">
              <div className="font-mono-num text-xs text-slate-300">
                {featuredCard.concert.ticketCode}
              </div>
              {/* Stylised Barcode SVG */}
              <div className="flex items-center gap-[2px] h-7 px-2.5 rounded-lg bg-white/95">
                {[3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3].map((w, idx) => (
                  <span
                    key={idx}
                    className="h-4 bg-slate-900"
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Favorite Setlist Moments */}
          <div className="lg:col-span-6 bg-[#131622] border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white mb-1">
                Momentos del Setlist y Audio en Vivo
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Escucha los fragmentos de canciones asociados a tus boletos y photocards.
              </p>
              <div className="space-y-3">
                {concertCards.slice(0, 3).map((c) => {
                  const isPlaying = playingId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAudio(
                            c.id,
                            c.concert?.audioPresetId || 'acoustic-stadium',
                            c.concert?.customAudioUrl
                          )
                        }
                        className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isPlaying
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-white/10 text-sky-400 hover:bg-white/15'
                        }`}
                      >
                        {isPlaying ? <Square className="w-4 h-4" /> : <Volume2 className="w-5 h-5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">
                          {c.concert?.favoriteSong}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {c.title} · {c.location}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onInspectCard(c)}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 shrink-0 px-2 py-1"
                      >
                        Abrir 3D
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Álbumes Personalizados con Visibilidad */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-white">
              Álbumes Personalizados
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Organiza tus giras, colecciones deportivas o recuerdos familiares y controla quién puede ver cada álbum.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAlbumForm((v) => !v)}
            className="min-h-[44px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Nuevo Álbum</span>
          </button>
        </div>

        {showAlbumForm && (
          <form
            onSubmit={handleSaveAlbum}
            className="bg-[#131622] border border-sky-400/30 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5"
          >
            <input
              type="text"
              required
              placeholder="Nombre del álbum (ej. Gira Verano 2025)"
              value={albTitle}
              onChange={(e) => setAlbTitle(e.target.value)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Ciudad o Estadio"
              value={albLocation}
              onChange={(e) => setAlbLocation(e.target.value)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Descripción breve"
              value={albDesc}
              onChange={(e) => setAlbDesc(e.target.value)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white md:col-span-2"
            />
            <select
              value={albCategory}
              onChange={(e) => setAlbCategory(e.target.value as Album['category'])}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            >
              <option value="concert">Concierto / Tour</option>
              <option value="idol">Ídolos / K-Pop</option>
              <option value="sports">Deportes / Fútbol</option>
              <option value="family">Familia y Amigos</option>
            </select>
            <select
              value={albVisibility}
              onChange={(e) => setAlbVisibility(e.target.value as VisibilityMode)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            >
              <option value="public">Visibilidad: Público</option>
              <option value="friends">Visibilidad: Solo Amigos</option>
              <option value="private">Visibilidad: Privado</option>
            </select>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAlbumForm(false)}
                className="min-h-[42px] px-4 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold"
              >
                Crear Álbum
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {albums.map((alb) => {
            const count = cards.filter((c) => c.albumId === alb.id).length;
            const isOwner = alb.ownerId === currentUser.id;
            return (
              <div
                key={alb.id}
                className="bg-[#131622] border border-white/10 rounded-3xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-40 bg-slate-900 overflow-hidden">
                    <img
                      src={alb.coverPhotoUrl}
                      alt={alb.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131622] via-black/25 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {alb.title}
                      </h3>
                      <span className="font-mono-num text-xs text-slate-200 shrink-0">
                        {count} {count === 1 ? 'card' : 'cards'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-xs text-slate-400">
                      {alb.location} · {alb.dateLabel}
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{alb.description}</p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  {isOwner ? (
                    <select
                      value={alb.visibility}
                      onChange={(e) =>
                        onUpdateAlbumVisibility(alb.id, e.target.value as VisibilityMode)
                      }
                      aria-label="Cambiar visibilidad del álbum"
                      className="min-h-[36px] px-2.5 rounded-lg bg-[#0B0D14] border border-white/10 text-xs text-slate-200"
                    >
                      <option value="public">Público</option>
                      <option value="friends">Solo Amigos</option>
                      <option value="private">Privado</option>
                    </select>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      {visibilityIcon(alb.visibility)}
                      <span>{visibilityLabel(alb.visibility)}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectAlbumFilter(alb.id)}
                    className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                  >
                    Abrir Álbum
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Carteles y Pancartas de Conciertos y Eventos */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-white">
              Carteles y Pancartas de Conciertos y Eventos
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Diseña carteles en el lienzo, sube fotos de tus pancartas y conviértelos en tu propia Photocard 3D con stickers, láminas HD, YouTube y QR.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCanvasEditor(true)}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold flex items-center gap-2 hover:opacity-95"
            >
              <Paintbrush className="w-4 h-4" />
              <span>Crear Cartel en Lienzo</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBannerForm((v) => !v)}
              className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Subir Foto de Cartel</span>
            </button>
          </div>
        </div>

        {showBannerForm && (
          <form
            onSubmit={handleSaveBanner}
            className="bg-[#131622] border border-fuchsia-400/30 rounded-3xl p-5 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <input
                type="text"
                required
                placeholder="Mensaje o título de tu cartel (ej. ¡Gracias por esta noche!)"
                value={banTitle}
                onChange={(e) => setBanTitle(e.target.value)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
              <input
                type="text"
                placeholder="Concierto, Artista o Evento (ej. Halloween Fest, Gira 2025)"
                value={banTour}
                onChange={(e) => setBanTour(e.target.value)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
              <input
                type="text"
                placeholder="Estadio, Salón o Recinto"
                value={banVenue}
                onChange={(e) => setBanVenue(e.target.value)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
              <input
                type="text"
                placeholder="Fecha del concierto o evento"
                value={banDate}
                onChange={(e) => setBanDate(e.target.value)}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
            </div>

            <ImageSourceSection
              title="Subir foto de tu cartel o pancarta hecha a mano"
              subtitle="Archivo local o Google Drive"
              compact
              onSelectImage={(dataUrl) => {
                setBanPhoto(dataUrl);
                onNotifyToast('Foto del cartel cargada.');
              }}
              onNotifyToast={onNotifyToast}
            />

            <textarea
              rows={2}
              placeholder="Cuenta la historia de tu cartel o del evento..."
              value={banStory}
              onChange={(e) => setBanStory(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
            <input
              type="text"
              placeholder="¿Cuál fue la reacción de tu ídolo o del público?"
              value={banReaction}
              onChange={(e) => setBanReaction(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="url"
                placeholder="Link de YouTube del momento (opcional)"
                value={banYoutubeUrl}
                onChange={(e) => setBanYoutubeUrl(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              />
              <input
                type="url"
                placeholder="Link de Spotify u otra plataforma musical (opcional)"
                value={banMusicUrl}
                onChange={(e) => setBanMusicUrl(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Canción asociada"
                value={banSong}
                onChange={(e) => setBanSong(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              />
              <select
                value={banPresetId}
                onChange={(e) => setBanPresetId(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              >
                {AUDIO_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <select
                value={banCategory}
                onChange={(e) => setBanCategory(e.target.value as CommunityCategory)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              >
                {COMMUNITY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={banVisibility}
                onChange={(e) => setBanVisibility(e.target.value as VisibilityMode)}
                className="min-h-[40px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
              >
                <option value="public">Público</option>
                <option value="friends">Solo Amigos</option>
                <option value="private">Privado</option>
              </select>
            </div>

            {onCreateCardFromBanner && (
              <label className="flex items-center gap-2.5 text-xs text-sky-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createCardToo}
                  onChange={(e) => setCreateCardToo(e.target.checked)}
                  className="w-4 h-4 accent-sky-400"
                />
                <span>
                  Abrir también como Photocard 3D en el Estudio (con láminas holográficas, stickers, QR y YouTube)
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBannerForm(false)}
                className="min-h-[42px] px-4 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-fuchsia-400 text-slate-950 text-xs font-bold"
              >
                Guardar Cartel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {banners.map((ban) => {
            const isPlaying = playingId === ban.id;
            return (
              <article
                key={ban.id}
                className="bg-[#131622] border border-white/10 rounded-3xl overflow-hidden flex flex-col"
              >
                <div className="relative h-60 bg-slate-900">
                  <img
                    src={ban.photoUrl}
                    alt={ban.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#131622] via-black/25 to-transparent" />
                  <div className="absolute bottom-4 left-5 right-5">
                    <div className="text-xs text-fuchsia-300 font-semibold">
                      {ban.artistOrTour} · {getCommunityCategoryLabel(ban.category)}
                    </div>
                    <h3 className="font-display text-xl font-bold text-white mt-0.5">
                      {ban.title}
                    </h3>
                    <div className="text-xs text-slate-300 mt-0.5">
                      {ban.venue} · {ban.date} · Por {ban.ownerName}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <p className="text-sm text-slate-200 leading-relaxed">{ban.story}</p>
                    <div className="p-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-amber-200">
                      <span className="font-semibold text-amber-400">Reacción vivida: </span>
                      {ban.idolReaction}
                    </div>

                    {(ban.youtubeUrl || ban.musicLinkUrl) && (
                      <div className="flex flex-wrap gap-2">
                        {ban.youtubeUrl && (
                          <a
                            href={normalizeExternalUrl(ban.youtubeUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Youtube className="w-3.5 h-3.5" />
                            <span>Ver en YouTube</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {ban.musicLinkUrl && (
                          <a
                            href={normalizeExternalUrl(ban.musicLinkUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{detectMusicPlatform(ban.musicLinkUrl)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleAudio(ban.id, ban.audioPresetId)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                        isPlaying
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-white/10 hover:bg-white/15 text-sky-300'
                      }`}
                    >
                      {isPlaying ? <Disc3 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                      <span className="truncate max-w-[150px]">{ban.songTitle}</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {onCreateCardFromBanner && (
                        <button
                          type="button"
                          onClick={() => onCreateCardFromBanner(buildBannerCardDraft(ban))}
                          className="min-h-[36px] px-3 rounded-lg bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 hover:opacity-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Photocard 3D</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = ban.photoUrl;
                          a.download = `${ban.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'cartel'}.png`;
                          a.click();
                          onNotifyToast('Cartel descargado para compartir.');
                        }}
                        className="min-h-[36px] px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>PNG</span>
                      </button>
                      <span className="flex items-center gap-1 text-xs text-slate-400 font-mono-num">
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        <span>{ban.likes}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showCanvasEditor && (
        <BannerCanvasModal
          currentUser={currentUser}
          stickers={stickers}
          onClose={() => setShowCanvasEditor(false)}
          onSaveBanner={onCreateBanner}
          onConvertToCard={onCreateCardFromBanner}
          onNotifyToast={onNotifyToast}
        />
      )}
    </div>
  );
};
