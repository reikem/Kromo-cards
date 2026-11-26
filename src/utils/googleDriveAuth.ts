import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  Album,
  CollectorUser,
  CustomSticker,
  CustomTexture,
  Photocard,
} from '../types/kromacard';
import { renderCardBackDataUrl, renderCardFrontDataUrl } from './cardExporter';
import { decodeSvgDataUrl, isSvgDataUrl, stickerToSvgDataUrl } from './svgSignature';

export const GOOGLE_OAUTH_CLIENT_ID: string = firebaseConfig.oAuthClientId || '';

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export const GOOGLE_PROFILE_AND_DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  ...GOOGLE_DRIVE_SCOPES,
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

function buildGoogleProvider(includeDriveScopes: boolean, forceConsent = false): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  if (includeDriveScopes) {
    for (const scope of GOOGLE_DRIVE_SCOPES) {
      p.addScope(scope);
    }
  }
  p.setCustomParameters({
    include_granted_scopes: 'true',
    prompt: forceConsent ? 'consent select_account' : 'select_account',
  });
  return p;
}

// Strictly in-memory token cache (never localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
const authListeners = new Set<() => void>();
const userSyncListeners = new Set<
  (payload: { user: CollectorUser; isNewUser: boolean; album?: Album }) => void
>();

function notifyAuthListeners() {
  authListeners.forEach((listener) => listener());
}

export function subscribeDriveAuthState(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function subscribeGoogleUserSynced(
  listener: (payload: { user: CollectorUser; isNewUser: boolean; album?: Album }) => void
): () => void {
  userSyncListeners.add(listener);
  return () => {
    userSyncListeners.delete(listener);
  };
}

export interface DriveImageItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface UploadedDriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            hint?: string;
            prompt?: string;
            callback: (resp: GisTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

export function preloadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GIS_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('GIS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

if (typeof window !== 'undefined') {
  void preloadGoogleIdentityScript().catch(() => {
    // will retry on user gesture if offline/blocked initially
  });
}

async function requestDriveTokenViaGis(
  hintEmail?: string | null,
  forceConsent = false,
  scopes = GOOGLE_PROFILE_AND_DRIVE_SCOPES
): Promise<string> {
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Falta configurar el oAuthClientId de Google en firebase-applet-config.json.');
  }
  if (!window.google?.accounts?.oauth2) {
    await preloadGoogleIdentityScript();
  }
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('No se pudo inicializar el cliente de Google Identity.');
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: scopes.join(' '),
      ...(hintEmail ? { hint: hintEmail } : {}),
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'No se otorgó acceso a Google Drive.'));
          return;
        }
        cachedAccessToken = resp.access_token;
        notifyAuthListeners();
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'popup_closed'));
      },
    });
    client.requestAccessToken({
      prompt: forceConsent ? 'consent select_account' : '',
      ...(hintEmail ? { hint: hintEmail } : {}),
    });
  });
}

export function formatGoogleAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : '';

  if (code === 'auth/popup-blocked' || msg.includes('popup_failed_to_open')) {
    return 'El navegador bloqueó la ventana emergente de Google. Habilita ventanas emergentes para este sitio e intenta de nuevo.';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('popup_closed')
  ) {
    return 'Se cerró la ventana de Google antes de completar el inicio de sesión.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio de vista previa necesita estar autorizado para iniciar sesión con popup.';
  }
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/permission-denied-on-the-service'
  ) {
    return 'El proveedor de Google no está habilitado para este proyecto. Intenta de nuevo en unos segundos.';
  }
  if (msg.includes('origin_mismatch') || msg.includes('redirect_uri_mismatch')) {
    return 'El origen de vista previa no coincide con el cliente OAuth directo. Intenta iniciar sesión de nuevo con la ventana de Google.';
  }
  if (msg === 'SCOPE_MISSING') {
    return 'Faltan permisos de Google Drive. Pulsa "Reconectar y permitir Google Drive" y marca la casilla de Drive.';
  }
  if (msg === 'AUTH_REQUIRED' || msg === 'AUTH_EXPIRED') {
    return 'Tu sesión de Google Drive expiró. Conecta de nuevo tu cuenta para continuar.';
  }
  return msg || 'No se pudo completar la conexión con Google.';
}

