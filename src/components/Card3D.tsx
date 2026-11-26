import React, { useEffect, useRef, useState } from 'react';
import { Music, QrCode, Volume2 } from 'lucide-react';
import type { Photocard } from '../types/kromacard';
import { buildFilterCss, generateCardQRDataUrl } from '../utils/cardExporter';
import {
  getCelebrationSpec,
  getFrameLayoutSpec,
  getFrameShapeClipPath,
} from '../utils/frameShapes';
import { getHoloTextureOverlayUrl } from '../utils/holoTextures';
import { soundEngine } from '../utils/soundEngine';
import { isSvgDataUrl } from '../utils/svgSignature';

export interface DroppedStickerPayload {
  stickerId: string;
  name: string;
  content: string;
  isImage: boolean;
  bgColor?: string;
  textColor?: string;
}

interface Card3DProps {
  card: Photocard;
  rotateY?: number;
  rotateX?: number;
  autoSpin?: boolean;
  interactiveTilt?: boolean;
  compact?: boolean;
  onStickerDrag?: (stickerId: string, x: number, y: number) => void;
  onStickerDrop?: (sticker: DroppedStickerPayload, x: number, y: number) => void;
  onCardClick?: () => void;
  onQrClick?: () => void;
}

export const Card3D: React.FC<Card3DProps> = ({
  card,
  rotateY = 0,
  rotateX = 0,
  autoSpin = false,
  interactiveTilt = true,
  compact = false,
  onStickerDrag,
  onStickerDrop,
  onCardClick,
  onQrClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointerTilt, setPointerTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const [spinDeg, setSpinDeg] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
  const [isDropHover, setIsDropHover] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [card.photoUrl]);

  useEffect(() => {
    let active = true;
    void generateCardQRDataUrl(card.id)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [card.id]);

  useEffect(() => {
    if (!autoSpin) {
      setSpinDeg(0);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setSpinDeg((prev) => (prev + dt * 42) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (draggingStickerId && onStickerDrag) {
      onStickerDrag(draggingStickerId, Math.round(px * 84 + 8), Math.round(py * 80 + 10));
      return;
    }

    if (!interactiveTilt) return;
    setPointerTilt({
      rx: (0.5 - py) * 18,
      ry: (px - 0.5) * 22,
      gx: px * 100,
      gy: py * 100,
    });
  };

  const handlePointerLeave = () => {
    setDraggingStickerId(null);
    setPointerTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

  const handlePlaySong = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.concert) return;
    if (isPlayingAudio) {
      soundEngine.stopSnippet();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      soundEngine.playSnippet(card.concert.audioPresetId, card.concert.customAudioUrl, () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const totalY = rotateY + pointerTilt.ry + (autoSpin ? spinDeg : 0);
  const totalX = rotateX + pointerTilt.rx;

  const frameBackground = (() => {
    if (card.frameStyle === 'gold') {
      return 'gold-foil-gradient';
    }
    if (card.frameStyle === 'holo') {
      return 'prism-foil-gradient holo-foil-animated';
    }
    if (card.frameStyle === 'polaroid') {
      return 'bg-slate-100';
    }
    if (card.frameStyle === 'neon-cyber') {
      return 'neon-cyber-gradient holo-foil-animated';
    }
    if (card.frameStyle === 'royal-velvet') {
      return 'royal-velvet-gradient';
    }
    if (card.frameStyle === 'sakura-pearl') {
      return 'sakura-pearl-gradient holo-foil-animated';
    }
    if (card.frameStyle === 'liquid-chrome') {
      return 'liquid-chrome-gradient holo-foil-animated';
    }
    return '';
  })();

  const customFrameStyle =
    card.frameStyle === 'custom' || card.frameStyle === 'stadium'
      ? {
          background: `linear-gradient(135deg, ${card.primaryColor}, ${card.secondaryColor})`,
        }
      : undefined;

  const holoOverlayUrl = card.customTextureUrl || getHoloTextureOverlayUrl(card.texture);

  const textureClass = (() => {
    if (holoOverlayUrl) return '';
    if (card.texture === 'prism') return 'prism-foil-gradient holo-foil-animated mix-blend-color-dodge';
    if (card.texture === 'stadium') return 'stadium-beams-pattern mix-blend-screen';
    if (card.texture === 'gold-relief') return 'gold-foil-gradient mix-blend-soft-light';
    if (card.texture === 'carbon') return 'carbon-weave-pattern mix-blend-overlay';
    if (card.texture === 'aurora-foil') return 'aurora-foil-pattern holo-foil-animated mix-blend-screen';
    if (card.texture === 'cyber-grid') return 'cyber-grid-pattern mix-blend-screen';
    if (card.texture === 'velvet-satin') return 'velvet-satin-pattern mix-blend-soft-light';
    if (card.texture === 'chrome-liquid') return 'chrome-liquid-pattern holo-foil-animated mix-blend-color-dodge';
    return '';
  })();

  const shineOpacity = Math.max(0, Math.min(1, card.shineIntensity / 100));
  const effectiveShape =
    card.frameShape || (card.frameStyle === 'polaroid' ? 'polaroid' : 'rectangulo');
  const isPolaroid = card.frameStyle === 'polaroid' || effectiveShape === 'polaroid';
  const shapeClipPath = getFrameShapeClipPath(effectiveShape);
  const frameLayout = getFrameLayoutSpec(effectiveShape);
  const celebrationSpec = getCelebrationSpec(card.frameCelebration);
  const uploadedBorderStyle =
    card.customFrameUrl && card.customFrameMode !== 'overlay'
      ? {
          backgroundImage: `url(${card.customFrameUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : undefined;
  const effectiveCustomFrameStyle =
    uploadedBorderStyle ||
    customFrameStyle ||
    (celebrationSpec
      ? {
          background: `linear-gradient(135deg, ${card.primaryColor || celebrationSpec.primaryColor}, ${card.secondaryColor || celebrationSpec.secondaryColor})`,
        }
      : undefined);
  const isLongTitle = card.title.length > 20;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onStickerDrop) return;
    if (e.dataTransfer.types.includes('application/kromacard-sticker')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDropHover) setIsDropHover(true);
    }
  };

  const handleDragLeave = () => {
    if (isDropHover) setIsDropHover(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!onStickerDrop) return;
    const raw = e.dataTransfer.getData('application/kromacard-sticker');
    setIsDropHover(false);
    if (!raw) return;
    e.preventDefault();
    try {
      const payload = JSON.parse(raw) as DroppedStickerPayload;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onStickerDrop(payload, Math.round(px * 84 + 8), Math.round(py * 80 + 10));
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={() => setDraggingStickerId(null)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onCardClick}
      className={`perspective-1200 select-none ${compact ? 'w-full aspect-[54/85]' : 'w-full max-w-[330px] aspect-[54/85] mx-auto'} ${onCardClick ? 'cursor-pointer' : ''} ${
        isDropHover ? 'ring-2 ring-sky-400 ring-offset-4 ring-offset-[#131622] rounded-[26px]' : ''
      }`}
    >
      <div
        className="relative w-full h-full preserve-3d transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${totalX}deg) rotateY(${totalY}deg)`,
        }}
      >
        {/* FRONT FACE (ANVERSO) */}
        <div
          className={`absolute inset-0 backface-hidden rounded-[22px] p-[6px] shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden ${
            effectiveCustomFrameStyle ? '' : frameBackground
          }`}
          style={{
            ...(effectiveCustomFrameStyle || {}),
            ...(shapeClipPath ? { clipPath: shapeClipPath } : {}),
          }}
        >
          <div
            className={`relative w-full h-full rounded-[17px] overflow-hidden flex flex-col ${
              isPolaroid ? 'bg-white text-slate-900' : 'bg-[#111524] text-slate-100'
            }`}
            style={{
              padding: frameLayout.frontPlatePadding,
              ...(shapeClipPath ? { clipPath: shapeClipPath } : {}),
            }}
          >
            {/* Photo Viewport */}
            <div
              className={`relative flex-1 overflow-hidden bg-slate-900 ${
                frameLayout.photoClipPath ? '' : isPolaroid ? 'rounded-[8px]' : 'rounded-[12px]'
              }`}
              style={
                frameLayout.photoClipPath ? { clipPath: frameLayout.photoClipPath } : undefined
              }
            >
              {!imgError ? (
                <img
                  src={card.photoUrl}
                  alt={card.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                  style={{
                    filter: buildFilterCss(card.filterSnapshot),
                    objectPosition: frameLayout.photoObjectPosition,
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-center">
                  <span className="text-3xl mb-2">{card.countryFlag}</span>
                  <span className="text-xs font-medium text-slate-300 line-clamp-2">
                    {card.title}
                  </span>
                </div>
              )}

              {/* Legibility Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/25 pointer-events-none" />

              {/* Top-left OVR / Edition Badge (adapts inset to frame shape) */}
              <div
                style={frameLayout.topLeftInset}
                className={`absolute rounded-xl bg-[#0B0D14]/75 backdrop-blur-md border border-white/10 flex flex-col items-center leading-none ${
                  frameLayout.narrowShape || compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
                }`}
              >
                <span
                  className={`font-display font-extrabold tabular-nums ${
                    compact || frameLayout.narrowShape ? 'text-sm' : 'text-xl'
                  }`}
                  style={{ color: card.frameStyle === 'gold' ? '#FDE68A' : card.primaryColor }}
                >
                  {card.ratingOrBadge}
                </span>
                <span className="text-[8px] font-bold tracking-wider text-slate-200 mt-0.5 max-w-[54px] truncate">
                  {card.categoryLabel}
                </span>
                <span className="text-[11px] mt-0.5">{card.countryFlag}</span>
              </div>

              {/* Top-right serial / celebration tag (adapts inset to frame shape) */}
              <div
                style={frameLayout.topRightInset}
                className="absolute text-right pointer-events-none flex flex-col items-end gap-0.5 max-w-[44%]"
              >
                <span className="font-mono-num text-[9px] font-semibold text-white/90 drop-shadow truncate max-w-full">
                  {card.serialCode}
                </span>
                {celebrationSpec && (
                  <span className="text-[9px] font-semibold text-amber-200 drop-shadow truncate max-w-full">
                    {celebrationSpec.emblem} {celebrationSpec.label}
                  </span>
                )}
              </div>

              {/* Placed Stickers */}
              {card.stickers.map((stk) => (
                <div
                  key={stk.id}
                  onPointerDown={(e) => {
                    if (onStickerDrag) {
                      e.stopPropagation();
                      setDraggingStickerId(stk.id);
                    }
                  }}
                  style={{
                    left: `${stk.x}%`,
                    top: `${stk.y}%`,
                    transform: `translate(-50%, -50%) scale(${stk.scale}) rotate(${stk.rotation}deg)`,
                  }}
                  className={`absolute z-10 select-none ${onStickerDrag ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                >
                  {stk.isImage ? (
                    <img
                      src={stk.content}
                      alt={stk.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 object-contain drop-shadow-md"
                    />
                  ) : stk.content.length <= 2 ? (
                    <span className="text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                      {stk.content}
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-display font-bold tracking-wide shadow-md"
                      style={{
                        backgroundColor: stk.bgColor || '#F59E0B',
                        color: stk.textColor || '#0B0D14',
                      }}
                    >
                      {stk.content}
                    </span>
                  )}
                </div>
              ))}

              {/* Title & Subtitle inside photo bottom (adapts alignment, width & line-clamp to frame) */}
              <div
                style={frameLayout.bottomOverlayInset}
                className={`absolute pointer-events-none ${
                  frameLayout.centerBottom ? 'text-center' : 'text-left'
                }`}
              >
                <h3
                  className={`font-display font-bold text-white leading-tight line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
                    compact || frameLayout.narrowShape
                      ? isLongTitle
                        ? 'text-xs'
                        : 'text-sm'
                      : isLongTitle
                        ? 'text-base'
                        : 'text-lg'
                  }`}
                >
                  {card.title}
                </h3>
                {card.subtitle && (
                  <p className="text-[10px] text-slate-200/95 truncate mt-0.5 drop-shadow">
                    {card.subtitle}
                  </p>
                )}
              </div>

              {/* Dynamic Texture & High-Res Holographic Foil Overlay */}
              {holoOverlayUrl ? (
                <img
                  src={holoOverlayUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen transition-transform duration-150 ease-out"
                  style={{
                    opacity: Math.max(0.18, shineOpacity * 0.85),
                    transform: `scale(1.08) translate(${((pointerTilt.gx - 50) * 0.16).toFixed(1)}px, ${((pointerTilt.gy - 50) * 0.16).toFixed(1)}px)`,
                  }}
                />
              ) : (
                card.texture !== 'none' && (
                  <div
                    className={`absolute inset-0 pointer-events-none ${textureClass}`}
                    style={{ opacity: shineOpacity * 0.55 }}
                  />
                )
              )}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-overlay"
                style={{
                  opacity: shineOpacity * 0.75,
                  background: `radial-gradient(circle at ${pointerTilt.gx}% ${pointerTilt.gy}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 32%, transparent 70%)`,
                }}
              />

              {/* Additional Card Visual Effect Overlay */}
              {card.cardEffect === 'sparkle-dust' && (
                <div className="absolute inset-0 pointer-events-none effect-sparkle-dust mix-blend-screen opacity-90" />
              )}
              {card.cardEffect === 'prism-rays' && (
                <div className="absolute inset-0 pointer-events-none effect-prism-rays mix-blend-screen opacity-85" />
              )}
              {card.cardEffect === 'aurora-glow' && (
                <div className="absolute inset-0 pointer-events-none aurora-foil-pattern mix-blend-screen opacity-75" />
              )}
              {card.cardEffect === 'scanlines-crt' && (
                <div className="absolute inset-0 pointer-events-none effect-scanlines-crt opacity-70" />
              )}
              {card.cardEffect === 'vignette-noir' && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 45%, transparent 45%, rgba(2,6,23,0.82) 100%)',
                  }}
                />
              )}
              {card.cardEffect === 'cyber-glitch' && (
                <div className="absolute inset-0 pointer-events-none effect-cyber-glitch mix-blend-screen opacity-85" />
              )}
              {card.cardEffect === 'rainbow-edge' && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-[inherit]"
                  style={{
                    boxShadow:
                      'inset 0 0 0 2px rgba(56,189,248,0.6), inset 0 0 18px rgba(232,121,249,0.55)',
                  }}
                />
              )}
              {card.cardEffect === 'confetti-shimmer' && (
                <div className="absolute inset-0 pointer-events-none effect-confetti-shimmer mix-blend-screen opacity-90" />
              )}
            </div>

            {/* Uploaded Transparent PNG Frame Overlay (when customFrameMode === 'overlay') */}
            {card.customFrameUrl && card.customFrameMode === 'overlay' && (
              <img
                src={card.customFrameUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
              />
            )}

            {/* Bottom Metadata Strip (Lugar, Fecha, Edición - adapts width & alignment to frame) */}
            <div
              style={frameLayout.footerPadding}
              className={`pt-1.5 flex items-center gap-1.5 ${
                frameLayout.centerBottom ? 'justify-center text-center' : 'justify-between text-left'
              } ${isPolaroid ? 'text-slate-700' : 'text-slate-300'}`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold truncate ${
                    compact || frameLayout.narrowShape ? 'text-[10px]' : 'text-xs'
                  } ${isPolaroid ? 'text-slate-900' : 'text-slate-100'}`}
                >
                  {card.location}
                </p>
                <p className="text-[9px] text-slate-400 truncate">
                  {card.eventDate} · {card.editionLabel}
                </p>
              </div>
              {card.concert?.enabled && (
                <button
                  type="button"
                  onClick={handlePlaySong}
                  title={card.concert.favoriteSong}
                  className={`shrink-0 min-h-[28px] min-w-[28px] px-1.5 rounded-lg flex items-center gap-1 text-[10px] font-medium transition-colors ${
                    isPlayingAudio
                      ? 'bg-sky-500 text-slate-950'
                      : isPolaroid
                        ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        : 'bg-white/10 text-sky-300 hover:bg-white/20'
                  }`}
                >
                  {isPlayingAudio ? <Volume2 className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                  {!compact && !frameLayout.narrowShape && <span>Audio</span>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BACK FACE (REVERSO) */}
        <div
          className={`absolute inset-0 backface-hidden rotate-y-180 rounded-[22px] p-[6px] shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden ${
            effectiveCustomFrameStyle ? '' : frameBackground
          }`}
          style={{
            ...(effectiveCustomFrameStyle || {}),
            ...(shapeClipPath ? { clipPath: shapeClipPath } : {}),
          }}
        >
          <div
            className="relative w-full h-full rounded-[17px] bg-[#0F1322] text-slate-100 flex flex-col justify-between overflow-hidden"
            style={{
              ...frameLayout.backPadding,
              ...(shapeClipPath ? { clipPath: shapeClipPath } : {}),
            }}
          >
            {card.backBackdropUrl && (
              <>
                <img
                  src={card.backBackdropUrl}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
                  style={{ objectPosition: frameLayout.photoObjectPosition }}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-b from-[#0B0D14]/75 via-[#0F1322]/70 to-[#0B0D14]/90 pointer-events-none"
                  aria-hidden="true"
                />
              </>
            )}
            {/* Subtle holographic texture on back */}
            <div
              className="absolute inset-0 pointer-events-none opacity-15 prism-foil-gradient"
              aria-hidden="true"
            />

            <div className={`relative z-10 ${frameLayout.backHeaderCentered ? 'text-center px-2' : ''}`}>
              <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 font-mono-num border-b border-white/10 pb-1">
                <span className="truncate">{card.serialCode}</span>
                <span className="shrink-0">{card.eventDate}</span>
              </div>
              <h4
                className={`font-display font-bold text-white mt-1.5 line-clamp-1 ${
                  frameLayout.narrowShape ? 'text-xs' : 'text-sm'
                }`}
              >
                {card.title}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">{card.location}</p>
            </div>

            {/* Stats Grid */}
            <div className="relative z-10 grid grid-cols-3 gap-1 my-1.5 bg-white/[0.04] rounded-xl p-1.5 border border-white/10">
              {card.stats.slice(0, 6).map((st, idx) => (
                <div key={idx} className="text-center py-0.5 min-w-0">
                  <div className="text-[8px] font-semibold tracking-wider text-slate-400 truncate">
                    {st.label}
                  </div>
                  <div
                    className={`font-mono-num font-bold ${
                      frameLayout.narrowShape ? 'text-xs' : 'text-sm'
                    }`}
                    style={{ color: card.frameStyle === 'gold' ? '#FDE68A' : '#38BDF8' }}
                  >
                    {st.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Exclusive Author Message */}
            <div className="relative z-10 bg-white/[0.03] rounded-xl p-2 border border-white/10">
              <div className="text-[8px] font-semibold text-slate-400 mb-0.5">
                Nota del autor
              </div>
              <p className="text-[10px] leading-snug text-slate-200 line-clamp-2">
                {card.authorMessage || 'Recuerdo guardado en Kromacard.'}
              </p>
            </div>

            {/* Digital Autograph & Scannable QR Code */}
            <div
              style={frameLayout.backFooterPadding}
              className="relative z-10 flex items-end justify-between gap-2 mt-1.5"
            >
              <div
                className={`flex-1 min-w-0 bg-white/[0.04] rounded-xl p-1.5 border border-white/10 flex flex-col justify-between ${
                  frameLayout.narrowShape ? 'h-[62px]' : 'h-[72px]'
                }`}
              >
                <span className="text-[8px] font-semibold text-slate-400 truncate">
                  Autógrafo Digital
                </span>
                {card.autographDataUrl ? (
                  <img
                    src={card.autographDataUrl}
                    alt="Autógrafo digital"
                    className={`w-full object-contain ${
                      frameLayout.narrowShape ? 'h-8' : 'h-10'
                    } ${isSvgDataUrl(card.autographDataUrl) ? '' : 'invert'}`}
                  />
                ) : (
                  <span className="text-[11px] italic text-slate-400 font-display truncate">
                    Edición Firmada
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQrClick?.();
                }}
                title="Abrir enlace QR de esta carta"
                className={`${
                  frameLayout.narrowShape ? 'w-[62px] h-[62px] p-1' : 'w-[72px] h-[72px] p-1.5'
                } shrink-0 rounded-xl bg-white flex items-center justify-center shadow-md hover:scale-105 transition-transform`}
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR ${card.serialCode}`} className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-8 h-8 text-slate-900" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
