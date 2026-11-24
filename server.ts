import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  Album,
  BootstrapPayload,
  CollectorUser,
  ConcertBanner,
  CustomBackdrop,
  CustomFramePreset,
  CustomSticker,
  CustomTexture,
  ImageFilterConfig,
  LikableAssetKind,
  Photocard,
  RealtimeNotification,
  TradeOffer,
} from './src/types/kromacard.ts';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function getFirebaseWebApiKey(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { apiKey?: string };
      return raw.apiKey || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function isSafeSvgDataUrl(dataUrl: string): boolean {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return false;
  const header = dataUrl.slice(0, commaIdx).toLowerCase();
  const payload = dataUrl.slice(commaIdx + 1);
  if (!header.startsWith('data:image/svg+xml')) return false;
  try {
    const decoded = header.includes(';base64')
      ? Buffer.from(payload, 'base64').toString('utf-8')
      : decodeURIComponent(payload);
    const lower = decoded.toLowerCase();
    if (!lower.includes('<svg')) return false;
    const forbidden = [
      /<script\b/,
      /<foreignobject\b/,
      /<iframe\b/,
      /<object\b/,
      /<embed\b/,
      /\son[a-z]+\s*=/,
      /javascript\s*:/,
      /vbscript\s*:/,
      /data\s*:\s*text\/html/,
    ];
    return !forbidden.some((re) => re.test(lower));
  } catch {
    return false;
  }
}

function isSafeImageSource(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/src/assets/')) return true;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:image/svg+xml')) {
    return isSafeSvgDataUrl(trimmed);
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function createSeedData(): BootstrapPayload {
  const users: CollectorUser[] = [
    {
      id: 'user-sofia',
      handle: '@sofia_estadio',
      displayName: 'Sofía Martínez',
      avatarColor: '#38BDF8',
      bio: 'Coleccionista de photocards de giras en vivo, carteles hechos a mano y recuerdos familiares.',
      favoriteArtist: 'Coldplay & Indie Pop',
      friends: ['user-mateo', 'user-luna'],
    },
    {
      id: 'user-mateo',
      handle: '@mateo_gold98',
      displayName: 'Mateo Rivera',
      avatarColor: '#F59E0B',
      bio: 'Diseño cartas doradas edición limitada de fútbol, goles históricos y noches de copa.',
      favoriteArtist: 'Fútbol Leyendas',
      friends: ['user-sofia'],
    },
    {
      id: 'user-luna',
      handle: '@luna_lightstick',
      displayName: 'Luna Chen',
      avatarColor: '#E879F9',
      bio: 'Archivista de conciertos, pulseras LED y setlists acústicos. Abierta a trueques verificados.',
      favoriteArtist: 'Arena Pop Tour',
      friends: ['user-sofia'],
    },
  ];

  const filters: ImageFilterConfig[] = [
    {
      id: 'filter-original',
      name: 'Original Natural',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      hueRotate: 0,
      sepia: 0,
      grayscale: 0,
    },
    {
      id: 'filter-estadio-prisma',
      name: 'Prisma Estadio',
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      brightness: 106,
      contrast: 118,
      saturate: 132,
      hueRotate: 8,
      sepia: 0,
      grayscale: 0,
    },
    {
      id: 'filter-oro-campeon',
      name: 'Dorado Épico',
      authorId: 'user-mateo',
      authorName: 'Mateo Rivera',
      isPublic: true,
      brightness: 105,
      contrast: 122,
      saturate: 118,
      hueRotate: -6,
      sepia: 24,
      grayscale: 0,
    },
    {
      id: 'filter-retro-35mm',
      name: 'Película 35mm',
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      brightness: 98,
      contrast: 112,
      saturate: 88,
      hueRotate: 0,
      sepia: 32,
      grayscale: 0,
    },
    {
      id: 'filter-monocromo',
      name: 'Dramático B&N',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      brightness: 104,
      contrast: 135,
      saturate: 0,
      hueRotate: 0,
      sepia: 0,
      grayscale: 100,
    },
  ];

  const stickers: CustomSticker[] = [
    {
      id: 'stk-star-gold',
      name: 'Estrella Dorada',
      content: '★',
      isImage: false,
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      bgColor: '#F59E0B',
      textColor: '#0B0D14',
      category: 'musica',
      likes: 42,
      createdAt: '2024-10-20T10:00:00.000Z',
    },
    {
      id: 'stk-vip-pass',
      name: 'Sello VIP',
      content: 'VIP',
      isImage: false,
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      bgColor: '#E879F9',
      textColor: '#0B0D14',
      category: 'eventos',
      likes: 65,
      createdAt: '2024-10-22T12:00:00.000Z',
    },
    {
      id: 'stk-limited',
      name: 'Edición Limitada',
      content: 'LIMITED',
      isImage: false,
      authorId: 'user-mateo',
      authorName: 'Mateo Rivera',
      isPublic: true,
      bgColor: '#38BDF8',
      textColor: '#0B0D14',
      category: 'edicion-limitada',
      likes: 58,
      createdAt: '2024-10-24T15:00:00.000Z',
    },
    {
      id: 'stk-crown',
      name: 'Corona Ídolo',
      content: '👑',
      isImage: false,
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      category: 'celebraciones',
      likes: 79,
      createdAt: '2024-10-25T16:00:00.000Z',
    },
    {
      id: 'stk-music',
      name: 'Setlist Live',
      content: '🎵',
      isImage: false,
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      category: 'musica',
      likes: 51,
      createdAt: '2024-10-26T11:30:00.000Z',
    },
    {
      id: 'stk-confetti',
      name: 'Confeti Tour',
      content: '✨',
      isImage: false,
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      category: 'celebraciones',
      likes: 47,
      createdAt: '2024-10-27T09:15:00.000Z',
    },
  ];

  const albums: Album[] = [
    {
      id: 'alb-spheres',
      title: 'Gira Luces del Estadio 2024',
      description: 'Photocards holográficas de pista A, setlist acústico y pulseras LED sincronizadas.',
      ownerId: 'user-sofia',
      visibility: 'public',
      category: 'concert',
      coverPhotoUrl: '/src/assets/images/concert_stage_vocalist_1795353654776.jpg',
      location: 'Estadio River Plate, Buenos Aires',
      dateLabel: '25 Oct 2024',
      createdAt: '2024-10-26T12:00:00.000Z',
    },
    {
      id: 'alb-leyendas',
      title: 'Colección Oro Fútbol',
      description: 'Cartas doradas estilo edición limitada con estadísticas personalizadas y autógrafo.',
      ownerId: 'user-mateo',
      visibility: 'public',
      category: 'sports',
      coverPhotoUrl: '/src/assets/images/soccer_star_card_1795353654615.jpg',
      location: 'Estadio Metropolitano, Madrid',
      dateLabel: '14 Sep 2024',
      createdAt: '2024-09-15T18:30:00.000Z',
    },
    {
      id: 'alb-familia',
      title: 'Recuerdos Dorados en Familia',
      description: 'Tardes inolvidables en el parque impresas en pliego A4 para nuestro álbum físico.',
      ownerId: 'user-sofia',
      visibility: 'friends',
      category: 'family',
      coverPhotoUrl: '/src/assets/images/family_golden_hour_1795353655019.jpg',
      location: 'Parque del Retiro, Madrid',
      dateLabel: '03 Ago 2024',
      createdAt: '2024-08-04T10:15:00.000Z',
    },
  ];

  const cards: Photocard[] = [
    {
      id: 'card-vocal-06',
      serialCode: 'KRM-EST-006',
      ownerId: 'user-sofia',
      creatorId: 'user-sofia',
      albumId: 'alb-spheres',
      visibility: 'public',
      tradeable: true,
      tradeWishNote: 'Busco cartas acústicas de giras en estadio 2024-2025',
      tradeCategory: 'musica',
      tradeExpiresAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      title: 'Elena Vance · Acoustic Stage',
      subtitle: 'Gira Prisma Mundial · Lluvia de Confeti',
      ratingOrBadge: '#06',
      categoryLabel: 'VOCAL',
      countryFlag: '🇦🇷',
      location: 'Estadio River Plate, Buenos Aires',
      eventDate: '25 Oct 2024',
      editionLabel: 'Edición Holo · 06/100',
      photoUrl: '/src/assets/images/concert_stage_vocalist_1795353654776.jpg',
      frameStyle: 'holo',
      frameShape: 'arco',
      frameCelebration: 'concierto',
      primaryColor: '#38BDF8',
      secondaryColor: '#E879F9',
      texture: 'prism',
      shineIntensity: 86,
      filterId: 'filter-estadio-prisma',
      filterSnapshot: filters[1],
      stickers: [
        {
          id: 'ps-1',
          stickerId: 'stk-star-gold',
          name: 'Estrella Dorada',
          content: '★',
          isImage: false,
          x: 84,
          y: 16,
          scale: 1,
          rotation: 12,
        },
      ],
      stats: [
        { label: 'VOZ', value: 98 },
        { label: 'ENERGÍA', value: 96 },
        { label: 'EMOCIÓN', value: 99 },
        { label: 'PÚBLICO', value: 97 },
      ],
      authorMessage: 'Cuando cayeron las estrellas de papel durante el encore acústico, todo el estadio cantó a capela.',
      concert: {
        enabled: true,
        tourName: 'World Tour Prisma 2024',
        artist: 'Elena Vance',
        zone: 'Campo Delantero VIP',
        access: 'Puerta A · Barricada',
        seatOrRow: 'Fila 01 · Centro',
        dateTime: '25 Oct 2024 · 21:00',
        ticketCode: 'KRM-2024-RVP-0994',
        favoriteSong: 'Luces en el Cielo (Acústico)',
        audioPresetId: 'acoustic-stadium',
      },
      likes: 48,
      createdAt: '2024-10-26T12:15:00.000Z',
    },
    {
      id: 'card-gold-98',
      serialCode: 'KRM-FUT-098',
      ownerId: 'user-mateo',
      creatorId: 'user-mateo',
      albumId: 'alb-leyendas',
      visibility: 'public',
      tradeable: true,
      tradeWishNote: 'Intercambio por edición limitada de fútbol o boleto VIP',
      tradeCategory: 'deportes',
      tradeExpiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      title: 'D. Mendoza · Gol Decisivo',
      subtitle: 'Emerald United · Noche de Campeones',
      ratingOrBadge: '98',
      categoryLabel: 'MC',
      countryFlag: '🇪🇸',
      location: 'Estadio Metropolitano, Madrid',
      eventDate: '14 Sep 2024',
      editionLabel: 'Gold Limited · #01/25',
      photoUrl: '/src/assets/images/soccer_star_card_1795353654615.jpg',
      frameStyle: 'gold',
      frameShape: 'escudo',
      frameCelebration: 'ninguna',
      primaryColor: '#F59E0B',
      secondaryColor: '#FDE68A',
      texture: 'gold-relief',
      shineIntensity: 90,
      filterId: 'filter-oro-campeon',
      filterSnapshot: filters[2],
      stickers: [
        {
          id: 'ps-2',
          stickerId: 'stk-crown',
          name: 'Corona Ídolo',
          content: '👑',
          isImage: false,
          x: 82,
          y: 18,
          scale: 1.1,
          rotation: -8,
        },
      ],
      stats: [
        { label: 'RIT', value: 91 },
        { label: 'TIR', value: 95 },
        { label: 'PAS', value: 94 },
        { label: 'REG', value: 93 },
        { label: 'DEF', value: 78 },
        { label: 'FIS', value: 89 },
      ],
      authorMessage: 'Minuto 89 desde la grada sur. Un disparo imparable al ángulo bajo los reflectores.',
      concert: {
        enabled: true,
        tourName: 'Copa de Campeones',
        artist: 'Emerald United',
        zone: 'Tribuna Alta Sur',
        access: 'Puerta 14 · Sector B',
        seatOrRow: 'Asiento 22',
        dateTime: '14 Sep 2024 · 20:45',
        ticketCode: 'FUT-2024-8841',
        favoriteSong: 'Himno del Estadio',
        audioPresetId: 'golden-anthem',
      },
      likes: 62,
      createdAt: '2024-09-15T19:00:00.000Z',
    },
    {
      id: 'card-arena-01',
      serialCode: 'KRM-ARN-024',
      ownerId: 'user-luna',
      creatorId: 'user-luna',
      albumId: 'alb-spheres',
      visibility: 'public',
      tradeable: true,
      tradeWishNote: 'Cambio por photocards de festivales o celebraciones',
      tradeCategory: 'eventos',
      title: 'Océano de Lightsticks',
      subtitle: 'Arena Final · 70,000 Almas Sincronizadas',
      ratingOrBadge: 'VIP',
      categoryLabel: 'ARENA',
      countryFlag: '🇰🇷',
      location: 'Palau Sant Jordi, Barcelona',
      eventDate: '19 Oct 2024',
      editionLabel: 'Tornasol · #24/50',
      photoUrl: '/src/assets/images/kpop_concert_crowd_1795353654618.jpg',
      frameStyle: 'stadium',
      frameShape: 'ticket',
      frameCelebration: 'concierto',
      primaryColor: '#22D3EE',
      secondaryColor: '#C084FC',
      texture: 'stadium',
      shineIntensity: 78,
      filterId: 'filter-estadio-prisma',
      filterSnapshot: filters[1],
      stickers: [],
      stats: [
        { label: 'CORO', value: 99 },
        { label: 'LUCES', value: 97 },
        { label: 'SONIDO', value: 95 },
        { label: 'RECUERDO', value: 100 },
      ],
      authorMessage: 'Intercambié pulseras con tres fans desconocidos antes del solo de cierre. Pura magia colectiva.',
      concert: {
        enabled: true,
        tourName: 'Neon Horizon Tour',
        artist: 'Starlight Collective',
        zone: 'Pista VIP Standing',
        access: 'Acceso Soundcheck',
        seatOrRow: 'Pulsera #412',
        dateTime: '19 Oct 2024 · 19:30',
        ticketCode: 'SL-2024-VIP-412',
        favoriteSong: 'Estrellas en Neón (Encore)',
        audioPresetId: 'synth-arena',
      },
      likes: 54,
      createdAt: '2024-10-20T09:00:00.000Z',
    },
    {
      id: 'card-fam-01',
      serialCode: 'KRM-FAM-001',
      ownerId: 'user-sofia',
      creatorId: 'user-sofia',
      albumId: 'alb-familia',
      visibility: 'friends',
      tradeable: false,
      title: 'Tarde de Risas en el Parque',
      subtitle: 'Atardecer Dorado · Familia y Amigos',
      ratingOrBadge: '100',
      categoryLabel: 'FAMILIA',
      countryFlag: '💛',
      location: 'Parque del Retiro, Madrid',
      eventDate: '03 Ago 2024',
      editionLabel: 'Recuerdo Único · #01/01',
      photoUrl: '/src/assets/images/family_golden_hour_1795353655019.jpg',
      frameStyle: 'custom',
      primaryColor: '#F59E0B',
      secondaryColor: '#FB7185',
      texture: 'gold-relief',
      shineIntensity: 55,
      filterId: 'filter-retro-35mm',
      filterSnapshot: filters[3],
      stickers: [],
      stats: [
        { label: 'ALEGRÍA', value: 100 },
        { label: 'ABRAZOS', value: 98 },
        { label: 'SOL', value: 95 },
        { label: 'MEMORIA', value: 100 },
      ],
      authorMessage: 'Lista para imprimir en el álbum familiar de fin de año con código QR a nuestra canción de verano.',
      concert: {
        enabled: true,
        tourName: 'Verano en Familia',
        artist: 'Nuestra Banda Sonora',
        zone: 'Césped del Lago',
        access: 'Pícnic',
        seatOrRow: 'Atardecer',
        dateTime: '03 Ago 2024 · 19:45',
        ticketCode: 'FAM-2024-SOL',
        favoriteSong: 'Acordes de Verano',
        audioPresetId: 'lofi-memory',
      },
      likes: 31,
      createdAt: '2024-08-04T11:00:00.000Z',
    },
  ];

  const banners: ConcertBanner[] = [
    {
      id: 'ban-1',
      ownerId: 'user-sofia',
      ownerName: 'Sofía Martínez',
      title: 'Gracias por la Música',
      artistOrTour: 'Elena Vance · World Tour Prisma',
      venue: 'Estadio River Plate, Buenos Aires',
      date: '25 Oct 2024',
      photoUrl: '/src/assets/images/handmade_fan_banner_1795353654555.jpg',
      story: 'Pintamos este cartón reciclado con estrellas doradas durante tres horas en la fila. ¡Logramos que las cámaras del escenario principal lo enfocaran durante la canción acústica!',
      idolReaction: 'Sonrió desde el micrófono, señaló nuestro sector y nos dedicó el puente de la canción.',
      songTitle: 'Luces en el Cielo (Acústico)',
      audioPresetId: 'acoustic-stadium',
      category: 'musica',
      visibility: 'public',
      likes: 74,
      createdAt: '2024-10-26T14:20:00.000Z',
    },
    {
      id: 'ban-2',
      ownerId: 'user-luna',
      ownerName: 'Luna Chen',
      title: 'Marea Cian en el Encore',
      artistOrTour: 'Starlight Collective · Neon Horizon',
      venue: 'Palau Sant Jordi, Barcelona',
      date: '19 Oct 2024',
      photoUrl: '/src/assets/images/kpop_concert_crowd_1795353654618.jpg',
      story: 'Organizamos el fanchant de luces entre 40 fans de la fila A y guardamos el cartel firmado detrás de la photocard.',
      idolReaction: 'Todo el grupo hizo una reverencia mirando hacia la pancarta antes de despedirse.',
      songTitle: 'Estrellas en Neón',
      audioPresetId: 'synth-arena',
      category: 'eventos',
      visibility: 'public',
      likes: 51,
      createdAt: '2024-10-20T16:10:00.000Z',
    },
  ];

  const trades: TradeOffer[] = [
    {
      id: 'trd-demo-1',
      type: 'swap',
      fromUserId: 'user-luna',
      toUserId: 'user-sofia',
      offeredCardId: 'card-arena-01',
      requestedCardId: 'card-vocal-06',
      verificationCode: 'VER-849201',
      message: '¡Hola Sofía! Tengo la photocard VIP del Palau Sant Jordi, ¿te interesa intercambiarla por tu edición #06 de River Plate?',
      status: 'pending',
      createdAt: '2024-10-27T08:40:00.000Z',
    },
  ];

  const notifications: RealtimeNotification[] = [
    {
      id: 'notif-1',
      userId: 'user-sofia',
      title: 'Propuesta de trueque verificada',
      message: 'Luna Chen quiere intercambiar "Océano de Lightsticks" por tu card "Elena Vance · Acoustic Stage".',
      kind: 'trade',
      relatedCardId: 'card-vocal-06',
      read: false,
      createdAt: '2024-10-27T08:40:00.000Z',
    },
  ];

  const textures: CustomTexture[] = [
    {
      id: 'tex-seed-neon-prisma',
      name: 'Prisma Neón Estadio',
      imageUrl: '/src/assets/images/holo_prism_shards_1795356018697.jpg',
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      patternType: 'prisma',
      primaryColor: '#38BDF8',
      secondaryColor: '#E879F9',
      category: 'musica',
      likes: 88,
      createdAt: '2024-10-25T12:00:00.000Z',
    },
    {
      id: 'tex-seed-gold-gala',
      name: 'Destello Dorado VIP',
      imageUrl: '/src/assets/images/holo_gold_filigree_1795356018771.jpg',
      authorId: 'user-mateo',
      authorName: 'Mateo Rivera',
      isPublic: true,
      patternType: 'estelar',
      primaryColor: '#F59E0B',
      secondaryColor: '#FDE68A',
      category: 'celebraciones',
      likes: 73,
      createdAt: '2024-10-26T15:30:00.000Z',
    },
    {
      id: 'tex-seed-navidad-frost',
      name: 'Escarcha Festiva Navidad',
      imageUrl: '/src/assets/images/holo_christmas_ornaments_1795357305941.jpg',
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      patternType: 'estelar',
      primaryColor: '#EF4444',
      secondaryColor: '#10B981',
      category: 'celebraciones',
      likes: 94,
      createdAt: '2024-12-01T14:00:00.000Z',
    },
  ];

  const frames: CustomFramePreset[] = [
    {
      id: 'frm-navidad-gala',
      name: 'Navidad Nieve Dorada',
      frameShape: 'arco',
      celebrationTheme: 'navidad',
      primaryColor: '#DC2626',
      secondaryColor: '#059669',
      accentColor: '#FDE68A',
      borderPattern: 'festivo',
      category: 'celebraciones',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      likes: 112,
      createdAt: '2024-12-01T10:00:00.000Z',
    },
    {
      id: 'frm-halloween-neon',
      name: 'Halloween Noche Neón',
      frameShape: 'hexagono',
      celebrationTheme: 'halloween',
      primaryColor: '#F97316',
      secondaryColor: '#7C3AED',
      accentColor: '#FACC15',
      borderPattern: 'neon',
      category: 'celebraciones',
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      likes: 86,
      createdAt: '2024-10-30T19:00:00.000Z',
    },
    {
      id: 'frm-san-valentin',
      name: 'San Valentín Corazón',
      frameShape: 'corazon',
      celebrationTheme: 'san-valentin',
      primaryColor: '#FB7185',
      secondaryColor: '#EC4899',
      accentColor: '#FFE4E6',
      borderPattern: 'festivo',
      category: 'celebraciones',
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      likes: 97,
      createdAt: '2025-02-14T11:00:00.000Z',
    },
    {
      id: 'frm-ano-nuevo',
      name: 'Año Nuevo Champagne VIP',
      frameShape: 'rectangulo',
      celebrationTheme: 'ano-nuevo',
      primaryColor: '#F59E0B',
      secondaryColor: '#1E293B',
      accentColor: '#FEF08A',
      borderPattern: 'metalico',
      category: 'celebraciones',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      likes: 78,
      createdAt: '2024-12-31T21:00:00.000Z',
    },
    {
      id: 'frm-cumpleanos-fiesta',
      name: 'Cumpleaños Confeti Party',
      frameShape: 'polaroid',
      celebrationTheme: 'cumpleanos',
      primaryColor: '#38BDF8',
      secondaryColor: '#F472B6',
      accentColor: '#FACC15',
      borderPattern: 'prisma',
      category: 'celebraciones',
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      likes: 64,
      createdAt: '2025-01-12T16:00:00.000Z',
    },
    {
      id: 'frm-escudo-campeon',
      name: 'Escudo Torneo Oro',
      frameShape: 'escudo',
      celebrationTheme: 'ninguna',
      primaryColor: '#F59E0B',
      secondaryColor: '#92400E',
      accentColor: '#FEF3C7',
      borderPattern: 'metalico',
      category: 'deportes',
      authorId: 'user-mateo',
      authorName: 'Mateo Rivera',
      isPublic: true,
      likes: 91,
      createdAt: '2024-11-05T13:00:00.000Z',
    },
    {
      id: 'frm-boleto-tour',
      name: 'Boleto Concierto Front Row',
      frameShape: 'ticket',
      celebrationTheme: 'concierto',
      primaryColor: '#22D3EE',
      secondaryColor: '#C084FC',
      accentColor: '#38BDF8',
      borderPattern: 'neon',
      category: 'musica',
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      likes: 105,
      createdAt: '2024-11-18T20:00:00.000Z',
    },
  ];

  const backdrops: CustomBackdrop[] = [
    {
      id: 'bg-seed-cyan-magenta',
      name: 'Estadio Prisma Neón',
      imageUrl: '/src/assets/images/stadium_backdrop_cyan_magenta_1795355312437.jpg',
      atmosphere: 'Reflectores láser cian y magenta',
      category: 'musica',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      likes: 95,
      createdAt: '2024-10-20T10:00:00.000Z',
    },
    {
      id: 'bg-seed-gold-fireworks',
      name: 'Encore Dorado & Fuegos',
      imageUrl: '/src/assets/images/stadium_backdrop_gold_fireworks_1795355313097.jpg',
      atmosphere: 'Pirotecnia dorada sobre estadio lleno',
      category: 'celebraciones',
      authorId: 'user-mateo',
      authorName: 'Mateo Rivera',
      isPublic: true,
      likes: 108,
      createdAt: '2024-10-22T14:00:00.000Z',
    },
    {
      id: 'bg-seed-purple-galaxy',
      name: 'Arena Galaxia Violeta',
      imageUrl: '/src/assets/images/stadium_backdrop_purple_galaxy_1795355313179.jpg',
      atmosphere: 'Mar de lightsticks y humo neón',
      category: 'eventos',
      authorId: 'user-luna',
      authorName: 'Luna Chen',
      isPublic: true,
      likes: 89,
      createdAt: '2024-10-24T17:00:00.000Z',
    },
    {
      id: 'bg-seed-emerald-electric',
      name: 'Tormenta Esmeralda VIP',
      imageUrl: '/src/assets/images/stadium_backdrop_emerald_electric_1795355313366.jpg',
      atmosphere: 'Focos nocturnos de festival al aire libre',
      category: 'deportes',
      authorId: 'system',
      authorName: 'Kromacard',
      isPublic: true,
      likes: 76,
      createdAt: '2024-10-28T11:00:00.000Z',
    },
    {
      id: 'bg-seed-sunset-confetti',
      name: 'Atardecer & Confeti',
      imageUrl: '/src/assets/images/stadium_backdrop_sunset_confetti_1795355313250.jpg',
      atmosphere: 'Hora dorada y lluvia de confeti',
      category: 'celebraciones',
      authorId: 'user-sofia',
      authorName: 'Sofía Martínez',
      isPublic: true,
      likes: 101,
      createdAt: '2024-11-01T18:00:00.000Z',
    },
  ];

  return {
    users,
    cards,
    albums,
    banners,
    filters,
    stickers,
    textures,
    frames,
    backdrops,
    trades,
    notifications,
  };
}

function loadStore(): BootstrapPayload {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const seed = createSeedData();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as BootstrapPayload;
      if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.users)) {
        if (!Array.isArray(parsed.textures) || parsed.textures.length === 0) {
          parsed.textures = seed.textures;
        }
        if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) {
          parsed.frames = seed.frames;
        }
        if (!Array.isArray(parsed.backdrops) || parsed.backdrops.length === 0) {
          parsed.backdrops = seed.backdrops;
        }
        parsed.stickers = (parsed.stickers || []).map((stk, i) => ({
          ...stk,
          likes: typeof stk.likes === 'number' ? stk.likes : 20 + ((i * 11) % 50),
          createdAt: stk.createdAt || '2024-10-20T10:00:00.000Z',
          category: stk.category || 'musica',
        }));
        parsed.textures = parsed.textures.map((tex, i) => ({
          ...tex,
          likes: typeof tex.likes === 'number' ? tex.likes : 35 + ((i * 13) % 60),
          category: tex.category || 'fantasia',
        }));
        parsed.cards = parsed.cards.map((c, i) => ({
          ...c,
          tradeCategory:
            c.tradeCategory ||
            (c.frameStyle === 'gold' ? 'deportes' : c.concert?.enabled ? 'musica' : 'eventos'),
          tradeExpiresAt:
            c.tradeExpiresAt ??
            (c.tradeable && i === 0
              ? new Date(Date.now() + 14 * 3600 * 1000).toISOString()
              : undefined),
        }));
        parsed.banners = (parsed.banners || []).map((b) => ({
          ...b,
          category: b.category || 'musica',
        }));
        return parsed;
      }
    } catch {
      // fall through to re-seed
    }
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2));
  return seed;
}