export async function syncBackendCollectorFromGoogle(
  firebaseUser: User | null,
  accessToken?: string | null
): Promise<{ user: CollectorUser; isNewUser: boolean; album?: Album } | null> {
  try {
    const idToken = firebaseUser ? await firebaseUser.getIdToken() : '';
    if (!idToken && !accessToken) return null;

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        ...(idToken ? { idToken } : {}),
        ...(accessToken ? { accessToken } : {}),
      }),
    });

    if (!res.ok) return null;
    const synced = (await res.json()) as {
      user: CollectorUser;
      isNewUser: boolean;
      album?: Album;
    };
    userSyncListeners.forEach((cb) => cb(synced));
    return synced;
  } catch {
    return null;
  }
}

export function initGoogleDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  if (typeof window !== 'undefined') {
    void preloadGoogleIdentityScript().catch(() => {});
  }
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else if (!cachedAccessToken && !isSigningIn) {
      onAuthFailure?.();
    }
    notifyAuthListeners();
  });
}

// Clean Google Sign-In via Firebase Auth popup (uses firebaseapp.com authDomain, avoiding origin_mismatch on preview URLs)
export async function signInWithGoogleAccount(): Promise<{
  firebaseUser: User | null;
  synced: { user: CollectorUser; isNewUser: boolean; album?: Album } | null;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, buildGoogleProvider(false, false));
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    const synced = await syncBackendCollectorFromGoogle(result.user, cachedAccessToken);
    notifyAuthListeners();
    return { firebaseUser: result.user, synced };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (
      GOOGLE_OAUTH_CLIENT_ID &&
      (code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/permission-denied-on-the-service')
    ) {
      const token = await requestDriveTokenViaGis(
        undefined,
        false,
        GOOGLE_PROFILE_AND_DRIVE_SCOPES
      );
      cachedAccessToken = token;
      const synced = await syncBackendCollectorFromGoogle(auth.currentUser, token);
      notifyAuthListeners();
      return { firebaseUser: auth.currentUser, synced };
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

// Google Sign-In + Drive OAuth access token acquisition via Firebase Auth popup (with GIS fallback only if Firebase Auth rejects domain/service)
export async function signInWithGoogleDrive(forceConsent = false): Promise<{
  user: User | null;
  accessToken: string;
  synced: { user: CollectorUser; isNewUser: boolean; album?: Album } | null;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, buildGoogleProvider(true, forceConsent));
    const credential = GoogleAuthProvider.credentialFromResult(result);
    let accessToken = credential?.accessToken || '';

    if (!accessToken && GOOGLE_OAUTH_CLIENT_ID) {
      accessToken = await requestDriveTokenViaGis(
        result.user.email,
        forceConsent,
        GOOGLE_PROFILE_AND_DRIVE_SCOPES
      );
    }

    if (!accessToken) {
      throw new Error('SCOPE_MISSING');
    }

    cachedAccessToken = accessToken;
    const synced = await syncBackendCollectorFromGoogle(result.user, accessToken);
    notifyAuthListeners();
    return { user: result.user, accessToken, synced };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (
      GOOGLE_OAUTH_CLIENT_ID &&
      (code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/permission-denied-on-the-service')
    ) {
      const accessToken = await requestDriveTokenViaGis(
        auth.currentUser?.email,
        forceConsent,
        GOOGLE_PROFILE_AND_DRIVE_SCOPES
      );
      cachedAccessToken = accessToken;
      const synced = await syncBackendCollectorFromGoogle(auth.currentUser, accessToken);
      notifyAuthListeners();
      return { user: auth.currentUser, accessToken, synced };
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function ensureDriveAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const { accessToken } = await signInWithGoogleDrive(false);
  return accessToken;
}

export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getCurrentGoogleUser(): User | null {
  return auth.currentUser;
}

export async function signOutGoogleDrive(): Promise<void> {
  const tokenToRevoke = cachedAccessToken;
  cachedAccessToken = null;
  if (tokenToRevoke && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tokenToRevoke, () => {});
    } catch {
      // ignore revoke errors
    }
  }
  try {
    await auth.signOut();
  } catch {
    // ignore if Firebase Auth isn't active
  }
  notifyAuthListeners();
}

async function parseDriveApiError(res: Response): Promise<{ reason: string; message: string }> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    const reason = body.error?.errors?.[0]?.reason || '';
    const message = body.error?.message || body.error?.errors?.[0]?.message || '';
    return { reason, message };
  } catch {
    return { reason: '', message: '' };
  }
}

