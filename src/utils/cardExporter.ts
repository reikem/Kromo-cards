import QRCode from 'qrcode';
import type { FrameShape, ImageFilterConfig, Photocard } from '../types/kromacard';
import { getCelebrationSpec } from './frameShapes';
import { getHoloTextureOverlayUrl } from './holoTextures';
import { decodeSvgDataUrl, isSvgDataUrl } from './svgSignature';

export function buildFilterCss(filter: ImageFilterConfig): string {
  return `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturate}%) hue-rotate(${filter.hueRotate}deg) sepia(${filter.sepia}%) grayscale(${filter.grayscale}%)`;
}

export function getCardDeepLink(cardId: string): string {
  if (typeof window === 'undefined') return `https://kromacard.app/?card=${cardId}`;
  return `${window.location.origin}/?card=${encodeURIComponent(cardId)}`;
}

export async function generateCardQRDataUrl(cardId: string): Promise<string> {
  const url = getCardDeepLink(cardId);
  return QRCode.toDataURL(url, {
    width: 280,
    margin: 1,
    color: {
      dark: '#0B0D14',
      light: '#FFFFFF',
    },
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  if (isSvgDataUrl(src)) {
    const safeSvg = decodeSvgDataUrl(src);
    if (!safeSvg) {
      return Promise.reject(new Error('SVG inválido'));
    }
    const blob = new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCardShapePath(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  shape?: FrameShape
) {
  if (!shape || shape === 'rectangulo' || shape === 'polaroid') {
    drawRoundedRect(ctx, 0, 0, W, H, 64);
    return;
  }
  const shapePoints: Record<string, [number, number][]> = {
    escudo: [
      [0.5, 0],
      [1, 0.1],
      [1, 0.72],
      [0.5, 1],
      [0, 0.72],
      [0, 0.1],
    ],
    ticket: [
      [0.1, 0],
      [0.9, 0],
      [1, 0.08],
      [0.94, 0.16],
      [1, 0.24],
      [1, 0.76],
      [0.94, 0.84],
      [1, 0.92],
      [0.9, 1],
      [0.1, 1],
      [0, 0.92],
      [0.06, 0.84],
      [0, 0.76],
      [0, 0.24],
      [0.06, 0.16],
      [0, 0.08],
    ],
    hexagono: [
      [0.14, 0],
      [0.86, 0],
      [1, 0.14],
      [1, 0.86],
      [0.86, 1],
      [0.14, 1],
      [0, 0.86],
      [0, 0.14],
    ],
    arco: [
      [0, 0.18],
      [0.08, 0.07],
      [0.24, 0.02],
      [0.5, 0],
      [0.76, 0.02],
      [0.92, 0.07],
      [1, 0.18],
      [1, 1],
      [0, 1],
    ],
    corazon: [
      [0.5, 0.06],
      [0.72, 0],
      [0.92, 0.06],
      [1, 0.22],
      [1, 0.62],
      [0.82, 0.88],
      [0.5, 1],
      [0.18, 0.88],
      [0, 0.62],
      [0, 0.22],
      [0.08, 0.06],
      [0.28, 0],
    ],
    estrella: [
      [0.5, 0],
      [0.66, 0.06],
      [0.88, 0.02],
      [0.94, 0.16],
      [1, 0.3],
      [0.95, 0.5],
      [1, 0.72],
      [0.88, 0.88],
      [0.68, 0.95],
      [0.5, 1],
      [0.32, 0.95],
      [0.12, 0.88],
      [0, 0.72],
      [0.05, 0.5],
      [0, 0.3],
      [0.06, 0.16],
      [0.12, 0.02],
      [0.34, 0.06],
    ],
    octagono: [
      [0.22, 0],
      [0.78, 0],
      [1, 0.16],
      [1, 0.84],
      [0.78, 1],
      [0.22, 1],
      [0, 0.84],
      [0, 0.16],
    ],
    nube: [
      [0.16, 0.06],
      [0.34, 0.01],
      [0.5, 0.04],
      [0.66, 0.01],
      [0.84, 0.06],
      [0.96, 0.16],
      [1, 0.32],
      [0.97, 0.5],
      [1, 0.68],
      [0.96, 0.84],
      [0.84, 0.94],
      [0.66, 0.99],
      [0.5, 0.96],
      [0.34, 0.99],
      [0.16, 0.94],
      [0.04, 0.84],
      [0, 0.68],
      [0.03, 0.5],
      [0, 0.32],
      [0.04, 0.16],
    ],
    pergamino: [
      [0.06, 0],
      [0.94, 0],
      [0.94, 0.06],
      [1, 0.06],
      [1, 0.94],
      [0.94, 0.94],
      [0.94, 1],
      [0.06, 1],
      [0.06, 0.94],
      [0, 0.94],
      [0, 0.06],
      [0.06, 0.06],
    ],
    visor: [
      [0, 0],
      [0.76, 0],
      [1, 0.16],
      [1, 1],
      [0.24, 1],
      [0, 0.84],
    ],
  };
  const pts = shapePoints[shape] || shapePoints.corazon;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px * W, py * H);
    else ctx.lineTo(px * W, py * H);
  });
  ctx.closePath();
}

export async function renderCardFrontDataUrl(card: Photocard): Promise<string> {
  const W = 1080;
  const H = 1512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Outer card frame background
  drawCardShapePath(ctx, W, H, card.frameShape);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 0, W, H);
  if (card.frameStyle === 'gold') {
    grad.addColorStop(0, '#785513');
    grad.addColorStop(0.3, '#F6DB85');
    grad.addColorStop(0.55, '#FFF5CC');
    grad.addColorStop(0.8, '#C8922A');
    grad.addColorStop(1, '#6C4B10');
  } else if (card.frameStyle === 'holo') {
    grad.addColorStop(0, '#38BDF8');
    grad.addColorStop(0.35, '#E879F9');
    grad.addColorStop(0.7, '#FACC15');
    grad.addColorStop(1, '#34D399');
  } else if (card.frameStyle === 'neon-cyber') {
    grad.addColorStop(0, '#06B6D4');
    grad.addColorStop(0.45, '#3B82F6');
    grad.addColorStop(1, '#D946EF');
  } else if (card.frameStyle === 'royal-velvet') {
    grad.addColorStop(0, '#3B0764');
    grad.addColorStop(0.5, '#F59E0B');
    grad.addColorStop(1, '#1E1B4B');
  } else if (card.frameStyle === 'sakura-pearl') {
    grad.addColorStop(0, '#FBCFE8');
    grad.addColorStop(0.5, '#FDE68A');
    grad.addColorStop(1, '#C084FC');
  } else if (card.frameStyle === 'liquid-chrome') {
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(0.35, '#F8FAFC');
    grad.addColorStop(0.65, '#38BDF8');
    grad.addColorStop(1, '#0F172A');
  } else if (card.frameStyle === 'polaroid') {
    grad.addColorStop(0, '#F8FAFC');
    grad.addColorStop(1, '#E2E8F0');
  } else {
    grad.addColorStop(0, card.primaryColor || '#38BDF8');
    grad.addColorStop(1, card.secondaryColor || '#131622');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (card.customFrameUrl && card.customFrameMode !== 'overlay') {
    try {
      const frmImg = await loadImage(card.customFrameUrl);
      const fScale = Math.max(W / frmImg.width, H / frmImg.height);
      const fdw = frmImg.width * fScale;
      const fdh = frmImg.height * fScale;
      ctx.drawImage(frmImg, (W - fdw) / 2, (H - fdh) / 2, fdw, fdh);
    } catch {
      // keep gradient frame fallback
    }
  }

  // Inner dark card plate (adapts margins to frame shape)
  const effectiveShape =
    card.frameShape || (card.frameStyle === 'polaroid' ? 'polaroid' : 'rectangulo');
  const isPolaroidStyle = card.frameStyle === 'polaroid' || effectiveShape === 'polaroid';
  const isNarrowShape =
    effectiveShape === 'escudo' ||
    effectiveShape === 'corazon' ||
    effectiveShape === 'hexagono' ||
    effectiveShape === 'ticket' ||
    effectiveShape === 'estrella' ||
    effectiveShape === 'octagono' ||
    effectiveShape === 'nube';
  const centerBottom =
    effectiveShape === 'escudo' ||
    effectiveShape === 'corazon' ||
    effectiveShape === 'hexagono' ||
    effectiveShape === 'estrella' ||
    effectiveShape === 'octagono' ||
    effectiveShape === 'nube';
  const pad = isPolaroidStyle ? 54 : 36;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  drawRoundedRect(ctx, pad, pad, innerW, innerH, 42);
  ctx.fillStyle = isPolaroidStyle ? '#FFFFFF' : '#111524';
  ctx.fill();

  // Photo viewport
  const photoX = pad + 26;
  const photoY = pad + 26;
  const photoW = innerW - 52;
  const photoH = isPolaroidStyle
    ? innerH - 310
    : effectiveShape === 'corazon' || effectiveShape === 'escudo' || effectiveShape === 'estrella'
      ? innerH - 290
      : innerH - 250;

  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 28);
  ctx.clip();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(photoX, photoY, photoW, photoH);

  try {
    const img = await loadImage(card.photoUrl);
    ctx.filter = buildFilterCss(card.filterSnapshot);
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const yBias =
      effectiveShape === 'corazon' ||
      effectiveShape === 'escudo' ||
      effectiveShape === 'arco' ||
      effectiveShape === 'estrella' ||
      effectiveShape === 'nube'
        ? 0.28
        : 0.35;
    ctx.drawImage(img, photoX + (photoW - dw) / 2, photoY + (photoH - dh) * yBias, dw, dh);
    ctx.filter = 'none';
  } catch {
    // Fallback gradient if image couldn't load
  }

  // High-res Holographic Foil or Custom Texture Overlay (when selected)
  const holoOverlayUrl = card.customTextureUrl || getHoloTextureOverlayUrl(card.texture);
  if (holoOverlayUrl) {
    try {
      const holoImg = await loadImage(holoOverlayUrl);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.max(0.22, Math.min(0.9, (card.shineIntensity / 100) * 0.85));
      const hScale = Math.max(photoW / holoImg.width, photoH / holoImg.height);
      const hdw = holoImg.width * hScale;
      const hdh = holoImg.height * hScale;
      ctx.drawImage(holoImg, photoX + (photoW - hdw) / 2, photoY + (photoH - hdh) / 2, hdw, hdh);
      ctx.restore();
    } catch {
      // ignore if foil texture fails to load
    }
  }

  // Scrim for legibility
  const scrim = ctx.createLinearGradient(0, photoY + photoH * 0.52, 0, photoY + photoH);
  scrim.addColorStop(0, 'rgba(11,13,20,0)');
  scrim.addColorStop(1, 'rgba(11,13,20,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(photoX, photoY, photoW, photoH);

  // Stickers
  for (const stk of card.stickers) {
    const sx = photoX + (stk.x / 100) * photoW;
    const sy = photoY + (stk.y / 100) * photoH;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((stk.rotation * Math.PI) / 180);
    ctx.scale(stk.scale, stk.scale);
    if (stk.isImage) {
      try {
        const sImg = await loadImage(stk.content);
        ctx.drawImage(sImg, -64, -64, 128, 128);
      } catch {
        // skip
      }
    } else if (stk.content.length <= 2) {
      ctx.font = '88px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stk.content, 0, 0);
    } else {
      ctx.fillStyle = stk.bgColor || '#F59E0B';
      drawRoundedRect(ctx, -95, -30, 190, 60, 14);
      ctx.fill();
      ctx.fillStyle = stk.textColor || '#0B0D14';
      ctx.font = '700 28px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stk.content, 0, 2);
    }
    ctx.restore();
  }

  // Top-left rating / OVR badge inside safe shape inset
  const badgeTopOffset =
    effectiveShape === 'arco' ||
    effectiveShape === 'corazon' ||
    effectiveShape === 'escudo' ||
    effectiveShape === 'estrella' ||
    effectiveShape === 'octagono'
      ? 145
      : effectiveShape === 'hexagono' ||
          effectiveShape === 'ticket' ||
          effectiveShape === 'nube' ||
          effectiveShape === 'pergamino'
        ? 110
        : 24;
  const badgeSideOffset =
    isNarrowShape || effectiveShape === 'arco' || effectiveShape === 'pergamino' ? 90 : 24;

  ctx.fillStyle = 'rgba(11, 13, 20, 0.72)';
  drawRoundedRect(ctx, photoX + badgeSideOffset, photoY + badgeTopOffset, 148, 178, 22);
  ctx.fill();
  ctx.fillStyle = card.frameStyle === 'gold' ? '#FDE68A' : '#38BDF8';
  ctx.font = '800 64px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.ratingOrBadge, photoX + badgeSideOffset + 74, photoY + badgeTopOffset + 74);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 26px Outfit, sans-serif';
  ctx.fillText(card.categoryLabel.slice(0, 8), photoX + badgeSideOffset + 74, photoY + badgeTopOffset + 112);
  ctx.font = '34px sans-serif';
  ctx.fillText(card.countryFlag, photoX + badgeSideOffset + 74, photoY + badgeTopOffset + 156);

  // Card Visual Effect Overlay in Canvas Export
  if (card.cardEffect === 'vignette-noir') {
    const vig = ctx.createRadialGradient(
      photoX + photoW / 2,
      photoY + photoH * 0.45,
      photoW * 0.25,
      photoX + photoW / 2,
      photoY + photoH * 0.45,
      photoH * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,6,23,0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(photoX, photoY, photoW, photoH);
  } else if (card.cardEffect === 'scanlines-crt') {
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let sy = photoY; sy < photoY + photoH; sy += 10) {
      ctx.fillRect(photoX, sy, photoW, 3);
    }
  } else if (card.cardEffect === 'sparkle-dust' || card.cardEffect === 'confetti-shimmer') {
    const pts = [
      [0.18, 0.22],
      [0.76, 0.19],
      [0.64, 0.48],
      [0.31, 0.66],
      [0.84, 0.74],
      [0.14, 0.82],
      [0.48, 0.14],
    ];
    pts.forEach(([px, py], i) => {
      ctx.fillStyle =
        card.cardEffect === 'confetti-shimmer'
          ? ['#F472B6', '#38BDF8', '#FACC15', '#34D399'][i % 4]
          : i % 2 === 0
            ? 'rgba(255,255,255,0.9)'
            : 'rgba(253,224,71,0.85)';
      ctx.beginPath();
      ctx.arc(photoX + photoW * px, photoY + photoH * py, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (card.cardEffect === 'aurora-glow') {
    const ag = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
    ag.addColorStop(0, 'rgba(52,211,153,0.28)');
    ag.addColorStop(0.5, 'rgba(56,189,248,0.22)');
    ag.addColorStop(1, 'rgba(192,132,252,0.28)');
    ctx.fillStyle = ag;
    ctx.fillRect(photoX, photoY, photoW, photoH);
  } else if (card.cardEffect === 'cyber-glitch') {
    ctx.fillStyle = 'rgba(34,211,238,0.16)';
    ctx.fillRect(photoX, photoY + photoH * 0.25, photoW, 24);
    ctx.fillStyle = 'rgba(244,63,94,0.16)';
    ctx.fillRect(photoX, photoY + photoH * 0.62, photoW, 18);
  }

  // Title inside bottom of photo (adapts alignment & width to frame shape)
  const titleMarginX = centerBottom
    ? 160
    : effectiveShape === 'ticket' || effectiveShape === 'visor'
      ? 106
      : 30;
  const maxTitleWidth = photoW - titleMarginX * 2;
  ctx.textAlign = centerBottom ? 'center' : 'left';
  const titleAnchorX = centerBottom ? photoX + photoW / 2 : photoX + titleMarginX;
  const titleY = photoY + photoH - (centerBottom ? 82 : 72);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${isNarrowShape ? 46 : 54}px Outfit, sans-serif`;
  ctx.fillText(card.title.slice(0, 26), titleAnchorX, titleY, maxTitleWidth);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 26px Plus Jakarta Sans, sans-serif';
  ctx.fillText(card.subtitle.slice(0, 40), titleAnchorX, titleY + 44, maxTitleWidth);
  ctx.restore();

  // Bottom footer bar (Location, Date, Edition)
  const footerY = photoY + photoH + 46;
  const textDark = isPolaroidStyle;
  const footerAnchorX = centerBottom
    ? W / 2
    : effectiveShape === 'ticket' || effectiveShape === 'visor'
      ? photoX + 106
      : photoX + 10;
  const maxFooterWidth = centerBottom ? W * 0.56 : photoW - 160;
  ctx.textAlign = centerBottom ? 'center' : 'left';
  ctx.fillStyle = textDark ? '#0F172A' : '#F8FAFC';
  ctx.font = '700 28px Outfit, sans-serif';
  ctx.fillText(card.location.slice(0, 34), footerAnchorX, footerY + 14, maxFooterWidth);

  ctx.fillStyle = textDark ? '#475569' : '#94A3B8';
  ctx.font = '500 24px Plus Jakarta Sans, sans-serif';
  ctx.fillText(
    `${card.eventDate}  ·  ${card.editionLabel}`,
    footerAnchorX,
    footerY + 58,
    maxFooterWidth
  );

  ctx.fillStyle = textDark ? '#0284C7' : '#38BDF8';
  ctx.font = '600 21px JetBrains Mono, monospace';
  ctx.fillText(card.serialCode, footerAnchorX, footerY + 102, maxFooterWidth);
  ctx.textAlign = 'left';

  // Celebration emblem top-right if set
  const celebrationSpec = getCelebrationSpec(card.frameCelebration);
  if (celebrationSpec) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE68A';
    ctx.font = '700 26px Outfit, sans-serif';
    ctx.fillText(
      `${celebrationSpec.emblem} ${celebrationSpec.label}`,
      photoX + photoW - badgeSideOffset,
      photoY + badgeTopOffset + 34
    );
    ctx.textAlign = 'left';
  }

  // Uploaded Transparent PNG Frame Overlay (if overlay mode)
  if (card.customFrameUrl && card.customFrameMode === 'overlay') {
    try {
      const overlayImg = await loadImage(card.customFrameUrl);
      ctx.drawImage(overlayImg, 0, 0, W, H);
    } catch {
      // ignore overlay load error
    }
  }

  return canvas.toDataURL('image/png');
}

export async function renderCardBackDataUrl(card: Photocard): Promise<string> {
  const W = 1080;
  const H = 1512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const effectiveShape =
    card.frameShape || (card.frameStyle === 'polaroid' ? 'polaroid' : 'rectangulo');
  const isShapedTop =
    effectiveShape !== 'rectangulo' && effectiveShape !== 'polaroid';
  const isNarrowBottom =
    effectiveShape === 'escudo' ||
    effectiveShape === 'corazon' ||
    effectiveShape === 'hexagono' ||
    effectiveShape === 'estrella' ||
    effectiveShape === 'octagono' ||
    effectiveShape === 'nube';
  const padX = isShapedTop ? 128 : 76;
  const topOffset =
    effectiveShape === 'arco' ||
    effectiveShape === 'corazon' ||
    effectiveShape === 'escudo' ||
    effectiveShape === 'estrella' ||
    effectiveShape === 'octagono'
      ? 150
      : isShapedTop
        ? 122
        : 60;

  drawCardShapePath(ctx, W, H, card.frameShape);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0F1320');
  grad.addColorStop(1, '#192038');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (card.backBackdropUrl) {
    try {
      const bgImg = await loadImage(card.backBackdropUrl);
      ctx.save();
      ctx.globalAlpha = 0.42;
      const bScale = Math.max(W / bgImg.width, H / bgImg.height);
      const bdw = bgImg.width * bScale;
      const bdh = bgImg.height * bScale;
      ctx.drawImage(bgImg, (W - bdw) / 2, (H - bdh) / 2, bdw, bdh);
      ctx.restore();

      const scrim = ctx.createLinearGradient(0, 0, 0, H);
      scrim.addColorStop(0, 'rgba(11,13,20,0.68)');
      scrim.addColorStop(1, 'rgba(11,13,20,0.88)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);
    } catch {
      // ignore if backdrop fails to load
    }
  }

  // Border ring
  ctx.strokeStyle = card.frameStyle === 'gold' ? '#F59E0B' : card.primaryColor || '#38BDF8';
  ctx.lineWidth = 22;
  drawRoundedRect(ctx, 22, 22, W - 44, H - 44, 50);
  ctx.stroke();

  // Header
  const contentW = W - padX * 2;
  ctx.textAlign = isNarrowBottom ? 'center' : 'left';
  const headerAnchorX = isNarrowBottom ? W / 2 : padX;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 24px JetBrains Mono, monospace';
  ctx.fillText(`CERTIFICADO KROMACARD  ·  ${card.serialCode}`, headerAnchorX, topOffset + 40, contentW);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 46px Outfit, sans-serif';
  ctx.fillText(card.title.slice(0, 26), headerAnchorX, topOffset + 104, contentW);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 25px Plus Jakarta Sans, sans-serif';
  ctx.fillText(`${card.location}  ·  ${card.eventDate}`, headerAnchorX, topOffset + 148, contentW);
  ctx.textAlign = 'left';

  // Stats Grid
  const statsY = topOffset + 186;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  drawRoundedRect(ctx, padX, statsY, contentW, 280, 28);
  ctx.fill();

  const stats = card.stats.slice(0, 6);
  const colW = (contentW - 60) / 3;
  stats.forEach((st, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const sx = padX + 30 + col * colW;
    const sy = statsY + 70 + row * 125;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.fillText(st.label.toUpperCase(), sx, sy, colW - 16);
    ctx.fillStyle = card.frameStyle === 'gold' ? '#FDE68A' : '#38BDF8';
    ctx.font = '800 50px JetBrains Mono, monospace';
    ctx.fillText(String(st.value), sx, sy + 54, colW - 16);
  });

  // Author message
  const msgY = statsY + 310;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  drawRoundedRect(ctx, padX, msgY, contentW, 220, 28);
  ctx.fill();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 20px Outfit, sans-serif';
  ctx.fillText('NOTA EXCLUSIVA DEL AUTOR', padX + 32, msgY + 48);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '500 26px Plus Jakarta Sans, sans-serif';
  const words = (card.authorMessage || 'Recuerdo guardado en Kromacard.').split(' ');
  let line = '';
  let ly = msgY + 96;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > contentW - 64) {
      ctx.fillText(line, padX + 32, ly);
      line = w;
      ly += 36;
      if (ly > msgY + 190) break;
    } else {
      line = test;
    }
  }
  if (line && ly <= msgY + 190) ctx.fillText(line, padX + 32, ly);

  // Autograph box & QR Code (inset safely above tapered bottom shapes)
  const footerBoxY = Math.min(msgY + 250, H - (isNarrowBottom ? 410 : 380));
  const qrSize = isNarrowBottom ? 270 : 320;
  const sigBoxW = contentW - qrSize - 32;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  drawRoundedRect(ctx, padX, footerBoxY, sigBoxW, 210, 28);
  ctx.fill();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 20px Outfit, sans-serif';
  ctx.fillText('AUTÓGRAFO DIGITAL', padX + 28, footerBoxY + 44);

  if (card.autographDataUrl) {
    try {
      const sig = await loadImage(card.autographDataUrl);
      ctx.drawImage(sig, padX + 28, footerBoxY + 62, sigBoxW - 56, 128);
    } catch {
      // skip
    }
  } else {
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 30px Outfit, sans-serif';
    ctx.fillText('Edición Firmada', padX + 28, footerBoxY + 140);
  }

  // Real QR Code
  const qrUrl = await generateCardQRDataUrl(card.id);
  const qrImg = await loadImage(qrUrl);
  const qrX = padX + sigBoxW + 32;
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, qrX, footerBoxY, qrSize, qrSize, 24);
  ctx.fill();
  ctx.drawImage(qrImg, qrX + 20, footerBoxY + 20, qrSize - 40, qrSize - 40);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 20px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Escanea el QR para audio y 3D', padX, footerBoxY + 250, sigBoxW);
  if (card.concert?.enabled) {
    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 22px Outfit, sans-serif';
    ctx.fillText(
      `♫ ${card.concert.favoriteSong} · ${card.concert.zone}`,
      padX,
      footerBoxY + 295,
      sigBoxW
    );
  }

  return canvas.toDataURL('image/png');
}

export async function downloadCardPNG(card: Photocard, side: 'front' | 'back') {
  const dataUrl =
    side === 'front' ? await renderCardFrontDataUrl(card) : await renderCardBackDataUrl(card);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${card.serialCode}-${side === 'front' ? 'anverso' : 'reverso'}-300dpi.png`;
  a.click();
}

export type SocialPreset = 'instagram-post' | 'instagram-story' | 'twitter-post';

export interface SocialPresetSpec {
  id: SocialPreset;
  label: string;
  platform: string;
  dimensionsLabel: string;
  width: number;
  height: number;
}

export const SOCIAL_PRESETS: SocialPresetSpec[] = [
  {
    id: 'instagram-post',
    label: 'Instagram Feed',
    platform: 'Instagram',
    dimensionsLabel: '1080 × 1080 · 1:1',
    width: 1080,
    height: 1080,
  },
  {
    id: 'instagram-story',
    label: 'Instagram Story',
    platform: 'Instagram',
    dimensionsLabel: '1080 × 1920 · 9:16',
    width: 1080,
    height: 1920,
  },
  {
    id: 'twitter-post',
    label: 'Twitter / X',
    platform: 'Twitter / X',
    dimensionsLabel: '1600 × 900 · 16:9',
    width: 1600,
    height: 900,
  },
];

/**
 * Draws a 2D card image with true 3D Y-axis perspective foreshortening,
 * extruded metallic card thickness, and dynamic foil sheen onto a target canvas.
 */
function drawCardWith3DPerspective(
  ctx: CanvasRenderingContext2D,
  cardImg: HTMLImageElement,
  centerX: number,
  centerY: number,
  targetW: number,
  targetH: number,
  angleDeg: number,
  edgeColor: string
) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const foreshortenW = targetW * Math.max(0.35, Math.abs(cos));
  const perspectiveSkew = sin * 0.14;
  const thickness = Math.round(Math.abs(sin) * 22);

  // Soft 3D ambient floor shadow
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(
    centerX + sin * 28,
    centerY + targetH * 0.56,
    10,
    centerX + sin * 28,
    centerY + targetH * 0.56,
    foreshortenW * 0.72
  );
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(
    centerX + sin * 28,
    centerY + targetH * 0.56,
    foreshortenW * 0.65,
    36,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  const slices = 160;
  const srcSliceW = cardImg.width / slices;
  const dstSliceW = foreshortenW / slices;
  const leftX = centerX - foreshortenW / 2;

  // Draw extruded 3D side thickness first when rotated
  if (thickness > 2) {
    const edgeDir = sin >= 0 ? -1 : 1;
    for (let depth = thickness; depth >= 1; depth -= 2) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = edgeColor;
      const edgeX = edgeDir < 0 ? leftX - depth : leftX + foreshortenW + depth - dstSliceW;
      const edgeT = edgeDir < 0 ? -0.5 : 0.5;
      const edgeH = targetH * (1 + edgeT * perspectiveSkew);
      drawRoundedRect(ctx, edgeX, centerY - edgeH / 2, Math.max(4, dstSliceW + 2), edgeH, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  // Render card slices with perspective vertical scaling
  for (let i = 0; i < slices; i++) {
    const t = i / slices - 0.5; // -0.5 to +0.5
    const sliceH = targetH * (1 + t * perspectiveSkew);
    const sx = i * srcSliceW;
    const dx = leftX + i * dstSliceW;
    const dy = centerY - sliceH / 2;
    ctx.drawImage(
      cardImg,
      sx,
      0,
      srcSliceW + 0.5,
      cardImg.height,
      dx,
      dy,
      dstSliceW + 0.75,
      sliceH
    );
  }

  // Diagonal holographic foil sheen across angled face
  ctx.save();
  const sheenGrad = ctx.createLinearGradient(
    leftX,
    centerY - targetH * 0.45,
    leftX + foreshortenW,
    centerY + targetH * 0.45
  );
  sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
  sheenGrad.addColorStop(0.42, 'rgba(255,255,255,0)');
  sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  sheenGrad.addColorStop(0.58, 'rgba(255,255,255,0)');
  sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(leftX, centerY - targetH * 0.54, foreshortenW, targetH * 1.08);
  ctx.restore();
}

export async function renderSocialShare3DDataUrl(
  card: Photocard,
  preset: SocialPreset,
  angleDeg = -18,
  showBackPeek = true
): Promise<string> {
  const spec = SOCIAL_PRESETS.find((p) => p.id === preset) || SOCIAL_PRESETS[0];
  const W = spec.width;
  const H = spec.height;

  // Temporary offscreen canvas for social composition
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Atmospheric dark background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#070910');
  bg.addColorStop(0.5, '#0E1220');
  bg.addColorStop(1, '#090C16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Colored stadium spotlights matching card theme
  const accentA = card.frameStyle === 'gold' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(56, 189, 248, 0.28)';
  const accentB = card.frameStyle === 'gold' ? 'rgba(253, 230, 138, 0.16)' : 'rgba(232, 121, 249, 0.22)';

  const glow1 = ctx.createRadialGradient(W * 0.28, H * 0.25, 20, W * 0.28, H * 0.25, W * 0.55);
  glow1.addColorStop(0, accentA);
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.78, H * 0.76, 20, W * 0.78, H * 0.76, W * 0.5);
  glow2.addColorStop(0, accentB);
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Render high-res front & back card images + QR
  const [frontUrl, backUrl, qrUrl] = await Promise.all([
    renderCardFrontDataUrl(card),
    showBackPeek ? renderCardBackDataUrl(card) : Promise.resolve(''),
    generateCardQRDataUrl(card.id),
  ]);
  const frontImg = await loadImage(frontUrl);
  const backImg = backUrl ? await loadImage(backUrl) : null;
  const qrImg = await loadImage(qrUrl);

  const edgeColor = card.frameStyle === 'gold' ? '#C8922A' : card.primaryColor || '#38BDF8';

  if (preset === 'twitter-post') {
    // Landscape 1600x900: Left 3D card(s), Right editorial metadata + QR
    if (backImg) {
      drawCardWith3DPerspective(ctx, backImg, 540, 465, 360, 504, angleDeg + 20, edgeColor);
    }
    drawCardWith3DPerspective(
      ctx,
      frontImg,
      backImg ? 380 : 440,
      455,
      430,
      602,
      angleDeg,
      edgeColor
    );

    const textX = 820;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 24px Outfit, sans-serif';
    ctx.fillText(`KROMACARD 3D  ·  ${card.serialCode}`, textX, 225);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 58px Outfit, sans-serif';
    ctx.fillText(card.title.slice(0, 22), textX, 305);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 28px Plus Jakarta Sans, sans-serif';
    ctx.fillText(card.subtitle.slice(0, 38), textX, 360);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 24px Plus Jakarta Sans, sans-serif';
    ctx.fillText(`${card.location}  ·  ${card.eventDate}`, textX, 425);
    ctx.fillText(card.editionLabel, textX, 465);

    if (card.concert?.enabled) {
      ctx.fillStyle = '#FDE68A';
      ctx.font = '600 25px Outfit, sans-serif';
      ctx.fillText(`♫ ${card.concert.favoriteSong.slice(0, 34)}`, textX, 535);
    }

    // Scannable QR card in bottom right
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    drawRoundedRect(ctx, textX, 600, 680, 190, 26);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, textX + 22, 622, 146, 146, 18);
    ctx.fill();
    ctx.drawImage(qrImg, textX + 32, 632, 126, 126);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 24px Outfit, sans-serif';
    ctx.fillText('Escanea el QR para abrir en 3D', textX + 195, 680);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 21px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Gira la carta, mira el reverso y escucha el audio', textX + 195, 722);
  } else if (preset === 'instagram-story') {
    // Vertical 1080x1920
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 26px Outfit, sans-serif';
    ctx.fillText(`KROMACARD 3D  ·  ${card.serialCode}`, W / 2, 150);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 54px Outfit, sans-serif';
    ctx.fillText(card.title.slice(0, 24), W / 2, 224);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 26px Plus Jakarta Sans, sans-serif';
    ctx.fillText(`${card.location}  ·  ${card.eventDate}`, W / 2, 276);

    if (backImg) {
      drawCardWith3DPerspective(ctx, backImg, W * 0.63, 870, 440, 616, angleDeg + 20, edgeColor);
    }
    drawCardWith3DPerspective(
      ctx,
      frontImg,
      backImg ? W * 0.43 : W * 0.5,
      845,
      540,
      756,
      angleDeg,
      edgeColor
    );

    if (card.concert?.enabled) {
      ctx.fillStyle = '#FDE68A';
      ctx.font = '600 28px Outfit, sans-serif';
      ctx.fillText(`♫ ${card.concert.favoriteSong.slice(0, 34)}`, W / 2, 1365);
    }

    // Bottom QR strip
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    drawRoundedRect(ctx, 110, 1460, W - 220, 230, 32);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, 142, 1492, 166, 166, 20);
    ctx.fill();
    ctx.drawImage(qrImg, 154, 1504, 142, 142);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 28px Outfit, sans-serif';
    ctx.fillText('Escanea para ver en 3D', 340, 1560);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 23px Plus Jakarta Sans, sans-serif';
    ctx.fillText(card.editionLabel, 340, 1608);
    ctx.fillText('Abre audio y autógrafo digital', 340, 1646);
  } else {
    // Square 1080x1080 Instagram Feed
    if (backImg) {
      drawCardWith3DPerspective(ctx, backImg, 395, 480, 330, 462, angleDeg + 20, edgeColor);
    }
    drawCardWith3DPerspective(
      ctx,
      frontImg,
      backImg ? 285 : 330,
      465,
      395,
      553,
      angleDeg,
      edgeColor
    );

    const rx = 590;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '700 21px Outfit, sans-serif';
    ctx.fillText(`KROMACARD 3D  ·  ${card.serialCode}`, rx, 240);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 44px Outfit, sans-serif';
    ctx.fillText(card.title.slice(0, 18), rx, 305);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 23px Plus Jakarta Sans, sans-serif';
    ctx.fillText(card.subtitle.slice(0, 30), rx, 350);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 21px Plus Jakarta Sans, sans-serif';
    ctx.fillText(card.location.slice(0, 30), rx, 410);
    ctx.fillText(`${card.eventDate} · ${card.editionLabel}`, rx, 446);

    if (card.concert?.enabled) {
      ctx.fillStyle = '#FDE68A';
      ctx.font = '600 22px Outfit, sans-serif';
      ctx.fillText(`♫ ${card.concert.favoriteSong.slice(0, 28)}`, rx, 510);
    }

    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, rx, 580, 196, 196, 22);
    ctx.fill();
    ctx.drawImage(qrImg, rx + 14, 594, 168, 168);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 20px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Escanea el QR para', rx + 216, 665);
    ctx.fillText('girar la carta 3D', rx + 216, 696);
  }

  return canvas.toDataURL('image/png');
}

export async function downloadSocialSharePNG(
  card: Photocard,
  preset: SocialPreset,
  angleDeg = -18,
  showBackPeek = true
): Promise<string> {
  const dataUrl = await renderSocialShare3DDataUrl(card, preset, angleDeg, showBackPeek);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${card.serialCode}-${preset}-3d.png`;
  a.click();
  return dataUrl;
}

export async function shareSocialCanvasNative(
  card: Photocard,
  preset: SocialPreset,
  angleDeg = -18,
  showBackPeek = true
): Promise<'shared' | 'downloaded'> {
  const dataUrl = await renderSocialShare3DDataUrl(card, preset, angleDeg, showBackPeek);
  const shareUrl = getCardDeepLink(card.id);

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${card.serialCode}-${preset}.png`, { type: 'image/png' });
      const navWithFiles = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navWithFiles.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${card.title} — Kromacard 3D`,
          text: `Mira mi photocard 3D de ${card.title} (${card.location})`,
          url: shareUrl,
          files: [file],
        });
        return 'shared';
      }
      await navigator.share({
        title: `${card.title} — Kromacard 3D`,
        text: `Mira mi photocard 3D de ${card.title} (${card.location})`,
        url: shareUrl,
      });
      return 'shared';
    } catch {
      // Fallback to download below
    }
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${card.serialCode}-${preset}-3d.png`;
  a.click();
  return 'downloaded';
}