let store: BootstrapPayload = loadStore();

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const pushSubscriptions = new Map<
    string,
    { endpoint: string; enabled: boolean; updatedAt: string }
  >();

  function broadcast(event: string, payload: unknown) {
    const msg = JSON.stringify({ event, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ event: 'ws:connected', payload: { timestamp: new Date().toISOString() } }));
  });

  // Bootstrap endpoint
  app.get('/api/bootstrap', (_req, res) => {
    res.json(store);
  });

  // Create card
  app.post('/api/cards', (req, res) => {
    const body = req.body as Partial<Photocard>;
    if (!body.title || !body.photoUrl || !body.ownerId) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (título, foto, usuario).' });
    }
    if (!isSafeImageSource(body.photoUrl)) {
      return res.status(400).json({ error: 'La imagen principal no es válida.' });
    }
    if (body.autographDataUrl && !isSafeImageSource(body.autographDataUrl)) {
      return res.status(400).json({ error: 'La firma digital SVG o imagen no es válida.' });
    }
    if (body.customTextureUrl && !isSafeImageSource(body.customTextureUrl)) {
      return res.status(400).json({ error: 'La textura personalizada no es válida.' });
    }
    if (body.backBackdropUrl && !isSafeImageSource(body.backBackdropUrl)) {
      return res.status(400).json({ error: 'El fondo del reverso no es válido.' });
    }
    const newCard: Photocard = {
      id: body.id || `card-${Date.now()}`,
      serialCode: body.serialCode || `KRM-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerId: body.ownerId,
      creatorId: body.creatorId || body.ownerId,
      albumId: body.albumId || store.albums[0]?.id || 'alb-spheres',
      visibility: body.visibility || 'public',
      tradeable: body.tradeable ?? true,
      tradeWishNote: body.tradeWishNote,
      tradeCategory: body.tradeCategory || 'musica',
      tradeExpiresAt: body.tradeExpiresAt,
      title: String(body.title).slice(0, 120),
      subtitle: String(body.subtitle || '').slice(0, 140),
      ratingOrBadge: String(body.ratingOrBadge || '99').slice(0, 10),
      categoryLabel: String(body.categoryLabel || 'FAN').slice(0, 14),
      countryFlag: String(body.countryFlag || '✨').slice(0, 8),
      location: String(body.location || 'Colección Personal').slice(0, 100),
      eventDate: String(body.eventDate || new Date().toLocaleDateString('es-ES')).slice(0, 40),
      editionLabel: String(body.editionLabel || 'Edición Especial #01').slice(0, 60),
      photoUrl: body.photoUrl,
      frameStyle: body.frameStyle || 'holo',
      frameShape: body.frameShape || 'rectangulo',
      customFrameId: body.customFrameId,
      frameCelebration: body.frameCelebration || 'ninguna',
      primaryColor: body.primaryColor || '#38BDF8',
      secondaryColor: body.secondaryColor || '#E879F9',
      texture: body.texture || 'prism',
      customTextureUrl: body.customTextureUrl,
      shineIntensity: typeof body.shineIntensity === 'number' ? body.shineIntensity : 80,
      filterId: body.filterId || 'filter-original',
      filterSnapshot: body.filterSnapshot || store.filters[0],
      stickers: Array.isArray(body.stickers) ? body.stickers : [],
      stats: Array.isArray(body.stats) ? body.stats : [],
      autographDataUrl: body.autographDataUrl,
      backBackdropUrl: body.backBackdropUrl,
      youtubeUrl: body.youtubeUrl,
      musicLinkUrl: body.musicLinkUrl,
      musicPlatformLabel: body.musicPlatformLabel,
      authorMessage: body.authorMessage || '',
      concert: body.concert,
      likes: 0,
      createdAt: new Date().toISOString(),
    };

    const existingIdx = store.cards.findIndex((c) => c.id === newCard.id);
    if (existingIdx >= 0) {
      store.cards[existingIdx] = newCard;
    } else {
      store.cards.unshift(newCard);
    }
    saveStore();
    broadcast('card:created', newCard);
    return res.status(201).json(newCard);
  });

  // Update card (visibility, album, likes, tradeable, details)
  app.put('/api/cards/:id', (req, res) => {
    const idx = store.cards.findIndex((c) => c.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Photocard no encontrada.' });
    }
    const patch = req.body as Partial<Photocard>;
    if (patch.photoUrl !== undefined && !isSafeImageSource(patch.photoUrl)) {
      return res.status(400).json({ error: 'La imagen principal no es válida.' });
    }
    if (patch.autographDataUrl !== undefined && patch.autographDataUrl !== '' && !isSafeImageSource(patch.autographDataUrl)) {
      return res.status(400).json({ error: 'La firma digital SVG o imagen no es válida.' });
    }
    if (patch.customTextureUrl !== undefined && patch.customTextureUrl !== '' && !isSafeImageSource(patch.customTextureUrl)) {
      return res.status(400).json({ error: 'La textura personalizada no es válida.' });
    }
    if (patch.backBackdropUrl !== undefined && patch.backBackdropUrl !== '' && !isSafeImageSource(patch.backBackdropUrl)) {
      return res.status(400).json({ error: 'El fondo del reverso no es válido.' });
    }
    const updated: Photocard = { ...store.cards[idx], ...patch, id: store.cards[idx].id };
    store.cards[idx] = updated;
    saveStore();
    broadcast('card:updated', updated);
    return res.json(updated);
  });

  // Delete card
  app.delete('/api/cards/:id', (req, res) => {
    const exists = store.cards.some((c) => c.id === req.params.id);
    if (!exists) {
      return res.status(404).json({ error: 'Photocard no encontrada.' });
    }
    store.cards = store.cards.filter((c) => c.id !== req.params.id);
    saveStore();
    broadcast('card:deleted', { id: req.params.id });
    return res.json({ ok: true });
  });

  // Albums
  app.post('/api/albums', (req, res) => {
    const body = req.body as Partial<Album>;
    if (!body.title || !body.ownerId) {
      return res.status(400).json({ error: 'Título y propietario requeridos.' });
    }
    const album: Album = {
      id: body.id || `alb-${Date.now()}`,
      title: body.title,
      description: body.description || '',
      ownerId: body.ownerId,
      visibility: body.visibility || 'public',
      category: body.category || 'concert',
      coverPhotoUrl: body.coverPhotoUrl || '/src/assets/images/kpop_concert_crowd_1795353654618.jpg',
      location: body.location || 'Ubicación personal',
      dateLabel: body.dateLabel || new Date().toLocaleDateString('es-ES'),
      createdAt: new Date().toISOString(),
    };
    store.albums.unshift(album);
    saveStore();
    broadcast('album:created', album);
    return res.status(201).json(album);
  });

  app.put('/api/albums/:id', (req, res) => {
    const idx = store.albums.findIndex((a) => a.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Álbum no encontrado.' });
    }
    store.albums[idx] = { ...store.albums[idx], ...req.body, id: store.albums[idx].id };
    saveStore();
    broadcast('album:updated', store.albums[idx]);
    return res.json(store.albums[idx]);
  });

  // Concert Banners (Carteles)
  app.post('/api/banners', (req, res) => {
    const body = req.body as Partial<ConcertBanner>;
    if (!body.title || !body.photoUrl || !body.ownerId) {
      return res.status(400).json({ error: 'Título, foto y usuario requeridos.' });
    }
    const banner: ConcertBanner = {
      id: `ban-${Date.now()}`,
      ownerId: body.ownerId,
      ownerName: body.ownerName || 'Fan',
      title: body.title,
      artistOrTour: body.artistOrTour || 'Gira en Vivo',
      venue: body.venue || 'Estadio',
      date: body.date || new Date().toLocaleDateString('es-ES'),
      photoUrl: body.photoUrl,
      story: body.story || '',
      idolReaction: body.idolReaction || '¡Momento inolvidable con el público!',
      songTitle: body.songTitle || 'Canción Favorita',
      audioPresetId: body.audioPresetId || 'acoustic-stadium',
      youtubeUrl: body.youtubeUrl,
      musicLinkUrl: body.musicLinkUrl,
      category: body.category || 'eventos',
      visibility: body.visibility || 'public',
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.banners.unshift(banner);
    saveStore();
    broadcast('banner:created', banner);
    return res.status(201).json(banner);
  });

  // Custom Filters (Create & share)
  app.post('/api/filters', (req, res) => {
    const body = req.body as Partial<ImageFilterConfig>;
    if (!body.name) {
      return res.status(400).json({ error: 'Nombre de filtro requerido.' });
    }
    const filter: ImageFilterConfig = {
      id: `filter-${Date.now()}`,
      name: String(body.name).slice(0, 60),
      authorId: body.authorId || 'user-sofia',
      authorName: body.authorName || 'Coleccionista',
      isPublic: body.isPublic ?? true,
      brightness: body.brightness ?? 100,
      contrast: body.contrast ?? 100,
      saturate: body.saturate ?? 100,
      hueRotate: body.hueRotate ?? 0,
      sepia: body.sepia ?? 0,
      grayscale: body.grayscale ?? 0,
      category: body.category || 'fantasia',
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.filters.push(filter);
    saveStore();
    broadcast('filter:created', filter);
    return res.status(201).json(filter);
  });

  // Custom Stickers (Create & share)
  app.post('/api/stickers', (req, res) => {
    const body = req.body as Partial<CustomSticker>;
    if (!body.name || !body.content) {
      return res.status(400).json({ error: 'Nombre y contenido de sticker requeridos.' });
    }
    const sticker: CustomSticker = {
      id: `stk-${Date.now()}`,
      name: String(body.name).slice(0, 60),
      content: body.content,
      isImage: Boolean(body.isImage),
      authorId: body.authorId || 'user-sofia',
      authorName: body.authorName || 'Coleccionista',
      isPublic: body.isPublic ?? true,
      bgColor: body.bgColor,
      textColor: body.textColor,
      category: body.category || 'musica',
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.stickers.push(sticker);
    saveStore();
    broadcast('sticker:created', sticker);
    return res.status(201).json(sticker);
  });

  // Custom Textures (Create, upload & share)
  app.post('/api/textures', (req, res) => {
    const body = req.body as Partial<CustomTexture>;
    if (!body.name || !isSafeImageSource(body.imageUrl)) {
      return res.status(400).json({ error: 'Nombre e imagen válida de textura requeridos.' });
    }
    const newTexture: CustomTexture = {
      id: `tex-${Date.now()}`,
      name: String(body.name).slice(0, 70),
      imageUrl: body.imageUrl!,
      authorId: body.authorId || 'user-sofia',
      authorName: body.authorName || 'Coleccionista',
      isPublic: body.isPublic ?? true,
      patternType: body.patternType || 'prisma',
      primaryColor: body.primaryColor || '#38BDF8',
      secondaryColor: body.secondaryColor || '#E879F9',
      category: body.category || 'fantasia',
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.textures.unshift(newTexture);
    saveStore();
    broadcast('texture:created', newTexture);
    return res.status(201).json(newTexture);
  });

  // Custom & Celebration Frames (Create, customize shape & share)
  app.post('/api/frames', (req, res) => {
    const body = req.body as Partial<CustomFramePreset>;
    if (!body.name || !body.frameShape) {
      return res.status(400).json({ error: 'Nombre y forma de marco requeridos.' });
    }
    const newFrame: CustomFramePreset = {
      id: `frm-${Date.now()}`,
      name: String(body.name).slice(0, 70),
      frameShape: body.frameShape,
      celebrationTheme: body.celebrationTheme || 'ninguna',
      primaryColor: body.primaryColor || '#38BDF8',
      secondaryColor: body.secondaryColor || '#E879F9',
      accentColor: body.accentColor || '#FDE68A',
      borderPattern: body.borderPattern || 'prisma',
      category: body.category || 'celebraciones',
      authorId: body.authorId || 'user-sofia',
      authorName: body.authorName || 'Coleccionista',
      isPublic: body.isPublic ?? true,
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.frames.unshift(newFrame);
    saveStore();
    broadcast('frame:created', newFrame);
    return res.status(201).json(newFrame);
  });

  // Custom Community Backdrops (Fondos de cartas)
  app.post('/api/backdrops', (req, res) => {
    const body = req.body as Partial<CustomBackdrop>;
    if (!body.name || !isSafeImageSource(body.imageUrl)) {
      return res.status(400).json({ error: 'Nombre e imagen válida de fondo requeridos.' });
    }
    const newBackdrop: CustomBackdrop = {
      id: `bg-${Date.now()}`,
      name: String(body.name).slice(0, 70),
      imageUrl: body.imageUrl!,
      atmosphere: String(body.atmosphere || 'Fondo personalizado de la comunidad').slice(0, 100),
      category: body.category || 'eventos',
      authorId: body.authorId || 'user-sofia',
      authorName: body.authorName || 'Coleccionista',
      isPublic: body.isPublic ?? true,
      likes: 1,
      createdAt: new Date().toISOString(),
    };
    store.backdrops.unshift(newBackdrop);
    saveStore();
    broadcast('backdrop:created', newBackdrop);
    return res.status(201).json(newBackdrop);
  });

  // Like / Popularity toggle for community library items
  app.post('/api/assets/like', (req, res) => {
    const { kind, id } = req.body as { kind?: LikableAssetKind; id?: string };
    if (!kind || !id) {
      return res.status(400).json({ error: 'kind e id requeridos.' });
    }
    let nextLikes = 0;
    let found = false;

    if (kind === 'card') {
      const item = store.cards.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    } else if (kind === 'frame') {
      const item = store.frames.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    } else if (kind === 'backdrop') {
      const item = store.backdrops.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    } else if (kind === 'texture') {
      const item = store.textures.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    } else if (kind === 'sticker') {
      const item = store.stickers.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    } else if (kind === 'banner') {
      const item = store.banners.find((x) => x.id === id);
      if (item) {
        item.likes = (item.likes || 0) + 1;
        nextLikes = item.likes;
        found = true;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Elemento no encontrado.' });
    }

    saveStore();
    broadcast('asset:liked', { kind, id, likes: nextLikes });
    return res.json({ kind, id, likes: nextLikes });
  });

  // Friends toggle
  app.post('/api/friends/toggle', (req, res) => {
    const { userId, friendId } = req.body as { userId: string; friendId: string };
    const user = store.users.find((u) => u.id === userId);
    const friend = store.users.find((u) => u.id === friendId);
    if (!user || !friend || userId === friendId) {
      return res.status(400).json({ error: 'Usuarios inválidos.' });
    }
    const isAlready = user.friends.includes(friendId);
    if (isAlready) {
      user.friends = user.friends.filter((id) => id !== friendId);
      friend.friends = friend.friends.filter((id) => id !== userId);
    } else {
      user.friends.push(friendId);
      if (!friend.friends.includes(userId)) {
        friend.friends.push(userId);
      }
      const notif: RealtimeNotification = {
        id: `notif-${Date.now()}`,
        userId: friendId,
        title: 'Nueva conexión de amistad',
        message: `${user.displayName} ahora está conectado contigo. Ya pueden ver sus álbumes "Solo Amigos".`,
        kind: 'community',
        read: false,
        createdAt: new Date().toISOString(),
      };
      store.notifications.unshift(notif);
      broadcast('notification:new', notif);
    }
    saveStore();
    broadcast('users:updated', store.users);
    return res.json({ users: store.users });
  });

  // Google Auth: verify Firebase ID token or Google OAuth access token and generate/sync CollectorUser
  app.post('/api/auth/google', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const body = req.body as { idToken?: string; accessToken?: string };
      const idToken = bearerToken || (typeof body.idToken === 'string' ? body.idToken.trim() : '');
      const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';

      let verifiedUid = '';
      let verifiedName = '';
      let verifiedEmail = '';
      let verifiedPhoto = '';

      const apiKey = getFirebaseWebApiKey();
      if (idToken && apiKey) {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );
        if (verifyRes.ok) {
          const payload = (await verifyRes.json()) as {
            users?: Array<{
              localId?: string;
              email?: string;
              displayName?: string;
              photoUrl?: string;
            }>;
          };
          const fbUser = payload.users?.[0];
          if (fbUser?.localId) {
            verifiedUid = fbUser.localId;
            verifiedName = fbUser.displayName || '';
            verifiedEmail = fbUser.email || '';
            verifiedPhoto = fbUser.photoUrl || '';
          }
        }
      }

      if (!verifiedUid && accessToken) {
        const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (infoRes.ok) {
          const info = (await infoRes.json()) as {
            sub?: string;
            name?: string;
            email?: string;
            picture?: string;
          };
          if (info.sub) {
            verifiedUid = `gis-${info.sub}`;
            verifiedName = info.name || '';
            verifiedEmail = info.email || '';
            verifiedPhoto = info.picture || '';
          }
        }
      }

      if (!verifiedUid) {
        return res.status(401).json({ error: 'No se pudo verificar la sesión de Google.' });
      }

      const safePhoto = isSafeImageSource(verifiedPhoto) ? verifiedPhoto : undefined;
      const fallbackName =
        verifiedName.trim() ||
        (verifiedEmail ? verifiedEmail.split('@')[0] : '') ||
        'Coleccionista';

      let existing = store.users.find((u) => u.googleUid === verifiedUid);
      let isNewUser = false;
      let createdAlbum: Album | undefined;

      if (existing) {
        existing.displayName = existing.displayName || fallbackName.slice(0, 60);
        if (safePhoto) {
          existing.photoUrl = safePhoto;
        }
      } else {
        isNewUser = true;
        const cleanSlugBase = (verifiedEmail ? verifiedEmail.split('@')[0] : fallbackName)
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 18) || 'coleccionista';
        let candidateHandle = `@${cleanSlugBase}`;
        let suffix = 1;
        while (store.users.some((u) => u.handle.toLowerCase() === candidateHandle.toLowerCase())) {
          candidateHandle = `@${cleanSlugBase}_${suffix}`;
          suffix += 1;
        }

        const palette = ['#38BDF8', '#E879F9', '#F59E0B', '#34D399', '#FB7185'];
        const avatarColor = palette[store.users.length % palette.length];
        const safeUidPart = verifiedUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18);

        existing = {
          id: `user-g-${safeUidPart || Date.now()}`,
          handle: candidateHandle,
          displayName: fallbackName.slice(0, 60),
          avatarColor,
          bio: 'Coleccionista en Kromacard conectado con Google.',
          favoriteArtist: 'Mi Artista Favorito',
          friends: [],
          googleUid: verifiedUid,
          ...(safePhoto ? { photoUrl: safePhoto } : {}),
        };
        store.users.push(existing);

        const hasAlbum = store.albums.some((a) => a.ownerId === existing!.id);
        if (!hasAlbum) {
          createdAlbum = {
            id: `alb-${Date.now()}`,
            title: `Colección de ${existing.displayName}`,
            description: 'Álbum personal generado al conectar tu cuenta de Google.',
            ownerId: existing.id,
            visibility: 'public',
            category: 'concert',
            coverPhotoUrl: '/src/assets/images/kpop_concert_crowd_1795353654618.jpg',
            location: 'Mi Bóveda Personal',
            dateLabel: new Date().getFullYear().toString(),
            createdAt: new Date().toISOString(),
          };
          store.albums.unshift(createdAlbum);
        }
      }

      saveStore();
      broadcast('users:updated', store.users);
      if (createdAlbum) {
        broadcast('album:created', createdAlbum);
      }
      return res.json({ user: existing, isNewUser, album: createdAlbum });
    } catch {
      return res.status(500).json({ error: 'Error al generar el usuario con Google.' });
    }
  });

  // User profile update (whitelisted fields)
  app.put('/api/users/:id', (req, res) => {
    const idx = store.users.findIndex((u) => u.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    }
    const body = req.body as Partial<CollectorUser>;
    const current = store.users[idx];
    store.users[idx] = {
      ...current,
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 60)
          : current.displayName,
      bio: typeof body.bio === 'string' ? body.bio.slice(0, 240) : current.bio,
      favoriteArtist:
        typeof body.favoriteArtist === 'string'
          ? body.favoriteArtist.slice(0, 80)
          : current.favoriteArtist,
      avatarColor:
        typeof body.avatarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.avatarColor)
          ? body.avatarColor
          : current.avatarColor,
    };
    saveStore();
    broadcast('users:updated', store.users);
    return res.json(store.users[idx]);
  });

  // Propose Trade or Gift
  app.post('/api/trades', (req, res) => {
    const { type, fromUserId, toUserId, offeredCardId, requestedCardId, message } = req.body as Partial<TradeOffer>;
    if (!fromUserId || !toUserId || !requestedCardId || !type) {
      return res.status(400).json({ error: 'Datos de intercambio incompletos.' });
    }
    const targetCard = store.cards.find((c) => c.id === requestedCardId);
    if (!targetCard) {
      return res.status(404).json({ error: 'Carta solicitada no encontrada.' });
    }
    const fromUser = store.users.find((u) => u.id === fromUserId);
    const verificationCode = `VER-${Math.floor(100000 + Math.random() * 900000)}`;

    // If gift: immediately transfer offeredCardId to toUserId
    if (type === 'gift' && offeredCardId) {
      const giftedIdx = store.cards.findIndex((c) => c.id === offeredCardId && c.ownerId === fromUserId);
      if (giftedIdx < 0) {
        return res.status(400).json({ error: 'No eres propietario de la carta para regalar.' });
      }
      store.cards[giftedIdx] = { ...store.cards[giftedIdx], ownerId: toUserId };
      const giftTrade: TradeOffer = {
        id: `trd-${Date.now()}`,
        type: 'gift',
        fromUserId,
        toUserId,
        offeredCardId,
        requestedCardId: offeredCardId,
        verificationCode,
        message: message || '¡Te envío esta photocard de regalo!',
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      store.trades.unshift(giftTrade);
      const notif: RealtimeNotification = {
        id: `notif-${Date.now()}`,
        userId: toUserId,
        title: 'Recibiste un regalo verificado',
        message: `${fromUser?.displayName || 'Un fan'} te regaló "${store.cards[giftedIdx].title}" (${verificationCode}).`,
        kind: 'gift',
        relatedCardId: offeredCardId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      store.notifications.unshift(notif);
      saveStore();
      broadcast('card:updated', store.cards[giftedIdx]);
      broadcast('trade:created', giftTrade);
      broadcast('notification:new', notif);
      return res.status(201).json(giftTrade);
    }

    const offer: TradeOffer = {
      id: `trd-${Date.now()}`,
      type: 'swap',
      fromUserId,
      toUserId,
      offeredCardId,
      requestedCardId,
      verificationCode,
      message: message || 'Propuesta de intercambio seguro en Kromacard.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.trades.unshift(offer);

    const notif: RealtimeNotification = {
      id: `notif-${Date.now()}`,
      userId: toUserId,
      title: 'Nueva solicitud de trueque seguro',
      message: `${fromUser?.displayName || 'Un coleccionista'} quiere intercambiar por "${targetCard.title}" (${verificationCode}).`,
      kind: 'trade',
      relatedCardId: requestedCardId,
      relatedTradeId: offer.id,
      read: false,
      createdAt: new Date().toISOString(),
    };
    store.notifications.unshift(notif);
    saveStore();
    broadcast('trade:created', offer);
    broadcast('notification:new', notif);
    return res.status(201).json(offer);
  });

  // Accept or Decline Trade (atomic ownership swap!)
  app.post('/api/trades/:id/respond', (req, res) => {
    const { action, actorUserId } = req.body as { action: 'accept' | 'decline'; actorUserId: string };
    const idx = store.trades.findIndex((t) => t.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Oferta de trueque no encontrada.' });
    }
    const trade = store.trades[idx];
    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Este intercambio ya fue procesado.' });
    }
    if (trade.toUserId !== actorUserId) {
      return res.status(403).json({ error: 'Solo el destinatario puede confirmar este trueque.' });
    }

    if (action === 'decline') {
      trade.status = 'declined';
      const notif: RealtimeNotification = {
        id: `notif-${Date.now()}`,
        userId: trade.fromUserId,
        title: 'Trueque rechazado',
        message: `La solicitud ${trade.verificationCode} fue declinada.`,
        kind: 'trade',
        relatedCardId: trade.requestedCardId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      store.notifications.unshift(notif);
      saveStore();
      broadcast('trade:updated', trade);
      broadcast('notification:new', notif);
      return res.json(trade);
    }

    // Verify ownership of both cards before atomic swap
    const reqCardIdx = store.cards.findIndex((c) => c.id === trade.requestedCardId && c.ownerId === trade.toUserId);
    const offCardIdx = trade.offeredCardId
      ? store.cards.findIndex((c) => c.id === trade.offeredCardId && c.ownerId === trade.fromUserId)
      : -1;

    if (reqCardIdx < 0 || offCardIdx < 0) {
      return res.status(409).json({ error: 'Una de las cartas ya cambió de dueño.' });
    }

    store.cards[reqCardIdx] = { ...store.cards[reqCardIdx], ownerId: trade.fromUserId };
    store.cards[offCardIdx] = { ...store.cards[offCardIdx], ownerId: trade.toUserId };
    trade.status = 'completed';

    const notifFrom: RealtimeNotification = {
      id: `notif-${Date.now()}-a`,
      userId: trade.fromUserId,
      title: '¡Trueque verificado y completado!',
      message: `Recibiste "${store.cards[reqCardIdx].title}" en tu bóveda (${trade.verificationCode}).`,
      kind: 'trade',
      relatedCardId: trade.requestedCardId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const notifTo: RealtimeNotification = {
      id: `notif-${Date.now()}-b`,
      userId: trade.toUserId,
      title: 'Intercambio exitoso',
      message: `Recibiste "${store.cards[offCardIdx].title}" en tu colección (${trade.verificationCode}).`,
      kind: 'trade',
      relatedCardId: trade.offeredCardId,
      read: false,
      createdAt: new Date().toISOString(),
    };

    store.notifications.unshift(notifFrom, notifTo);
    saveStore();
    broadcast('card:updated', store.cards[reqCardIdx]);
    broadcast('card:updated', store.cards[offCardIdx]);
    broadcast('trade:updated', trade);
    broadcast('notification:new', notifFrom);
    broadcast('notification:new', notifTo);
    return res.json(trade);
  });

  // Mark notifications read
  app.post('/api/notifications/read', (req, res) => {
    const { userId } = req.body as { userId: string };
    store.notifications = store.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n));
    saveStore();
    return res.json({ ok: true });
  });

  // Register PWA push subscription state per collector
  app.post('/api/push/subscribe', (req, res) => {
    const { userId, enabled = true, endpoint } = req.body as {
      userId?: string;
      enabled?: boolean;
      endpoint?: string;
    };
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido.' });
    }
    if (!enabled) {
      pushSubscriptions.delete(userId);
      return res.json({ ok: true, enabled: false });
    }
    pushSubscriptions.set(userId, {
      endpoint: endpoint || `sw-local://${userId}`,
      enabled: true,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ ok: true, enabled: true, totalSubscriptions: pushSubscriptions.size });
  });

  // Trigger a scheduled background trade notification demo over WebSocket -> Service Worker
  app.post('/api/push/test', (req, res) => {
    const { userId, delayMs = 4000 } = req.body as { userId?: string; delayMs?: number };
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido.' });
    }
    const clampedDelay = Math.max(0, Math.min(10000, Number(delayMs) || 0));
    const sender = store.users.find((u) => u.id !== userId) || store.users[0];
    const targetCard = store.cards.find((c) => c.ownerId === userId) || store.cards[0];

    setTimeout(() => {
      const code = `VER-${Math.floor(100000 + Math.random() * 900000)}`;
      const notif: RealtimeNotification = {
        id: `notif-push-${Date.now()}`,
        userId,
        title: 'Nueva oferta de trueque en Kromacard',
        message: `${sender?.displayName || 'Otro coleccionista'} envió una propuesta por "${targetCard?.title || 'tu photocard'}" (${code}).`,
        kind: 'trade',
        relatedCardId: targetCard?.id,
        triggerPush: true,
        read: false,
        createdAt: new Date().toISOString(),
      };
      store.notifications.unshift(notif);
      saveStore();
      broadcast('notification:new', notif);
    }, clampedDelay);

    return res.json({ ok: true, scheduledInMs: clampedDelay });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kromacard server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