export async function listDriveImages(searchQuery = ''): Promise<DriveImageItem[]> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const trimmed = searchQuery.trim().replace(/'/g, "\\'");
  const qParts = ["mimeType contains 'image/'", 'trashed = false'];
  if (trimmed) {
    qParts.push(`name contains '${trimmed}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '24',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    fields: 'files(id,name,mimeType,thumbnailLink,modifiedTime,webViewLink)',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    notifyAuthListeners();
    throw new Error('AUTH_EXPIRED');
  }

  if (res.status === 403) {
    const { reason, message } = await parseDriveApiError(res);
    if (
      reason === 'insufficientPermissions' ||
      reason === 'insufficientFilePermissions' ||
      message.toLowerCase().includes('insufficient')
    ) {
      cachedAccessToken = null;
      notifyAuthListeners();
      throw new Error('SCOPE_MISSING');
    }
    if (reason === 'accessNotConfigured') {
      throw new Error('La API de Google Drive aún se está activando en Google Cloud; espera 1 minuto e intenta de nuevo.');
    }
    throw new Error(message || 'Permiso denegado por Google Drive.');
  }

  if (!res.ok) {
    throw new Error('No se pudieron listar las imágenes de Google Drive.');
  }

  const data = (await res.json()) as { files?: DriveImageItem[] };
  return data.files || [];
}

function resizeBlobToDataUrl(blob: Blob, maxSize = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const outputMime = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, 0.9);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo decodificar la imagen de Drive.'));
    };
    img.src = objectUrl;
  });
}

export async function fetchDriveImageAsDataUrl(
  fileId: string,
  fallbackThumbnailUrl?: string
): Promise<string> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    cachedAccessToken = null;
    notifyAuthListeners();
    throw new Error('AUTH_EXPIRED');
  }

  if (res.status === 403) {
    const { reason, message } = await parseDriveApiError(res);
    if (reason === 'insufficientPermissions' || reason === 'insufficientFilePermissions') {
      cachedAccessToken = null;
      notifyAuthListeners();
      throw new Error('SCOPE_MISSING');
    }
    if (fallbackThumbnailUrl) {
      try {
        const highResThumb = fallbackThumbnailUrl.replace(/=s\d+$/, '=s1400');
        const thumbRes = await fetch(highResThumb);
        if (thumbRes.ok) {
          return resizeBlobToDataUrl(await thumbRes.blob(), 1400);
        }
      } catch {
        // ignore thumbnail fallback failure
      }
    }
    throw new Error(message || 'No tienes permisos para descargar esta imagen de Drive.');
  }

  if (!res.ok) {
    throw new Error('No se pudo descargar la imagen desde Google Drive.');
  }

  const blob = await res.blob();
  return resizeBlobToDataUrl(blob, 1400);
}

async function imageSourceToUploadBlob(
  source: string
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  if (isSvgDataUrl(source)) {
    const safeSvg = decodeSvgDataUrl(source);
    if (!safeSvg) {
      throw new Error('El contenido SVG no es válido.');
    }
    return {
      blob: new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' }),
      mimeType: 'image/svg+xml',
      ext: 'svg',
    };
  }

  if (source.startsWith('data:')) {
    const res = await fetch(source);
    const blob = await res.blob();
    const mimeType = blob.type || 'image/png';
    const ext =
      mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/svg+xml'
            ? 'svg'
            : 'png';
    return { blob, mimeType, ext };
  }

  try {
    const res = await fetch(source);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/')) {
        const ext =
          blob.type === 'image/jpeg'
            ? 'jpg'
            : blob.type === 'image/webp'
              ? 'webp'
              : blob.type === 'image/svg+xml'
                ? 'svg'
                : 'png';
        return { blob, mimeType: blob.type, ext };
      }
    }
  } catch {
    // Fallback to canvas conversion below
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1080;
      canvas.height = img.naturalHeight || 1512;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo preparar la imagen para exportar.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Error al codificar la imagen PNG.'));
            return;
          }
          resolve({ blob, mimeType: 'image/png', ext: 'png' });
        },
        'image/png',
        0.95
      );
    };
    img.onerror = () =>
      reject(new Error('No se pudo leer la imagen origen para subirla a Drive.'));
    img.src = source;
  });
}

export const DEFAULT_DRIVE_FOLDER_NAME = 'Kromacard Studio';
export const FANCARD_STUDIO_FOLDER_NAME = 'FanCard Studio';

async function findOrCreateDriveFolder(
  token: string,
  folderName = DEFAULT_DRIVE_FOLDER_NAME
): Promise<string | undefined> {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${escapedName}' and trashed = false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (searchRes.status === 403) {
    const { reason } = await parseDriveApiError(searchRes);
    if (reason === 'insufficientPermissions' || reason === 'insufficientFilePermissions') {
      throw new Error('SCOPE_MISSING');
    }
  }

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Texturas, stickers, firmas SVG y diseños originales exportados desde FanCard Studio',
    }),
  });

  if (createRes.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (!createRes.ok) return undefined;
  const created = (await createRes.json()) as { id?: string };
  return created.id;
}

async function uploadBlobWithToken(options: {
  token: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  description: string;
  folderId?: string;
}): Promise<UploadedDriveFile> {
  const metadata = {
    name: options.fileName,
    mimeType: options.mimeType,
    description: options.description,
    ...(options.folderId ? { parents: [options.folderId] } : {}),
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', options.blob, options.fileName);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
      body: form,
    }
  );

  if (uploadRes.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }
  if (uploadRes.status === 403) {
    const { reason, message } = await parseDriveApiError(uploadRes);
    if (reason === 'insufficientPermissions' || reason === 'insufficientFilePermissions') {
      throw new Error('SCOPE_MISSING');
    }
    throw new Error(message || 'No tienes permisos para subir archivos a Google Drive.');
  }
  if (!uploadRes.ok) {
    throw new Error('No se pudo subir el archivo a Google Drive.');
  }

  return (await uploadRes.json()) as UploadedDriveFile;
}

function buildSafeDriveFileName(fileNameBase: string, ext: string): string {
  const safeBase =
    fileNameBase
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/(^-|-$)/g, '') || 'fancard-export';
  return safeBase.endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`;
}

export async function uploadImageToGoogleDrive(options: {
  source: string | (() => Promise<string> | string);
  fileNameBase: string;
  description?: string;
  folderName?: string;
  folderId?: string;
}): Promise<UploadedDriveFile> {
  // CRITICAL: Obtain OAuth token FIRST inside user click gesture so browsers never block the popup!
  let token = await ensureDriveAccessToken();

  const resolvedSource =
    typeof options.source === 'function' ? await options.source() : options.source;
  const { blob, mimeType, ext } = await imageSourceToUploadBlob(resolvedSource);
  const fileName = buildSafeDriveFileName(options.fileNameBase, ext);
  const targetFolderName = options.folderName || DEFAULT_DRIVE_FOLDER_NAME;

  const performUpload = async (activeToken: string): Promise<UploadedDriveFile> => {
    const folderId =
      options.folderId || (await findOrCreateDriveFolder(activeToken, targetFolderName));
    return uploadBlobWithToken({
      token: activeToken,
      blob,
      mimeType,
      fileName,
      description: options.description || 'Archivo exportado desde FanCard Studio',
      folderId,
    });
  };

  try {
    return await performUpload(token);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'AUTH_EXPIRED' || err.message === 'SCOPE_MISSING')
    ) {
      cachedAccessToken = null;
      notifyAuthListeners();
      const fresh = await signInWithGoogleDrive(err.message === 'SCOPE_MISSING');
      token = fresh.accessToken;
      return await performUpload(token);
    }
    throw err;
  }
}

