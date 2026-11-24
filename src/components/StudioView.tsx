import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  Check,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  HelpCircle,
  Link2,
  Mic,
  Music,
  Palette,
  PenTool,
  Plus,
  QrCode,
  Save,
  Sliders,
  Sticker,
  Ticket,
  Trash2,
  Undo2,
  Upload,
  Youtube,
} from 'lucide-react';
import type {
  Album,
  CardStat,
  CelebrationTheme,
  CollectorUser,
  CommunityCategory,
  CustomBackdrop,
  CustomFramePreset,
  CustomSticker,
  CustomTexture,
  FrameShape,
  FrameStyle,
  ImageFilterConfig,
  Photocard,
  PlacedSticker,
  TextureEffect,
  VisibilityMode,
} from '../types/kromacard';
import { COMMUNITY_CATEGORIES } from '../utils/frameShapes';
import { HOLO_TEXTURE_COLLECTION } from '../utils/holoTextures';
import {
  detectMusicPlatform,
  extractYouTubeId,
  generateLinkQRDataUrl,
  normalizeExternalUrl,
} from '../utils/mediaLinks';
import { AUDIO_PRESETS } from '../utils/soundEngine';
import { STADIUM_BACKDROPS } from '../utils/stadiumBackdrops';
import {
  PRESET_STICKER_LIBRARY,
  STICKER_CATEGORIES,
  type StickerCategoryId,
} from '../utils/stickerLibrary';
import { renderCardFrontDataUrl } from '../utils/cardExporter';
import {
  downloadSvgDataUrl,
  isSvgDataUrl,
  SIGNATURE_INK_COLORS,
  SIGNATURE_VIEWBOX_HEIGHT,
  SIGNATURE_VIEWBOX_WIDTH,
  strokesToSvgDataUrl,
  strokeToSvgPathD,
  type SvgStroke,
} from '../utils/svgSignature';
import { Card3D, type DroppedStickerPayload } from './Card3D';
import { CustomFrameStudio } from './CustomFrameStudio';
import { CustomTextureStudio, exportTextureImageAsPng } from './CustomTextureStudio';
import { DriveExportButton } from './DriveExportButton';
import { ImageSourceSection } from './ImageSourceSection';
import { StudioTutorial } from './StudioTutorial';

export type StudioTab = 'photo' | 'frame' | 'details' | 'stickers' | 'back';

interface StudioViewProps {
  currentUser: CollectorUser;
  albums: Album[];
  filters: ImageFilterConfig[];
  stickers: CustomSticker[];
  textures: CustomTexture[];
  frames?: CustomFramePreset[];
  backdrops?: CustomBackdrop[];
  newStickerIds?: string[];
  initialTab?: StudioTab;
  editingCard?: Photocard | null;
  onSaveCard: (card: Partial<Photocard>) => Promise<void>;
  onCreateFilter: (filter: Partial<ImageFilterConfig>) => Promise<ImageFilterConfig>;
  onCreateTexture: (texture: Partial<CustomTexture>) => Promise<CustomTexture>;
  onCreateFrame?: (frame: Partial<CustomFramePreset>) => Promise<CustomFramePreset>;
  onOpenStickerCreator: (cardDraft: Photocard) => void;
  onNotifyToast: (msg: string) => void;
}

const DEFAULT_PHOTO = '/src/assets/images/concert_stage_vocalist_1795353654776.jpg';

const FRAME_OPTIONS: { id: FrameStyle; label: string; desc: string }[] = [
  { id: 'holo', label: 'Holo Prisma', desc: 'Tornasol arcoíris' },
  { id: 'gold', label: 'Dorado Edición', desc: 'Lámina oro 24k' },
  { id: 'stadium', label: 'Estadio Neón', desc: 'Degradado club' },
  { id: 'custom', label: 'Color Libre', desc: 'Elige tus colores' },
  { id: 'polaroid', label: 'Polaroid', desc: 'Borde clásico' },
];

const QUICK_COLORS = [
  '#38BDF8',
  '#E879F9',
  '#F59E0B',
  '#10B981',
  '#F43F5E',
  '#6366F1',
  '#1E293B',
  '#F8FAFC',
];

