export type StickerCategoryId = 'emociones' | 'musica' | 'eventos';

export interface PresetStickerItem {
  id: string;
  category: StickerCategoryId;
  name: string;
  content: string;
  isImage: boolean;
}

export const STICKER_CATEGORIES: { id: StickerCategoryId; label: string }[] = [
  { id: 'emociones', label: 'Emociones' },
  { id: 'musica', label: 'Música' },
  { id: 'eventos', label: 'Eventos' },
];

export const PRESET_STICKER_LIBRARY: PresetStickerItem[] = [
  // Emociones
  { id: 'lib-emo-heart', category: 'emociones', name: 'Corazón', content: '💖', isImage: false },
  { id: 'lib-emo-hands', category: 'emociones', name: 'Manos Amor', content: '🫶', isImage: false },
  { id: 'lib-emo-fire', category: 'emociones', name: 'Fuego', content: '🔥', isImage: false },
  { id: 'lib-emo-starry', category: 'emociones', name: 'Deslumbrado', content: '🤩', isImage: false },
  { id: 'lib-emo-cry', category: 'emociones', name: 'Emoción', content: '😭', isImage: false },
  { id: 'lib-emo-sparkles', category: 'emociones', name: 'Magia', content: '✨', isImage: false },
  { id: 'lib-emo-love', category: 'emociones', name: 'Enamorado', content: '😍', isImage: false },
  { id: 'lib-emo-badge-1', category: 'emociones', name: 'Te Amo', content: 'TE AMO', isImage: false },
  { id: 'lib-emo-badge-2', category: 'emociones', name: 'Inolvidable', content: 'INOLVIDABLE', isImage: false },

  // Música
  { id: 'lib-mus-mic', category: 'musica', name: 'Micrófono', content: '🎤', isImage: false },
  { id: 'lib-mus-notes', category: 'musica', name: 'Notas', content: '🎶', isImage: false },
  { id: 'lib-mus-guitar', category: 'musica', name: 'Guitarra', content: '🎸', isImage: false },
  { id: 'lib-mus-headphones', category: 'musica', name: 'Audio', content: '🎧', isImage: false },
  { id: 'lib-mus-disc', category: 'musica', name: 'Disco', content: '💿', isImage: false },
  { id: 'lib-mus-drums', category: 'musica', name: 'Batería', content: '🥁', isImage: false },
  { id: 'lib-mus-score', category: 'musica', name: 'Melodía', content: '🎼', isImage: false },
  { id: 'lib-mus-badge-1', category: 'musica', name: 'Encore', content: 'ENCORE', isImage: false },
  { id: 'lib-mus-badge-2', category: 'musica', name: 'Setlist VIP', content: 'SETLIST VIP', isImage: false },

  // Eventos
  { id: 'lib-evt-ticket', category: 'eventos', name: 'Boleto', content: '🎟️', isImage: false },
  { id: 'lib-evt-stadium', category: 'eventos', name: 'Estadio', content: '🏟️', isImage: false },
  { id: 'lib-evt-crown', category: 'eventos', name: 'VIP', content: '👑', isImage: false },
  { id: 'lib-evt-party', category: 'eventos', name: 'Fiesta', content: '🎉', isImage: false },
  { id: 'lib-evt-halloween', category: 'eventos', name: 'Halloween', content: '🎃', isImage: false },
  { id: 'lib-evt-christmas', category: 'eventos', name: 'Navidad', content: '🎄', isImage: false },
  { id: 'lib-evt-valentine', category: 'eventos', name: 'San Valentín', content: '💘', isImage: false },
  { id: 'lib-evt-toast', category: 'eventos', name: 'Brindis', content: '🥂', isImage: false },
  { id: 'lib-evt-cake', category: 'eventos', name: 'Cumpleaños', content: '🎂', isImage: false },
  { id: 'lib-evt-badge-1', category: 'eventos', name: 'Primera Fila', content: 'PRIMERA FILA', isImage: false },
  { id: 'lib-evt-badge-2', category: 'eventos', name: 'Edición 2025', content: 'EDICIÓN 2025', isImage: false },
];