export interface VaultDriveExportSummary {
  uploadedCount: number;
  failedCount: number;
  folderName: string;
  files: UploadedDriveFile[];
}

interface ExportTask {
  label: string;
  fileNameBase: string;
  description: string;
  getSource: () => Promise<string> | string;
}

function buildOriginalExportTasks(params: {
  userId: string;
  cards: Photocard[];
  textures: CustomTexture[];
  stickers: CustomSticker[];
}): ExportTask[] {
  const tasks: ExportTask[] = [];

  const originalCards = params.cards.filter(
    (c) => (c.creatorId || c.ownerId) === params.userId
  );
  for (const card of originalCards) {
    tasks.push({
      label: `Carta (anverso): ${card.title}`,
      fileNameBase: `card-${card.serialCode}-${card.title}-anverso`,
      description: `Diseño original anverso (${card.serialCode}) — FanCard Studio`,
      getSource: () => renderCardFrontDataUrl(card),
    });
    tasks.push({
      label: `Carta (reverso): ${card.title}`,
      fileNameBase: `card-${card.serialCode}-${card.title}-reverso`,
      description: `Diseño original reverso (${card.serialCode}) — FanCard Studio`,
      getSource: () => renderCardBackDataUrl(card),
    });
    if (card.autographDataUrl && isSvgDataUrl(card.autographDataUrl)) {
      const svgSig = card.autographDataUrl;
      tasks.push({
        label: `Firma SVG: ${card.title}`,
        fileNameBase: `firma-${card.serialCode}-${card.title}`,
        description: `Autógrafo digital vectorial SVG de ${card.title} — FanCard Studio`,
        getSource: () => svgSig,
      });
    }
  }

  const originalTextures = params.textures.filter((t) => t.authorId === params.userId);
  for (const tex of originalTextures) {
    tasks.push({
      label: `Textura: ${tex.name}`,
      fileNameBase: `textura-${tex.name}`,
      description: `Textura original creada por ${tex.authorName} — FanCard Studio`,
      getSource: () => tex.imageUrl,
    });
  }

  const originalStickers = params.stickers.filter((s) => s.authorId === params.userId);
  for (const stk of originalStickers) {
    tasks.push({
      label: `Sticker: ${stk.name}`,
      fileNameBase: `sticker-${stk.name}`,
      description: `Sticker original creado por ${stk.authorName} — FanCard Studio`,
      getSource: () => (stk.isImage ? stk.content : stickerToSvgDataUrl(stk)),
    });
  }

  return tasks;
}

