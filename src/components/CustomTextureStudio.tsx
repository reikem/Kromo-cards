import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  ImagePlus,
  Layers,
  RefreshCw,
  Save,
  Sparkles,
  SwitchCamera,
  VideoOff,
  Wand2,
} from 'lucide-react';
import type {
  CollectorUser,
  CommunityCategory,
  CustomTexture,
  TexturePatternType,
} from '../types/kromacard';
import { COMMUNITY_CATEGORIES } from '../utils/frameShapes';
import { DriveExportButton } from './DriveExportButton';
import { ImageSourceSection } from './ImageSourceSection';

interface CustomTextureStudioProps {
  currentUser: CollectorUser;
  textures: CustomTexture[];
  activeCustomTextureUrl?: string;
  requestedMode?: 'create' | 'camera' | 'upload';
  requestedModeNonce?: number;
  onApplyTextureUrl: (imageUrl: string, label?: string) => void;
  onApplyFrontPhotoUrl?: (imageUrl: string) => void;
  onCreateTexture: (texture: Partial<CustomTexture>) => Promise<CustomTexture>;
  onNotifyToast: (msg: string) => void;
}

const PATTERN_PRESETS: {
  id: Exclude<TexturePatternType, 'subida'>;
  label: string;
}[] = [
  { id: 'prisma', label: 'Prisma Cristal' },
  { id: 'ondas', label: 'Ondas Neón' },
  { id: 'malla', label: 'Malla Láser' },
  { id: 'estelar', label: 'Polvo Estelar' },
  { id: 'cuadricula', label: 'Cuadrícula Holo' },
  { id: 'cristal', label: 'Facetas Diamante' },
  { id: 'galaxia', label: 'Espiral Galaxia' },
  { id: 'aurora', label: 'Cortinas Aurora' },
];

