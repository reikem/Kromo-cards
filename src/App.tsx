import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  CloudUpload,
  Compass,
  FolderCheck,
  FolderHeart,
  Layers,
  Library,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Paintbrush,
  Palette,
  Plus,
  Printer,
  QrCode,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Star,
  Sticker,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  Album,
  BootstrapPayload,
  ChatMessage,
  CollectorUser,
  ConcertBanner,
  CustomBackdrop,
  CustomFramePreset,
  CustomSticker,
  CustomTexture,
  ImageFilterConfig,
  LikableAssetKind,
  Photocard,
  RealtimeNotification,
  TradeOffer,
  VisibilityMode,
} from './types/kromacard';
import { Card3D } from './components/Card3D';
import { CollectorProfileModal } from './components/CollectorProfileModal';
import { CommunityLibraryView } from './components/CommunityLibraryView';
import { ConcertsView } from './components/ConcertsView';
import { FriendsChatView, getDmRoomId } from './components/FriendsChatView';
import { FriendsProfileView } from './components/FriendsProfileView';
import { Inspector3DModal } from './components/Inspector3DModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { PaginationControls } from './components/PaginationControls';
import { PrintSheetModal } from './components/PrintSheetModal';
import { ScannerModal } from './components/ScannerModal';
import { StickerCreatorView } from './components/StickerCreatorView';
import { StudioView, type StudioTab } from './components/StudioView';
import { TradeBazaarView } from './components/TradeBazaarView';
import {
  getAllFavorites,
  loadBootstrapSnapshot,
  type OfflineFavoriteCard,
  removeFavoriteCard,
  saveBootstrapSnapshot,
  saveFavoriteCard,
} from './utils/offlineDb';
import {
  dispatchServiceWorkerTradeNotification,
  fetchVapidPublicKey,
  getPushPermissionState,
  type PushPermissionState,
  registerPushServiceWorker,
  requestTradePushPermission,
  subscribeUserToPush,
} from './utils/pushNotifications';
import {
  countOriginalVaultExports,
  ensureDriveAccessToken,
  exportOriginalVaultToFanCardStudio,
  FANCARD_STUDIO_FOLDER_NAME,
  formatGoogleAuthError,
  getCurrentGoogleUser,
  getDriveAccessToken,
  initGoogleDriveAuth,
  signInWithGoogleAccount,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  subscribeDriveAuthState,
  subscribeGoogleUserSynced,
  syncBackendCollectorFromGoogle,
  syncSingleCreationToFanCardStudio,
} from './utils/googleDriveAuth';
import { soundEngine } from './utils/soundEngine';