export function countOriginalVaultExports(params: {
  userId: string;
  cards: Photocard[];
  textures: CustomTexture[];
  stickers: CustomSticker[];
}): { cardsCount: number; texturesCount: number; stickersCount: number; totalFiles: number } {
  const originalCards = params.cards.filter(
    (c) => (c.creatorId || c.ownerId) === params.userId
  );
  const originalTextures = params.textures.filter((t) => t.authorId === params.userId);
  const originalStickers = params.stickers.filter((s) => s.authorId === params.userId);
  const svgSignatures = originalCards.filter(
    (c) => c.autographDataUrl && isSvgDataUrl(c.autographDataUrl)
  ).length;
  return {
    cardsCount: originalCards.length,
    texturesCount: originalTextures.length,
    stickersCount: originalStickers.length,
    totalFiles:
      originalCards.length * 2 +
      svgSignatures +
      originalTextures.length +
      originalStickers.length,
  };
}

export async function exportOriginalVaultToFanCardStudio(params: {
  userId: string;
  cards: Photocard[];
  textures: CustomTexture[];
  stickers: CustomSticker[];
  folderName?: string;
  onProgress?: (info: { current: number; total: number; label: string }) => void;
}): Promise<VaultDriveExportSummary> {
  const folderName = params.folderName || FANCARD_STUDIO_FOLDER_NAME;
  const tasks = buildOriginalExportTasks(params);
  if (tasks.length === 0) {
    return { uploadedCount: 0, failedCount: 0, folderName, files: [] };
  }

  let token = await ensureDriveAccessToken();
  let folderId = await findOrCreateDriveFolder(token, folderName);

  const files: UploadedDriveFile[] = [];
  let failedCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    params.onProgress?.({ current: i + 1, total: tasks.length, label: task.label });
    try {
      const src = await task.getSource();
      const { blob, mimeType, ext } = await imageSourceToUploadBlob(src);
      const fileName = buildSafeDriveFileName(task.fileNameBase, ext);
      try {
        const uploaded = await uploadBlobWithToken({
          token,
          blob,
          mimeType,
          fileName,
          description: task.description,
          folderId,
        });
        files.push(uploaded);
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === 'AUTH_EXPIRED' || err.message === 'SCOPE_MISSING')
        ) {
          cachedAccessToken = null;
          notifyAuthListeners();
          const fresh = await signInWithGoogleDrive(err.message === 'SCOPE_MISSING');
          token = fresh.accessToken;
          folderId = await findOrCreateDriveFolder(token, folderName);
          const uploaded = await uploadBlobWithToken({
            token,
            blob,
            mimeType,
            fileName,
            description: task.description,
            folderId,
          });
          files.push(uploaded);
        } else {
          failedCount++;
        }
      }
    } catch {
      failedCount++;
    }
  }

  return {
    uploadedCount: files.length,
    failedCount,
    folderName,
    files,
  };
}

