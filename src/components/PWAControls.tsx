import React, { useState } from 'react';
import {
  BookmarkCheck,
  Compass,
  Database,
  Download,
  Star,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import type { Photocard } from '../types/kromacard';
import type { OfflineFavoriteCard } from '../utils/offlineDb';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-semibold flex items-center gap-1.5 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[40px] px-3 py-2 rounded-xl border border-white/15 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
        >
          Instalar en iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#131622] border border-white/10 p-6 shadow-2xl">
              <h3 className="font-display text-lg font-bold text-white">Instalar Kromacard en iPhone</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
                2. Desliza y selecciona <strong>Añadir a la pantalla de inicio</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

interface OfflineIndicatorProps {
  favorites: OfflineFavoriteCard[];
  allCards: Photocard[];
  onInspectCard: (card: Photocard) => void;
  onToggleFavorite: (card: Photocard) => Promise<void>;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  favorites,
  allCards,
  onInspectCard,
  onToggleFavorite,
}) => {
  const isOnline = useOnlineStatus();
  const [openDrawer, setOpenDrawer] = useState(false);

  const favoriteIds = new Set(favorites.map((f) => f.id));
  const quickSuggestions = allCards.filter((c) => !favoriteIds.has(c.id)).slice(0, 4);

  return (
    <>
      {/* Interactive PWA Status & Offline Favorites Trigger */}
      {(!isOnline || favorites.length > 0) && (
        <button
          type="button"
          onClick={() => setOpenDrawer(true)}
          aria-label={
            isOnline
              ? `Acceso rápido a ${favorites.length} cartas favoritas sin conexión`
              : `Modo sin conexión, ver ${favorites.length} cartas favoritas`
          }
          className={`fixed bottom-20 md:bottom-6 left-4 z-40 min-h-[44px] flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xl border transition-colors ${
            !isOnline
              ? 'bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300'
              : 'bg-[#131622]/95 backdrop-blur-md text-slate-100 border-white/15 hover:border-sky-400/50'
          }`}
        >
          {!isOnline ? (
            <WifiOff className="w-4 h-4 shrink-0" />
          ) : (
            <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="whitespace-nowrap">
            {!isOnline
              ? `Sin conexión · ${favorites.length} favoritas`
              : `Favoritas Offline (${favorites.length})`}
          </span>
        </button>
      )}

      {/* Offline Favorites Quick-Access Drawer */}
      {openDrawer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full max-w-lg bg-[#131622] border border-white/15 rounded-t-3xl md:rounded-3xl p-5 md:p-6 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3 md:hidden" />

            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {isOnline ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5" />
                      Conectado · Sincronizado con IndexedDB
                    </span>
                  ) : (
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <WifiOff className="w-3.5 h-3.5" />
                      Sin red · Leyendo desde IndexedDB
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-bold text-white mt-1">
                  Acceso Rápido Sin Conexión
                </h3>
                <p className="text-xs text-slate-400">
                  Tus cartas favoritas se guardan localmente en IndexedDB para verlas en 3D incluso en modo avión o dentro de un estadio sin señal.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpenDrawer(false)}
                aria-label="Cerrar panel sin conexión"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Saved Favorites List */}
              {favorites.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#0B0D14] border border-white/10 text-center space-y-2">
                  <Database className="w-7 h-7 text-sky-400 mx-auto" />
                  <div className="text-sm font-bold text-white">
                    Aún no tienes cartas favoritas sin conexión
                  </div>
                  <p className="text-xs text-slate-400">
                    Marca una carta con la estrella en tu colección o añádela aquí abajo para guardarla en IndexedDB.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-400">
                    Guardadas en IndexedDB ({favorites.length})
                  </div>
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="p-3 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center gap-3"
                    >
                      <img
                        src={fav.photoUrl}
                        alt={fav.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-16 rounded-xl object-cover shrink-0 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">{fav.title}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {fav.location} · {fav.serialCode}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenDrawer(false);
                          onInspectCard(fav);
                        }}
                        className="min-h-[40px] px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Abrir 3D</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void onToggleFavorite(fav)}
                        aria-label={`Quitar ${fav.title} de favoritas sin conexión`}
                        title="Quitar de acceso sin conexión"
                        className="min-h-[40px] min-w-[40px] rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Add from Collection when Online or Cached */}
              {quickSuggestions.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="text-xs font-semibold text-slate-400">
                    Añadir cartas al caché rápido
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {quickSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void onToggleFavorite(c)}
                        className="min-h-[48px] p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between gap-2 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{c.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{c.serialCode}</div>
                        </div>
                        <Star className="w-4 h-4 text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
