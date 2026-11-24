import type { BootstrapPayload, Photocard } from '../types/kromacard';

export interface OfflineFavoriteCard extends Photocard {
  savedOfflineAt: string;
}

const DB_NAME = 'kromacard-offline-db';
const DB_VERSION = 1;
const STORE_FAVORITES = 'favorites';
const STORE_SNAPSHOTS = 'snapshots';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB.'));
  });
}

async function inlinePhotoForOffline(photoUrl: string): Promise<string> {
  if (!photoUrl || photoUrl.startsWith('data:')) {
    return photoUrl;
  }
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return photoUrl;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : photoUrl);
      };
      reader.onerror = () => resolve(photoUrl);
      reader.readAsDataURL(blob);
    });
  } catch {
    return photoUrl;
  }
}

export async function getAllFavorites(): Promise<OfflineFavoriteCard[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAVORITES, 'readonly');
      const store = tx.objectStore(STORE_FAVORITES);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as OfflineFavoriteCard[]) || [];
        list.sort((a, b) => (b.savedOfflineAt || '').localeCompare(a.savedOfflineAt || ''));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveFavoriteCard(card: Photocard): Promise<OfflineFavoriteCard> {
  const cachedPhoto = await inlinePhotoForOffline(card.photoUrl);
  const record: OfflineFavoriteCard = {
    ...card,
    photoUrl: cachedPhoto,
    savedOfflineAt: new Date().toISOString(),
  };

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return record;
}

export async function removeFavoriteCard(cardId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    tx.objectStore(STORE_FAVORITES).delete(cardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveBootstrapSnapshot(payload: BootstrapPayload): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      tx.objectStore(STORE_SNAPSHOTS).put({
        key: 'bootstrap',
        payload,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota or private mode issues gracefully
  }
}

export async function loadBootstrapSnapshot(): Promise<BootstrapPayload | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const req = tx.objectStore(STORE_SNAPSHOTS).get('bootstrap');
      req.onsuccess = () => {
        const res = req.result as { payload?: BootstrapPayload } | undefined;
        resolve(res?.payload || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