export async function syncSingleCreationToFanCardStudio(params: {
  userId: string;
  card?: Photocard;
  texture?: CustomTexture;
  sticker?: CustomSticker;
  folderName?: string;
}): Promise<{ uploaded: number; skippedNoAuth?: boolean }> {
  const token = cachedAccessToken;
  if (!token) {
    return { uploaded: 0, skippedNoAuth: true };
  }

  const folderName = params.folderName || FANCARD_STUDIO_FOLDER_NAME;
  const tasks = buildOriginalExportTasks({
    userId: params.userId,
    cards: params.card ? [params.card] : [],
    textures: params.texture ? [params.texture] : [],
    stickers: params.sticker ? [params.sticker] : [],
  });

  if (tasks.length === 0) return { uploaded: 0 };

  const folderId = await findOrCreateDriveFolder(token, folderName);
  let uploaded = 0;

  for (const task of tasks) {
    try {
      const src = await task.getSource();
      const { blob, mimeType, ext } = await imageSourceToUploadBlob(src);
      const fileName = buildSafeDriveFileName(task.fileNameBase, ext);
      await uploadBlobWithToken({
        token,
        blob,
        mimeType,
        fileName,
        description: task.description,
        folderId,
      });
      uploaded++;
    } catch {
      // ignore individual background sync failures cleanly
    }
  }

  return { uploaded };
}
