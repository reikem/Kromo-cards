import type {
  CelebrationTheme,
  CommunityCategory,
  FrameShape,
} from '../types/kromacard';

export interface FrameShapeSpec {
  id: FrameShape;
  label: string;
  desc: string;
  clipPath?: string;
}

export const FRAME_SHAPE_SPECS: FrameShapeSpec[] = [
  {
    id: 'rectangulo',
    label: 'Clásico',
    desc: 'Borde redondeado estándar',
  },
  {
    id: 'escudo',
    label: 'Escudo VIP',
    desc: 'Silueta torneo / campeonato',
    clipPath: 'polygon(50% 0%, 100% 10%, 100% 72%, 50% 100%, 0% 72%, 0% 10%)',
  },
  {
    id: 'ticket',
    label: 'Boleto Tour',
    desc: 'Esquinas troqueladas concierto',
    clipPath:
      'polygon(10% 0%, 90% 0%, 100% 8%, 94% 16%, 100% 24%, 100% 76%, 94% 84%, 100% 92%, 90% 100%, 10% 100%, 0% 92%, 6% 84%, 0% 76%, 0% 24%, 6% 16%, 0% 8%)',
  },
  {
    id: 'hexagono',
    label: 'Diamante',
    desc: 'Corte geométrico futurista',
    clipPath: 'polygon(14% 0%, 86% 0%, 100% 14%, 100% 86%, 86% 100%, 14% 100%, 0% 86%, 0% 14%)',
  },
  {
    id: 'arco',
    label: 'Arco Gala',
    desc: 'Cúpula superior conmemorativa',
    clipPath: 'polygon(0% 18%, 8% 7%, 24% 2%, 50% 0%, 76% 2%, 92% 7%, 100% 18%, 100% 100%, 0% 100%)',
  },
  {
    id: 'corazon',
    label: 'Corazón Fan',
    desc: 'Corte romántico / San Valentín',
    clipPath: 'polygon(50% 6%, 72% 0%, 92% 6%, 100% 22%, 100% 62%, 82% 88%, 50% 100%, 18% 88%, 0% 62%, 0% 22%, 8% 6%, 28% 0%)',
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    desc: 'Marco blanco instantáneo',
  },
];

export interface CelebrationThemeSpec {
  id: CelebrationTheme;
  label: string;
  emblem: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const CELEBRATION_THEMES: CelebrationThemeSpec[] = [
  {
    id: 'ninguna',
    label: 'Estándar',
    emblem: '✨',
    primaryColor: '#38BDF8',
    secondaryColor: '#E879F9',
    accentColor: '#FDE68A',
  },
  {
    id: 'navidad',
    label: 'Navidad',
    emblem: '🎄',
    primaryColor: '#EF4444',
    secondaryColor: '#10B981',
    accentColor: '#FDE68A',
  },
  {
    id: 'halloween',
    label: 'Halloween',
    emblem: '🎃',
    primaryColor: '#F97316',
    secondaryColor: '#7C3AED',
    accentColor: '#FACC15',
  },
  {
    id: 'san-valentin',
    label: 'San Valentín',
    emblem: '💖',
    primaryColor: '#FB7185',
    secondaryColor: '#EC4899',
    accentColor: '#FFE4E6',
  },
  {
    id: 'ano-nuevo',
    label: 'Año Nuevo',
    emblem: '🥂',
    primaryColor: '#F59E0B',
    secondaryColor: '#1E293B',
    accentColor: '#FEF08A',
  },
  {
    id: 'cumpleanos',
    label: 'Cumpleaños',
    emblem: '🎂',
    primaryColor: '#38BDF8',
    secondaryColor: '#F472B6',
    accentColor: '#FACC15',
  },
  {
    id: 'aniversario',
    label: 'Aniversario',
    emblem: '💐',
    primaryColor: '#A855F7',
    secondaryColor: '#F43F5E',
    accentColor: '#FDE68A',
  },
  {
    id: 'concierto',
    label: 'Concierto Live',
    emblem: '🎤',
    primaryColor: '#22D3EE',
    secondaryColor: '#C084FC',
    accentColor: '#38BDF8',
  },
];

export const COMMUNITY_CATEGORIES: { id: CommunityCategory; label: string }[] = [
  { id: 'musica', label: 'Música' },
  { id: 'eventos', label: 'Eventos y Giras' },
  { id: 'celebraciones', label: 'Celebraciones' },
  { id: 'deportes', label: 'Deportes' },
  { id: 'fantasia', label: 'Fantasía y Holo' },
  { id: 'edicion-limitada', label: 'Edición Limitada' },
];

export function getCommunityCategoryLabel(cat?: CommunityCategory): string {
  return COMMUNITY_CATEGORIES.find((c) => c.id === cat)?.label || 'General';
}

export function getFrameShapeClipPath(shape?: FrameShape): string | undefined {
  if (!shape || shape === 'rectangulo' || shape === 'polaroid') return undefined;
  return FRAME_SHAPE_SPECS.find((s) => s.id === shape)?.clipPath;
}

export function getCelebrationSpec(theme?: CelebrationTheme): CelebrationThemeSpec | undefined {
  if (!theme || theme === 'ninguna') return undefined;
  return CELEBRATION_THEMES.find((t) => t.id === theme);
}

export function formatRemainingTime(expiresAt?: string, nowMs = Date.now()): {
  isTimed: boolean;
  expired: boolean;
  label: string;
} {
  if (!expiresAt) {
    return { isTimed: false, expired: false, label: 'Sin límite' };
  }
  const diff = new Date(expiresAt).getTime() - nowMs;
  if (Number.isNaN(diff)) {
    return { isTimed: false, expired: false, label: 'Sin límite' };
  }
  if (diff <= 0) {
    return { isTimed: true, expired: true, label: 'Tiempo finalizado' };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return { isTimed: true, expired: false, label: `${days}d ${hours}h ${mins}m` };
  }
  if (hours > 0) {
    return { isTimed: true, expired: false, label: `${hours}h ${String(mins).padStart(2, '0')}m` };
  }
  return {
    isTimed: true,
    expired: false,
    label: `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`,
  };
}
