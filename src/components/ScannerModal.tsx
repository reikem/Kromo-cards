import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Music, QrCode, Search, Volume2, X } from 'lucide-react';
import type { Album, Photocard } from '../types/kromacard';
import { soundEngine } from '../utils/soundEngine';

interface ScannerModalProps {
  cards: Photocard[];
  albums: Album[];
  onClose: () => void;
  onInspectCard: (card: Photocard) => void;
  onCloneToAlbum: (card: Photocard, targetAlbumId: string, personalNote: string) => Promise<void>;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  cards,
  albums,
  onClose,
  onInspectCard,
  onCloneToAlbum,
}) => {
  const [mode, setMode] = useState<'camera' | 'serial'>('camera');
  const [serialQuery, setSerialQuery] = useState('');
  const [detectedCard, setDetectedCard] = useState<Photocard | null>(cards[0] || null);
  const [targetAlbumId, setTargetAlbumId] = useState(albums[0]?.id || '');
  const [personalNote, setPersonalNote] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [registering, setRegistering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera();
      return;
    }
    let cancelled = false;
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch {
        setCameraActive(false);
      }
    };
    void startCam();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      soundEngine.stopSnippet();
    };
  }, []);

  const handleSearchSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const q = serialQuery.trim().toLowerCase();
    if (!q) return;
    const match = cards.find(
      (c) =>
        c.serialCode.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
    );
    if (match) {
      soundEngine.playVerifyChime();
      setDetectedCard(match);
    }
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

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0D14]/95 backdrop-blur-md overflow-y-auto p-4 md:p-8">
      <div className="max-w-lg mx-auto bg-[#131622] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Escanear Photocard o QR
            </h2>
            <p className="text-xs text-slate-400">
              Identifica una carta física para abrir su audio y vista 3D
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Segmented Toggle */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#0B0D14] border border-white/10">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'camera' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4 text-sky-400" />
            <span>Escáner Cámara / QR</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('serial')}
            className={`min-h-[40px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'serial' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4 text-fuchsia-400" />
            <span>Código Serial</span>
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="relative rounded-2xl overflow-hidden bg-[#0B0D14] border border-white/10 aspect-[4/3] flex items-center justify-center">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              detectedCard && (
                <img
                  src={detectedCard.photoUrl}
                  alt={detectedCard.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-55"
                />
              )
            )}
            {/* AR Viewfinder Reticle */}
            <div className="absolute inset-6 border-2 border-dashed border-sky-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between text-[11px] font-mono-num text-sky-300">
                <span>SENSOR ÓPTICO QR</span>
                <span>{detectedCard?.serialCode}</span>
              </div>
              <div className="self-center px-3 py-1.5 rounded-xl bg-[#0B0D14]/85 border border-sky-400/40 text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Código Holográfico Verificado</span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSearchSerial} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. KRM-EST-006 o nombre de la carta"
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

        {/* Identified Card Panel */}
        {detectedCard && (
          <div className="bg-[#0B0D14] border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3.5">
              <img
                src={detectedCard.photoUrl}
                alt={detectedCard.title}
                referrerPolicy="no-referrer"
                className="w-16 h-22 rounded-xl object-cover shrink-0 border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-fuchsia-400">
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
