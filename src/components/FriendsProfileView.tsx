import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  FolderCheck,
  Lock,
  LogOut,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  Album,
  CollectorUser,
  ConcertBanner,
  Photocard,
  TradeOffer,
  VisibilityMode,
} from '../types/kromacard';
import {
  getCurrentGoogleUser,
  getDriveAccessToken,
  subscribeDriveAuthState,
} from '../utils/googleDriveAuth';
import { FanStatsSection } from './FanStatsSection';

interface FriendsProfileViewProps {
  currentUser: CollectorUser;
  users: CollectorUser[];
  cards: Photocard[];
  albums: Album[];
  trades?: TradeOffer[];
  banners?: ConcertBanner[];
  googleAuthBusy?: boolean;
  onGoogleSignIn?: (withDrive?: boolean) => Promise<void>;
  onGoogleSignOut?: () => Promise<void>;
  onSwitchUser: (userId: string) => void;
  onToggleFriend: (friendId: string) => Promise<void>;
  onUpdateProfile: (patch: Partial<CollectorUser>) => Promise<void>;
  onUpdateCardVisibility: (cardId: string, visibility: VisibilityMode) => Promise<void>;
}

export const FriendsProfileView: React.FC<FriendsProfileViewProps> = ({
  currentUser,
  users,
  cards,
  albums,
  trades = [],
  banners = [],
  googleAuthBusy = false,
  onGoogleSignIn,
  onGoogleSignOut,
  onSwitchUser,
  onToggleFriend,
  onUpdateProfile,
  onUpdateCardVisibility,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio);
  const [favoriteArtist, setFavoriteArtist] = useState(currentUser.favoriteArtist);
  const [savedFlag, setSavedFlag] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() =>
    getCurrentGoogleUser()
  );
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(() => Boolean(getDriveAccessToken()));

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setBio(currentUser.bio);
    setFavoriteArtist(currentUser.favoriteArtist);
  }, [currentUser.id, currentUser.displayName, currentUser.bio, currentUser.favoriteArtist]);

  useEffect(() => {
    return subscribeDriveAuthState(() => {
      setFirebaseUser(getCurrentGoogleUser());
      setHasDriveToken(Boolean(getDriveAccessToken()));
    });
  }, []);

  const myCards = cards.filter((c) => c.ownerId === currentUser.id);
  const myAlbums = albums.filter((a) => a.ownerId === currentUser.id);
  const otherUsers = users.filter((u) => u.id !== currentUser.id);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({ displayName, bio, favoriteArtist });
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Google Account & Drive Connection Card */}
      {onGoogleSignIn && (
        <section className="bg-[#131622] border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-white">
                Cuenta Google y Conexión con Google Drive
              </h2>
              {hasDriveToken && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Drive activo</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              {firebaseUser
                ? `Conectado como ${firebaseUser.displayName || firebaseUser.email}. Tu usuario "${currentUser.displayName}" (${currentUser.handle}) se genera y guarda automáticamente.`
                : 'Inicia sesión con tu cuenta de Google para crear tu usuario personal de coleccionista y guardar o importar fotos y texturas desde Google Drive.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!firebaseUser ? (
              <>
                <button
                  type="button"
                  disabled={googleAuthBusy}
                  onClick={() => void onGoogleSignIn(false)}
                  className="inline-flex items-center gap-2.5 min-h-[42px] px-4 rounded-full bg-white hover:bg-slate-100 text-[#1F1F1F] text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{googleAuthBusy ? 'Conectando...' : 'Sign in with Google'}</span>
                </button>
                <button
                  type="button"
                  disabled={googleAuthBusy}
                  onClick={() => void onGoogleSignIn(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <FolderCheck className="w-4 h-4 text-sky-400" />
                  <span>Entrar + Google Drive</span>
                </button>
              </>
            ) : (
              <>
                {!hasDriveToken && (
                  <button
                    type="button"
                    disabled={googleAuthBusy}
                    onClick={() => void onGoogleSignIn(true)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${googleAuthBusy ? 'animate-spin' : ''}`} />
                    <span>Conectar Google Drive</span>
                  </button>
                )}
                {onGoogleSignOut && (
                  <button
                    type="button"
                    onClick={() => void onGoogleSignOut()}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-300" />
                    <span>Cerrar sesión Google</span>
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Switch Active Collector Session */}
      <section className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Tu Perfil y Sesiones de Coleccionista
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-0.5">
            Cambia de perfil activo en cualquier momento para probar intercambios reales y la visibilidad "Solo Amigos".
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {users.map((u) => {
            const active = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSwitchUser(u.id);
                  setDisplayName(u.displayName);
                  setBio(u.bio);
                  setFavoriteArtist(u.favoriteArtist);
                }}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-colors ${
                  active
                    ? 'bg-sky-500/15 border-sky-400'
                    : 'bg-[#0B0D14] border-white/10 hover:bg-white/5'
                }`}
              >
                {u.photoUrl ? (
                  <img
                    src={u.photoUrl}
                    alt={u.displayName}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-slate-950 shrink-0"
                    style={{ backgroundColor: u.avatarColor }}
                  >
                    {u.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{u.displayName}</div>
                  <div className="text-xs text-slate-400 truncate">{u.handle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fan Analytics & Charts (Recharts) */}
      <FanStatsSection
        currentUser={currentUser}
        cards={cards}
        albums={albums}
        trades={trades}
        banners={banners}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Edit Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-5 bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4"
        >
          <h3 className="font-display text-lg font-bold text-white">Editar mi Perfil</h3>
          <label className="block space-y-1 text-xs">
            <span className="text-slate-400">Nombre visible</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-slate-400">Artista, banda o equipo favorito</span>
            <input
              type="text"
              value={favoriteArtist}
              onChange={(e) => setFavoriteArtist(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-slate-400">Biografía</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0B0D14] border border-white/10 text-sm text-white"
            />
          </label>
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{savedFlag ? 'Perfil Actualizado' : 'Guardar Perfil'}</span>
          </button>
        </form>

        {/* Connect Friend Profiles */}
        <div className="lg:col-span-7 bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-fuchsia-400" />
              <span>Unir Perfiles de Amigos</span>
            </h3>
            <span className="text-xs text-slate-400">
              {currentUser.friends.length} conectados
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Al conectar perfiles de amigos podrán ver las colecciones y álbumes marcados como "Solo Amigos".
          </p>

          <div className="space-y-3">
            {otherUsers.map((other) => {
              const isFriend = currentUser.friends.includes(other.id);
              const sharedCardsCount = cards.filter(
                (c) =>
                  c.ownerId === other.id &&
                  (c.visibility === 'public' || (isFriend && c.visibility === 'friends'))
              ).length;

              return (
                <div
                  key={other.id}
                  className="p-4 rounded-2xl bg-[#0B0D14] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-slate-950 shrink-0"
                      style={{ backgroundColor: other.avatarColor }}
                    >
                      {other.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {other.displayName} <span className="text-xs font-normal text-slate-400">{other.handle}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {other.favoriteArtist} · {sharedCardsCount} cartas visibles para ti
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleFriend(other.id)}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors ${
                      isFriend
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {isFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{isFriend ? 'Amigos Unidos' : 'Unir Amigo'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Granular Visibility Control for My Cards */}
      <section className="bg-[#131622] border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-sky-400" />
              <span>Control de Visibilidad de tus Photocards ({myCards.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tienes {myAlbums.length} álbumes personales. Ajusta en tiempo real quién puede ver cada carta.
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/10">
          {myCards.map((c) => (
            <div
              key={c.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={c.photoUrl}
                  alt={c.title}
                  referrerPolicy="no-referrer"
                  className="w-11 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{c.title}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {c.location} · {c.eventDate} · {c.serialCode}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={c.visibility}
                  onChange={(e) =>
                    onUpdateCardVisibility(c.id, e.target.value as VisibilityMode)
                  }
                  className="min-h-[38px] px-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-white"
                >
                  <option value="public">Público (Comunidad)</option>
                  <option value="friends">Solo Amigos</option>
                  <option value="private">Privado</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
