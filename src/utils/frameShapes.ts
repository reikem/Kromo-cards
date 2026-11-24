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

export interface FrameLayoutSpec {
  shape: FrameShape;
  photoClipPath?: string;
  photoObjectPosition: string;
  frontPlatePadding: string;
  topLeftInset: { top: string; left: string };
  topRightInset: { top: string; right: string };
  bottomOverlayInset: { bottom: string; left: string; right: string };
  footerPadding: { paddingLeft: string; paddingRight: string; paddingBottom: string };
  centerBottom: boolean;
  backPadding: { padding: string };
  backHeaderCentered: boolean;
  backFooterPadding: { paddingLeft: string; paddingRight: string };
  previewPadding: string;
  narrowShape: boolean;
}

export function getFrameLayoutSpec(shape?: FrameShape): FrameLayoutSpec {
  const effective: FrameShape = shape || 'rectangulo';

  switch (effective) {
    case 'escudo':
      return {
        shape: effective,
        photoClipPath: 'polygon(50% 0%, 100% 11%, 100% 88%, 50% 100%, 0% 88%, 0% 11%)',
        photoObjectPosition: '50% 26%',
        frontPlatePadding: '6px 6px 8% 6px',
        topLeftInset: { top: '12%', left: '7%' },
        topRightInset: { top: '12%', right: '7%' },
        bottomOverlayInset: { bottom: '10%', left: '14%', right: '14%' },
        footerPadding: { paddingLeft: '17%', paddingRight: '17%', paddingBottom: '2%' },
        centerBottom: true,
        backPadding: { padding: '12% 10% 14% 10%' },
        backHeaderCentered: true,
        backFooterPadding: { paddingLeft: '11%', paddingRight: '11%' },
        previewPadding: '14% 12% 18% 12%',
        narrowShape: true,
      };
    case 'corazon':
      return {
        shape: effective,
        photoClipPath:
          'polygon(50% 7%, 72% 0%, 92% 6%, 100% 24%, 100% 74%, 82% 96%, 50% 100%, 18% 96%, 0% 74%, 0% 24%, 8% 6%, 28% 0%)',
        photoObjectPosition: '50% 28%',
        frontPlatePadding: '6px 6px 9% 6px',
        topLeftInset: { top: '13%', left: '8%' },
        topRightInset: { top: '13%', right: '8%' },
        bottomOverlayInset: { bottom: '11%', left: '16%', right: '16%' },
        footerPadding: { paddingLeft: '19%', paddingRight: '19%', paddingBottom: '2%' },
        centerBottom: true,
        backPadding: { padding: '13% 11% 15% 11%' },
        backHeaderCentered: true,
        backFooterPadding: { paddingLeft: '13%', paddingRight: '13%' },
        previewPadding: '16% 14% 20% 14%',
        narrowShape: true,
      };
    case 'hexagono':
      return {
        shape: effective,
        photoClipPath:
          'polygon(14% 0%, 86% 0%, 100% 14%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 14%)',
        photoObjectPosition: '50% 30%',
        frontPlatePadding: '7px 7px 9px 7px',
        topLeftInset: { top: '11%', left: '10%' },
        topRightInset: { top: '11%', right: '10%' },
        bottomOverlayInset: { bottom: '8%', left: '12%', right: '12%' },
        footerPadding: { paddingLeft: '13%', paddingRight: '13%', paddingBottom: '2%' },
        centerBottom: true,
        backPadding: { padding: '10% 10% 11% 10%' },
        backHeaderCentered: true,
        backFooterPadding: { paddingLeft: '8%', paddingRight: '8%' },
        previewPadding: '14% 12%',
        narrowShape: true,
      };
    case 'arco':
      return {
        shape: effective,
        photoClipPath:
          'polygon(0% 19%, 8% 7%, 24% 2%, 50% 0%, 76% 2%, 92% 7%, 100% 19%, 100% 100%, 0% 100%)',
        photoObjectPosition: '50% 28%',
        frontPlatePadding: '7px',
        topLeftInset: { top: '13%', left: '7%' },
        topRightInset: { top: '13%', right: '7%' },
        bottomOverlayInset: { bottom: '10px', left: '10px', right: '10px' },
        footerPadding: { paddingLeft: '6px', paddingRight: '6px', paddingBottom: '2px' },
        centerBottom: false,
        backPadding: { padding: '14% 14px 14px 14px' },
        backHeaderCentered: true,
        backFooterPadding: { paddingLeft: '0px', paddingRight: '0px' },
        previewPadding: '18% 10% 10% 10%',
        narrowShape: false,
      };
    case 'ticket':
      return {
        shape: effective,
        photoClipPath:
          'polygon(10% 0%, 90% 0%, 100% 9%, 94% 18%, 100% 27%, 100% 94%, 94% 100%, 6% 100%, 0% 94%, 0% 27%, 6% 18%, 0% 9%)',
        photoObjectPosition: '50% 35%',
        frontPlatePadding: '8px 10px 8px 10px',
        topLeftInset: { top: '9%', left: '9%' },
        topRightInset: { top: '9%', right: '9%' },
        bottomOverlayInset: { bottom: '10px', left: '9%', right: '9%' },
        footerPadding: { paddingLeft: '10%', paddingRight: '10%', paddingBottom: '2px' },
        centerBottom: false,
        backPadding: { padding: '10% 11% 10% 11%' },
        backHeaderCentered: false,
        backFooterPadding: { paddingLeft: '3%', paddingRight: '3%' },
        previewPadding: '12% 14%',
        narrowShape: true,
      };
    case 'polaroid':
      return {
        shape: effective,
        photoObjectPosition: '50% 30%',
        frontPlatePadding: '10px 10px 12px 10px',
        topLeftInset: { top: '8px', left: '8px' },
        topRightInset: { top: '8px', right: '8px' },
        bottomOverlayInset: { bottom: '8px', left: '10px', right: '10px' },
        footerPadding: { paddingLeft: '4px', paddingRight: '4px', paddingBottom: '2px' },
        centerBottom: false,
        backPadding: { padding: '14px' },
        backHeaderCentered: false,
        backFooterPadding: { paddingLeft: '0px', paddingRight: '0px' },
        previewPadding: '10px 10px 16px 10px',
        narrowShape: false,
      };
    case 'rectangulo':
    default:
      return {
        shape: effective,
        photoObjectPosition: '50% 35%',
        frontPlatePadding: '8px',
        topLeftInset: { top: '10px', left: '10px' },
        topRightInset: { top: '10px', right: '10px' },
        bottomOverlayInset: { bottom: '10px', left: '10px', right: '10px' },
        footerPadding: { paddingLeft: '4px', paddingRight: '4px', paddingBottom: '0px' },
        centerBottom: false,
        backPadding: { padding: '14px' },
        backHeaderCentered: false,
        backFooterPadding: { paddingLeft: '0px', paddingRight: '0px' },
        previewPadding: '8px',
        narrowShape: false,
      };
  }
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
