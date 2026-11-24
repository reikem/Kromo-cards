import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  FolderSearch,
  Image as ImageIcon,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  fetchDriveImageAsDataUrl,
  formatGoogleAuthError,
  getCurrentGoogleUser,
  getDriveAccessToken,
  initGoogleDriveAuth,
  listDriveImages,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  subscribeDriveAuthState,
  type DriveImageItem,
} from '../utils/googleDriveAuth';

interface ContentRulesNoticeProps {
  accepted: boolean;
  onToggle: (next: boolean) => void;
  compact?: boolean;
}

export const ContentRulesNotice: React.FC<ContentRulesNoticeProps> = ({
  accepted,
  onToggle,
  compact = false,
}) => {
  return (
    <div
      className={`rounded-2xl border transition-colors ${
        accepted
          ? 'bg-emerald-500/[0.06] border-emerald-400/35'
          : 'bg-amber-500/[0.08] border-amber-400/40'
      } ${compact ? 'p-3' : 'p-4'} space-y-2.5`}
    >
      <div className="flex items-start gap-2.5">
        {accepted ? (
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 min-w-0">
          <div className="text-xs font-bold text-white">
            Reglas de Contenido al Subir Imágenes (Normas estilo Instagram)
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Para proteger a la comunidad, las fotos, texturas y carteles{' '}
            <strong className="text-amber-200">
              no deben incluir desnudez, contenido sexual explícito o sugerente, violencia gráfica, acoso, discurso de odio ni material que infrinja las Normas Comunitarias de Instagram
            </strong>
            .
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-[11px] font-semibold text-slate-100 cursor-pointer select-none pt-0.5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 mt-0.5 accent-emerald-400 shrink-0"
        />
        <span>
          Confirmo que mi imagen cumple estas reglas (sin desnudez ni infracciones).
        </span>
      </label>
    </div>
  );
};

interface ImageSourceSectionProps {
  title: string;
  subtitle?: string;
  onSelectImage: (dataUrl: string, fileName?: string) => void;
  onNotifyToast?: (msg: string) => void;
  compact?: boolean;
}

export const ImageSourceSection: React.FC<ImageSourceSectionProps> = ({
  title,
  subtitle = 'JPG, PNG o WebP en alta calidad',
  onSelectImage,
  onNotifyToast,
  compact = false,
}) => {
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [sourceMode, setSourceMode] = useState<'device' | 'google'>('device');

  // Google Drive Auth & Images State
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getDriveAccessToken());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveFiles, setDriveFiles] = useState<DriveImageItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [scopeMissing, setScopeMissing] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = initGoogleDriveAuth(
      (user) => {
        setGoogleUser(user);
        setNeedsAuth(false);
        setScopeMissing(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    const unsubscribeSync = subscribeDriveAuthState(() => {
      const token = getDriveAccessToken();
      const user = getCurrentGoogleUser();
      setGoogleUser(user);
      setNeedsAuth(!token);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, []);

  const loadDriveFiles = async (query = driveSearch) => {
    setLoadingDrive(true);
    setDriveError(null);
    setScopeMissing(false);
    try {
      const files = await listDriveImages(query);
      setDriveFiles(files);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'AUTH_REQUIRED' || msg === 'AUTH_EXPIRED') {
        setNeedsAuth(true);
        setDriveFiles([]);
        if (msg === 'AUTH_EXPIRED') {
          setDriveError(formatGoogleAuthError(err));
        }
      } else if (msg === 'SCOPE_MISSING') {
        setNeedsAuth(true);
        setScopeMissing(true);
        setDriveFiles([]);
        setDriveError(formatGoogleAuthError(err));
      } else {
        setDriveError(formatGoogleAuthError(err));
      }
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (sourceMode === 'google' && !needsAuth && driveFiles.length === 0 && !loadingDrive && !driveError) {
      void loadDriveFiles('');
    }
  }, [sourceMode, needsAuth]);

  const handleGoogleLogin = async (forceConsent = false) => {
    setIsLoggingIn(true);
    setDriveError(null);
    setScopeMissing(false);
    try {
      const { user, synced } = await signInWithGoogleDrive(forceConsent);
      setGoogleUser(user);
      setNeedsAuth(false);
      if (synced?.user) {
        onNotifyToast?.(
          synced.isNewUser
            ? `¡Usuario "${synced.user.displayName}" creado y conectado con Google Drive!`
            : `Conectado como ${synced.user.displayName} con Google Drive.`
        );
      }
      await loadDriveFiles(driveSearch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'SCOPE_MISSING') {
        setScopeMissing(true);
      }
      setDriveError(formatGoogleAuthError(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await signOutGoogleDrive();
    setGoogleUser(null);
    setNeedsAuth(true);
    setScopeMissing(false);
    setDriveFiles([]);
    setDriveError(null);
  };

  const handleDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!rulesAccepted) {
      onNotifyToast?.('Marca primero la confirmación de Normas de Contenido estilo Instagram.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelectImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePickDriveImage = async (item: DriveImageItem) => {
    if (!rulesAccepted) {
      onNotifyToast?.('Marca primero la confirmación de Normas de Contenido estilo Instagram.');
      return;
    }
    setImportingFileId(item.id);
    setDriveError(null);
    try {
      const dataUrl = await fetchDriveImageAsDataUrl(item.id, item.thumbnailLink);
      onSelectImage(dataUrl, item.name);
      onNotifyToast?.(`Imagen "${item.name}" cargada desde Google Drive.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'AUTH_REQUIRED' || msg === 'AUTH_EXPIRED' || msg === 'SCOPE_MISSING') {
        setNeedsAuth(true);
        if (msg === 'SCOPE_MISSING') setScopeMissing(true);
        setDriveError(formatGoogleAuthError(err));
      } else {
        setDriveError(formatGoogleAuthError(err));
      }
    } finally {
      setImportingFileId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-sm font-bold text-white">{title}</h4>
        <div className="flex items-center gap-1 p-1 bg-[#0B0D14] border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => setSourceMode('device')}
            className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
              sourceMode === 'device'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Dispositivo</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('google')}
            className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
              sourceMode === 'google'
                ? 'bg-white text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
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
            <span>Google Drive</span>
          </button>
        </div>
      </div>

      {/* Mandatory Instagram Community Content Policy Notice */}
      <ContentRulesNotice
        accepted={rulesAccepted}
        onToggle={setRulesAccepted}
        compact={compact}
      />

      {/* Option 1: Device File Upload */}
      {sourceMode === 'device' && (
        <label
          onClick={(e) => {
            if (!rulesAccepted) {
              e.preventDefault();
              onNotifyToast?.('Acepta primero las Reglas de Contenido antes de subir una imagen.');
            }
          }}
          className={`${compact ? 'min-h-[68px] p-3' : 'min-h-[92px] p-4'} border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-colors bg-white/[0.02] ${
            rulesAccepted
              ? 'border-white/20 hover:border-sky-400/60 cursor-pointer'
              : 'border-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          <Upload className="w-5 h-5 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200 text-center">
            {rulesAccepted
              ? 'Toca para subir una imagen desde tu dispositivo'
              : 'Marca la casilla de normas arriba para habilitar la carga'}
          </span>
          <span className="text-[11px] text-slate-400">{subtitle}</span>
          <input
            type="file"
            accept="image/*"
            disabled={!rulesAccepted}
            onChange={handleDeviceUpload}
            className="hidden"
          />
        </label>
      )}

      {/* Option 2: Google Drive Section */}
      {sourceMode === 'google' && (
        <div className="rounded-2xl bg-[#0B0D14] border border-white/15 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FolderSearch className="w-4 h-4 text-sky-400" />
                <span>Cargar Imágenes con Google</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Explora tus fotos y láminas guardadas en Google Drive.
              </p>
            </div>

            {!needsAuth && googleUser && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[140px]">
                    {googleUser.displayName || googleUser.email}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleGoogleLogout()}
                  title="Desconectar cuenta de Google"
                  className="min-h-[30px] px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Salir</span>
                </button>
              </div>
            )}
          </div>

          {needsAuth ? (
            <div className="py-3 flex flex-col items-center text-center gap-3">
              <p className="text-xs text-slate-300 max-w-sm">
                Inicia sesión con tu cuenta de Google para explorar e importar tus imágenes directamente desde Google Drive.
              </p>
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => void handleGoogleLogin(scopeMissing)}
                className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white hover:bg-slate-100 text-[#1F1F1F] text-sm font-medium shadow-md transition-colors disabled:opacity-60"
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block' }}
                >
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
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                <span>
                  {isLoggingIn
                    ? 'Conectando...'
                    : scopeMissing
                      ? 'Reconectar y permitir Google Drive'
                      : 'Sign in with Google'}
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar imagen en Google Drive..."
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void loadDriveFiles(driveSearch);
                      }
                    }}
                    className="w-full min-h-[36px] pl-8 pr-3 rounded-xl bg-[#131622] border border-white/10 text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadDriveFiles(driveSearch)}
                  disabled={loadingDrive}
                  className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                  <span>Buscar</span>
                </button>
              </div>

              {loadingDrive ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Cargando imágenes de Google Drive...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No encontramos imágenes con ese criterio en tu Google Drive.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {driveFiles.map((file) => {
                    const busy = importingFileId === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        disabled={!rulesAccepted || busy}
                        onClick={() => void handlePickDriveImage(file)}
                        title={
                          rulesAccepted
                            ? `Importar ${file.name}`
                            : 'Acepta las reglas de contenido arriba primero'
                        }
                        className={`group rounded-xl overflow-hidden border text-left transition-all ${
                          rulesAccepted
                            ? 'border-white/10 hover:border-sky-400 bg-[#131622]'
                            : 'border-white/5 opacity-55 cursor-not-allowed bg-[#131622]'
                        }`}
                      >
                        <div className="relative h-16 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt={file.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-500" />
                          )}
                          {busy && (
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            </div>
                          )}
                        </div>
                        <div className="px-1.5 py-1 text-[10px] text-slate-200 truncate">
                          {file.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {driveError && (
            <div className="text-[11px] text-rose-300 font-medium">{driveError}</div>
          )}
        </div>
      )}
    </div>
  );
};
