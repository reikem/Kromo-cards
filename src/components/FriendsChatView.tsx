import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Hash,
  Layers,
  MessageCircle,
  Send,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { ChatMessage, CollectorUser, Photocard } from '../types/kromacard';

interface FriendsChatViewProps {
  currentUser: CollectorUser;
  users: CollectorUser[];
  cards: Photocard[];
  messages: ChatMessage[];
  initialRoomId?: string | null;
  onClearInitialRoom?: () => void;
  onSendMessage: (payload: {
    roomId: string;
    recipientId?: string;
    text: string;
    cardId?: string;
  }) => Promise<void>;
  onInspectProfile: (userId: string) => void;
  onInspectCard: (card: Photocard) => void;
}

export function getDmRoomId(userA: string, userB: string): string {
  const pair = [userA, userB].sort();
  return `dm:${pair[0]}:${pair[1]}`;
}

export const FriendsChatView: React.FC<FriendsChatViewProps> = ({
  currentUser,
  users,
  cards,
  messages,
  initialRoomId,
  onClearInitialRoom,
  onSendMessage,
  onInspectProfile,
  onInspectCard,
}) => {
  const [activeRoomId, setActiveRoomId] = useState<string>('friends-lounge');
  const [draftText, setDraftText] = useState('');
  const [attachedCardId, setAttachedCardId] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialRoomId) {
      setActiveRoomId(initialRoomId);
      onClearInitialRoom?.();
    }
  }, [initialRoomId, onClearInitialRoom]);

  const otherUsers = useMemo(
    () => users.filter((u) => u.id !== currentUser.id),
    [users, currentUser.id]
  );

  const activeDmRecipient = useMemo(() => {
    if (activeRoomId === 'friends-lounge') return null;
    const parts = activeRoomId.split(':');
    const otherId = parts.slice(1).find((id) => id !== currentUser.id);
    return users.find((u) => u.id === otherId) || null;
  }, [activeRoomId, users, currentUser.id]);

  const roomMessages = useMemo(
    () =>
      messages
        .filter((m) => m.roomId === activeRoomId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, activeRoomId]
  );

  const myShareableCards = useMemo(
    () =>
      cards.filter(
        (c) => c.ownerId === currentUser.id || c.visibility === 'public'
      ),
    [cards, currentUser.id]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length, activeRoomId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draftText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSendMessage({
        roomId: activeRoomId,
        recipientId: activeDmRecipient?.id,
        text,
        cardId: attachedCardId || undefined,
      });
      setDraftText('');
      setAttachedCardId('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[#131622] border border-white/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Sala Social en Tiempo Real · Kromacard</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-white">
            Sala de Amigos y Mensajes Directos
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Conversa con tus amigos y seguidores, comparte photocards al instante y recibe avisos en tiempo real en la barra superior de Alertas.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0B0D14] border border-white/10 px-3.5 py-2 rounded-2xl shrink-0">
          <Users className="w-4 h-4 text-emerald-400" />
          <span>
            <strong className="text-white">{otherUsers.length}</strong> coleccionistas disponibles
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Sidebar: Channels & Friends */}
        <aside className="lg:col-span-4 rounded-3xl bg-[#131622] border border-white/10 p-4 space-y-4 flex flex-col">
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Canales Grupales
            </div>
            <button
              type="button"
              onClick={() => setActiveRoomId('friends-lounge')}
              className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                activeRoomId === 'friends-lounge'
                  ? 'bg-sky-500/15 border-sky-400 text-white'
                  : 'bg-[#0B0D14] border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center shrink-0">
                  <Hash className="w-4 h-4 text-sky-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    Sala General de Amigos
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    Todos los amigos y seguidores
                  </div>
                </div>
              </div>
              <span className="font-mono-num px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-sky-300 shrink-0">
                {messages.filter((m) => m.roomId === 'friends-lounge').length}
              </span>
            </button>
          </div>

          <div className="space-y-2 flex-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Amigos y Seguidores ({otherUsers.length})
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {otherUsers.map((person) => {
                const dmRoom = getDmRoomId(currentUser.id, person.id);
                const isSelected = activeRoomId === dmRoom;
                const isFriend = currentUser.friends.includes(person.id);
                const isFollower = (person.following || person.friends).includes(
                  currentUser.id
                );
                const dmMsgs = messages.filter((m) => m.roomId === dmRoom);
                const lastMsg = dmMsgs[dmMsgs.length - 1];

                return (
                  <div
                    key={person.id}
                    className={`p-2.5 rounded-2xl border transition-colors ${
                      isSelected
                        ? 'bg-fuchsia-500/15 border-fuchsia-400'
                        : 'bg-[#0B0D14] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRoomId(dmRoom)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        {person.photoUrl ? (
                          <img
                            src={person.photoUrl}
                            alt={person.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/15"
                          />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-display text-xs font-bold text-slate-950 shrink-0"
                            style={{ backgroundColor: person.avatarColor }}
                          >
                            {person.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              {person.displayName}
                            </span>
                            {isFriend && (
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {lastMsg
                              ? lastMsg.text
                              : isFollower
                                ? `Te sigue · ${person.handle}`
                                : person.favoriteArtist}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => onInspectProfile(person.id)}
                        title={`Ver perfil de ${person.displayName}`}
                        className="min-h-[30px] px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-sky-300 flex items-center gap-1 shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Perfil</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Main Pane: Active Chat Timeline + Composer */}
        <section className="lg:col-span-8 rounded-3xl bg-[#131622] border border-white/10 flex flex-col min-h-[520px] max-h-[680px]">
          {/* Room Header */}
          <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            {activeDmRecipient ? (
              <div className="flex items-center gap-3 min-w-0">
                {activeDmRecipient.photoUrl ? (
                  <img
                    src={activeDmRecipient.photoUrl}
                    alt={activeDmRecipient.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-display text-sm font-bold text-slate-950 shrink-0"
                    style={{ backgroundColor: activeDmRecipient.avatarColor }}
                  >
                    {activeDmRecipient.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {activeDmRecipient.displayName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeDmRecipient.handle} · {activeDmRecipient.favoriteArtist}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/35 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    Sala General de Amigos
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cada mensaje avisa automáticamente en Alertas a tus amigos y seguidores
                  </div>
                </div>
              </div>
            )}

            {activeDmRecipient && (
              <button
                type="button"
                onClick={() => onInspectProfile(activeDmRecipient.id)}
                className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>Ver Perfil Completo</span>
              </button>
            )}
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {roomMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2">
                <MessageCircle className="w-9 h-9 text-slate-500" />
                <p className="text-sm font-semibold text-slate-300">
                  Aún no hay mensajes en esta conversación
                </p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Envía un saludo o adjunta una photocard; tu mensaje generará una notificación instantánea.
                </p>
              </div>
            ) : (
              roomMessages.map((msg) => {
                const sender = users.find((u) => u.id === msg.senderId);
                const isMine = msg.senderId === currentUser.id;
                const attachedCard = msg.cardId
                  ? cards.find((c) => c.id === msg.cardId)
                  : undefined;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <button
                      type="button"
                      onClick={() => sender && onInspectProfile(sender.id)}
                      title={`Ver perfil de ${sender?.displayName || 'Coleccionista'}`}
                      className="shrink-0 self-end"
                    >
                      {sender?.photoUrl ? (
                        <img
                          src={sender.photoUrl}
                          alt={sender.displayName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-white/15"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-950"
                          style={{
                            backgroundColor: sender?.avatarColor || '#38BDF8',
                          }}
                        >
                          {(sender?.displayName || 'KR').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </button>

                    <div
                      className={`max-w-[80%] sm:max-w-[70%] space-y-1.5 ${
                        isMine ? 'items-end text-right' : 'items-start text-left'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => sender && onInspectProfile(sender.id)}
                          className="font-bold text-slate-200 hover:text-sky-300 transition-colors"
                        >
                          {sender?.displayName || 'Coleccionista'}
                        </button>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed border ${
                          isMine
                            ? 'bg-sky-500/20 border-sky-400/35 text-white text-left'
                            : 'bg-[#0B0D14] border-white/10 text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                        {attachedCard && (
                          <button
                            type="button"
                            onClick={() => onInspectCard(attachedCard)}
                            className="mt-2.5 w-full p-2 rounded-xl bg-[#131622] border border-white/15 hover:border-sky-400/50 flex items-center gap-2.5 text-left transition-colors"
                          >
                            <img
                              src={attachedCard.photoUrl}
                              alt={attachedCard.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-white truncate">
                                {attachedCard.title}
                              </div>
                              <div className="text-[10px] text-sky-300 truncate">
                                {attachedCard.subtitle}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Tocar para ver Photocard 3D →
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Message Composer */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-white/10 bg-[#0B0D14]/60 rounded-b-3xl space-y-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
              <select
                value={attachedCardId}
                onChange={(e) => setAttachedCardId(e.target.value)}
                aria-label="Adjuntar photocard al mensaje"
                className="flex-1 min-w-[180px] min-h-[34px] px-2.5 rounded-xl bg-[#131622] border border-white/10 text-[11px] text-slate-200"
              >
                <option value="">Adjuntar una photocard (opcional)...</option>
                {myShareableCards.slice(0, 20).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.serialCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={500}
                placeholder={
                  activeDmRecipient
                    ? `Escribe un mensaje para ${activeDmRecipient.displayName}...`
                    : 'Escribe un mensaje en la Sala de Amigos...'
                }
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#131622] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={!draftText.trim() || sending}
                className="min-h-[44px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Enviando...' : 'Enviar'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
