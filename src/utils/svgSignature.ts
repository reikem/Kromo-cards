export interface SvgPoint {
  x: number;
  y: number;
}

export interface SvgStroke {
  points: SvgPoint[];
  color: string;
  width: number;
}

export const SIGNATURE_VIEWBOX_WIDTH = 320;
export const SIGNATURE_VIEWBOX_HEIGHT = 110;

export const SIGNATURE_INK_COLORS: { hex: string; label: string }[] = [
  { hex: '#F8FAFC', label: 'Blanco' },
  { hex: '#FDE68A', label: 'Oro 24k' },
  { hex: '#38BDF8', label: 'Cian' },
  { hex: '#E879F9', label: 'Neón' },
];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function clampCoord(val: number, max: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(Math.min(max, Math.max(0, val)) * 10) / 10;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSvgDataUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.trim().toLowerCase().startsWith('data:image/svg+xml');
}

export function isSafeSvgMarkup(svg: string): boolean {
  if (!svg || typeof svg !== 'string') return false;
  const lower = svg.toLowerCase();
  if (!lower.includes('<svg')) return false;
  const forbiddenPatterns = [
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
  return !forbiddenPatterns.some((re) => re.test(lower));
}

export function strokeToSvgPathD(
  points: SvgPoint[],
  width = SIGNATURE_VIEWBOX_WIDTH,
  height = SIGNATURE_VIEWBOX_HEIGHT
): string {
  if (!points.length) return '';
  const safePts = points.map((p) => ({
    x: clampCoord(p.x, width),
    y: clampCoord(p.y, height),
  }));

  if (safePts.length === 1) {
    const p = safePts[0];
    return `M ${p.x} ${p.y} L ${clampCoord(p.x + 0.2, width)} ${p.y}`;
  }

  if (safePts.length === 2) {
    return `M ${safePts[0].x} ${safePts[0].y} L ${safePts[1].x} ${safePts[1].y}`;
  }

  let d = `M ${safePts[0].x} ${safePts[0].y}`;
  for (let i = 1; i < safePts.length - 1; i++) {
    const curr = safePts[i];
    const next = safePts[i + 1];
    const midX = Math.round(((curr.x + next.x) / 2) * 10) / 10;
    const midY = Math.round(((curr.y + next.y) / 2) * 10) / 10;
    d += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }
  const last = safePts[safePts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function strokesToSvgString(
  strokes: SvgStroke[],
  width = SIGNATURE_VIEWBOX_WIDTH,
  height = SIGNATURE_VIEWBOX_HEIGHT
): string {
  const paths = strokes
    .filter((s) => s.points.length > 0)
    .map((stroke) => {
      const d = strokeToSvgPathD(stroke.points, width, height);
      const color = HEX_COLOR_RE.test(stroke.color) ? stroke.color : '#F8FAFC';
      const strokeWidth = Math.min(10, Math.max(1, Number(stroke.width) || 3));
      return `<path d="${d}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">${paths}</svg>`;
}

export function svgStringToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function strokesToSvgDataUrl(
  strokes: SvgStroke[],
  width = SIGNATURE_VIEWBOX_WIDTH,
  height = SIGNATURE_VIEWBOX_HEIGHT
): string {
  return svgStringToDataUrl(strokesToSvgString(strokes, width, height));
}

export function decodeSvgDataUrl(dataUrl: string): string | null {
  if (!isSvgDataUrl(dataUrl)) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(0, commaIdx).toLowerCase();
  const payload = dataUrl.slice(commaIdx + 1);
  try {
    const decoded = header.includes(';base64')
      ? atob(payload)
      : decodeURIComponent(payload);
    return isSafeSvgMarkup(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function downloadSvgDataUrl(dataUrl: string, fileNameBase: string): boolean {
  const svg = decodeSvgDataUrl(dataUrl);
  if (!svg) return false;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const safeName =
    fileNameBase
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'autografo-kromacard';
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = safeName.endsWith('.svg') ? safeName : `${safeName}.svg`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return true;
}

export function stickerToSvgDataUrl(sticker: {
  name: string;
  content: string;
  bgColor?: string;
  textColor?: string;
}): string {
  const safeBg = sticker.bgColor && HEX_COLOR_RE.test(sticker.bgColor) ? sticker.bgColor : '#38BDF8';
  const safeFg = sticker.textColor && HEX_COLOR_RE.test(sticker.textColor) ? sticker.textColor : '#0B0D14';
  const content = (sticker.content || '★').trim().slice(0, 24);
  const isBadge = Boolean(sticker.bgColor) || content.length > 2;
  const fontSize = content.length <= 2 ? 120 : content.length <= 6 ? 56 : 36;

  const svg = isBadge
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><rect x="16" y="56" width="224" height="144" rx="28" fill="${safeBg}" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="6"/><text x="128" y="138" text-anchor="middle" dominant-baseline="middle" fill="${safeFg}" font-family="Outfit, Arial, sans-serif" font-weight="800" font-size="${fontSize}">${escapeXml(content)}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><text x="128" y="140" text-anchor="middle" dominant-baseline="middle" font-size="144">${escapeXml(content)}</text></svg>`;

  return svgStringToDataUrl(svg);
}