type AppTab =
  | 'vault'
  | 'studio'
  | 'library'
  | 'sticker-studio'
  | 'concerts'
  | 'bazaar'
  | 'chat'
  | 'profile';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function App() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string>(() => {
    try {
      return localStorage.getItem('kromacard_active_user_id') || 'user-sofia';
    } catch {
      return 'user-sofia';
    }
  });
  const [googleAuthBusy, setGoogleAuthBusy] = useState(false);
  const [hasGoogleSession, setHasGoogleSession] = useState<boolean>(() =>
    Boolean(getCurrentGoogleUser() || getDriveAccessToken())
  );
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (
        tabParam === 'vault' ||
        tabParam === 'studio' ||
        tabParam === 'library' ||
        tabParam === 'sticker-studio' ||
        tabParam === 'concerts' ||
        tabParam === 'bazaar' ||
        tabParam === 'chat' ||
        tabParam === 'profile'
      ) {
        return tabParam;
      }
    } catch {
      // ignore URL parsing errors
    }
    return 'vault';
  });

  // Filtering in Vault
  const [vaultScope, setVaultScope] = useState<'all' | 'mine' | 'friends' | 'favorites'>('all');
  const [albumFilterId, setAlbumFilterId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultPage, setVaultPage] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [offlineFavorites, setOfflineFavorites] = useState<OfflineFavoriteCard[]>([]);

  // Modals & Overlays
  const [inspectedCard, setInspectedCard] = useState<Photocard | null>(null);
  const [inspectedProfileUserId, setInspectedProfileUserId] = useState<string | null>(null);
  const [chatInitialRoomId, setChatInitialRoomId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('room');
    } catch {
      return null;
    }
  });
  const [editingCard, setEditingCard] = useState<Photocard | null>(null);
  const [studioInitialTab, setStudioInitialTab] = useState<StudioTab>('photo');
  const [returnToStudioAfterSticker, setReturnToStudioAfterSticker] = useState(false);
  const [newStickerIds, setNewStickerIds] = useState<string[]>([]);
  const [printSheetCard, setPrintSheetCard] = useState<Photocard | undefined>(undefined);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [tradeTargetCard, setTradeTargetCard] = useState<Photocard | null>(null);
  const [autoOpenCanvasBanner, setAutoOpenCanvasBanner] = useState(false);

  // Audio Ambience, Push & Toast
  const [crowdPlaying, setCrowdPlaying] = useState(false);
  const [hasPlayedWelcomeSound, setHasPlayedWelcomeSound] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getPushPermissionState()
  );
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [showVaultSettings, setShowVaultSettings] = useState(false);
  const [autoDriveBackup, setAutoDriveBackup] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`kromacard_auto_drive_backup_${activeUserId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(() => Boolean(getDriveAccessToken()));
  const [showDriveExportConfirm, setShowDriveExportConfirm] = useState(false);
  const [driveBatchExporting, setDriveBatchExporting] = useState(false);
  const [driveBatchProgress, setDriveBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [lastDriveBackupInfo, setLastDriveBackupInfo] = useState<{
    count: number;
    folderName: string;
    at: string;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeUserIdRef = useRef<string>(activeUserId);

  useEffect(() => {
    activeUserIdRef.current = activeUserId;
    try {
      localStorage.setItem('kromacard_active_user_id', activeUserId);
      setAutoDriveBackup(
        localStorage.getItem(`kromacard_auto_drive_backup_${activeUserId}`) === 'true'
      );
    } catch {
      // ignore storage errors
    }
  }, [activeUserId]);

  useEffect(() => {
    return subscribeDriveAuthState(() => {
      const hasToken = Boolean(getDriveAccessToken());
      setHasDriveToken(hasToken);
      if (hasToken) {
        setHasGoogleSession(true);
      }
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  const applySyncedCollectorUser = useCallback(
    (synced: { user: CollectorUser; isNewUser: boolean; album?: Album }) => {
      setData((prev) => {
        if (!prev) return prev;
        const userExists = prev.users.some((u) => u.id === synced.user.id);
        const nextUsers = userExists
          ? prev.users.map((u) => (u.id === synced.user.id ? synced.user : u))
          : [...prev.users, synced.user];
        const nextAlbums =
          synced.album && !prev.albums.some((a) => a.id === synced.album!.id)
            ? [synced.album, ...prev.albums]
            : prev.albums;
        return { ...prev, users: nextUsers, albums: nextAlbums };
      });
      setActiveUserId(synced.user.id);
      setHasGoogleSession(true);
    },
    []
  );

  useEffect(() => {
    const unsubSynced = subscribeGoogleUserSynced((synced) => {
      applySyncedCollectorUser(synced);
    });
    const unsubAuth = initGoogleDriveAuth(
      (fbUser, token) => {
        setHasGoogleSession(true);
        void syncBackendCollectorFromGoogle(fbUser, token);
      },
      () => {
        const fbUser = getCurrentGoogleUser();
        const hasToken = Boolean(getDriveAccessToken());
        setHasGoogleSession(Boolean(fbUser || hasToken));
        if (fbUser) {
          void syncBackendCollectorFromGoogle(fbUser);
        }
      }
    );
    return () => {
      unsubSynced();
      unsubAuth();
    };
  }, [applySyncedCollectorUser]);

  const handleGoogleSignInFlow = useCallback(
    async (withDrive = false) => {
      setGoogleAuthBusy(true);
      try {
        if (withDrive) {
          const { synced } = await signInWithGoogleDrive(false);
          if (synced) {
            applySyncedCollectorUser(synced);
            showToast(
              synced.isNewUser
                ? `¡Bienvenido ${synced.user.displayName}! Usuario y Google Drive listos.`
                : `Sesión iniciada como ${synced.user.displayName} (Drive conectado).`
            );
          } else {
            showToast('Google Drive conectado, pero no se pudo generar el perfil.');
          }
        } else {
          const { synced } = await signInWithGoogleAccount();
          if (synced) {
            applySyncedCollectorUser(synced);
            showToast(
              synced.isNewUser
                ? `¡Bienvenido ${synced.user.displayName}! Tu perfil y álbum fueron creados.`
                : `Sesión iniciada como ${synced.user.displayName}.`
            );
          } else {
            showToast('No se pudo verificar la cuenta de Google en el servidor.');
          }
        }
      } catch (err) {
        showToast(formatGoogleAuthError(err));
      } finally {
        setGoogleAuthBusy(false);
      }
    },
    [applySyncedCollectorUser, showToast]
  );

  const handleGoogleSignOutFlow = useCallback(async () => {
    await signOutGoogleDrive();
    setHasGoogleSession(false);
    setActiveUserId('user-sofia');
    showToast('Sesión de Google cerrada.');
  }, [showToast]);

  // Load IndexedDB favorites + initial data from Express server (with offline IndexedDB fallback)
  useEffect(() => {
    let active = true;

    void getAllFavorites().then((favs) => {
      if (active) setOfflineFavorites(favs);
    });

    const initialParams = new URLSearchParams(window.location.search);
    if (initialParams.get('tab') === 'bazaar') {
      setActiveTab('bazaar');
    }

    fetch('/api/bootstrap')
      .then((res) => res.json())
      .then((payload: BootstrapPayload) => {
        if (!active) return;
        setData(payload);
        setLoading(false);
        void saveBootstrapSnapshot(payload);

        // Support deep-linked QR codes (?card=card-vocal-06)
        const cardParam = initialParams.get('card');
        if (cardParam) {
          const found = payload.cards.find((c) => c.id === cardParam || c.serialCode === cardParam);
          if (found) {
            setInspectedCard(found);
          }
        }
      })
      .catch(async () => {
        if (!active) return;
        const cached = await loadBootstrapSnapshot();
        const favs = await getAllFavorites();
        if (!active) return;
        setOfflineFavorites(favs);
        if (cached) {
          setData(cached);
        } else {
          setData({
            users: [
              {
                id: 'user-sofia',
                handle: '@sofia_estadio',
                displayName: 'Coleccionista Offline',
                avatarColor: '#38BDF8',
                bio: 'Modo sin conexión usando IndexedDB.',
                favoriteArtist: 'Kromacard',
                friends: [],
              },
            ],
            cards: favs,
            albums: [],
            banners: [],
            filters: [],
            stickers: [],
            textures: [],
            frames: [],
            backdrops: [],
            trades: [],
            notifications: [],
            chatMessages: [],
          });
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Real-time WebSocket Connection with auto-reconnect
  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const { event, payload } = JSON.parse(ev.data) as { event: string; payload: unknown };

          if (event === 'notification:new') {
            const incomingNotif = payload as RealtimeNotification;
            if (
              incomingNotif.userId === activeUserIdRef.current &&
              (incomingNotif.kind === 'trade' ||
                incomingNotif.kind === 'gift' ||
                incomingNotif.kind === 'chat')
            ) {
              if (incomingNotif.kind === 'chat') {
                showToast(`${incomingNotif.title}: ${incomingNotif.message}`);
              }
              const isBackgrounded =
                document.visibilityState !== 'visible' || !document.hasFocus();
              if ((isBackgrounded || incomingNotif.triggerPush) && !pushSubscribedRef.current) {
                void dispatchServiceWorkerTradeNotification({
                  title: incomingNotif.title,
                  body: incomingNotif.message,
                  kind: incomingNotif.kind === 'chat' ? 'chat' : incomingNotif.kind === 'gift' ? 'gift' : 'trade',
                  tradeId: incomingNotif.relatedTradeId || '',
                  roomId: incomingNotif.relatedRoomId || '',
                  tag:
                    incomingNotif.kind === 'chat'
                      ? `kromacard-chat-${incomingNotif.relatedRoomId || 'dm'}`
                      : incomingNotif.relatedTradeId
                      ? `kromacard-trade-${incomingNotif.relatedTradeId}`
                      : incomingNotif.id,
                });
              }
            }
          }

          setData((prev) => {
            if (!prev) return prev;
            switch (event) {
              case 'card:created': {
                const c = payload as Photocard;
                if (prev.cards.some((x) => x.id === c.id)) return prev;
                return { ...prev, cards: [c, ...prev.cards] };
              }
              case 'card:updated': {
                const c = payload as Photocard;
                setInspectedCard((curr) => (curr && curr.id === c.id ? c : curr));
                return {
                  ...prev,
                  cards: prev.cards.map((x) => (x.id === c.id ? c : x)),
                };
              }
              case 'card:deleted': {
                const { id } = payload as { id: string };
                return {
                  ...prev,
                  cards: prev.cards.filter((x) => x.id !== id),
                };
              }
              case 'album:created': {
                const a = payload as Album;
                if (prev.albums.some((x) => x.id === a.id)) return prev;
                return { ...prev, albums: [a, ...prev.albums] };
              }
              case 'album:updated': {
                const a = payload as Album;
                return {
                  ...prev,
                  albums: prev.albums.map((x) => (x.id === a.id ? a : x)),
                };
              }
              case 'banner:created': {
                const b = payload as ConcertBanner;
                if (prev.banners.some((x) => x.id === b.id)) return prev;
                return { ...prev, banners: [b, ...prev.banners] };
              }
              case 'filter:created': {
                const f = payload as ImageFilterConfig;
                if (prev.filters.some((x) => x.id === f.id)) return prev;
                return { ...prev, filters: [...prev.filters, f] };
              }
              case 'sticker:created': {
                const s = payload as CustomSticker;
                if (prev.stickers.some((x) => x.id === s.id)) return prev;
                return { ...prev, stickers: [...prev.stickers, s] };
              }
              case 'texture:created': {
                const tex = payload as CustomTexture;
                const currentTextures = prev.textures || [];
                if (currentTextures.some((x) => x.id === tex.id)) return prev;
                return { ...prev, textures: [tex, ...currentTextures] };
              }
              case 'frame:created': {
                const frm = payload as CustomFramePreset;
                const currentFrames = prev.frames || [];
                if (currentFrames.some((x) => x.id === frm.id)) return prev;
                return { ...prev, frames: [frm, ...currentFrames] };
              }
              case 'backdrop:created': {
                const bg = payload as CustomBackdrop;
                const currentBgs = prev.backdrops || [];
                if (currentBgs.some((x) => x.id === bg.id)) return prev;
                return { ...prev, backdrops: [bg, ...currentBgs] };
              }
              case 'asset:liked': {
                const { kind, id, likes } = payload as {
                  kind: LikableAssetKind;
                  id: string;
                  likes: number;
                };
                return {
                  ...prev,
                  cards:
                    kind === 'card'
                      ? prev.cards.map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.cards,
                  frames:
                    kind === 'frame'
                      ? (prev.frames || []).map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.frames,
                  backdrops:
                    kind === 'backdrop'
                      ? (prev.backdrops || []).map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.backdrops,
                  textures:
                    kind === 'texture'
                      ? (prev.textures || []).map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.textures,
                  stickers:
                    kind === 'sticker'
                      ? prev.stickers.map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.stickers,
                  banners:
                    kind === 'banner'
                      ? prev.banners.map((x) => (x.id === id ? { ...x, likes } : x))
                      : prev.banners,
                };
              }
              case 'trade:created': {
                const t = payload as TradeOffer;
                if (prev.trades.some((x) => x.id === t.id)) return prev;
                return { ...prev, trades: [t, ...prev.trades] };
              }
              case 'trade:updated': {
                const t = payload as TradeOffer;
                return {
                  ...prev,
                  trades: prev.trades.map((x) => (x.id === t.id ? t : x)),
                };
              }
              case 'users:updated': {
                const users = payload as CollectorUser[];
                return { ...prev, users };
              }
              case 'notification:new': {
                const n = payload as RealtimeNotification;
                if (prev.notifications.some((x) => x.id === n.id)) return prev;
                return { ...prev, notifications: [n, ...prev.notifications] };
              }
              case 'chat:message': {
                const msg = payload as ChatMessage;
                const existing = prev.chatMessages || [];
                if (existing.some((m) => m.id === msg.id)) return prev;
                return { ...prev, chatMessages: [...existing, msg] };
              }
              default:
                return prev;
            }
          });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Register Service Worker, fetch vapidPublicKey, and sync pushManager subscription
  const pushSubscribedRef = useRef(pushSubscribed);
  useEffect(() => {
    pushSubscribedRef.current = pushSubscribed;
  }, [pushSubscribed]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await registerPushServiceWorker();
      const key = await fetchVapidPublicKey();
      if (active && key) {
        setVapidPublicKey(key);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifDrawer(false);
        setToastMsg(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!activeUserId || pushPermission !== 'granted' || !vapidPublicKey) {
      return;
    }
    let active = true;
    void subscribeUserToPush(activeUserId, vapidPublicKey).then((res) => {
      if (active && res.hasPushSubscription) {
        setPushSubscribed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [activeUserId, pushPermission, vapidPublicKey]);

  // Listen for Service Worker notification click deep-links and permission updates
  useEffect(() => {
    const syncPermission = () => setPushPermission(getPushPermissionState());
    document.addEventListener('visibilitychange', syncPermission);

    if (!('serviceWorker' in navigator)) {
      return () => {
        document.removeEventListener('visibilitychange', syncPermission);
      };
    }

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data as
        | { type?: string; kind?: string; tradeId?: string; roomId?: string }
        | undefined;
      if (msg?.type === 'NAVIGATE_NOTIFICATION') {
        setShowNotifDrawer(false);
        setInspectedCard(null);
        if (msg.kind === 'chat') {
          if (msg.roomId) {
            setChatInitialRoomId(msg.roomId);
          }
          setActiveTab('chat');
          showToast('Abriendo chat desde la notificación.');
        } else {
          setActiveTab('bazaar');
          showToast('Abriendo Bazar de Trueque desde la notificación.');
        }
      } else if (msg?.type === 'NAVIGATE_TRADE') {
        setShowNotifDrawer(false);
        setInspectedCard(null);
        setActiveTab('bazaar');
        showToast('Abriendo Bazar de Trueque desde la notificación.');
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      document.removeEventListener('visibilitychange', syncPermission);
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [showToast]);

  // Gentle copyright-free crowd applause on first user click inside app
  useEffect(() => {
    if (hasPlayedWelcomeSound) return;
    const triggerOnFirstGesture = () => {
      setHasPlayedWelcomeSound(true);
      setCrowdPlaying(true);
      soundEngine.playCrowdWelcome(3.6);
      window.setTimeout(() => setCrowdPlaying(false), 3600);
    };
    window.addEventListener('pointerdown', triggerOnFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', triggerOnFirstGesture);
    };
  }, [hasPlayedWelcomeSound]);

  const toggleCrowdAmbience = () => {
    if (crowdPlaying) {
      soundEngine.stopCrowd();
      setCrowdPlaying(false);
    } else {
      setCrowdPlaying(true);
      soundEngine.playCrowdWelcome(4.5);
      window.setTimeout(() => setCrowdPlaying(false), 4500);
    }
  };

  // Cleanup speech recognition on unmount or tab switch
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const toggleVoiceSearch = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      showToast('Tu navegador no admite búsqueda por voz (prueba Chrome, Edge o Safari).');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const cleaned = transcript.trim().replace(/[.,!?]+$/, '');
        setSearchQuery(cleaned);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showToast('Permiso de micrófono denegado para la búsqueda por voz.');
        } else if (event.error === 'no-speech') {
          showToast('No se detectó voz. Intenta hablar más cerca del micrófono.');
        } else if (event.error !== 'aborted') {
          showToast('No se pudo completar el reconocimiento de voz.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      showToast('No se pudo iniciar el reconocimiento de voz.');
    }
  };

  const currentUser = useMemo(() => {
    if (!data) return null;
    return data.users.find((u) => u.id === activeUserId) || data.users[0];
  }, [data, activeUserId]);

  // Respect visibility permissions (public, friends, private)
  const canViewItem = useCallback(
    (ownerId: string, visibility: VisibilityMode) => {
      if (!currentUser) return false;
      if (ownerId === currentUser.id) return true;
      if (visibility === 'public') return true;
      if (visibility === 'friends') return currentUser.friends.includes(ownerId);
      return false;
    },
    [currentUser]
  );

  const favoriteIds = useMemo(
    () => new Set(offlineFavorites.map((f) => f.id)),
    [offlineFavorites]
  );

  const toggleOfflineFavorite = useCallback(
    async (card: Photocard) => {
      const exists = offlineFavorites.some((f) => f.id === card.id);
      if (exists) {
        await removeFavoriteCard(card.id);
        setOfflineFavorites((prev) => prev.filter((f) => f.id !== card.id));
        showToast(`"${card.title}" quitada de favoritas sin conexión.`);
      } else {
        const saved = await saveFavoriteCard(card);
        setOfflineFavorites((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
        showToast(`"${card.title}" guardada en IndexedDB para acceso sin red.`);
      }
    },
    [offlineFavorites, showToast]
  );

  const visibleCards = useMemo(() => {
    if (!data || !currentUser) return [];
    const baseList =
      vaultScope === 'favorites'
        ? offlineFavorites
        : data.cards.filter((c) => canViewItem(c.ownerId, c.visibility));

    return baseList.filter((c) => {
      if (vaultScope === 'mine' && c.ownerId !== currentUser.id) return false;
      if (vaultScope === 'friends' && !currentUser.friends.includes(c.ownerId)) return false;
      if (albumFilterId !== 'all' && c.albumId !== albumFilterId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.serialCode.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, currentUser, canViewItem, vaultScope, offlineFavorites, albumFilterId, searchQuery]);

  const VAULT_PAGE_SIZE = 8;
  const vaultTotalPages = Math.max(1, Math.ceil(visibleCards.length / VAULT_PAGE_SIZE));
  const safeVaultPage = Math.min(vaultPage, vaultTotalPages);
  const pagedVaultCards = useMemo(() => {
    const start = (safeVaultPage - 1) * VAULT_PAGE_SIZE;
    return visibleCards.slice(start, start + VAULT_PAGE_SIZE);
  }, [visibleCards, safeVaultPage]);

  const visibleAlbums = useMemo(() => {
    if (!data || !currentUser) return [];
    return data.albums.filter((a) => canViewItem(a.ownerId, a.visibility));
  }, [data, currentUser, canViewItem]);

  const visibleBanners = useMemo(() => {
    if (!data || !currentUser) return [];
    return data.banners.filter((b) => canViewItem(b.ownerId, b.visibility));
  }, [data, currentUser, canViewItem]);

  const myNotifications = useMemo(() => {
    if (!data || !currentUser) return [];
    return data.notifications.filter((n) => n.userId === currentUser.id);
  }, [data, currentUser]);

  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  const originalExportCounts = useMemo(() => {
    if (!data || !currentUser) {
      return { cardsCount: 0, texturesCount: 0, stickersCount: 0, totalFiles: 0 };
    }
    return countOriginalVaultExports({
      userId: currentUser.id,
      cards: data.cards,
      textures: data.textures || [],
      stickers: data.stickers,
    });
  }, [data, currentUser]);

  const handleToggleAutoDriveBackup = async () => {
    if (!currentUser) return;
    const nextValue = !autoDriveBackup;
    if (!nextValue) {
      setAutoDriveBackup(false);
      setShowDriveExportConfirm(false);
      try {
        localStorage.setItem(`kromacard_auto_drive_backup_${currentUser.id}`, 'false');
      } catch {
        // ignore
      }
      showToast(`Exportación automática a "${FANCARD_STUDIO_FOLDER_NAME}" desactivada.`);
      return;
    }

    try {
      if (!getDriveAccessToken()) {
        await ensureDriveAccessToken();
        setHasDriveToken(Boolean(getDriveAccessToken()));
      }
      setAutoDriveBackup(true);
      try {
        localStorage.setItem(`kromacard_auto_drive_backup_${currentUser.id}`, 'true');
      } catch {
        // ignore
      }
      if (originalExportCounts.totalFiles > 0) {
        setShowDriveExportConfirm(true);
      }
      showToast(
        `Respaldo automático activado: tus nuevas creaciones se guardarán en "${FANCARD_STUDIO_FOLDER_NAME}".`
      );
    } catch (err) {
      showToast(formatGoogleAuthError(err));
    }
  };

  const handleConfirmBatchExportToFanCardStudio = async () => {
    if (!data || !currentUser) return;
    setDriveBatchExporting(true);
    setDriveBatchProgress(null);
    try {
      const summary = await exportOriginalVaultToFanCardStudio({
        userId: currentUser.id,
        cards: data.cards,
        textures: data.textures || [],
        stickers: data.stickers,
        folderName: FANCARD_STUDIO_FOLDER_NAME,
        onProgress: setDriveBatchProgress,
      });
      setHasDriveToken(Boolean(getDriveAccessToken()));
      setShowDriveExportConfirm(false);
      setLastDriveBackupInfo({
        count: summary.uploadedCount,
        folderName: summary.folderName,
        at: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      });
      if (summary.uploadedCount === 0 && summary.failedCount === 0) {
        showToast('No tienes creaciones originales pendientes para exportar.');
      } else if (summary.failedCount > 0) {
        showToast(
          `Se exportaron ${summary.uploadedCount} archivos a "${summary.folderName}" (${summary.failedCount} con error).`
        );
      } else {
        showToast(
          `${summary.uploadedCount} archivos originales exportados a "${summary.folderName}" en Google Drive.`
        );
      }
    } catch (err) {
      showToast(formatGoogleAuthError(err));
    } finally {
      setDriveBatchExporting(false);
      setDriveBatchProgress(null);
    }
  };

  // API Handlers
  const handleSaveCard = async (cardPayload: Partial<Photocard>) => {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    });
    if (!res.ok) {
      showToast('Error al guardar la photocard.');
      return;
    }
    const saved = (await res.json()) as Photocard;
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.cards.some((c) => c.id === saved.id);
      return {
        ...prev,
        cards: exists
          ? prev.cards.map((c) => (c.id === saved.id ? saved : c))
          : [saved, ...prev.cards],
      };
    });
    soundEngine.playVerifyChime();
    setEditingCard(null);
    setActiveTab('vault');
    showToast(`Photocard "${saved.title}" guardada con código QR listo.`);

    if (autoDriveBackup && currentUser && (saved.creatorId || saved.ownerId) === currentUser.id) {
      void syncSingleCreationToFanCardStudio({
        userId: currentUser.id,
        card: saved,
        folderName: FANCARD_STUDIO_FOLDER_NAME,
      }).then((syncRes) => {
        if (syncRes.uploaded > 0) {
          showToast(
            `Respaldo automático: "${saved.title}" guardado en Drive (${FANCARD_STUDIO_FOLDER_NAME}).`
          );
        }
      });
    }
  };

  const handleUpdateCardPatch = async (cardId: string, patch: Partial<Photocard>) => {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = (await res.json()) as Photocard;
      setData((prev) =>
        prev
          ? { ...prev, cards: prev.cards.map((c) => (c.id === updated.id ? updated : c)) }
          : prev
      );
      if (inspectedCard?.id === updated.id) {
        setInspectedCard(updated);
      }
    }
  };

  const handleCreateFilter = async (filterPayload: Partial<ImageFilterConfig>) => {
    const res = await fetch('/api/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filterPayload),
    });
    const created = (await res.json()) as ImageFilterConfig;
    setData((prev) =>
      prev && !prev.filters.some((f) => f.id === created.id)
        ? { ...prev, filters: [...prev.filters, created] }
        : prev
    );
    return created;
  };

  const handleCreateSticker = async (stickerPayload: Partial<CustomSticker>) => {
    const res = await fetch('/api/stickers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stickerPayload),
    });
    const created = (await res.json()) as CustomSticker;
    setData((prev) =>
      prev && !prev.stickers.some((s) => s.id === created.id)
        ? { ...prev, stickers: [...prev.stickers, created] }
        : prev
    );
    setNewStickerIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));

    if (autoDriveBackup && currentUser && created.authorId === currentUser.id) {
      void syncSingleCreationToFanCardStudio({
        userId: currentUser.id,
        sticker: created,
        folderName: FANCARD_STUDIO_FOLDER_NAME,
      }).then((syncRes) => {
        if (syncRes.uploaded > 0) {
          showToast(
            `Sticker "${created.name}" respaldado en Drive (${FANCARD_STUDIO_FOLDER_NAME}).`
          );
        }
      });
    }
    return created;
  };

  const handleCreateTexture = async (texturePayload: Partial<CustomTexture>) => {
    const res = await fetch('/api/textures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(texturePayload),
    });
    const created = (await res.json()) as CustomTexture;
    setData((prev) =>
      prev && !(prev.textures || []).some((t) => t.id === created.id)
        ? { ...prev, textures: [created, ...(prev.textures || [])] }
        : prev
    );

    if (autoDriveBackup && currentUser && created.authorId === currentUser.id) {
      void syncSingleCreationToFanCardStudio({
        userId: currentUser.id,
        texture: created,
        folderName: FANCARD_STUDIO_FOLDER_NAME,
      }).then((syncRes) => {
        if (syncRes.uploaded > 0) {
          showToast(
            `Textura "${created.name}" respaldada en Drive (${FANCARD_STUDIO_FOLDER_NAME}).`
          );
        }
      });
    }
    return created;
  };

  const handleCreateFrame = async (framePayload: Partial<CustomFramePreset>) => {
    const res = await fetch('/api/frames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(framePayload),
    });
    const created = (await res.json()) as CustomFramePreset;
    setData((prev) =>
      prev && !(prev.frames || []).some((f) => f.id === created.id)
        ? { ...prev, frames: [created, ...(prev.frames || [])] }
        : prev
    );
    return created;
  };

  const handleCreateBackdrop = async (backdropPayload: Partial<CustomBackdrop>) => {
    const res = await fetch('/api/backdrops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backdropPayload),
    });
    const created = (await res.json()) as CustomBackdrop;
    setData((prev) =>
      prev && !(prev.backdrops || []).some((b) => b.id === created.id)
        ? { ...prev, backdrops: [created, ...(prev.backdrops || [])] }
        : prev
    );
    return created;
  };

  const handleLikeAsset = async (kind: LikableAssetKind, id: string) => {
    const res = await fetch('/api/assets/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id }),
    });
    if (!res.ok) return;
    const { likes } = (await res.json()) as { kind: LikableAssetKind; id: string; likes: number };
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: kind === 'card' ? prev.cards.map((x) => (x.id === id ? { ...x, likes } : x)) : prev.cards,
        frames:
          kind === 'frame'
            ? (prev.frames || []).map((x) => (x.id === id ? { ...x, likes } : x))
            : prev.frames,
        backdrops:
          kind === 'backdrop'
            ? (prev.backdrops || []).map((x) => (x.id === id ? { ...x, likes } : x))
            : prev.backdrops,
        textures:
          kind === 'texture'
            ? (prev.textures || []).map((x) => (x.id === id ? { ...x, likes } : x))
            : prev.textures,
        stickers:
          kind === 'sticker'
            ? prev.stickers.map((x) => (x.id === id ? { ...x, likes } : x))
            : prev.stickers,
        banners:
          kind === 'banner'
            ? prev.banners.map((x) => (x.id === id ? { ...x, likes } : x))
            : prev.banners,
      };
    });
  };

  const handleCreateAlbum = async (albumPayload: Partial<Album>) => {
    const res = await fetch('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(albumPayload),
    });
    if (res.ok) {
      const created = (await res.json()) as Album;
      setData((prev) =>
        prev && !prev.albums.some((a) => a.id === created.id)
          ? { ...prev, albums: [created, ...prev.albums] }
          : prev
      );
    }
  };

  const handleUpdateAlbumVisibility = async (albumId: string, visibility: VisibilityMode) => {
    const res = await fetch(`/api/albums/${albumId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Album;
      setData((prev) =>
        prev
          ? { ...prev, albums: prev.albums.map((a) => (a.id === updated.id ? updated : a)) }
          : prev
      );
      showToast('Visibilidad del álbum actualizada.');
    }
  };

  const handleCreateBanner = async (bannerPayload: Partial<ConcertBanner>) => {
    const res = await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bannerPayload),
    });
    if (res.ok) {
      const created = (await res.json()) as ConcertBanner;
      setData((prev) =>
        prev && !prev.banners.some((b) => b.id === created.id)
          ? { ...prev, banners: [created, ...prev.banners] }
          : prev
      );
    }
  };

  const handleProposeTrade = async (payload: {
    type: 'swap' | 'gift';
    fromUserId: string;
    toUserId: string;
    offeredCardId?: string;
    requestedCardId: string;
    message: string;
  }) => {
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      soundEngine.playVerifyChime();
      showToast(
        payload.type === 'gift'
          ? 'Regalo enviado y verificado en tiempo real.'
          : 'Propuesta de trueque enviada con código de verificación.'
      );
    } else {
      const err = await res.json();
      showToast(err.error || 'No se pudo enviar la solicitud.');
    }
  };

  const handleRespondTrade = async (tradeId: string, action: 'accept' | 'decline') => {
    if (!currentUser) return;
    const res = await fetch(`/api/trades/${tradeId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actorUserId: currentUser.id }),
    });
    if (res.ok) {
      soundEngine.playVerifyChime();
      showToast(
        action === 'accept'
          ? '¡Trueque completado! Las cartas se transfirieron automáticamente.'
          : 'Propuesta rechazada.'
      );
    } else {
      const err = await res.json();
      showToast(err.error || 'No se pudo procesar el trueque.');
    }
  };

  const handleToggleFriend = async (friendId: string) => {
    if (!currentUser) return;
    const res = await fetch('/api/friends/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, friendId }),
    });
    if (res.ok) {
      const { users } = (await res.json()) as { users: CollectorUser[] };
      setData((prev) => (prev ? { ...prev, users } : prev));
      showToast('Lista de amigos actualizada.');
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser) return;
    const res = await fetch('/api/follow/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, targetUserId }),
    });
    if (res.ok) {
      const { users, following } = (await res.json()) as {
        users: CollectorUser[];
        following: boolean;
      };
      setData((prev) => (prev ? { ...prev, users } : prev));
      showToast(following ? 'Ahora sigues a este coleccionista.' : 'Dejaste de seguir este perfil.');
    }
  };

  const handleSendChatMessage = async (payload: {
    roomId: string;
    recipientId?: string;
    text: string;
    cardId?: string;
  }) => {
    if (!currentUser) return;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUser.id,
        ...payload,
      }),
    });
    if (res.ok) {
      const { message } = (await res.json()) as {
        message: ChatMessage;
        notifications: RealtimeNotification[];
      };
      setData((prev) => {
        if (!prev) return prev;
        const currentMsgs = prev.chatMessages || [];
        if (currentMsgs.some((m) => m.id === message.id)) return prev;
        return { ...prev, chatMessages: [...currentMsgs, message] };
      });
    } else {
      const err = await res.json();
      showToast(err.error || 'No se pudo enviar el mensaje.');
    }
  };

  const handleOpenChatWithUser = (userId: string) => {
    if (!currentUser) return;
    setChatInitialRoomId(getDmRoomId(currentUser.id, userId));
    setActiveTab('chat');
  };

  const handleUpdateProfile = async (patch: Partial<CollectorUser>) => {
    if (!currentUser) return;
    const res = await fetch(`/api/users/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = (await res.json()) as CollectorUser;
      setData((prev) =>
        prev
          ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) }
          : prev
      );
      showToast('Perfil guardado.');
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!currentUser) return;
    setPushPermission(getPushPermissionState());
    setShowNotifDrawer(true);
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.userId === currentUser.id ? { ...n, read: true } : n
            ),
          }
        : prev
    );
  };

  const handleDismissNotification = async (notificationId?: string) => {
    if (!currentUser) return;
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.filter((n) => {
              if (n.userId !== currentUser.id) return true;
              return notificationId ? n.id !== notificationId : false;
            }),
          }
        : prev
    );
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          ...(notificationId ? { notificationId } : { dismissAll: true }),
        }),
      });
    } catch {
      // optimistic UI already closed the notification
    }
  };

  const handleEnableTradePush = async () => {
    if (!currentUser) return;
    const result = await requestTradePushPermission(currentUser.id, vapidPublicKey);
    setPushPermission(result.permission);
    setPushSubscribed(result.subscribed);
    if (result.permission === 'granted') {
      showToast(
        result.subscribed
          ? 'Push activado con pushManager: recibirás trueques y mensajes incluso con el navegador cerrado.'
          : 'Permiso de notificaciones concedido para alertas en el Service Worker.'
      );
    } else if (result.permission === 'denied') {
      showToast('Notificaciones bloqueadas. Habilítalas en los ajustes del navegador.');
    } else if (result.permission === 'unsupported') {
      showToast('Este navegador no soporta notificaciones Service Worker.');
    }
  };

  const handleTestBackgroundPush = async () => {
    if (!currentUser) return;
    if (pushPermission !== 'granted') {
      await handleEnableTradePush();
      if (getPushPermissionState() !== 'granted') return;
    }
    setPushTesting(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, delayMs: 4000 }),
      });
      if (res.ok) {
        showToast('Cambia de pestaña o minimiza: la notificación push llegará en 4 segundos.');
      } else {
        showToast('No se pudo programar la prueba de notificación.');
      }
    } catch {
      showToast('Sin conexión con el servidor para la prueba push.');
    } finally {
      window.setTimeout(() => setPushTesting(false), 4200);
    }
  };

  if (loading || !data || !currentUser) {
    return (
      <div className="min-h-screen bg-[#0B0D14] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <img
            src="/src/assets/images/kromacard_logo_1795355873398.jpg"
            alt="Logotipo Kromacard"
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border border-sky-400/30 mx-auto shadow-lg"
          />
          <p className="text-sm text-slate-300 font-medium">Cargando bóveda Kromacard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D14] text-slate-100 pb-24 md:pb-12">
      {/* Top Bar Contract: 3 zones separated cleanly */}
      <header className="sticky top-0 z-30 h-14 bg-[#0B0D14]/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-4 lg:gap-6">
          {/* Zone 1: Brand emblem + wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className="flex items-center gap-2.5 font-display text-lg lg:text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 group"
          >
            <img
              src="/src/assets/images/kromacard_logo_1795355873398.jpg"
              alt="Kromacard"
              referrerPolicy="no-referrer"
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl object-cover border border-white/15 shadow-sm group-hover:border-sky-400/50 transition-colors"
            />
            <span>Kromacard</span>
          </button>

          {/* Zone 2: Single-line navigation links */}
          <nav className="hidden md:flex items-center gap-2.5 lg:gap-3.5 text-xs lg:text-sm font-medium">
            {(
              [
                { id: 'vault', label: 'Colección' },
                { id: 'studio', label: 'Estudio 3D' },
                { id: 'library', label: 'Biblioteca' },
                { id: 'sticker-studio', label: 'Stickers' },
                { id: 'concerts', label: 'Conciertos' },
                { id: 'bazaar', label: 'Trueque' },
                { id: 'chat', label: 'Sala Chat' },
                { id: 'profile', label: 'Amigos' },
              ] as { id: AppTab; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'studio') {
                    setEditingCard(null);
                    setStudioInitialTab('photo');
                    setReturnToStudioAfterSticker(false);
                  } else if (item.id === 'sticker-studio') {
                    setReturnToStudioAfterSticker(false);
                  }
                  setActiveTab(item.id);
                }}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === item.id
                    ? 'text-white border-sky-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <span>{item.label}</span>
                {item.id === 'sticker-studio' && newStickerIds.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
                {item.id === 'chat' &&
                  myNotifications.some((n) => !n.read && n.kind === 'chat') && (
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                  )}
              </button>
            ))}
          </nav>

          {/* Zone 3: Google User + Top Alerts + Primary QR Scanner */}
          <div className="flex items-center gap-2 shrink-0">
            {hasGoogleSession ? (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                title={`Conectado como ${currentUser.displayName}`}
                className="min-h-[38px] px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                {currentUser.photoUrl ? (
                  <img
                    src={currentUser.photoUrl}
                    alt={currentUser.displayName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: currentUser.avatarColor }}
                  >
                    {currentUser.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden xl:inline max-w-[100px] truncate">
                  {currentUser.displayName.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={googleAuthBusy}
                onClick={() => void handleGoogleSignInFlow(false)}
                title="Iniciar sesión con Google y generar tu usuario"
                className="min-h-[38px] px-2.5 lg:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-[#1F1F1F] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
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
                <span className="hidden lg:inline">
                  {googleAuthBusy ? 'Conectando...' : 'Entrar'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleMarkNotificationsRead}
              aria-label="Abrir alertas"
              className="relative min-h-[38px] px-2.5 lg:px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Bell className="w-4 h-4 text-amber-300" />
              <span className="hidden xl:inline">Alertas</span>
              {unreadNotifCount > 0 && (
                <span className="font-mono-num px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="min-h-[38px] px-3 lg:px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Escanear QR</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'vault' && (
            <motion.div
              key="vault"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Hero & Workspace Controls */}
              <section className="rounded-3xl bg-[#131622] border border-white/10 p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-2.5">
                  <div className="text-xs font-semibold text-sky-400">
                    Colección de {currentUser.displayName} · {visibleCards.length} photocards visibles
                  </div>
                  <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
                    Tus photocards 3D, boletos y recuerdos listos para imprimir
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Sube tus fotos, diseña marcos holográficos o dorados, añade stickers, autógrafos, audio y código QR en el reverso para compartir o intercambiar.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCard(null);
                      setStudioInitialTab('photo');
                      setReturnToStudioAfterSticker(false);
                      setActiveTab('studio');
                    }}
                    className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 text-slate-950 text-sm font-bold flex items-center gap-2 hover:opacity-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Photocard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnToStudioAfterSticker(false);
                      setActiveTab('sticker-studio');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Sticker className="w-4 h-4 text-emerald-300" />
                    <span>Crear Sticker</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAutoOpenCanvasBanner(true);
                      setActiveTab('concerts');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Paintbrush className="w-4 h-4 text-fuchsia-300" />
                    <span>Crear Cartel / Evento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintSheetCard(undefined);
                      setShowPrintModal(true);
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-amber-300" />
                    <span>Imprimir A4</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleCrowdAmbience}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      crowdPlaying
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {crowdPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>Ambiente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVaultSettings((v) => !v)}
                    className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      showVaultSettings || autoDriveBackup
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
                        : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-emerald-300" />
                    <span>Config. Bóveda</span>
                  </button>

                  <PWAInstallButton />
                </div>
              </section>

              {showVaultSettings && (
                <section className="rounded-3xl bg-[#131622] border border-emerald-400/25 p-5 md:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FolderCheck className="w-4 h-4 text-emerald-400" />
                        <h2 className="font-display text-base font-bold text-white">
                          Configuración de la Bóveda · Google Drive
                        </h2>
                      </div>
                      <p className="text-xs text-slate-300">
                        Exporta automáticamente tus texturas, stickers, firmas SVG y diseños de cartas originales a la carpeta{' '}
                        <span className="font-semibold text-emerald-300">
                          {FANCARD_STUDIO_FOLDER_NAME}
                        </span>{' '}
                        en tu Google Drive.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVaultSettings(false)}
                      aria-label="Cerrar configuración de bóveda"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0B0D14] border border-white/10">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">
                        Exportación automática a "{FANCARD_STUDIO_FOLDER_NAME}"
                      </div>
                      <div className="text-xs text-slate-400">
                        Creaciones originales detectadas: {originalExportCounts.cardsCount} cartas ·{' '}
                        {originalExportCounts.texturesCount} texturas ·{' '}
                        {originalExportCounts.stickersCount} stickers ({originalExportCounts.totalFiles}{' '}
                        archivos)
                      </div>
                      {autoDriveBackup && !hasDriveToken && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-amber-300">
                          <span>
                            Conecta tu sesión de Drive para sincronizar nuevas creaciones automáticamente.
                          </span>
                          <button
                            type="button"
                            disabled={googleAuthBusy}
                            onClick={() => void handleGoogleSignInFlow(true)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 font-semibold disabled:opacity-60"
                          >
                            Conectar Drive
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoDriveBackup}
                        onClick={() => void handleToggleAutoDriveBackup()}
                        className={`min-h-[40px] px-4 rounded-xl text-xs font-bold border transition-colors ${
                          autoDriveBackup
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {autoDriveBackup ? 'Auto-exportación: Activa' : 'Activar auto-exportación'}
                      </button>

                      <button
                        type="button"
                        disabled={driveBatchExporting || originalExportCounts.totalFiles === 0}
                        onClick={() => setShowDriveExportConfirm(true)}
                        className="min-h-[40px] px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                        {driveBatchExporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CloudUpload className="w-3.5 h-3.5" />
                        )}
                        <span>Exportar todo ahora</span>
                      </button>
                    </div>
                  </div>

                  {showDriveExportConfirm && (
                    <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-white">
                          Confirmar exportación a carpeta "{FANCARD_STUDIO_FOLDER_NAME}"
                        </div>
                        <p className="text-slate-300">
                          Se crearán o subirán {originalExportCounts.totalFiles} archivos originales
                          (anverso, reverso, firmas SVG, texturas y stickers) a tu Google Drive.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={driveBatchExporting}
                          onClick={() => void handleConfirmBatchExportToFanCardStudio()}
                          className="min-h-[38px] px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {driveBatchExporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Confirmar exportación</span>
                        </button>
                        <button
                          type="button"
                          disabled={driveBatchExporting}
                          onClick={() => setShowDriveExportConfirm(false)}
                          className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {driveBatchProgress && (
                    <div className="p-3 rounded-xl bg-[#0B0D14] border border-white/10 text-xs text-sky-300 flex items-center justify-between gap-3">
                      <span className="truncate">{driveBatchProgress.label}</span>
                      <span className="font-mono-num font-bold shrink-0">
                        {driveBatchProgress.current} / {driveBatchProgress.total}
                      </span>
                    </div>
                  )}

                  {lastDriveBackupInfo && !driveBatchExporting && (
                    <div className="text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Última exportación a "{lastDriveBackupInfo.folderName}":{' '}
                        {lastDriveBackupInfo.count} archivos ({lastDriveBackupInfo.at})
                      </span>
                    </div>
                  )}
                </section>
              )}

              {/* Filter & Search Toolbar */}
              <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#131622] border border-white/10 rounded-xl">
                    {(
                      [
                        { id: 'all', label: 'Todas' },
                        { id: 'mine', label: 'Mis Cartas' },
                        { id: 'friends', label: 'De Amigos' },
                        { id: 'favorites', label: `Favoritas (${offlineFavorites.length})` },
                      ] as const
                    ).map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => {
                          setVaultScope(scope.id);
                          setVaultPage(1);
                        }}
                        className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          vaultScope === scope.id
                            ? 'bg-sky-500 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={albumFilterId}
                    onChange={(e) => {
                      setAlbumFilterId(e.target.value);
                      setVaultPage(1);
                    }}
                    aria-label="Filtrar por álbum"
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#131622] border border-white/10 text-xs font-semibold text-slate-200"
                  >
                    <option value="all">Todos los álbumes</option>
                    {visibleAlbums.map((alb) => (
                      <option key={alb.id} value={alb.id}>
                        {alb.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full md:w-80 flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={
                      isListening
                        ? 'Escuchando tu búsqueda...'
                        : 'Buscar por ídolo, lugar o código...'
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVaultPage(1);
                    }}
                    aria-label="Buscar en colección"
                    className={`w-full min-h-[44px] pl-10 pr-24 rounded-xl bg-[#131622] border text-sm text-white placeholder:text-slate-500 transition-colors ${
                      isListening
                        ? 'border-sky-400 ring-1 ring-sky-400/50'
                        : 'border-white/10'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Limpiar búsqueda"
                        title="Limpiar búsqueda"
                        className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleVoiceSearch}
                      aria-label={isListening ? 'Detener búsqueda por voz' : 'Buscar por voz'}
                      aria-pressed={isListening}
                      title={isListening ? 'Detener micrófono' : 'Buscar por voz'}
                      className={`min-h-[36px] min-w-[36px] px-2 rounded-lg flex items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                        isListening
                          ? 'bg-rose-500 text-white'
                          : 'text-sky-400 hover:bg-sky-500/15'
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          <span className="sr-only sm:not-sr-only">Parar</span>
                        </>
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* Cards Grid */}
              {visibleCards.length === 0 ? (
                <div className="bg-[#131622] border border-white/10 rounded-3xl p-12 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-sky-400 mx-auto" />
                  <h3 className="font-display text-lg font-bold text-white">
                    No hay photocards en este filtro
                  </h3>
                  <p className="text-sm text-slate-400">
                    Crea tu primera carta holográfica o cambia el filtro de álbum.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setVaultScope('all');
                      setAlbumFilterId('all');
                      setSearchQuery('');
                    }}
                    className="min-h-[42px] px-5 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold"
                  >
                    Ver todas las cartas
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {pagedVaultCards.map((card) => {
                      const owner = data.users.find((u) => u.id === card.ownerId);
                      const isMine = card.ownerId === currentUser.id;
                      const isFav = favoriteIds.has(card.id);
                      return (
                        <motion.article
                          key={card.id}
                          whileHover={{ scale: 1.02 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                          className="bg-[#131622] border border-white/10 rounded-3xl p-4 flex flex-col justify-between gap-4 hover:border-white/25 transition-colors"
                        >
                          <Card3D
                            card={card}
                            compact
                            onCardClick={() => setInspectedCard(card)}
                            onQrClick={() => setInspectedCard(card)}
                          />

                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-400 truncate">
                                {owner?.displayName || 'Coleccionista'} · {card.visibility === 'public' ? 'Público' : card.visibility === 'friends' ? 'Solo Amigos' : 'Privado'}
                              </div>
                              <button
                                type="button"
                                onClick={() => void toggleOfflineFavorite(card)}
                                aria-label={
                                  isFav
                                    ? `Quitar ${card.title} de favoritas sin conexión`
                                    : `Guardar ${card.title} como favorita sin conexión`
                                }
                                aria-pressed={isFav}
                                title={isFav ? 'Guardada sin conexión (IndexedDB)' : 'Guardar para ver sin conexión'}
                                className={`min-h-[36px] min-w-[36px] px-2 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold shrink-0 transition-colors ${
                                  isFav
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : 'bg-white/5 text-slate-400 hover:text-amber-300 hover:bg-white/10'
                                }`}
                              >
                                <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                                <span>{isFav ? 'Offline' : 'Fav'}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectedCard(card)}
                                className="min-h-[40px] rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                              >
                                <Compass className="w-3.5 h-3.5 text-sky-400" />
                                <span>Girar 3D</span>
                              </button>

                              {isMine ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCard(card);
                                    setActiveTab('studio');
                                  }}
                                  className="min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
                                >
                                  <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
                                  <span>Editar</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTradeTargetCard(card);
                                    setActiveTab('bazaar');
                                  }}
                                  className="min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                  <Repeat className="w-3.5 h-3.5" />
                                  <span>Trueque</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </section>

                  <PaginationControls
                    currentPage={safeVaultPage}
                    totalItems={visibleCards.length}
                    pageSize={VAULT_PAGE_SIZE}
                    onPageChange={(p) => setVaultPage(p)}
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'studio' && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StudioView
                key={`${editingCard?.id || 'draft'}-${studioInitialTab}-${editingCard?.stickers?.length || 0}`}
                currentUser={currentUser}
                albums={visibleAlbums}
                filters={data.filters}
                stickers={data.stickers}
                textures={data.textures || []}
                frames={data.frames || []}
                backdrops={data.backdrops || []}
                newStickerIds={newStickerIds}
                initialTab={studioInitialTab}
                editingCard={editingCard}
                onSaveCard={handleSaveCard}
                onCreateFilter={handleCreateFilter}
                onCreateTexture={handleCreateTexture}
                onCreateFrame={handleCreateFrame}
                onOpenStickerCreator={(cardDraft) => {
                  setEditingCard({
                    ...cardDraft,
                    id: cardDraft.id === 'preview-card' ? '' : cardDraft.id,
                  });
                  setReturnToStudioAfterSticker(true);
                  setActiveTab('sticker-studio');
                }}
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <CommunityLibraryView
                currentUser={currentUser}
                users={data.users}
                cards={data.cards.filter((c) => canViewItem(c.ownerId, c.visibility))}
                backdrops={data.backdrops || []}
                textures={data.textures || []}
                stickers={data.stickers}
                banners={visibleBanners}
                frames={data.frames || []}
                newStickerIds={newStickerIds}
                onLikeAsset={handleLikeAsset}
                onCreateBackdrop={handleCreateBackdrop}
                onInspectCard={(c) => setInspectedCard(c)}
                onUseFrameInStudio={(frm) => {
                  setEditingCard({
                    ...data.cards[0],
                    id: '',
                    serialCode: '',
                    title: 'Nueva Carta con Marco',
                    frameStyle: frm.frameShape === 'polaroid' ? 'polaroid' : 'custom',
                    frameShape: frm.frameShape,
                    customFrameId: frm.id,
                    frameCelebration: frm.celebrationTheme,
                    primaryColor: frm.primaryColor,
                    secondaryColor: frm.secondaryColor,
                    stickers: [],
                  });
                  setStudioInitialTab('frame');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast(`Marco "${frm.name}" aplicado en Estudio 3D.`);
                }}
                onUseBackdropInStudio={(bg) => {
                  setEditingCard({
                    ...data.cards[0],
                    id: '',
                    serialCode: '',
                    title: 'Nueva Carta con Fondo',
                    backBackdropUrl: bg.imageUrl,
                    stickers: [],
                  });
                  setStudioInitialTab('back');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast(`Fondo "${bg.name}" cargado en Estudio 3D.`);
                }}
                onUseTextureInStudio={(tex) => {
                  setEditingCard({
                    ...data.cards[0],
                    id: '',
                    serialCode: '',
                    title: 'Nueva Carta con Textura',
                    customTextureUrl: tex.imageUrl,
                    stickers: [],
                  });
                  setStudioInitialTab('frame');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast(`Textura "${tex.name}" aplicada en Estudio 3D.`);
                }}
                onUseStickerInStudio={(stk) => {
                  setEditingCard({
                    ...data.cards[0],
                    id: '',
                    serialCode: '',
                    title: 'Nueva Carta con Sticker',
                    stickers: [
                      {
                        id: `ps-${Date.now()}`,
                        stickerId: stk.id,
                        name: stk.name,
                        content: stk.content,
                        isImage: stk.isImage,
                        x: 50,
                        y: 35,
                        scale: 1,
                        rotation: 0,
                        bgColor: stk.bgColor,
                        textColor: stk.textColor,
                      },
                    ],
                  });
                  setStudioInitialTab('stickers');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast(`Sticker "${stk.name}" añadido en Estudio 3D.`);
                }}
                onCreateCardFromBanner={(ban) => {
                  setEditingCard({
                    ...data.cards[0],
                    id: '',
                    serialCode: '',
                    title: ban.title,
                    subtitle: ban.artistOrTour,
                    location: ban.venue,
                    eventDate: ban.date,
                    photoUrl: ban.photoUrl,
                    authorMessage: ban.story,
                    youtubeUrl: ban.youtubeUrl,
                    musicLinkUrl: ban.musicLinkUrl,
                    stickers: [],
                  });
                  setStudioInitialTab('photo');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast(`Cartel "${ban.title}" cargado en Estudio 3D.`);
                }}
                onOpenStudioTab={(tab) => {
                  setEditingCard(null);
                  setStudioInitialTab(tab);
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                }}
                onOpenStickerStudio={() => {
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('sticker-studio');
                }}
                onOpenBannerCreator={() => {
                  setAutoOpenCanvasBanner(true);
                  setActiveTab('concerts');
                }}
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'sticker-studio' && (
            <motion.div
              key="sticker-studio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <StickerCreatorView
                currentUser={currentUser}
                stickers={data.stickers}
                newStickerIds={newStickerIds}
                returnCardTitle={returnToStudioAfterSticker ? editingCard?.title : undefined}
                onBackToStudio={() => {
                  setStudioInitialTab(returnToStudioAfterSticker ? 'stickers' : 'photo');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                }}
                onCreateSticker={handleCreateSticker}
                onCreateAndAttachToCard={
                  returnToStudioAfterSticker && editingCard
                    ? async (stickerPayload) => {
                        const created = await handleCreateSticker(stickerPayload);
                        setEditingCard((prev) =>
                          prev
                            ? {
                                ...prev,
                                stickers: [
                                  ...(prev.stickers || []),
                                  {
                                    id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                    stickerId: created.id,
                                    name: created.name,
                                    content: created.content,
                                    isImage: created.isImage,
                                    x: 50,
                                    y: 35,
                                    scale: 1,
                                    rotation: 0,
                                    bgColor: created.bgColor,
                                    textColor: created.textColor,
                                  },
                                ],
                              }
                            : prev
                        );
                        setStudioInitialTab('stickers');
                        setReturnToStudioAfterSticker(false);
                        setActiveTab('studio');
                        return created;
                      }
                    : undefined
                }
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'concerts' && (
            <motion.div
              key="concerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ConcertsView
                currentUser={currentUser}
                cards={visibleCards}
                albums={visibleAlbums}
                banners={visibleBanners}
                stickers={data.stickers}
                autoOpenCanvas={autoOpenCanvasBanner}
                onClearAutoOpenCanvas={() => setAutoOpenCanvasBanner(false)}
                onCreateAlbum={handleCreateAlbum}
                onUpdateAlbumVisibility={handleUpdateAlbumVisibility}
                onCreateBanner={handleCreateBanner}
                onCreateCardFromBanner={(draft) => {
                  setEditingCard(draft as Photocard);
                  setStudioInitialTab('photo');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                  showToast('Cartel cargado en Estudio 3D: añade láminas HD, stickers, YouTube y QR.');
                }}
                onInspectCard={(c) => setInspectedCard(c)}
                onSelectAlbumFilter={(albId) => {
                  setAlbumFilterId(albId);
                  setVaultScope('all');
                  setActiveTab('vault');
                }}
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'bazaar' && (
            <motion.div
              key="bazaar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TradeBazaarView
                currentUser={currentUser}
                users={data.users}
                cards={data.cards.filter((c) => canViewItem(c.ownerId, c.visibility))}
                trades={data.trades}
                filters={data.filters}
                stickers={data.stickers}
                textures={data.textures || []}
                newStickerIds={newStickerIds}
                preselectedTargetCard={tradeTargetCard}
                pushPermission={pushPermission}
                pushTesting={pushTesting}
                onEnablePush={handleEnableTradePush}
                onTestPush={handleTestBackgroundPush}
                onClearPreselected={() => setTradeTargetCard(null)}
                onToggleCardTradeable={(cardId, tradeable, tradeWishNote, tradeCategory, tradeExpiresAt) =>
                  handleUpdateCardPatch(cardId, {
                    tradeable,
                    tradeWishNote,
                    ...(tradeCategory ? { tradeCategory } : {}),
                    ...(tradeExpiresAt !== undefined ? { tradeExpiresAt } : {}),
                  })
                }
                onProposeTrade={handleProposeTrade}
                onRespondTrade={handleRespondTrade}
                onInspectCard={(c) => setInspectedCard(c)}
                onUseInStudio={() => {
                  setEditingCard(null);
                  setStudioInitialTab('photo');
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('studio');
                }}
                onOpenStickerStudio={() => {
                  setReturnToStudioAfterSticker(false);
                  setActiveTab('sticker-studio');
                }}
                onNotifyToast={showToast}
              />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <FriendsChatView
                currentUser={currentUser}
                users={data.users}
                cards={data.cards.filter((c) => canViewItem(c.ownerId, c.visibility))}
                messages={data.chatMessages || []}
                initialRoomId={chatInitialRoomId}
                onClearInitialRoom={() => setChatInitialRoomId(null)}
                onSendMessage={handleSendChatMessage}
                onInspectProfile={(uid) => setInspectedProfileUserId(uid)}
                onInspectCard={(card) => setInspectedCard(card)}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <FriendsProfileView
                currentUser={currentUser}
                users={data.users}
                cards={data.cards}
                albums={data.albums}
                trades={data.trades}
                banners={data.banners}
                googleAuthBusy={googleAuthBusy}
                onGoogleSignIn={handleGoogleSignInFlow}
                onGoogleSignOut={handleGoogleSignOutFlow}
                onSwitchUser={(id) => {
                  setActiveUserId(id);
                  showToast('Sesión de coleccionista cambiada.');
                }}
                onToggleFriend={handleToggleFriend}
                onToggleFollow={handleToggleFollow}
                onInspectProfile={(uid) => setInspectedProfileUserId(uid)}
                onOpenChatWithUser={handleOpenChatWithUser}
                onUpdateProfile={handleUpdateProfile}
                onUpdateCardVisibility={(cardId, vis) =>
                  handleUpdateCardPatch(cardId, { visibility: vis })
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Navigation) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0B0D14]/92 backdrop-blur-md border-t border-white/10 grid grid-cols-7 items-center">
        {(
          [
            { id: 'vault', label: 'Bóveda', icon: <Layers className="w-4 h-4" /> },
            { id: 'studio', label: 'Crear', icon: <Plus className="w-4 h-4" /> },
            { id: 'library', label: 'Biblio', icon: <Library className="w-4 h-4" /> },
            { id: 'concerts', label: 'Eventos', icon: <FolderHeart className="w-4 h-4" /> },
            { id: 'bazaar', label: 'Trueque', icon: <Repeat className="w-4 h-4" /> },
            { id: 'chat', label: 'Chat', icon: <MessageCircle className="w-4 h-4" /> },
            { id: 'profile', label: 'Perfil', icon: <User className="w-4 h-4" /> },
          ] as { id: AppTab; label: string; icon: React.ReactNode }[]
        ).map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'studio') setEditingCard(null);
                setActiveTab(item.id);
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                active ? 'text-sky-400' : 'text-slate-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3D Card Inspector Modal */}
      {inspectedCard && (
        <Inspector3DModal
          card={inspectedCard}
          stickers={data.stickers}
          textures={data.textures || []}
          newStickerIds={newStickerIds}
          isFavorite={favoriteIds.has(inspectedCard.id)}
          onToggleFavorite={(card) => {
            void toggleOfflineFavorite(card);
          }}
          onClose={() => setInspectedCard(null)}
          onUpdateCardEffects={(cardId, patch) => {
            void handleUpdateCardPatch(cardId, patch);
          }}
          onOpenPrint={(card) => {
            setInspectedCard(null);
            setPrintSheetCard(card);
            setShowPrintModal(true);
          }}
          onProposeTrade={(card) => {
            setInspectedCard(null);
            setTradeTargetCard(card);
            setActiveTab('bazaar');
          }}
          onNotifyToast={showToast}
        />
      )}

      {/* A4 Printable Sheet Modal */}
      {showPrintModal && (
        <PrintSheetModal
          cards={visibleCards}
          initialCard={printSheetCard}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* QR & Serial Scanner Modal */}
      {showScanner && (
        <ScannerModal
          cards={data.cards.filter((c) => canViewItem(c.ownerId, c.visibility))}
          albums={visibleAlbums}
          onClose={() => setShowScanner(false)}
          onInspectCard={(c) => setInspectedCard(c)}
          onCloneToAlbum={async (card, targetAlbumId, personalNote) => {
            await handleSaveCard({
              ...card,
              id: undefined,
              serialCode: `${card.serialCode}-CP`,
              ownerId: currentUser.id,
              albumId: targetAlbumId,
              authorMessage: personalNote || card.authorMessage,
            });
          }}
        />
      )}

      {/* Real-Time Notifications Drawer */}
      {showNotifDrawer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotifDrawer(false);
          }}
        >
          <div className="w-full max-w-md bg-[#131622] border-l border-white/10 h-full p-6 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
              <h3 className="font-display text-lg font-bold text-white truncate">
                Notificaciones en Tiempo Real
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {myNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleDismissNotification()}
                    className="min-h-[36px] px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    Cerrar todas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifDrawer(false)}
                  aria-label="Cerrar panel de notificaciones"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {/* Service Worker Native Push Notification Controls */}
              <div className="p-4 rounded-2xl bg-[#0B0D14] border border-sky-400/25 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      {pushPermission === 'granted' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <BellRing className="w-4 h-4 text-sky-400 shrink-0" />
                      )}
                      <span>Notificaciones Push en 2º Plano</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {pushPermission === 'granted'
                        ? pushSubscribed
                          ? 'Suscripción Web Push VAPID activa. Recibirás alertas de nuevos trueques y mensajes directos incluso con el navegador cerrado.'
                          : 'Activas vía Service Worker. Recibirás alertas nativas de nuevas ofertas y mensajes.'
                        : pushPermission === 'denied'
                        ? 'Permiso bloqueado en este navegador. Habilítalo desde el icono de información del sitio.'
                        : pushPermission === 'unsupported'
                        ? 'Este navegador o contexto no soporta notificaciones nativas.'
                        : 'Activa Web Push para recibir nuevos trueques y mensajes directos incluso si el navegador está cerrado.'}
                    </p>
                  </div>
                </div>

                {pushPermission !== 'unsupported' && pushPermission !== 'denied' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {pushPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={() => void handleEnableTradePush()}
                        className="min-h-[38px] px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Activar Push de Trueques y Mensajes</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pushTesting}
                        onClick={() => void handleTestBackgroundPush()}
                        className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>
                          {pushTesting
                            ? 'Enviando alerta en 4s...'
                            : 'Probar alerta en 2º plano (4s)'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {myNotifications.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">
                  No tienes notificaciones nuevas.
                </p>
              ) : (
                myNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-2xl bg-[#0B0D14] border border-white/10 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-bold text-white leading-snug">{n.title}</div>
                      <button
                        type="button"
                        onClick={() => void handleDismissNotification(n.id)}
                        aria-label={`Cerrar notificación: ${n.title}`}
                        title="Cerrar notificación"
                        className="min-w-[30px] min-h-[30px] -mt-1 -mr-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center shrink-0 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {n.kind === 'trade' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifDrawer(false);
                            setActiveTab('bazaar');
                          }}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                        >
                          Ir al Bazar de Trueque →
                        </button>
                      )}
                      {n.kind === 'chat' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifDrawer(false);
                            if (n.relatedRoomId) {
                              setChatInitialRoomId(n.relatedRoomId);
                            }
                            setActiveTab('chat');
                          }}
                          className="text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300"
                        >
                          Responder en Sala de Chat →
                        </button>
                      )}
                      {n.relatedUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotifDrawer(false);
                            setInspectedProfileUserId(n.relatedUserId!);
                          }}
                          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          Ver Perfil →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collector Profile Viewer Modal (Friends & Followers) */}
      {inspectedProfileUserId &&
        data.users.find((u) => u.id === inspectedProfileUserId) && (
          <CollectorProfileModal
            profileUser={data.users.find((u) => u.id === inspectedProfileUserId)!}
            currentUser={currentUser}
            users={data.users}
            cards={data.cards}
            albums={data.albums}
            textures={data.textures || []}
            stickers={data.stickers}
            banners={data.banners}
            onClose={() => setInspectedProfileUserId(null)}
            onSelectProfileUser={(uid) => setInspectedProfileUserId(uid)}
            onToggleFriend={handleToggleFriend}
            onToggleFollow={handleToggleFollow}
            onOpenChatWithUser={handleOpenChatWithUser}
            onInspectCard={(card) => setInspectedCard(card)}
          />
        )}

      {/* Top-Positioned Non-blocking Alert Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-16 right-4 md:right-8 z-50 max-w-sm rounded-2xl bg-sky-500 text-slate-950 pl-4 pr-2.5 py-2.5 text-xs font-bold shadow-2xl flex items-center gap-2 border border-sky-300/60"
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span className="flex-1 leading-snug">{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            aria-label="Cerrar alerta"
            title="Cerrar notificación"
            className="min-w-[32px] min-h-[32px] rounded-xl hover:bg-slate-950/15 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <OfflineIndicator
        favorites={offlineFavorites}
        allCards={data.cards.filter((c) => canViewItem(c.ownerId, c.visibility))}
        onInspectCard={(card) => setInspectedCard(card)}
        onToggleFavorite={toggleOfflineFavorite}
      />
    </div>
  );
}