export const StudioView: React.FC<StudioViewProps> = ({
  currentUser,
  albums,
  filters,
  stickers,
  textures,
  frames = [],
  backdrops = [],
  newStickerIds = [],
  initialTab = 'photo',
  editingCard,
  onSaveCard,
  onCreateFilter,
  onCreateTexture,
  onCreateFrame,
  onOpenStickerCreator,
  onNotifyToast,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>(
    initialTab === 'back' ? 'back' : 'front'
  );
  const [saving, setSaving] = useState(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kromacard_studio_tour_v1_seen') !== '1';
    } catch {
      return true;
    }
  });
  const [autoSpinDemo, setAutoSpinDemo] = useState(false);

  // Card Fields
  const [title, setTitle] = useState(editingCard?.title || 'Mi Recuerdo Especial');
  const [subtitle, setSubtitle] = useState(editingCard?.subtitle || 'Gira en Vivo · Momento Único');
  const [ratingOrBadge, setRatingOrBadge] = useState(editingCard?.ratingOrBadge || '99');
  const [categoryLabel, setCategoryLabel] = useState(editingCard?.categoryLabel || 'FAN');
  const [countryFlag, setCountryFlag] = useState(editingCard?.countryFlag || '✨');
  const [location, setLocation] = useState(editingCard?.location || 'Estadio Nacional');
  const [eventDate, setEventDate] = useState(
    editingCard?.eventDate || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  );
  const [editionLabel, setEditionLabel] = useState(editingCard?.editionLabel || 'Edición Única #01');
  const [photoUrl, setPhotoUrl] = useState(editingCard?.photoUrl || DEFAULT_PHOTO);
  const [albumId, setAlbumId] = useState(editingCard?.albumId || albums[0]?.id || 'alb-spheres');
  const [visibility, setVisibility] = useState<VisibilityMode>(editingCard?.visibility || 'public');
  const [tradeable, setTradeable] = useState(editingCard?.tradeable ?? true);
  const [tradeCategory, setTradeCategory] = useState<CommunityCategory>(
    editingCard?.tradeCategory || 'musica'
  );
  const [tradeDurationHours, setTradeDurationHours] = useState<number>(0);

  // Frame, Shape, Celebration & Shader
  const [frameStyle, setFrameStyle] = useState<FrameStyle>(editingCard?.frameStyle || 'holo');
  const [frameShape, setFrameShape] = useState<FrameShape>(editingCard?.frameShape || 'rectangulo');
  const [customFrameId, setCustomFrameId] = useState<string | undefined>(editingCard?.customFrameId);
  const [frameCelebration, setFrameCelebration] = useState<CelebrationTheme>(
    editingCard?.frameCelebration || 'ninguna'
  );
  const [primaryColor, setPrimaryColor] = useState(editingCard?.primaryColor || '#38BDF8');
  const [secondaryColor, setSecondaryColor] = useState(editingCard?.secondaryColor || '#E879F9');
  const [texture, setTexture] = useState<TextureEffect>(editingCard?.texture || 'prism');
  const [customTextureUrl, setCustomTextureUrl] = useState<string | undefined>(
    editingCard?.customTextureUrl
  );
  const [shineIntensity, setShineIntensity] = useState(editingCard?.shineIntensity ?? 82);

  // Filter State + Custom Filter Builder
  const [selectedFilter, setSelectedFilter] = useState<ImageFilterConfig>(
    editingCard?.filterSnapshot || filters[0]
  );
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [shareFilterPublic, setShareFilterPublic] = useState(true);

  // Stickers + Categorized Drag Library
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>(editingCard?.stickers || []);
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategoryId | 'comunidad'>('all');

  // Back of Card: Stats, Autograph, Author Note, Concert & Audio
  const [stats, setStats] = useState<CardStat[]>(
    editingCard?.stats?.length
      ? editingCard.stats
      : [
          { label: 'EMOCIÓN', value: 98 },
          { label: 'MÚSICA', value: 96 },
          { label: 'ENERGÍA', value: 95 },
          { label: 'RECUERDO', value: 100 },
        ]
  );
  const [authorMessage, setAuthorMessage] = useState(
    editingCard?.authorMessage || 'Guardado en Kromacard para recordar cada detalle de este día.'
  );
  const [autographDataUrl, setAutographDataUrl] = useState<string | undefined>(
    editingCard?.autographDataUrl
  );
  const [backBackdropUrl, setBackBackdropUrl] = useState<string>(
    editingCard?.backBackdropUrl || ''
  );

  // Concert Ticket & Audio
  const [concertEnabled, setConcertEnabled] = useState(editingCard?.concert?.enabled ?? true);
  const [tourName, setTourName] = useState(editingCard?.concert?.tourName || 'World Tour 2025');
  const [artist, setArtist] = useState(editingCard?.concert?.artist || 'Artista Favorito');
  const [zone, setZone] = useState(editingCard?.concert?.zone || 'Pista VIP');
  const [access, setAccess] = useState(editingCard?.concert?.access || 'Puerta A');
  const [seatOrRow, setSeatOrRow] = useState(editingCard?.concert?.seatOrRow || 'Fila 02 · Asiento 14');
  const [ticketCode, setTicketCode] = useState(
    editingCard?.concert?.ticketCode || `TKT-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [favoriteSong, setFavoriteSong] = useState(
    editingCard?.concert?.favoriteSong || 'Luces en el Cielo (Acústico)'
  );
  const [audioPresetId, setAudioPresetId] = useState(
    editingCard?.concert?.audioPresetId || 'acoustic-stadium'
  );
  const [customAudioUrl, setCustomAudioUrl] = useState<string | undefined>(
    editingCard?.concert?.customAudioUrl
  );
  const [customAudioTitle, setCustomAudioTitle] = useState<string | undefined>(
    editingCard?.concert?.customAudioTitle
  );
  const [youtubeUrl, setYoutubeUrl] = useState(editingCard?.youtubeUrl || '');
  const [musicLinkUrl, setMusicLinkUrl] = useState(editingCard?.musicLinkUrl || '');
  const [musicQrPreviewUrl, setMusicQrPreviewUrl] = useState('');
  const [holoCategory, setHoloCategory] = useState<'all' | 'clasico' | 'festivo'>('all');
  const [requestedTextureMode, setRequestedTextureMode] = useState<'create' | 'camera' | 'upload'>('create');
  const [requestedTextureNonce, setRequestedTextureNonce] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // SVG Signature Pad State & Ref
  const sigSvgRef = useRef<SVGSVGElement>(null);
  const isDrawingRef = useRef(false);
  const [svgStrokes, setSvgStrokes] = useState<SvgStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<SvgStroke | null>(null);
  const [sigInkColor, setSigInkColor] = useState<string>(SIGNATURE_INK_COLORS[0].hex);

  useEffect(() => {
    let active = true;
    const target = musicLinkUrl.trim() || youtubeUrl.trim();
    if (!target) {
      setMusicQrPreviewUrl('');
      return;
    }
    void generateLinkQRDataUrl(target)
      .then((url) => {
        if (active) setMusicQrPreviewUrl(url);
      })
      .catch(() => {
        if (active) setMusicQrPreviewUrl('');
      });
    return () => {
      active = false;
    };
  }, [musicLinkUrl, youtubeUrl]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
        onNotifyToast('Foto cargada en el lienzo 3D.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomAudioUrl(reader.result);
        setCustomAudioTitle(file.name.replace(/\.[^.]+$/, ''));
        setFavoriteSong(file.name.replace(/\.[^.]+$/, ''));
        onNotifyToast('Fragmento de audio adjuntado desde tu dispositivo.');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleMicRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setCustomAudioUrl(reader.result);
            setCustomAudioTitle('Audio grabado en vivo');
            onNotifyToast('Audio en vivo guardado en la tarjeta.');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, 12000);
    } catch {
      onNotifyToast('Permiso de micrófono no disponible; puedes subir un archivo de audio o elegir un tema.');
    }
  };

  const handleSaveCustomFilter = async () => {
    const name = newFilterName.trim() || `Filtro ${currentUser.displayName.split(' ')[0]}`;
    const created = await onCreateFilter({
      ...selectedFilter,
      name,
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      isPublic: shareFilterPublic,
    });
    setSelectedFilter(created);
    setNewFilterName('');
    setShowFilterBuilder(false);
    onNotifyToast(
      shareFilterPublic
        ? `Filtro "${created.name}" creado y compartido con la comunidad.`
        : `Filtro "${created.name}" guardado en tu estudio.`
    );
  };

  const handleAddSticker = (
    stk: {
      id: string;
      name: string;
      content: string;
      isImage: boolean;
      bgColor?: string;
      textColor?: string;
    },
    dropX?: number,
    dropY?: number
  ) => {
    const placed: PlacedSticker = {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      stickerId: stk.id,
      name: stk.name,
      content: stk.content,
      isImage: stk.isImage,
      x: dropX ?? 50 + Math.round((Math.random() - 0.5) * 30),
      y: dropY ?? 35 + Math.round((Math.random() - 0.5) * 24),
      scale: 1,
      rotation: 0,
      bgColor: stk.bgColor,
      textColor: stk.textColor,
    };
    setPlacedStickers((prev) => [...prev, placed]);
    setPreviewSide('front');
  };

  const handleStickerDropOnCard = (
    payload: DroppedStickerPayload,
    x: number,
    y: number
  ) => {
    handleAddSticker(
      {
        id: payload.stickerId,
        name: payload.name,
        content: payload.content,
        isImage: payload.isImage,
        bgColor: payload.bgColor,
        textColor: payload.textColor,
      },
      x,
      y
    );
    onNotifyToast(`Sticker "${payload.name}" colocado en la tarjeta 3D.`);
  };

  // SVG Signature drawing handlers
  const getSvgPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = sigSvgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = Math.min(
      SIGNATURE_VIEWBOX_WIDTH,
      Math.max(0, ((e.clientX - rect.left) / Math.max(1, rect.width)) * SIGNATURE_VIEWBOX_WIDTH)
    );
    const y = Math.min(
      SIGNATURE_VIEWBOX_HEIGHT,
      Math.max(0, ((e.clientY - rect.top) / Math.max(1, rect.height)) * SIGNATURE_VIEWBOX_HEIGHT)
    );
    return { x, y };
  };

  const startDrawing = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!sigSvgRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture issues
    }
    isDrawingRef.current = true;
    const pt = getSvgPoint(e);
    setActiveStroke({
      points: [pt],
      color: sigInkColor,
      width: 3,
    });
  };

  const drawMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current || !sigSvgRef.current) return;
    const pt = getSvgPoint(e);
    setActiveStroke((prev) => {
      if (!prev) return prev;
      const last = prev.points[prev.points.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) {
        return prev;
      }
      return { ...prev, points: [...prev.points, pt] };
    });
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setActiveStroke((current) => {
      if (current && current.points.length > 0) {
        setSvgStrokes((prev) => {
          const next = [...prev, current];
          setAutographDataUrl(strokesToSvgDataUrl(next));
          return next;
        });
      }
      return null;
    });
  };

  const undoSignatureStroke = () => {
    setSvgStrokes((prev) => {
      const next = prev.slice(0, -1);
      setAutographDataUrl(next.length > 0 ? strokesToSvgDataUrl(next) : undefined);
      return next;
    });
  };

  const clearSignature = () => {
    setActiveStroke(null);
    setSvgStrokes([]);
    setAutographDataUrl(undefined);
  };

  const handleDownloadSignatureSvg = () => {
    if (!autographDataUrl || !isSvgDataUrl(autographDataUrl)) {
      onNotifyToast('Dibuja una firma vectorial primero para descargarla en SVG.');
      return;
    }
    const ok = downloadSvgDataUrl(autographDataUrl, `${title || 'firma'}-autografo`);
    if (ok) {
      onNotifyToast('Autógrafo descargado en formato vectorial .SVG.');
    }
  };

  const previewCard: Photocard = {
    id: editingCard?.id || 'preview-card',
    serialCode: editingCard?.serialCode || 'KRM-NEW-01',
    ownerId: currentUser.id,
    creatorId: currentUser.id,
    albumId,
    visibility,
    tradeable,
    tradeCategory,
    tradeExpiresAt:
      tradeable && tradeDurationHours > 0
        ? new Date(Date.now() + tradeDurationHours * 3600 * 1000).toISOString()
        : editingCard?.tradeExpiresAt,
    title,
    subtitle,
    ratingOrBadge,
    categoryLabel,
    countryFlag,
    location,
    eventDate,
    editionLabel,
    photoUrl,
    frameStyle,
    frameShape,
    customFrameId,
    frameCelebration,
    primaryColor,
    secondaryColor,
    texture,
    customTextureUrl,
    shineIntensity,
    filterId: selectedFilter.id,
    filterSnapshot: selectedFilter,
    stickers: placedStickers,
    stats,
    autographDataUrl,
    backBackdropUrl: backBackdropUrl || undefined,
    authorMessage,
    youtubeUrl: youtubeUrl.trim() || undefined,
    musicLinkUrl: musicLinkUrl.trim() || undefined,
    musicPlatformLabel: musicLinkUrl.trim() ? detectMusicPlatform(musicLinkUrl) : undefined,
    concert: {
      enabled: concertEnabled,
      tourName,
      artist,
      zone,
      access,
      seatOrRow,
      dateTime: eventDate,
      ticketCode,
      favoriteSong,
      audioPresetId,
      customAudioUrl,
      customAudioTitle,
    },
    likes: editingCard?.likes || 0,
    createdAt: editingCard?.createdAt || new Date().toISOString(),
  };

  const handleSave = async () => {
    if (!title.trim()) {
      onNotifyToast('Escribe un título o nombre para tu photocard.');
      return;
    }
    setSaving(true);
    try {
      await onSaveCard({
        ...previewCard,
        id: editingCard?.id,
        serialCode: editingCard?.serialCode,
      });
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
    { id: 'photo', label: 'Foto y Filtros', icon: <Sliders className="w-4 h-4" /> },
    { id: 'frame', label: 'Marco y Brillo', icon: <Palette className="w-4 h-4" /> },
    { id: 'details', label: 'Datos y Lugar', icon: <Camera className="w-4 h-4" /> },
    { id: 'stickers', label: 'Stickers', icon: <Sticker className="w-4 h-4" /> },
    { id: 'back', label: 'Reverso y Audio', icon: <PenTool className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Live 3D Card Stage */}
      <div
        id="studio-3d-preview-stage"
        className="lg:col-span-5 lg:sticky lg:top-24 relative overflow-hidden bg-[#131622] border border-white/10 rounded-3xl p-6 flex flex-col items-center scroll-mt-24"
      >
        {backBackdropUrl && (
          <>
            <img
              src={backBackdropUrl}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#0B0D14]/75 via-[#0B0D14]/45 to-[#131622]/95 pointer-events-none"
              aria-hidden="true"
            />
          </>
        )}

        <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Vista Previa 3D</h2>
            <p className="text-xs text-slate-400">
              {previewSide === 'front'
                ? 'Arrastra stickers sobre la foto o inclina la tarjeta'
                : 'Reverso con estadísticas, autógrafo y QR'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowTutorial((v) => !v)}
              title="Abrir guía rápida interactiva"
              className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                showTutorial
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                  : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Guía 3D</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSide((s) => (s === 'front' ? 'back' : 'front'))}
              className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
              <span>{previewSide === 'front' ? 'Ver Reverso' : 'Ver Anverso'}</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 w-full">
          <Card3D
            card={previewCard}
            rotateY={previewSide === 'back' ? 180 : 0}
            autoSpin={autoSpinDemo}
            onStickerDrag={(stickerId, x, y) => {
              setPlacedStickers((prev) =>
                prev.map((s) => (s.id === stickerId ? { ...s, x, y } : s))
              );
            }}
            onStickerDrop={handleStickerDropOnCard}
          />
        </div>

        <div className="relative z-10 mt-6 w-full flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : editingCard ? 'Actualizar Photocard' : 'Guardar en mi Colección'}</span>
          </button>

          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0B0D14]/80 border border-white/10">
            <span className="text-[11px] text-slate-300 font-medium pl-1">
              Respalda tu carta en la nube
            </span>
            <DriveExportButton
              source={() => renderCardFrontDataUrl(previewCard)}
              fileNameBase={`card-${title || 'kromacard'}`}
              description={`Photocard 3D "${title}" exportada desde Kromacard Studio`}
              label="Guardar Card en Drive"
              onNotifyToast={onNotifyToast}
            />
          </div>
        </div>
      </div>

      {/* Right: Studio Controls */}
      <div className="lg:col-span-7 space-y-5">
        <StudioTutorial
          open={showTutorial}
          onClose={(markSeen) => {
            setShowTutorial(false);
            setAutoSpinDemo(false);
            if (markSeen) {
              try {
                localStorage.setItem('kromacard_studio_tour_v1_seen', '1');
              } catch {
                // ignore storage errors
              }
            }
          }}
          onJumpTab={(t) => {
            setActiveTab(t);
            setPreviewSide(t === 'back' ? 'back' : 'front');
          }}
          onFlipPreview={(side) => setPreviewSide(side)}
          onSetDemoSpin={(spinning) => setAutoSpinDemo(spinning)}
        />

        {/* Tab Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'back') setPreviewSide('back');
                else setPreviewSide('front');
              }}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 border transition-colors ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-[#131622] text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Photo & Filters */}
        {activeTab === 'photo' && (
          <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-6">
            <ImageSourceSection
              title="Sube tu foto (dispositivo o Google Drive)"
              subtitle="JPG, PNG o WebP en alta calidad"
              onSelectImage={(dataUrl) => {
                setPhotoUrl(dataUrl);
                onNotifyToast('Foto cargada en el lienzo 3D.');
              }}
              onNotifyToast={onNotifyToast}
            />

            <div className="p-3.5 rounded-2xl bg-emerald-500/[0.08] border border-emerald-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Capturar textura del anverso con tu cámara</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Toma una foto en vivo sin cargar archivos y úsala directamente sobre el frente de tu carta 3D.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('frame');
                  setPreviewSide('front');
                  setRequestedTextureMode('camera');
                  setRequestedTextureNonce((n) => n + 1);
                  window.setTimeout(() => {
                    document
                      .getElementById('studio-textures-panel')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 120);
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Abrir Cámara para Anverso</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0B0D14] border border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={photoUrl}
                  alt="Foto actual de tu photocard"
                  referrerPolicy="no-referrer"
                  className="w-11 h-14 rounded-lg object-cover border border-white/15 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Foto activa de la tarjeta
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Expórtala directamente a tu carpeta de Google Drive
                  </div>
                </div>
              </div>
              <DriveExportButton
                source={photoUrl}
                fileNameBase={`foto-${title || 'photocard'}`}
                description={`Foto de photocard "${title}" exportada desde Kromacard`}
                label="Guardar Foto en Drive"
                onNotifyToast={onNotifyToast}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-display text-base font-bold text-white">
                  Filtros de imagen y comunidad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFilterBuilder((v) => !v)}
                  className="min-h-[38px] px-3 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Filtro Propio</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filters.map((flt) => (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setSelectedFilter(flt)}
                    className={`min-h-[52px] p-3 rounded-xl text-left border transition-colors ${
                      selectedFilter.id === flt.id
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{flt.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">Por {flt.authorName}</div>
                  </button>
                ))}
              </div>
            </div>

            {showFilterBuilder && (
              <div className="p-4 rounded-2xl bg-[#0B0D14] border border-sky-400/30 space-y-3">
                <div className="text-xs font-bold text-sky-300">
                  Laboratorio de Filtro Personalizado
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="flex justify-between text-slate-300">
                      <span>Brillo</span>
                      <span className="font-mono-num">{selectedFilter.brightness}%</span>
                    </span>
                    <input
                      type="range"
                      min={50}
                      max={160}
                      value={selectedFilter.brightness}
                      onChange={(e) =>
                        setSelectedFilter((f) => ({ ...f, id: 'custom-draft', brightness: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between text-slate-300">
                      <span>Contraste</span>
                      <span className="font-mono-num">{selectedFilter.contrast}%</span>
                    </span>
                    <input
                      type="range"
                      min={60}
                      max={180}
                      value={selectedFilter.contrast}
                      onChange={(e) =>
                        setSelectedFilter((f) => ({ ...f, id: 'custom-draft', contrast: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between text-slate-300">
                      <span>Saturación</span>
                      <span className="font-mono-num">{selectedFilter.saturate}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={selectedFilter.saturate}
                      onChange={(e) =>
                        setSelectedFilter((f) => ({ ...f, id: 'custom-draft', saturate: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between text-slate-300">
                      <span>Matiz (Hue)</span>
                      <span className="font-mono-num">{selectedFilter.hueRotate}°</span>
                    </span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={selectedFilter.hueRotate}
                      onChange={(e) =>
                        setSelectedFilter((f) => ({ ...f, id: 'custom-draft', hueRotate: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between text-slate-300">
                      <span>Sepia Vintage</span>
                      <span className="font-mono-num">{selectedFilter.sepia}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedFilter.sepia}
                      onChange={(e) =>
                        setSelectedFilter((f) => ({ ...f, id: 'custom-draft', sepia: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-400"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Nombre de tu filtro (ej. Neón Estadio)"
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomFilter}
                    className="min-h-[42px] px-4 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar Filtro</span>
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareFilterPublic}
                    onChange={(e) => setShareFilterPublic(e.target.checked)}
                    className="accent-sky-400"
                  />
                  <span>Compartir este filtro con toda la comunidad</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Frame & Shine */}
        {activeTab === 'frame' && (
          <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="font-display text-base font-bold text-white mb-3">
                Estilo de Marco
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {FRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFrameStyle(opt.id);
                      if (opt.id === 'polaroid') setFrameShape('polaroid');
                      else if (frameShape === 'polaroid') setFrameShape('rectangulo');
                    }}
                    className={`min-h-[56px] p-3 rounded-xl text-left border transition-colors ${
                      frameStyle === opt.id
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {onCreateFrame && (
              <CustomFrameStudio
                currentUser={currentUser}
                frames={frames}
                activeShape={frameShape}
                activeCelebration={frameCelebration}
                activePrimaryColor={primaryColor}
                activeSecondaryColor={secondaryColor}
                activeCustomFrameId={customFrameId}
                onSelectShape={(nextShape) => {
                  setFrameShape(nextShape);
                  if (nextShape === 'polaroid') setFrameStyle('polaroid');
                  else if (frameStyle === 'polaroid') setFrameStyle('custom');
                }}
                onApplyFramePreset={(preset) => {
                  setFrameShape(preset.frameShape);
                  setFrameCelebration(preset.celebrationTheme);
                  setPrimaryColor(preset.primaryColor);
                  setSecondaryColor(preset.secondaryColor);
                  setCustomFrameId(preset.id);
                  setFrameStyle(preset.frameShape === 'polaroid' ? 'polaroid' : 'custom');
                  setPreviewSide('front');
                }}
                onCreateFrame={onCreateFrame}
                onNotifyToast={onNotifyToast}
              />
            )}

            <div>
              <h3 className="font-display text-sm font-bold text-white mb-2.5">
                Colores del marco y detalles
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">Color principal</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs text-slate-400">{primaryColor}</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => {
                        setPrimaryColor(e.target.value);
                        if (frameStyle !== 'stadium') setFrameStyle('custom');
                      }}
                      className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">Color secundario</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-xs text-slate-400">{secondaryColor}</span>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => {
                        setSecondaryColor(e.target.value);
                        if (frameStyle !== 'stadium') setFrameStyle('custom');
                      }}
                      className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {QUICK_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(hex);
                      setFrameStyle('custom');
                    }}
                    aria-label={`Color ${hex}`}
                    className="w-8 h-8 rounded-full border border-white/25 transition-transform hover:scale-110"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span>Efecto de brillo holográfico en tiempo real</span>
                <span className="font-mono-num text-amber-400 font-bold">{shineIntensity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={shineIntensity}
                onChange={(e) => setShineIntensity(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div id="studio-textures-panel" className="space-y-5 scroll-mt-24">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Textura base</span>
                {customTextureUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomTextureUrl(undefined)}
                    className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold"
                  >
                    Quitar textura personalizada activa
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  [
                    { id: 'prism', label: 'Prisma' },
                    { id: 'stadium', label: 'Estadio' },
                    { id: 'gold-relief', label: 'Oro' },
                    { id: 'carbon', label: 'Carbono' },
                    { id: 'none', label: 'Mate' },
                  ] as { id: TextureEffect; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setCustomTextureUrl(undefined);
                      setTexture(t.id);
                    }}
                    className={`min-h-[40px] rounded-xl text-xs font-semibold border ${
                      !customTextureUrl && texture === t.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Texture Creator, Camera Capture, Uploader (incl. Google Drive) & PNG Exporter */}
            <CustomTextureStudio
              currentUser={currentUser}
              textures={textures}
              activeCustomTextureUrl={customTextureUrl}
              requestedMode={requestedTextureMode}
              requestedModeNonce={requestedTextureNonce}
              onApplyTextureUrl={(imageUrl) => {
                setCustomTextureUrl(imageUrl);
                setPreviewSide('front');
              }}
              onApplyFrontPhotoUrl={(imageUrl) => {
                setPhotoUrl(imageUrl);
                setPreviewSide('front');
              }}
              onCreateTexture={onCreateTexture}
              onNotifyToast={onNotifyToast}
            />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-fuchsia-300">
                  Láminas Holográficas HD (Estadio, Fiestas, Halloween, Navidad y San Valentín)
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: `Todas (${HOLO_TEXTURE_COLLECTION.length})` },
                      { id: 'clasico', label: 'Clásicas' },
                      { id: 'festivo', label: 'Fiestas y Fechas' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setHoloCategory(cat.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                        holoCategory === cat.id
                          ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {(holoCategory === 'all'
                  ? HOLO_TEXTURE_COLLECTION
                  : HOLO_TEXTURE_COLLECTION.filter((h) => h.category === holoCategory)
                ).map((holo) => {
                  const selected = !customTextureUrl && texture === holo.id;
                  return (
                    <div
                      key={holo.id}
                      className={`group rounded-2xl overflow-hidden border text-left transition-all ${
                        selected
                          ? 'border-sky-400 ring-2 ring-sky-400/40 bg-sky-500/10'
                          : 'border-white/10 bg-[#0B0D14] hover:border-white/25'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCustomTextureUrl(undefined);
                          setTexture(holo.id);
                        }}
                        className="w-full text-left"
                      >
                        <div className="relative h-20 w-full overflow-hidden bg-black">
                          <img
                            src={holo.imageUrl}
                            alt={holo.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {selected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 pb-1">
                          <div className="text-[11px] font-bold text-white truncate">
                            {holo.label}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {holo.subtitle}
                          </div>
                        </div>
                      </button>
                      <div className="px-2 pb-2 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            void exportTextureImageAsPng(holo.imageUrl, holo.label);
                            onNotifyToast(`Lámina "${holo.label}" exportada en PNG.`);
                          }}
                          className="min-h-[26px] rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-sky-300 flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>PNG</span>
                        </button>
                        <DriveExportButton
                          compact
                          source={holo.imageUrl}
                          fileNameBase={`lamina-${holo.label}`}
                          description={`Lámina holográfica "${holo.label}" de Kromacard`}
                          label="Drive"
                          onNotifyToast={onNotifyToast}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-sky-300">
                  Fondos y Escenarios 3D ({Array.from(
                    new Map(
                      [
                        ...backdrops.map((b) => ({
                          id: b.id,
                          name: b.name,
                          imageUrl: b.imageUrl,
                          atmosphere: b.atmosphere,
                        })),
                        ...STADIUM_BACKDROPS.map((b) => ({
                          id: b.id,
                          name: b.label,
                          imageUrl: b.imageUrl,
                          atmosphere: b.atmosphere,
                        })),
                      ].map((item) => [item.imageUrl, item])
                    ).values()
                  ).length} disponibles)
                </span>
                {backBackdropUrl && (
                  <button
                    type="button"
                    onClick={() => setBackBackdropUrl('')}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Quitar fondo trasero
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {Array.from(
                  new Map(
                    [
                      ...backdrops.map((b) => ({
                        id: b.id,
                        name: b.name,
                        imageUrl: b.imageUrl,
                        atmosphere: b.atmosphere,
                      })),
                      ...STADIUM_BACKDROPS.map((b) => ({
                        id: b.id,
                        name: b.label,
                        imageUrl: b.imageUrl,
                        atmosphere: b.atmosphere,
                      })),
                    ].map((item) => [item.imageUrl, item])
                  ).values()
                ).map((bg) => {
                  const selectedBack = backBackdropUrl === bg.imageUrl;
                  const selectedFront = customTextureUrl === bg.imageUrl;
                  return (
                    <div
                      key={bg.id}
                      className={`group rounded-2xl overflow-hidden border text-left transition-all ${
                        selectedBack || selectedFront
                          ? 'border-sky-400 ring-2 ring-sky-400/40 bg-sky-500/10'
                          : 'border-white/10 bg-[#0B0D14] hover:border-white/25'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setBackBackdropUrl(selectedBack ? '' : bg.imageUrl);
                          setPreviewSide('back');
                        }}
                        className="w-full text-left"
                      >
                        <div className="relative h-20 w-full overflow-hidden bg-black">
                          <img
                            src={bg.imageUrl}
                            alt={bg.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {(selectedBack || selectedFront) && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 pb-1">
                          <div className="text-[11px] font-bold text-white truncate">
                            {bg.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {bg.atmosphere}
                          </div>
                        </div>
                      </button>
                      <div className="px-2 pb-2 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBackBackdropUrl(selectedBack ? '' : bg.imageUrl);
                            setPreviewSide('back');
                          }}
                          className={`min-h-[26px] rounded-lg text-[10px] font-semibold transition-colors ${
                            selectedBack
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-white/5 hover:bg-white/10 text-sky-300'
                          }`}
                        >
                          Reverso
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTextureUrl(selectedFront ? undefined : bg.imageUrl);
                            setPreviewSide('front');
                          }}
                          className={`min-h-[26px] rounded-lg text-[10px] font-semibold transition-colors ${
                            selectedFront
                              ? 'bg-fuchsia-400 text-slate-950'
                              : 'bg-white/5 hover:bg-white/10 text-fuchsia-300'
                          }`}
                        >
                          Anverso
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Details, Location, Dates, Album, Visibility */}
        {activeTab === 'details' && (
          <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-white">
              Textos, Lugar y Privacidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Nombre / Ídolo / Título</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Subtítulo / Momento</span>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Donde fue tomada / ingresada</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej. Estadio River Plate, Buenos Aires"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Fecha del recuerdo</span>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="Ej. 25 Oct 2024"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-xs">
                  <span className="text-slate-400">Media / #</span>
                  <input
                    type="text"
                    value={ratingOrBadge}
                    onChange={(e) => setRatingOrBadge(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white font-mono-num"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-slate-400">Rol / Pos</span>
                  <input
                    type="text"
                    value={categoryLabel}
                    onChange={(e) => setCategoryLabel(e.target.value.toUpperCase())}
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-slate-400">Bandera</span>
                  <input
                    type="text"
                    value={countryFlag}
                    onChange={(e) => setCountryFlag(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white text-center"
                  />
                </label>
              </div>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Sello de edición</span>
                <input
                  type="text"
                  value={editionLabel}
                  onChange={(e) => setEditionLabel(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Álbum destino</span>
                <select
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-slate-400">Visibilidad de la photocard</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as VisibilityMode)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                >
                  <option value="public">Público (Toda la comunidad)</option>
                  <option value="friends">Solo Amigos conectados</option>
                  <option value="private">Privado (Solo tú)</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-200 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={tradeable}
                onChange={(e) => setTradeable(e.target.checked)}
                className="w-4 h-4 accent-sky-400"
              />
              <span>Permitir propuestas de intercambio / trueque en el Mercado</span>
            </label>

            {tradeable && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <label className="space-y-1 text-xs">
                  <span className="text-slate-400">Categoría en Mercado y Biblioteca</span>
                  <select
                    value={tradeCategory}
                    onChange={(e) => setTradeCategory(e.target.value as CommunityCategory)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                  >
                    {COMMUNITY_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs">
                  <span className="text-slate-400">Tiempo límite de oferta</span>
                  <select
                    value={tradeDurationHours}
                    onChange={(e) => setTradeDurationHours(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
                  >
                    <option value={0}>Sin tiempo límite</option>
                    <option value={1}>Oferta relámpago · 1 hora</option>
                    <option value={6}>Por tiempo limitado · 6 horas</option>
                    <option value={24}>Por tiempo limitado · 24 horas</option>
                    <option value={72}>Por tiempo limitado · 3 días</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Categorized Sticker Library (Drag & Drop) + Custom Sticker Builder */}
        {activeTab === 'stickers' && (
          <div
            id="studio-stickers-drag-panel"
            className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-5 scroll-mt-24"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Biblioteca de Stickers (Arrastra a la Tarjeta 3D)
                </h3>
                <p className="text-xs text-slate-400">
                  Arrastra cualquier sticker sobre la vista previa 3D para soltarlo donde quieras, o tócalo para añadirlo al instante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStickerCreator(previewCard)}
                className="min-h-[40px] px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Sticker Nuevo</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B0D14] border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setStickerCategory('all')}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  stickerCategory === 'all'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Todos ({PRESET_STICKER_LIBRARY.length + stickers.length})
              </button>
              {STICKER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setStickerCategory(cat.id)}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    stickerCategory === cat.id
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              {stickers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStickerCategory('comunidad')}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                    stickerCategory === 'comunidad'
                      ? 'bg-sky-500 text-slate-950'
                      : newStickerIds.length > 0
                        ? 'text-emerald-300 hover:text-emerald-200'
                        : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>Comunidad y Propios ({stickers.length})</span>
                  {newStickerIds.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 text-[9px] font-extrabold">
                      +{newStickerIds.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Categorized Draggable Sticker Grid */}
            <div className="space-y-4">
              {(stickerCategory === 'all' || stickerCategory === 'comunidad') &&
                stickers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span>Tus Stickers y Comunidad</span>
                        {newStickerIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold">
                            Nuevos marcados en verde
                          </span>
                        )}
                      </span>
                      <span>{stickers.length} stickers</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                      {[
                        ...stickers.filter((s) => newStickerIds.includes(s.id)).reverse(),
                        ...stickers.filter((s) => !newStickerIds.includes(s.id)),
                      ].map((stk) => {
                        const isNew = newStickerIds.includes(stk.id);
                        return (
                          <button
                            key={stk.id}
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/kromacard-sticker',
                                JSON.stringify({
                                  stickerId: stk.id,
                                  name: stk.name,
                                  content: stk.content,
                                  isImage: stk.isImage,
                                  bgColor: stk.bgColor,
                                  textColor: stk.textColor,
                                } satisfies DroppedStickerPayload)
                              );
                              e.dataTransfer.effectAllowed = 'copy';
                              setPreviewSide('front');
                            }}
                            onClick={() => handleAddSticker(stk)}
                            title={`Arrastra o toca "${stk.name}"`}
                            className={`relative min-h-[72px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-grab active:cursor-grabbing ${
                              isNew
                                ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/50 hover:bg-emerald-500/25 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-sky-400/50'
                            }`}
                          >
                            {isNew && (
                              <span className="absolute -top-2 right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[8px] font-extrabold tracking-wide shadow">
                                NUEVO
                              </span>
                            )}
                            {stk.isImage ? (
                              <img src={stk.content} alt={stk.name} referrerPolicy="no-referrer" className="w-8 h-8 object-contain" />
                            ) : stk.content.length <= 2 ? (
                              <span className="text-2xl leading-none">{stk.content}</span>
                            ) : (
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-display font-bold truncate max-w-full"
                                style={{
                                  backgroundColor: stk.bgColor || '#F59E0B',
                                  color: stk.textColor || '#0B0D14',
                                }}
                              >
                                {stk.content}
                              </span>
                            )}
                            <span
                              className={`text-[10px] truncate w-full text-center ${
                                isNew ? 'text-emerald-200 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {stk.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {STICKER_CATEGORIES.filter(
                (cat) => stickerCategory === 'all' || stickerCategory === cat.id
              ).map((cat) => {
                const items = PRESET_STICKER_LIBRARY.filter((s) => s.category === cat.id);
                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">{cat.label}</span>
                      <span>Arrastra o toca para añadir · {items.length} disponibles</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {items.map((stk) => (
                        <button
                          key={stk.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/kromacard-sticker',
                              JSON.stringify({
                                stickerId: stk.id,
                                name: stk.name,
                                content: stk.content,
                                isImage: stk.isImage,
                              } satisfies DroppedStickerPayload)
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                            setPreviewSide('front');
                          }}
                          onClick={() => handleAddSticker(stk)}
                          title={`Arrastra o toca "${stk.name}"`}
                          className="min-h-[68px] p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sky-400/50 flex flex-col items-center justify-center gap-1 transition-colors cursor-grab active:cursor-grabbing"
                        >
                          {stk.content.length <= 2 ? (
                            <span className="text-2xl leading-none">{stk.content}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-display font-bold bg-amber-400 text-slate-950 truncate max-w-full">
                              {stk.content}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 truncate w-full text-center">
                            {stk.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {placedStickers.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="text-xs font-semibold text-slate-400">
                  Stickers colocados en tu carta ({placedStickers.length}) · Arrástralos sobre la vista 3D
                </div>
                {placedStickers.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-white/5"
                  >
                    <span className="text-xs font-medium text-white truncate min-w-[90px]">
                      {ps.name}
                    </span>
                    <div className="flex items-center gap-3 ml-auto">
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>Tamaño</span>
                        <input
                          type="range"
                          min={0.6}
                          max={2}
                          step={0.1}
                          value={ps.scale}
                          onChange={(e) =>
                            setPlacedStickers((prev) =>
                              prev.map((item) =>
                                item.id === ps.id ? { ...item, scale: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="w-16 accent-sky-400"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>Giro</span>
                        <input
                          type="range"
                          min={-45}
                          max={45}
                          step={1}
                          value={ps.rotation}
                          onChange={(e) =>
                            setPlacedStickers((prev) =>
                              prev.map((item) =>
                                item.id === ps.id ? { ...item, rotation: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="w-16 accent-fuchsia-400"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setPlacedStickers((prev) => prev.filter((item) => item.id !== ps.id))
                        }
                        aria-label="Quitar sticker"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/15"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Back of Card (Backdrop, Stats, Autograph, Author Note, Concert Ticket & Audio) */}
        {activeTab === 'back' && (
          <div className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-6">
            {/* Stadium Volumetric Back Layers */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Capa Trasera de Estadio (Iluminación Volumétrica)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ambienta el reverso de la tarjeta y el escenario 3D del estudio
                  </p>
                </div>
                {backBackdropUrl && (
                  <button
                    type="button"
                    onClick={() => setBackBackdropUrl('')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Sin fondo
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {(backdrops.length > 0 ? backdrops : STADIUM_BACKDROPS.map((b) => ({
                  id: b.id,
                  name: b.label,
                  imageUrl: b.imageUrl,
                  atmosphere: b.atmosphere,
                }))).map((bg) => {
                  const selected = backBackdropUrl === bg.imageUrl;
                  return (
                    <button
                      key={`back-${bg.id}`}
                      type="button"
                      onClick={() => {
                        setBackBackdropUrl(selected ? '' : bg.imageUrl);
                        setPreviewSide('back');
                      }}
                      className={`group rounded-2xl overflow-hidden border text-left transition-all ${
                        selected
                          ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/40 bg-fuchsia-500/10'
                          : 'border-white/10 bg-[#0B0D14] hover:border-white/25'
                      }`}
                    >
                      <div className="relative h-16 w-full overflow-hidden bg-black">
                        <img
                          src={bg.imageUrl}
                          alt={bg.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-bold text-white truncate">
                          {bg.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Stats */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-bold text-white">
                  Estadísticas en el Reverso
                </h3>
                {stats.length < 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      setStats((prev) => [...prev, { label: 'EXTRA', value: 90 }])
                    }
                    className="min-h-[36px] px-3 rounded-xl bg-white/10 text-xs font-semibold text-white flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10"
                  >
                    <input
                      type="text"
                      value={st.label}
                      onChange={(e) =>
                        setStats((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, label: e.target.value.toUpperCase() } : item
                          )
                        )
                      }
                      className="w-24 px-2 py-1 rounded-lg bg-[#0B0D14] text-xs font-semibold text-slate-200"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={st.value}
                      onChange={(e) =>
                        setStats((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, value: Math.min(100, Math.max(0, Number(e.target.value))) } : item
                          )
                        )
                      }
                      className="w-16 px-2 py-1 rounded-lg bg-[#0B0D14] text-xs font-mono-num font-bold text-sky-400 text-center"
                    />
                    {stats.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setStats((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-auto text-slate-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vector SVG Digital Autograph Pad */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-white">
                    Autógrafo Digital en SVG
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Firma vectorial nítida al escalar e imprimir (dibuja con el dedo o ratón)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {svgStrokes.length > 0 && (
                    <button
                      type="button"
                      onClick={undoSignatureStroke}
                      className="text-xs text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Deshacer</span>
                    </button>
                  )}
                  {autographDataUrl && isSvgDataUrl(autographDataUrl) && (
                    <button
                      type="button"
                      onClick={handleDownloadSignatureSvg}
                      className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-400/30"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.SVG</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>

              {/* Ink color selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">Tinta SVG:</span>
                {SIGNATURE_INK_COLORS.map((ink) => (
                  <button
                    key={ink.hex}
                    type="button"
                    onClick={() => setSigInkColor(ink.hex)}
                    title={ink.label}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      sigInkColor === ink.hex
                        ? 'border-sky-400 scale-110'
                        : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: ink.hex }}
                  />
                ))}
              </div>

              <div className="relative w-full h-[110px] rounded-xl bg-[#0B0D14] border border-white/15 overflow-hidden">
                {svgStrokes.length === 0 && autographDataUrl && (
                  <img
                    src={autographDataUrl}
                    alt="Firma guardada"
                    className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                      isSvgDataUrl(autographDataUrl) ? '' : 'invert'
                    }`}
                  />
                )}
                <svg
                  ref={sigSvgRef}
                  viewBox={`0 0 ${SIGNATURE_VIEWBOX_WIDTH} ${SIGNATURE_VIEWBOX_HEIGHT}`}
                  preserveAspectRatio="none"
                  onPointerDown={startDrawing}
                  onPointerMove={drawMove}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="relative z-10 w-full h-full touch-none cursor-crosshair select-none"
                >
                  <line
                    x1="16"
                    y1={SIGNATURE_VIEWBOX_HEIGHT - 18}
                    x2={SIGNATURE_VIEWBOX_WIDTH - 16}
                    y2={SIGNATURE_VIEWBOX_HEIGHT - 18}
                    stroke="rgba(148,163,184,0.22)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {svgStrokes.map((st, idx) => (
                    <path
                      key={idx}
                      d={strokeToSvgPathD(st.points)}
                      stroke={st.color}
                      strokeWidth={st.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                  {activeStroke && activeStroke.points.length > 0 && (
                    <path
                      d={strokeToSvgPathD(activeStroke.points)}
                      stroke={activeStroke.color}
                      strokeWidth={activeStroke.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </svg>
              </div>
            </div>

            {/* Author Message */}
            <label className="block space-y-1.5 text-xs">
              <span className="font-semibold text-slate-300">Mensaje exclusivo del autor</span>
              <textarea
                rows={3}
                value={authorMessage}
                onChange={(e) => setAuthorMessage(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white"
              />
            </label>

            {/* Concert Ticket & Audio Attachment */}
            <div className="p-4 rounded-2xl bg-[#0B0D14] border border-white/10 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
                  <Ticket className="w-4 h-4 text-sky-400" />
                  <span>Adjuntar Boleto de Concierto y Canción</span>
                </span>
                <input
                  type="checkbox"
                  checked={concertEnabled}
                  onChange={(e) => setConcertEnabled(e.target.checked)}
                  className="w-4 h-4 accent-sky-400"
                />
              </label>

              {concertEnabled && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input
                      type="text"
                      placeholder="Nombre del Tour o Evento"
                      value={tourName}
                      onChange={(e) => setTourName(e.target.value)}
                      className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Zona / Sector (Ej. Pista VIP)"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Asiento o Fila"
                      value={seatOrRow}
                      onChange={(e) => setSeatOrRow(e.target.value)}
                      className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Código de Boleto"
                      value={ticketCode}
                      onChange={(e) => setTicketCode(e.target.value)}
                      className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono-num"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input
                      type="text"
                      placeholder="Canción favorita del setlist"
                      value={favoriteSong}
                      onChange={(e) => setFavoriteSong(e.target.value)}
                      className="min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                    />
                    <select
                      value={audioPresetId}
                      onChange={(e) => {
                        setAudioPresetId(e.target.value);
                        setCustomAudioUrl(undefined);
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-[#131622] border border-white/10 text-white"
                    >
                      {AUDIO_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer">
                      <Music className="w-3.5 h-3.5 text-sky-400" />
                      <span>{customAudioTitle ? `Audio: ${customAudioTitle}` : 'Subir audio del dispositivo'}</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={toggleMicRecording}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        isRecording
                          ? 'bg-rose-500 text-white'
                          : 'bg-white/10 hover:bg-white/15 text-slate-200'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isRecording ? 'Detener Grabación' : 'Grabar Clip de Voz/Estadio'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* YouTube Moment Video & Music Platform Link + Exportable QR */}
            <div className="p-4 rounded-2xl bg-[#0B0D14] border border-white/10 space-y-4">
              <div>
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-rose-400" />
                  <span>Video de YouTube y Música en Streaming (Spotify / QR)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adjunta el video que grabaste y subiste a YouTube o tu canción en Spotify para verla en Inspección 3D y exportar su QR.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-rose-300 font-semibold flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5" />
                    <span>Enlace de YouTube del momento</span>
                  </span>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=... o youtu.be/..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                  />
                  {youtubeUrl.trim() && (
                    <span
                      className={`block text-[10px] ${
                        extractYouTubeId(youtubeUrl) ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {extractYouTubeId(youtubeUrl)
                        ? 'Video de YouTube detectado listo para reproducir en 3D.'
                        : 'Verifica que sea un enlace válido de YouTube.'}
                    </span>
                  )}
                </label>

                <label className="space-y-1">
                  <span className="text-emerald-300 font-semibold flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Link de Spotify u otra plataforma</span>
                    </span>
                    {musicLinkUrl.trim() && (
                      <span className="text-[10px] text-emerald-300">
                        {detectMusicPlatform(musicLinkUrl)}
                      </span>
                    )}
                  </span>
                  <input
                    type="url"
                    placeholder="https://open.spotify.com/track/..."
                    value={musicLinkUrl}
                    onChange={(e) => setMusicLinkUrl(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-white/5 border border-white/10 text-white"
                  />
                </label>
              </div>

              {musicQrPreviewUrl && (
                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-[#131622] border border-white/10">
                  <img
                    src={musicQrPreviewUrl}
                    alt="Código QR del enlace musical o video"
                    className="w-20 h-20 rounded-lg bg-white p-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2 w-full">
                    <div className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        QR listo para{' '}
                        {musicLinkUrl.trim() ? detectMusicPlatform(musicLinkUrl) : 'YouTube'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = musicQrPreviewUrl;
                          a.download = `qr-kromacard-${Date.now()}.png`;
                          a.click();
                          onNotifyToast('QR exportado en PNG.');
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar QR PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const target = normalizeExternalUrl(musicLinkUrl || youtubeUrl);
                          if (!target) return;
                          try {
                            await navigator.clipboard.writeText(target);
                            onNotifyToast('Enlace copiado al portapapeles.');
                          } catch {
                            onNotifyToast(target);
                          }
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-white/10 text-white text-[11px] font-semibold flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </button>
                      <a
                        href={normalizeExternalUrl(musicLinkUrl || youtubeUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-3 rounded-lg bg-white/5 text-sky-300 text-[11px] font-semibold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
