import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Music,
  QrCode,
  RefreshCw,
  Search,
  SwitchCamera,
  Volume2,
  X,
} from 'lucide-react';
import type { Album, Photocard } from '../types/kromacard';
import { soundEngine } from '../utils/soundEngine';

interface ScannerModalProps {
  cards: Photocard[];
  albums: Album[];
  onClose: () => void;
  onInspectCard: (card: Photocard) => void;
  onCloneToAlbum: (card: Photocard, targetAlbumId: string, personalNote: string) => Promise<void>;
}

function extractCardLookupToken(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const cardParam = parsed.searchParams.get('card') || parsed.searchParams.get('id');
      if (cardParam) return cardParam.trim();
    }
  } catch {
    // not a valid URL, fall back to raw query parsing
  }
  const match = trimmed.match(/[?&](?:card|id)=([^&\s]+)/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return trimmed;
}

function decodeQrFromCanvasRegion(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): string | null {
  if (sw < 24 || sh < 24) return null;
  const imgData = ctx.getImageData(sx, sy, sw, sh);
  const res = jsQR(imgData.data, imgData.width, imgData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return res?.data?.trim() || null;
}

function decodeQrMultiPass(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return null;

  // Pass 1: Full frame
  const full = decodeQrFromCanvasRegion(ctx, 0, 0, W, H);
  if (full) return full;

  // Pass 2: Center reticle crop (64% box)
  const cw = Math.round(W * 0.64);
  const ch = Math.round(H * 0.64);
  const cx = Math.round((W - cw) / 2);
  const cy = Math.round((H - ch) / 2);
  const center = decodeQrFromCanvasRegion(ctx, cx, cy, cw, ch);
  if (center) return center;

  // Pass 3: Bottom-right quadrant (where card back QR sits on full card PNGs)
  const qw = Math.round(W * 0.55);
  const qh = Math.round(H * 0.45);
  const qx = Math.max(0, W - qw);
  const qy = Math.max(0, H - qh);
  const corner = decodeQrFromCanvasRegion(ctx, qx, qy, qw, qh);
  if (corner) return corner;

  return null;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  cards,
  albums,
  onClose,
  onInspectCard,
  onCloneToAlbum,
}) => {
  const [mode, setMode] = useState<'camera' | 'image' | 'serial'>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [serialQuery, setSerialQuery] = useState('');
  const [detectedCard, setDetectedCard] = useState<Photocard | null>(null);
  const [scannedRawText, setScannedRawText] = useState<string>('');
  const [scanStatus, setScanStatus] = useState<string>(
    'Apunta la cámara al código QR del reverso de una carta'
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [targetAlbumId, setTargetAlbumId] = useState(albums[0]?.id || '');
  const [personalNote, setPersonalNote] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [uploadedScanPreview, setUploadedScanPreview] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastDecodedRef = useRef<string>('');

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const resolveScannedPayload = useCallback(
    async (rawQrText: string) => {
      const cleaned = rawQrText.trim();
      if (!cleaned) return false;
      setScannedRawText(cleaned);
      setScanError(null);

      const token = extractCardLookupToken(cleaned);
      const tokenLower = token.toLowerCase();

      const localMatch = cards.find(
        (c) =>
          c.id.toLowerCase() === tokenLower ||
          c.serialCode.toLowerCase() === tokenLower ||
          (c.concert?.ticketCode && c.concert.ticketCode.toLowerCase() === tokenLower) ||
          c.serialCode.toLowerCase().includes(tokenLower)
      );

      if (localMatch) {
        soundEngine.playVerifyChime();
        setDetectedCard(localMatch);
        setScanStatus(`QR verificado · ${localMatch.serialCode}`);
        return true;
      }

      // Server fallback lookup for any card ID or serialCode in database
      try {
        const res = await fetch(`/api/cards/lookup?code=${encodeURIComponent(token)}`);
        if (res.ok) {
          const found = (await res.json()) as Photocard;
          if (found?.id) {
            soundEngine.playVerifyChime();
            setDetectedCard(found);
            setScanStatus(`QR verificado · ${found.serialCode}`);
            return true;
          }
        }
      } catch {
        // ignore network errors
      }

      soundEngine.playVerifyChime();
      setDetectedCard(null);
      setScanStatus('Código QR leído');
      return false;
    },
    [cards]
  );

  useEffect(() => {
    if (mode !== 'camera' || detectedCard) {
      stopCamera();
      return;
    }

    let cancelled = false;
    const startCam = async () => {
      setScanError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        setScanError(
          'Tu navegador o contexto actual no permite acceder a la cámara. Usa "Subir Imagen QR" o "Código Serial".'
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraActive(true);
        setScanStatus('Escaneando en vivo... acerca el QR al recuadro');

        window.requestAnimationFrame(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            void videoRef.current.play().catch(() => {});
          }
        });

        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }

        scanTimerRef.current = window.setInterval(() => {
          const video = videoRef.current;
          const canvas = offscreenCanvasRef.current;
          if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

          const maxDim = 960;
          const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(120, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(120, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const decoded = decodeQrMultiPass(canvas);
          if (decoded && decoded !== lastDecodedRef.current) {
            lastDecodedRef.current = decoded;
            void resolveScannedPayload(decoded).then((matched) => {
              if (matched) {
                stopCamera();
              }
            });
          }
        }, 160);
      } catch (err) {
        setCameraActive(false);
        const msg = err instanceof Error ? err.message : '';
        if (/Permission|NotAllowed|denied/i.test(msg)) {
          setScanError(
            'Permiso de cámara denegado. Permite la cámara en tu navegador o escanea subiendo una foto del QR.'
          );
        } else {
          setScanError(
            'No se detectó cámara activa. Puedes subir una imagen de la carta/QR o buscar por serial.'
          );
        }
      }
    };

    void startCam();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, facingMode, detectedCard, resolveScannedPayload, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      soundEngine.stopSnippet();
    };
  }, [stopCamera]);

  const handleScanImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const dataUrl = reader.result;
      setUploadedScanPreview(dataUrl);

      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        canvas.width = Math.max(120, Math.round(img.width * scale));
        canvas.height = Math.max(120, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const decoded = decodeQrMultiPass(canvas);
        if (decoded) {
          await resolveScannedPayload(decoded);
        } else {
          setDetectedCard(null);
          setScannedRawText('');
          setScanError(
            'No se detectó ningún código QR legible en esa imagen. Asegúrate de que el QR no esté borroso ni recortado.'
          );
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSearchSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = serialQuery.trim();
    if (!raw) return;
    const token = extractCardLookupToken(raw).toLowerCase();
    const match = cards.find(
      (c) =>
        c.serialCode.toLowerCase().includes(token) ||
        c.id.toLowerCase() === token ||
        c.title.toLowerCase().includes(token) ||
        (c.concert?.ticketCode && c.concert.ticketCode.toLowerCase() === token)
    );
    if (match) {
      soundEngine.playVerifyChime();
      setDetectedCard(match);
      setScannedRawText(raw);
      setScanError(null);
      setScanStatus(`Carta encontrada · ${match.serialCode}`);
      return;
    }
    const serverMatched = await resolveScannedPayload(raw);
    if (!serverMatched) {
      setScanError('No encontramos una photocard con ese código serial, ID o enlace QR.');
    }
  };

  const handleResetScan = () => {
    lastDecodedRef.current = '';
    setDetectedCard(null);
    setScannedRawText('');
    setScanError(null);
    setScanStatus('Apunta la cámara al código QR del reverso de una carta');
  };

  const handlePlayAudio = () => {
    if (!detectedCard?.concert) return;
    if (isPlayingAudio) {
      soundEngine.stopSnippet();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      soundEngine.playSnippet(
        detectedCard.concert.audioPresetId,
        detectedCard.concert.customAudioUrl,
        () => setIsPlayingAudio(false)
      );
    }
  };

  const handleRegister = async () => {
    if (!detectedCard) return;
    setRegistering(true);
    try {
      await onCloneToAlbum(detectedCard, targetAlbumId, personalNote);
      onClose();
    } finally {
      setRegistering(false);
    }
  };

  const isSafeScannedExternalUrl =
    /^https?:\/\//i.test(scannedRawText) && !detectedCard;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0D14]/95 backdrop-blur-md overflow-y-auto p-4 md:p-8">
      <div className="max-w-lg mx-auto bg-[#131622] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Escáner QR de Photocards
            </h2>
            <p className="text-xs text-slate-400">
              Lee códigos QR en vivo, desde una captura PNG/JPG o por código serial
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar escáner"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Segmented Toggle */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0B0D14] border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('camera');
              setScanError(null);
            }}
            className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'camera' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span>Cámara QR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('image');
              setScanError(null);
            }}
            className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'image' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImagePlus className="w-4 h-4 text-emerald-400" />
            <span>Subir QR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('serial');
              setScanError(null);
            }}
            className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'serial' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4 text-fuchsia-400" />
            <span>Serial / Link</span>
          </button>
        </div>

        {mode === 'camera' && (
          <div className="space-y-2.5">
            <div className="relative rounded-2xl overflow-hidden bg-[#0B0D14] border border-white/10 aspect-[4/3] flex items-center justify-center">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? '-scale-x-100' : ''
                  }`}
                />
              ) : (
                <div className="p-6 text-center space-y-2">
                  <QrCode className="w-10 h-10 text-sky-400 mx-auto opacity-75" />
                  <p className="text-xs text-slate-300 max-w-xs mx-auto">
                    {detectedCard
                      ? `Carta detectada: ${detectedCard.title}`
                      : scanError || 'Iniciando lector óptico QR...'}
                  </p>
                </div>
              )}

              {/* AR Viewfinder Reticle */}
              <div className="absolute inset-6 border-2 border-dashed border-sky-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between text-[11px] font-mono-num text-sky-300">
                  <span>{cameraActive ? 'LECTOR QR ACTIVO' : 'MODO ESCÁNER'}</span>
                  <span>{detectedCard ? detectedCard.serialCode : 'BUSCANDO QR...'}</span>
                </div>
                <div
                  className={`self-center px-3 py-1.5 rounded-xl bg-[#0B0D14]/85 border text-xs font-semibold flex items-center gap-1.5 ${
                    detectedCard
                      ? 'border-emerald-400/50 text-emerald-300'
                      : 'border-sky-400/40 text-sky-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{scanStatus}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                }
                className="min-h-[38px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
              >
                <SwitchCamera className="w-4 h-4 text-sky-400" />
                <span>
                  Lente: {facingMode === 'environment' ? 'Trasera' : 'Frontal'}
                </span>
              </button>

              {detectedCard && (
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="min-h-[38px] px-3 rounded-xl bg-sky-500/15 border border-sky-400/35 text-xs font-semibold text-sky-300 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Escanear otro QR</span>
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'image' && (
          <div className="space-y-3">
            <label className="block rounded-2xl border-2 border-dashed border-emerald-400/40 hover:border-emerald-400 bg-[#0B0D14] p-5 text-center cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleScanImageUpload}
                className="hidden"
              />
              <ImagePlus className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-white">
                Sube el reverso de una photocard o captura con QR
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Decodificación automática en PNG, JPG o WebP sin necesitar cámara
              </p>
            </label>

            {uploadedScanPreview && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#0B0D14] border border-white/10">
                <img
                  src={uploadedScanPreview}
                  alt="Imagen escaneada"
                  className="w-16 h-20 object-cover rounded-xl border border-white/15 shrink-0"
                />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-white">{scanStatus}</div>
                  {scannedRawText && (
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      Contenido: {scannedRawText}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'serial' && (
          <form onSubmit={(e) => void handleSearchSerial(e)} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Serial (KRM-EST-006), ID o URL ?card=..."
                value={serialQuery}
                onChange={(e) => setSerialQuery(e.target.value)}
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-sky-500 text-slate-950 font-semibold text-sm flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>Buscar</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cards.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSerialQuery(c.serialCode);
                    setDetectedCard(c);
                    setScannedRawText(c.serialCode);
                    setScanError(null);
                    setScanStatus(`Carta seleccionada · ${c.serialCode}`);
                    soundEngine.playVerifyChime();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono-num text-slate-300"
                >
                  {c.serialCode}
                </button>
              ))}
            </div>
          </form>
        )}

        {scanError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/35 text-xs text-rose-200">
            {scanError}
          </div>
        )}

        {isSafeScannedExternalUrl && (
          <div className="p-4 rounded-2xl bg-[#0B0D14] border border-sky-400/30 space-y-2">
            <div className="text-xs font-bold text-sky-300">Enlace QR externo detectado</div>
            <p className="text-xs text-slate-300 break-all">{scannedRawText}</p>
            <a
              href={scannedRawText}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Enlace Escaneado</span>
            </a>
          </div>
        )}

        {!detectedCard && scannedRawText && !isSafeScannedExternalUrl && !scanError && (
          <div className="p-3.5 rounded-2xl bg-[#0B0D14] border border-amber-400/30 text-xs text-amber-200">
            QR leído (<span className="font-mono-num">{scannedRawText}</span>), pero no corresponde a una carta pública en tu colección actual.
          </div>
        )}

        {/* Identified Card Panel */}
        {detectedCard && (
          <div className="bg-[#0B0D14] border border-emerald-400/30 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3.5">
              <img
                src={detectedCard.photoUrl}
                alt={detectedCard.title}
                referrerPolicy="no-referrer"
                className="w-16 h-22 rounded-xl object-cover shrink-0 border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-emerald-400">
                  Photocard Identificada · {detectedCard.serialCode}
                </div>
                <h3 className="font-display text-base font-bold text-white truncate">
                  {detectedCard.title}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  {detectedCard.location} · {detectedCard.eventDate}
                </p>
                {detectedCard.concert?.enabled && (
                  <button
                    type="button"
                    onClick={handlePlayAudio}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300"
                  >
                    {isPlayingAudio ? <Volume2 className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5" />}
                    <span>
                      {isPlayingAudio
                        ? 'Reproduciendo audio...'
                        : `Escuchar: ${detectedCard.concert.favoriteSong}`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="block space-y-1">
                <span className="text-slate-400">Guardar recuerdo en álbum</span>
                <select
                  value={targetAlbumId}
                  onChange={(e) => setTargetAlbumId(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#131622] border border-white/10 text-white"
                >
                  {albums.map((alb) => (
                    <option key={alb.id} value={alb.id}>
                      {alb.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-slate-400">Añadir recuerdo o nota personal (opcional)</span>
                <input
                  type="text"
                  placeholder="Ej. Me la regaló un fan en la barricada..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#131622] border border-white/10 text-white"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onInspectCard(detectedCard);
                }}
                className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
              >
                Abrir en Visor 3D
              </button>
              <button
                type="button"
                onClick={handleRegister}
                disabled={registering}
                className="min-h-[44px] rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-xs font-bold"
              >
                {registering ? 'Guardando...' : 'Registrar en Álbum'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
