export type FrameStyle = 'holo' | 'gold' | 'stadium' | 'custom' | 'polaroid';

export type FrameShape =
  | 'rectangulo'
  | 'escudo'
  | 'ticket'
  | 'corazon'
  | 'hexagono'
  | 'polaroid'
  | 'arco';

export type CelebrationTheme =
  | 'ninguna'
  | 'navidad'
  | 'halloween'
  | 'san-valentin'
  | 'ano-nuevo'
  | 'cumpleanos'
  | 'aniversario'
  | 'concierto';

export type CommunityCategory =
  | 'musica'
  | 'eventos'
  | 'celebraciones'
  | 'deportes'
  | 'fantasia'
  | 'edicion-limitada';

export type TextureEffect =
  | 'prism'
  | 'stadium'
  | 'gold-relief'
  | 'carbon'
  | 'none'
  | 'holo-prism-shards'
  | 'holo-cosmos-galaxy'
  | 'holo-cracked-ice'
  | 'holo-gold-filigree'
  | 'holo-laser-confetti'
  | 'holo-party-fiesta'
  | 'holo-halloween-spooky'
  | 'holo-christmas-festive'
  | 'holo-valentines-hearts'
  | 'holo-fireworks-gala'
  | 'holo-winter-frost'
  | 'holo-winter-aurora'
  | 'holo-christmas-ornaments'
  | 'holo-newyear-champagne'
  | 'holo-festive-snowlight';

export type VisibilityMode = 'public' | 'friends' | 'private';

export interface CardStat {
  label: string;
  value: number;
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  name: string;
  content: string;
  isImage: boolean;
  x: number; // percentage 10-90
  y: number; // percentage 10-90
  scale: number; // 0.6 to 2.0
  rotation: number; // degrees
  bgColor?: string;
  textColor?: string;
}

export interface ImageFilterConfig {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  brightness: number; // 100 default
  contrast: number; // 100 default
  saturate: number; // 100 default
  hueRotate: number; // 0 default
  sepia: number; // 0 default
  grayscale: number; // 0 default
  category?: CommunityCategory;
  likes?: number;
  createdAt?: string;
}

export interface CustomSticker {
  id: string;
  name: string;
  content: string; // emoji/text or image dataURL
  isImage: boolean;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  bgColor?: string;
  textColor?: string;
  category?: CommunityCategory;
  likes?: number;
  createdAt?: string;
}

export type TexturePatternType =
  | 'prisma'
  | 'ondas'
  | 'malla'
  | 'estelar'
  | 'cuadricula'
  | 'subida';

export interface CustomTexture {
  id: string;
  name: string;
  imageUrl: string;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  patternType: TexturePatternType;
  primaryColor: string;
  secondaryColor: string;
  category?: CommunityCategory;
  likes?: number;
  createdAt: string;
}

export interface CustomFramePreset {
  id: string;
  name: string;
  frameShape: FrameShape;
  celebrationTheme: CelebrationTheme;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderPattern: 'solido' | 'metalico' | 'prisma' | 'festivo' | 'neon';
  category: CommunityCategory;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  likes: number;
  createdAt: string;
}

export interface CustomBackdrop {
  id: string;
  name: string;
  imageUrl: string;
  atmosphere: string;
  category: CommunityCategory;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  likes: number;
  createdAt: string;
}

export interface ConcertTicketInfo {
  enabled: boolean;
  tourName: string;
  artist: string;
  zone: string;
  access: string;
  seatOrRow: string;
  dateTime: string;
  ticketCode: string;
  favoriteSong: string;
  audioPresetId: string;
  customAudioUrl?: string;
  customAudioTitle?: string;
}

export interface Photocard {
  id: string;
  serialCode: string;
  ownerId: string;
  creatorId: string;
  albumId: string;
  visibility: VisibilityMode;
  tradeable: boolean;
  tradeWishNote?: string;
  tradeCategory?: CommunityCategory;
  tradeExpiresAt?: string;
  title: string;
  subtitle: string;
  ratingOrBadge: string;
  categoryLabel: string;
  countryFlag: string;
  location: string;
  eventDate: string;
  editionLabel: string;
  photoUrl: string;
  frameStyle: FrameStyle;
  frameShape?: FrameShape;
  customFrameId?: string;
  frameCelebration?: CelebrationTheme;
  primaryColor: string;
  secondaryColor: string;
  texture: TextureEffect;
  customTextureUrl?: string;
  shineIntensity: number; // 0-100
  filterId: string;
  filterSnapshot: ImageFilterConfig;
  stickers: PlacedSticker[];
  stats: CardStat[];
  autographDataUrl?: string;
  backBackdropUrl?: string;
  youtubeUrl?: string;
  musicLinkUrl?: string;
  musicPlatformLabel?: string;
  authorMessage: string;
  concert?: ConcertTicketInfo;
  likes: number;
  createdAt: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  visibility: VisibilityMode;
  category: 'concert' | 'sports' | 'family' | 'idol';
  coverPhotoUrl: string;
  location: string;
  dateLabel: string;
  createdAt: string;
}

export interface ConcertBanner {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  artistOrTour: string;
  venue: string;
  date: string;
  photoUrl: string;
  story: string;
  idolReaction: string;
  songTitle: string;
  audioPresetId: string;
  youtubeUrl?: string;
  musicLinkUrl?: string;
  category?: CommunityCategory;
  visibility: VisibilityMode;
  likes: number;
  createdAt: string;
}

export interface CollectorUser {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  bio: string;
  favoriteArtist: string;
  friends: string[];
  googleUid?: string;
  photoUrl?: string;
}

export interface TradeOffer {
  id: string;
  type: 'swap' | 'gift';
  fromUserId: string;
  toUserId: string;
  offeredCardId?: string;
  requestedCardId: string;
  verificationCode: string;
  message: string;
  status: 'pending' | 'completed' | 'declined';
  createdAt: string;
}

export interface RealtimeNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: 'trade' | 'gift' | 'community' | 'system';
  relatedCardId?: string;
  relatedTradeId?: string;
  triggerPush?: boolean;
  read: boolean;
  createdAt: string;
}

export type LikableAssetKind =
  | 'card'
  | 'frame'
  | 'backdrop'
  | 'texture'
  | 'sticker'
  | 'banner';

export interface BootstrapPayload {
  users: CollectorUser[];
  cards: Photocard[];
  albums: Album[];
  banners: ConcertBanner[];
  filters: ImageFilterConfig[];
  stickers: CustomSticker[];
  textures: CustomTexture[];
  frames: CustomFramePreset[];
  backdrops: CustomBackdrop[];
  trades: TradeOffer[];
  notifications: RealtimeNotification[];
}
