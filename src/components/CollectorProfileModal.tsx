import React, { useMemo, useState } from 'react';
import {
  Eye,
  Heart,
  Layers,
  MessageCircle,
  Sparkles,
  Sticker,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Album,
  CollectorUser,
  ConcertBanner,
  CustomSticker,
  CustomTexture,
  Photocard,
} from '../types/kromacard';
import { Card3D } from './Card3D';

interface CollectorProfileModalProps {
  profileUser: CollectorUser;
  currentUser: CollectorUser;
  users: CollectorUser[];
  cards: Photocard[];
  albums: Album[];
  textures: CustomTexture[];
  stickers: CustomSticker[];
  banners: ConcertBanner[];
  onClose: () => void;
  onSelectProfileUser: (userId: string) => void;
  onToggleFriend: (friendId: string) => Promise<void> | void;
  onToggleFollow: (targetUserId: string) => Promise<void> | void;
  onOpenChatWithUser: (userId: string) => void;
  onInspectCard: (card: Photocard) => void;
}

type ProfileSectionTab = 'cards' | 'network' | 'creations';

export const CollectorProfileModal: React.FC<CollectorProfileModalProps> = ({
  profileUser,
  currentUser,
  users,
  cards,
  albums,
  textures,
  stickers,
  banners,
  onClose,
  onSelectProfileUser,
  onToggleFriend,
  onToggleFollow,
  onOpenChatWithUser,
  onInspectCard,
}) => {
  const [section, setSection] = useState<ProfileSectionTab>('cards');

  const isSelf = profileUser.id === currentUser.id;
  const isFriend = currentUser.friends.includes(profileUser.id);
  const isFollowing = (currentUser.following || currentUser.friends).includes(profileUser.id);

  // Followers = all users whose `following` (or `friends` fallback) includes profileUser.id
  const followersList = useMemo(
    () =>
      users.filter(
        (u) =>
          u.id !== profileUser.id &&
          ((u.following || u.friends).includes(profileUser.id) ||
            u.friends.includes(profileUser.id))
      ),
    [users, profileUser.id]
  );

  const followingIds = profileUser.following || profileUser.friends;
  const followingList = useMemo(
    () => users.filter((u) => u.id !== profileUser.id && followingIds.includes(u.id)),
    [users, profileUser.id, followingIds]
  );

  const friendsList = useMemo(
    () => users.filter((u) => profileUser.friends.includes(u.id)),
    [users, profileUser.friends]
  );

  const visibleCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.ownerId !== profileUser.id) return false;
      if (isSelf) return true;
      if (c.visibility === 'public') return true;
      if (c.visibility === 'friends' && isFriend) return true;
      return false;
    });
  }, [cards, profileUser.id, isSelf, isFriend]);

  const visibleAlbums = useMemo(() => {
    return albums.filter((a) => {
      if (a.ownerId !== profileUser.id) return false;
      if (isSelf) return true;
      if (a.visibility === 'public') return true;
      if (a.visibility === 'friends' && isFriend) return true;
      return false;
    });
  }, [albums, profileUser.id, isSelf, isFriend]);

  const userTextures = useMemo(
    () =>
      textures.filter(
        (t) => t.authorId === profileUser.id && (t.isPublic || isSelf)
      ),
    [textures, profileUser.id, isSelf]
  );

  const userStickers = useMemo(
    () =>
      stickers.filter(
        (s) => s.authorId === profileUser.id && (s.isPublic || isSelf)
      ),
    [stickers, profileUser.id, isSelf]
  );

  const userBanners = useMemo(
    () =>
      banners.filter(
        (b) =>
          b.ownerId === profileUser.id &&
          (b.visibility === 'public' || (isFriend && b.visibility === 'friends') || isSelf)
      ),
    [banners, profileUser.id, isFriend, isSelf]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#131622] border border-white/15 shadow-2xl">
        {/* Header Banner & Identity */}
        <div className="relative p-6 md:p-7 border-b border-white/10 bg-gradient-to-br from-[#161B2E] via-[#131622] to-[#0B0D14]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil"
            className="absolute top-4 right-4 min-h-[38px] min-w-[38px] rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pr-8">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              {profileUser.photoUrl ? (
                <img
                  src={profileUser.photoUrl}
                  alt={profileUser.displayName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-sky-400/40 shrink-0 shadow-lg"
                />
              ) : (
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-display text-2xl font-extrabold text-slate-950 shrink-0 shadow-lg"
                  style={{ backgroundColor: profileUser.avatarColor }}
                >
                  {profileUser.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white truncate">
                    {profileUser.displayName}
                  </h2>
                  <span className="text-xs font-mono-num text-sky-300">
                    {profileUser.handle}
                  </span>
                  {isFriend && !isSelf && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-bold text-emerald-300">
                      Amigo Unido
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  {profileUser.bio}
                </p>
                <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Favorito: {profileUser.favoriteArtist}</span>
                </div>
              </div>
            </div>

            {!isSelf && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void onToggleFollow(profileUser.id)}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isFollowing
                      ? 'bg-sky-500/20 border border-sky-400/40 text-sky-200'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFollowing ? 'fill-sky-300' : ''}`} />
                  <span>{isFollowing ? 'Siguiendo' : 'Seguir'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void onToggleFriend(profileUser.id)}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isFriend
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {isFriend ? (
                    <UserCheck className="w-3.5 h-3.5" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>{isFriend ? 'Amigos' : 'Unir Amigo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenChatWithUser(profileUser.id);
                  }}
                  className="min-h-[40px] px-3.5 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Enviar Mensaje</span>
                </button>
              </div>
            )}
          </div>

          {/* Numeric Counters */}
          <div className="grid grid-cols-4 gap-2.5 mt-5">
            <div className="p-3 rounded-2xl bg-[#0B0D14]/80 border border-white/10">
              <div className="font-mono-num text-lg font-extrabold text-white">
                {followersList.length}
              </div>
              <div className="text-[11px] text-slate-400">Seguidores</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B0D14]/80 border border-white/10">
              <div className="font-mono-num text-lg font-extrabold text-white">
                {followingList.length}
              </div>
              <div className="text-[11px] text-slate-400">Siguiendo</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B0D14]/80 border border-white/10">
              <div className="font-mono-num text-lg font-extrabold text-white">
                {friendsList.length}
              </div>
              <div className="text-[11px] text-slate-400">Amigos</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#0B0D14]/80 border border-white/10">
              <div className="font-mono-num text-lg font-extrabold text-sky-400">
                {visibleCards.length}
              </div>
              <div className="text-[11px] text-slate-400">Cartas Visibles</div>
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-6 pt-4 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setSection('cards')}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              section === 'cards'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Photocards y Álbumes ({visibleCards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('network')}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              section === 'network'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              Seguidores y Amigos ({followersList.length + friendsList.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSection('creations')}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
              section === 'creations'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <Sticker className="w-3.5 h-3.5" />
            <span>
              Texturas, Stickers y Carteles (
              {userTextures.length + userStickers.length + userBanners.length})
            </span>
          </button>
        </div>

        {/* Section Body */}
        <div className="p-6 space-y-6">
          {section === 'cards' && (
            <>
              {visibleAlbums.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Álbumes Visibles ({visibleAlbums.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleAlbums.map((alb) => (
                      <div
                        key={alb.id}
                        className="p-3 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center gap-3"
                      >
                        <img
                          src={alb.coverPhotoUrl}
                          alt={alb.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {alb.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {alb.location} · {alb.dateLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visibleCards.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#0B0D14] border border-white/10 text-center text-xs text-slate-400">
                  Este coleccionista aún no tiene photocards visibles para tu perfil.
                  {!isFriend && !isSelf && ' Únete como amigo para desbloquear su colección "Solo Amigos".'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {visibleCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl bg-[#0B0D14] border border-white/10 p-3 flex flex-col items-center gap-2.5"
                    >
                      <div className="w-full flex justify-center">
                        <Card3D
                          card={card}
                          compact
                          onCardClick={() => {
                            onClose();
                            onInspectCard(card);
                          }}
                        />
                      </div>
                      <div className="w-full flex items-center justify-between gap-2 pt-1">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {card.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {card.serialCode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onInspectCard(card);
                          }}
                          className="min-h-[30px] px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-sky-300 flex items-center gap-1 shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          <span>3D</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {section === 'network' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                  Seguidores ({followersList.length})
                </h3>
                {followersList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 rounded-2xl bg-[#0B0D14] border border-white/10">
                    Sin seguidores registrados todavía.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {followersList.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSection('cards');
                          onSelectProfileUser(u.id);
                        }}
                        className="w-full p-3 rounded-2xl bg-[#0B0D14] border border-white/10 hover:border-sky-400/50 flex items-center justify-between gap-3 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {u.photoUrl ? (
                            <img
                              src={u.photoUrl}
                              alt={u.displayName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0"
                              style={{ backgroundColor: u.avatarColor }}
                            >
                              {u.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {u.handle} · {u.favoriteArtist}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-sky-400 shrink-0">
                          Ver perfil →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  Amigos Unidos ({friendsList.length})
                </h3>
                {friendsList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 rounded-2xl bg-[#0B0D14] border border-white/10">
                    Sin amigos unidos todavía.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friendsList.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSection('cards');
                          onSelectProfileUser(u.id);
                        }}
                        className="w-full p-3 rounded-2xl bg-[#0B0D14] border border-white/10 hover:border-emerald-400/50 flex items-center justify-between gap-3 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {u.photoUrl ? (
                            <img
                              src={u.photoUrl}
                              alt={u.displayName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0"
                              style={{ backgroundColor: u.avatarColor }}
                            >
                              {u.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {u.handle} · {u.favoriteArtist}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                          Ver perfil →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'creations' && (
            <div className="space-y-5">
              {userTextures.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Texturas ({userTextures.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {userTextures.map((tex) => (
                      <div
                        key={tex.id}
                        className="rounded-xl overflow-hidden bg-[#0B0D14] border border-white/10"
                      >
                        <img
                          src={tex.imageUrl}
                          alt={tex.name}
                          referrerPolicy="no-referrer"
                          className="h-20 w-full object-cover"
                        />
                        <div className="p-2 text-[11px] font-bold text-white truncate">
                          {tex.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userStickers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Stickers ({userStickers.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {userStickers.map((stk) => (
                      <div
                        key={stk.id}
                        className="p-3 rounded-xl bg-[#0B0D14] border border-white/10 flex items-center gap-2.5"
                      >
                        {stk.isImage ? (
                          <img
                            src={stk.content}
                            alt={stk.name}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded object-cover shrink-0"
                          />
                        ) : (
                          <span className="text-xl shrink-0">{stk.content}</span>
                        )}
                        <span className="text-xs font-semibold text-white truncate">
                          {stk.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userBanners.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Carteles de Concierto ({userBanners.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userBanners.map((ban) => (
                      <div
                        key={ban.id}
                        className="p-3 rounded-2xl bg-[#0B0D14] border border-white/10 flex items-center gap-3"
                      >
                        <img
                          src={ban.photoUrl}
                          alt={ban.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {ban.title}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {ban.artistOrTour} · {ban.venue}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userTextures.length === 0 &&
                userStickers.length === 0 &&
                userBanners.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Este usuario aún no ha compartido texturas, stickers ni carteles públicos.
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