export async function exportTextureImageAsPng(
  imageUrl: string,
  fileNameBase: string
) {
  const safeName =
    fileNameBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'textura-kromacard';

  if (imageUrl.startsWith('data:image/png')) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${safeName}.png`;
    a.click();
    return;
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('load failed'));
      img.src = imageUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 720;
    canvas.height = img.naturalHeight || 1008;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${safeName}.png`;
    a.click();
  } catch {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${safeName}.png`;
    a.click();
  }
}

export const CustomTextureStudio: React.FC<CustomTextureStudioProps> = ({
  currentUser,
  textures,
  activeCustomTextureUrl,
  requestedMode,
  requestedModeNonce,
  onApplyTextureUrl,
  onApplyFrontPhotoUrl,
  onCreateTexture,
  onNotifyToast,
}) => {
  const [mode, setMode] = useState<'create' | 'camera' | 'upload'>('create');
  const [patternType, setPatternType] =
    useState<Exclude<TexturePatternType, 'subida'>>('prisma');
  const [primaryColor, setPrimaryColor] = useState('#38BDF8');
  const [secondaryColor, setSecondaryColor] = useState('#E879F9');
  const [density, setDensity] = useState(64);
  const [angleDeg, setAngleDeg] = useState(35);
  const [textureName, setTextureName] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('fantasia');
  const [sharePublic, setSharePublic] = useState(true);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Camera capture state
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedCameraUrl, setCapturedCameraUrl] = useState<string>('');

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraStream = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Tu navegador o contexto actual no permite acceder a la cámara del dispositivo.'
        );
        return;
      }
      stopCameraStream();
      setCameraStarting(true);
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setCameraActive(true);
        window.requestAnimationFrame(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            void videoRef.current.play().catch(() => {
              // autoplay handled via attribute
            });
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (/Permission|NotAllowed|denied/i.test(msg)) {
          setCameraError(
            'Permiso de cámara denegado. Habilita el acceso a la cámara en tu navegador e inténtalo de nuevo.'
          );
        } else if (/NotFound|DevicesNotFound/i.test(msg)) {
          setCameraError('No se detectó ninguna cámara disponible en este dispositivo.');
        } else {
          setCameraError('No se pudo iniciar la cámara en vivo. Intenta recargar o cambiar de lente.');
        }
      } finally {
        setCameraStarting(false);
      }
    },
    [facingMode, stopCameraStream]
  );

  // Sync external mode trigger (e.g., from Studio "Foto" tab shortcut)
  useEffect(() => {
    if (!requestedMode) return;
    setMode(requestedMode);
    if (requestedMode === 'camera' && !capturedCameraUrl) {
      void startCameraStream(facingMode);
    }
  }, [requestedMode, requestedModeNonce]);

  // Cleanup camera when leaving camera mode or unmounting
  useEffect(() => {
    if (mode !== 'camera') {
      stopCameraStream();
    }
  }, [mode, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Attach stream if videoRef mounts slightly after cameraActive toggles
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {
        // ignore
      });
    }
  }, [cameraActive]);

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      onNotifyToast('Espera un instante a que la cámara enfoque antes de capturar.');
      return;
    }

    const targetW = 720;
    const targetH = 1008;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = targetW / targetH;
    const videoRatio = vw / vh;

    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    if (videoRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }

    if (facingMode === 'user') {
      ctx.save();
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }

    const dataUrl = canvas.toDataURL('image/png');
    setCapturedCameraUrl(dataUrl);
    if (!textureName.trim()) {
      setTextureName(`Textura Cámara ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`);
    }
    stopCameraStream();
    onApplyTextureUrl(dataUrl, 'Textura Cámara Anverso');
    onNotifyToast('Foto capturada y aplicada directamente como textura del anverso.');
  };

  const renderProceduralTexture = (
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ) => {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark obsidian holographic base
    const baseGrad = ctx.createLinearGradient(0, 0, width, height);
    baseGrad.addColorStop(0, '#090B12');
    baseGrad.addColorStop(0.5, '#12182B');
    baseGrad.addColorStop(1, '#090B12');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient holographic foil sweep
    const rad = (angleDeg * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const dx = Math.cos(rad) * width * 0.55;
    const dy = Math.sin(rad) * height * 0.55;

    const sheen = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    sheen.addColorStop(0, `${primaryColor}55`);
    sheen.addColorStop(0.35, `${secondaryColor}77`);
    sheen.addColorStop(0.52, 'rgba(255,255,255,0.42)');
    sheen.addColorStop(0.7, `${primaryColor}66`);
    sheen.addColorStop(1, `${secondaryColor}44`);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    if (patternType === 'prisma') {
      const cols = Math.max(4, Math.round(density / 12));
      const rows = Math.round(cols * 1.4);
      const cw = width / cols;
      const ch = height / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw;
          const y = r * ch;
          const shift = ((r * 7 + c * 13) % 10) / 10;
          ctx.fillStyle =
            (r + c) % 2 === 0
              ? `rgba(255,255,255,${0.08 + shift * 0.25})`
              : shift > 0.5
                ? `${primaryColor}66`
                : `${secondaryColor}66`;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cw, y + (r % 2 === 0 ? 0 : ch));
          ctx.lineTo(x + cw * 0.5, y + ch);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (patternType === 'ondas') {
      const waveCount = Math.max(6, Math.round(density / 4));
      for (let i = 0; i < waveCount; i++) {
        const yBase = (i / waveCount) * height;
        ctx.strokeStyle = i % 2 === 0 ? `${primaryColor}AA` : `${secondaryColor}AA`;
        ctx.lineWidth = 2.5 + (i % 3);
        ctx.beginPath();
        for (let x = 0; x <= width; x += 18) {
          const y =
            yBase +
            Math.sin((x / width) * Math.PI * 4 + i * 0.55 + rad) * 26;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (patternType === 'malla') {
      const step = Math.max(24, Math.round(115 - density * 0.75));
      ctx.lineWidth = 1.8;
      for (let x = -height; x < width + height; x += step) {
        ctx.strokeStyle = `${primaryColor}99`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.75, height);
        ctx.stroke();

        ctx.strokeStyle = `${secondaryColor}99`;
        ctx.beginPath();
        ctx.moveTo(x + height * 0.75, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    } else if (patternType === 'estelar') {
      const starCount = Math.max(28, Math.round(density * 1.4));
      for (let i = 0; i < starCount; i++) {
        const sx = (((i * 197 + 31) % 997) / 997) * width;
        const sy = (((i * 313 + 89) % 991) / 991) * height;
        const r = 1.5 + (i % 5) * 1.3;
        ctx.fillStyle =
          i % 3 === 0
            ? '#FFFFFF'
            : i % 2 === 0
              ? primaryColor
              : secondaryColor;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        if (i % 6 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx - r * 3.2, sy);
          ctx.lineTo(sx + r * 3.2, sy);
          ctx.moveTo(sx, sy - r * 3.2);
          ctx.lineTo(sx, sy + r * 3.2);
          ctx.stroke();
        }
      }
    } else if (patternType === 'cuadricula') {
      const size = Math.max(22, Math.round(92 - density * 0.6));
      for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
          const checker = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
          ctx.fillStyle = checker ? `${primaryColor}40` : `${secondaryColor}40`;
          ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
        }
      }
    } else if (patternType === 'cristal') {
      const shards = Math.max(18, Math.round(density * 0.55));
      for (let i = 0; i < shards; i++) {
        const px = (((i * 173 + 19) % 977) / 977) * width;
        const py = (((i * 271 + 43) % 983) / 983) * height;
        const r = 38 + (i % 5) * 24;
        ctx.fillStyle = i % 2 === 0 ? `${primaryColor}55` : `${secondaryColor}55`;
        ctx.beginPath();
        ctx.moveTo(px, py - r);
        ctx.lineTo(px + r * 0.65, py);
        ctx.lineTo(px, py + r);
        ctx.lineTo(px - r * 0.65, py);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else if (patternType === 'galaxia') {
      const arms = 3;
      const dots = Math.max(80, Math.round(density * 2.2));
      for (let i = 0; i < dots; i++) {
        const arm = i % arms;
        const progress = i / dots;
        const theta = progress * Math.PI * 5 + (arm * Math.PI * 2) / arms + rad;
        const radius = progress * width * 0.65;
        const gx = cx + Math.cos(theta) * radius;
        const gy = cy + Math.sin(theta) * radius * 1.25;
        const dr = 1.8 + (1 - progress) * 3.8;
        ctx.fillStyle = i % 3 === 0 ? '#FFFFFF' : i % 2 === 0 ? `${primaryColor}CC` : `${secondaryColor}CC`;
        ctx.beginPath();
        ctx.arc(gx, gy, dr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (patternType === 'aurora') {
      const ribbons = Math.max(5, Math.round(density / 12));
      for (let i = 0; i < ribbons; i++) {
        const g = ctx.createLinearGradient(0, (i / ribbons) * height, width, ((i + 1) / ribbons) * height);
        g.addColorStop(0, `${primaryColor}00`);
        g.addColorStop(0.5, i % 2 === 0 ? `${primaryColor}99` : `${secondaryColor}99`);
        g.addColorStop(1, `${secondaryColor}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        const y0 = (i / ribbons) * height;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= width; x += 24) {
          ctx.lineTo(x, y0 + Math.sin((x / width) * Math.PI * 3 + i + rad) * 55);
        }
        ctx.lineTo(width, y0 + 130);
        ctx.lineTo(0, y0 + 130);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Diagonal light glare bar
    const glare = ctx.createLinearGradient(0, 0, width, height);
    glare.addColorStop(0, 'rgba(255,255,255,0)');
    glare.addColorStop(0.45, 'rgba(255,255,255,0)');
    glare.addColorStop(0.5, 'rgba(255,255,255,0.34)');
    glare.addColorStop(0.55, 'rgba(255,255,255,0)');
    glare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  };

  useEffect(() => {
    if (mode !== 'create' || !previewCanvasRef.current) return;
    renderProceduralTexture(previewCanvasRef.current, 360, 504);
  }, [mode, patternType, primaryColor, secondaryColor, density, angleDeg]);

  const buildHighResCreatedDataUrl = (): string => {
    const offscreen = document.createElement('canvas');
    renderProceduralTexture(offscreen, 720, 1008);
    return offscreen.toDataURL('image/png');
  };

  const getActiveDraftImageUrl = (): string | null => {
    if (mode === 'create') {
      return buildHighResCreatedDataUrl();
    }
    if (mode === 'camera') {
      return capturedCameraUrl || null;
    }
    return uploadedPreviewUrl || null;
  };

  const handleApplyDraft = () => {
    const url = getActiveDraftImageUrl();
    if (!url) {
      onNotifyToast(
        mode === 'camera'
          ? 'Primero toma una foto con la cámara para usarla como textura.'
          : 'Primero sube o selecciona una imagen para tu textura.'
      );
      return;
    }
    onApplyTextureUrl(url, textureName.trim() || 'Textura Personalizada');
    onNotifyToast('Textura personalizada aplicada al anverso de tu carta 3D.');
  };

  const handleSaveAndShareTexture = async () => {
    const url = getActiveDraftImageUrl();
    if (!url) {
      onNotifyToast(
        mode === 'camera'
          ? 'Captura primero una foto con la cámara.'
          : 'Primero crea o carga una textura.'
      );
      return;
    }
    setSaving(true);
    try {
      const name =
        textureName.trim() ||
        (mode === 'create'
          ? `${PATTERN_PRESETS.find((p) => p.id === patternType)?.label || 'Holo'} Propia`
          : mode === 'camera'
            ? 'Textura Cámara Anverso'
            : 'Textura Subida');
      const created = await onCreateTexture({
        name,
        imageUrl: url,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        isPublic: sharePublic,
        patternType: mode === 'create' ? patternType : 'subida',
        primaryColor,
        secondaryColor,
        category,
      });
      onApplyTextureUrl(created.imageUrl, created.name);
      setTextureName('');
      onNotifyToast(
        sharePublic
          ? `Textura "${created.name}" guardada, aplicada y compartida.`
          : `Textura "${created.name}" guardada en tu estudio.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportCurrentPng = async () => {
    const url = getActiveDraftImageUrl();
    if (!url) {
      onNotifyToast('Crea, captura o carga una textura para poder exportarla en PNG.');
      return;
    }
    await exportTextureImageAsPng(
      url,
      textureName.trim() || `textura-${mode === 'camera' ? 'camara' : patternType}`
    );
    onNotifyToast('Textura exportada en PNG de alta resolución.');
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0D14] border border-sky-400/30 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-sky-400" />
            <span>Taller de Texturas Propias (Crear, Cámara y Subir)</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Diseña láminas holográficas, captura directamente con tu cámara como textura del anverso o sube archivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131622] border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
              mode === 'create'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Crear Textura</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
              mode === 'camera'
                ? 'bg-emerald-400 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Cámara</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${
              mode === 'upload'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Subir</span>
          </button>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-5 flex flex-col items-center gap-2">
            <canvas
              ref={previewCanvasRef}
              className="w-40 aspect-[54/76] rounded-2xl border border-white/20 shadow-lg bg-black"
            />
            <span className="text-[10px] text-slate-400">
              Vista previa de lámina 720×1008px
            </span>
          </div>

          <div className="sm:col-span-7 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {PATTERN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPatternType(p.id)}
                  className={`min-h-[34px] px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                    patternType === p.id
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-[#131622] border-white/10 text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <label className="flex items-center justify-between p-2 rounded-xl bg-[#131622] border border-white/10">
                <span className="text-slate-300">Color 1</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded-xl bg-[#131622] border border-white/10">
                <span className="text-slate-300">Color 2</span>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <label className="space-y-1 text-slate-300">
                <span className="flex justify-between">
                  <span>Densidad</span>
                  <span className="font-mono-num text-sky-400">{density}%</span>
                </span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={density}
                  onChange={(e) => setDensity(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </label>
              <label className="space-y-1 text-slate-300">
                <span className="flex justify-between">
                  <span>Ángulo</span>
                  <span className="font-mono-num text-fuchsia-400">{angleDeg}°</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={180}
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(Number(e.target.value))}
                  className="w-full accent-fuchsia-400"
                />
              </label>
            </div>
          </div>
        </div>
      ) : mode === 'camera' ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-5 flex flex-col items-center gap-2">
            <div className="relative w-44 aspect-[54/76] rounded-2xl border border-emerald-400/35 bg-[#131622] overflow-hidden shadow-lg flex items-center justify-center">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === 'user' ? '-scale-x-100' : ''
                    }`}
                  />
                  <div className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-white/40" />
                </>
              ) : capturedCameraUrl ? (
                <img
                  src={capturedCameraUrl}
                  alt="Foto capturada para textura del anverso"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-4 text-center space-y-2">
                  <Camera className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Enciende tu cámara para tomar una textura directa al anverso.
                  </p>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 text-center">
              Encuadre automático 54×76 mm sin subir archivos
            </span>
          </div>

          <div className="sm:col-span-7 space-y-3">
            <div className="p-3 rounded-xl bg-[#131622] border border-white/10 space-y-1">
              <div className="text-xs font-bold text-white">
                Captura en Vivo → Textura del Anverso
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Apunta a luces de concierto, papel brillante, telas o una foto directa. Al capturar se aplica al instante sobre el frente de tu carta 3D.
              </p>
            </div>

            {cameraError && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200">
                {cameraError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  disabled={cameraStarting}
                  onClick={() => void startCameraStream(facingMode)}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {cameraStarting
                      ? 'Abriendo cámara...'
                      : capturedCameraUrl
                        ? 'Tomar otra foto'
                        : 'Encender Cámara'}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureCameraFrame}
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Capturar como Textura</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = facingMode === 'environment' ? 'user' : 'environment';
                      setFacingMode(next);
                      void startCameraStream(next);
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                  >
                    <SwitchCamera className="w-4 h-4 text-sky-400" />
                    <span>Cambiar Lente</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="min-h-[40px] px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                  >
                    <VideoOff className="w-4 h-4 text-rose-300" />
                    <span>Detener</span>
                  </button>
                </>
              )}
            </div>

            {capturedCameraUrl && !cameraActive && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onApplyTextureUrl(
                      capturedCameraUrl,
                      textureName.trim() || 'Textura Cámara Anverso'
                    );
                    onNotifyToast('Foto aplicada como textura del anverso.');
                  }}
                  className="min-h-[36px] px-3 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[11px] font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Aplicar como Textura Anverso</span>
                </button>

                {onApplyFrontPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onApplyFrontPhotoUrl(capturedCameraUrl);
                      onNotifyToast('Captura aplicada también como foto principal del anverso.');
                    }}
                    className="min-h-[36px] px-3 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200 text-[11px] font-semibold flex items-center gap-1.5"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>Usar como Foto Principal</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ImageSourceSection
            title="Sube o carga una imagen de textura (Archivo o Google)"
            subtitle="Se aplicará como lámina translúcida sobre tu carta"
            compact
            onSelectImage={(dataUrl, fileName) => {
              setUploadedPreviewUrl(dataUrl);
              if (!textureName.trim() && fileName) {
                setTextureName(fileName.replace(/\.[^.]+$/, ''));
              }
              onApplyTextureUrl(dataUrl, fileName || 'Textura Propia');
            }}
            onNotifyToast={onNotifyToast}
          />
          {uploadedPreviewUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#131622] border border-emerald-400/30">
              <img
                src={uploadedPreviewUrl}
                alt="Vista previa de textura cargada"
                className="w-12 h-16 rounded-lg object-cover border border-white/15"
              />
              <div className="text-xs text-emerald-300 font-semibold">
                Textura lista para aplicar, guardar o exportar en PNG.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save / Apply / Export Actions */}
      <div className="space-y-2.5 pt-2 border-t border-white/10">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Nombre de tu textura (ej. Lámina Aurora VIP)"
            value={textureName}
            onChange={(e) => setTextureName(e.target.value)}
            className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white placeholder:text-slate-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CommunityCategory)}
            aria-label="Categoría de textura"
            className="min-h-[38px] px-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
          >
            {COMMUNITY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={sharePublic}
              onChange={(e) => setSharePublic(e.target.checked)}
              className="accent-sky-400"
            />
            <span>Compartir con todos los usuarios</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApplyDraft}
            className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-sky-400" />
            <span>Aplicar a Carta</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveAndShareTexture()}
            className="min-h-[38px] px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Guardando...' : 'Guardar Textura'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <DriveExportButton
              source={() => getActiveDraftImageUrl()}
              fileNameBase={textureName.trim() || `textura-${patternType}`}
              description="Lámina holográfica personalizada creada en Kromacard Studio"
              label="Guardar en Drive"
              onNotifyToast={onNotifyToast}
            />
            <button
              type="button"
              onClick={() => void handleExportCurrentPng()}
              className="min-h-[38px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Community & Personal Saved Textures */}
      {textures.filter((t) => t.isPublic || t.authorId === currentUser.id).length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>
              Texturas Guardadas y de Todos los Usuarios (
              {textures.filter((t) => t.isPublic || t.authorId === currentUser.id).length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {textures
              .filter((t) => t.isPublic || t.authorId === currentUser.id)
              .map((tex) => {
              const isSelected = activeCustomTextureUrl === tex.imageUrl;
              return (
                <div
                  key={tex.id}
                  className={`rounded-xl overflow-hidden border bg-[#131622] transition-all ${
                    isSelected
                      ? 'border-sky-400 ring-2 ring-sky-400/40'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApplyTextureUrl(tex.imageUrl, tex.name);
                      onNotifyToast(`Textura "${tex.name}" aplicada.`);
                    }}
                    className="w-full text-left"
                  >
                    <div className="relative h-16 w-full bg-black overflow-hidden">
                      <img
                        src={tex.imageUrl}
                        alt={tex.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 pt-1.5">
                      <div className="text-[11px] font-bold text-white truncate">
                        {tex.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Por {tex.authorName}
                      </div>
                    </div>
                  </button>
                  <div className="px-2 py-1.5 grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void exportTextureImageAsPng(tex.imageUrl, tex.name);
                        onNotifyToast(`Textura "${tex.name}" exportada en PNG.`);
                      }}
                      className="min-h-[28px] rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-sky-300 flex items-center justify-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>PNG</span>
                    </button>
                    <DriveExportButton
                      compact
                      source={tex.imageUrl}
                      fileNameBase={`textura-${tex.name}`}
                      description={`Textura "${tex.name}" exportada desde Kromacard`}
                      label="Drive"
                      onNotifyToast={onNotifyToast}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
