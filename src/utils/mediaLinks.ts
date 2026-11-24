import QRCode from 'qrcode';

export function extractYouTubeId(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,15}$/.test(id) ? id : null;
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{6,15}$/.test(vParam)) return vParam;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p)
      );
      if (markerIdx >= 0 && parts[markerIdx + 1]) {
        const cand = parts[markerIdx + 1];
        return /^[a-zA-Z0-9_-]{6,15}$/.test(cand) ? cand : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function detectMusicPlatform(rawUrl?: string): string {
  if (!rawUrl) return 'Enlace Musical';
  const lower = rawUrl.toLowerCase();
  if (lower.includes('spotify.com')) return 'Spotify';
  if (lower.includes('music.apple.com') || lower.includes('itunes.apple.com')) return 'Apple Music';
  if (lower.includes('music.youtube.com')) return 'YouTube Music';
  if (lower.includes('soundcloud.com')) return 'SoundCloud';
  if (lower.includes('deezer.com')) return 'Deezer';
  if (lower.includes('tidal.com')) return 'Tidal';
  if (lower.includes('amazon.') && lower.includes('music')) return 'Amazon Music';
  return 'Plataforma Musical';
}

export function normalizeExternalUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function generateLinkQRDataUrl(url: string): Promise<string> {
  const safeUrl = normalizeExternalUrl(url);
  if (!safeUrl) return '';
  return QRCode.toDataURL(safeUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0B0D14',
      light: '#FFFFFF',
    },
  });
}
