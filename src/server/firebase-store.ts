import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  FirebaseStorage
} from 'firebase/storage';
import fs from 'fs';
import path from 'path';

// Definitive Firebase configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCFKspoQvBoURlsp-WVywql8RooLd0-lR0',
  authDomain: 'fresh-shore-5q6d2.firebaseapp.com',
  projectId: 'fresh-shore-5q6d2',
  storageBucket: 'fresh-shore-5q6d2.firebasestorage.app',
  messagingSenderId: '31520475548',
  appId: '1:31520475548:web:76ee886169704893ebe059',
  firestoreDatabaseId: 'ai-studio-gmmanagementprop-36c98631-02a4-4db3-95b1-4b26c5d7f464'
};

let firestoreDb: Firestore | null = null;
let firebaseApp: FirebaseApp | null = null;
let storageInstance: FirebaseStorage | null = null;

function loadFirebaseConfig(): any {
  let config: any = DEFAULT_FIREBASE_CONFIG;
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      config = { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(raw) };
    } catch {
      // Fallback to DEFAULT_FIREBASE_CONFIG
    }
  }
  return config;
}

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const config = loadFirebaseConfig();
  firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
  return firebaseApp;
}

export function logOperation(
  type: 'READ' | 'WRITE' | 'DELETE',
  collectionName: string,
  docId: string,
  count: number,
  caller: string
) {
  console.log(
    `[Firestore ${type}] Collection: "${collectionName}" | Target: "${docId}" | Count: ${count} | Reason: [${caller}]`
  );
}

function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`[Firestore Timeout] Operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function getFirestoreInstance(): Firestore | null {
  if (firestoreDb) return firestoreDb;

  try {
    const config = loadFirebaseConfig();
    const app = getFirebaseApp();
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      firestoreDb = getFirestore(app, config.firestoreDatabaseId);
    } else {
      firestoreDb = getFirestore(app);
    }
    console.log(`[Firestore] Initialized Google Cloud Firestore: ${config.projectId}`);
    return firestoreDb;
  } catch (err) {
    console.error('[Firestore] Failed to initialize Firebase Firestore:', err);
    return null;
  }
}

// ------------------- Firebase Storage (for image uploads) -------------------

function getStorageInstance(): FirebaseStorage | null {
  if (storageInstance) return storageInstance;
  try {
    const app = getFirebaseApp();
    storageInstance = getStorage(app);
    return storageInstance;
  } catch (err) {
    console.error('[Storage] Failed to initialize Firebase Storage:', err);
    return null;
  }
}

/**
 * Uploads a base64 data-URI image to Firebase Storage and returns its public
 * download URL. Unlike writing to local disk, this survives server restarts,
 * redeploys, and moving hosts entirely - since the file lives in the Firebase
 * project's Cloud Storage bucket, not on whatever machine the server runs on.
 */
export async function uploadImageToStorage(dataUri: string, folder = 'uploads'): Promise<string | null> {
  if (!dataUri || typeof dataUri !== 'string') return null;
  const matches = dataUri.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches) return null;

  const storage = getStorageInstance();
  if (!storage) return null;

  try {
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${folder}/img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const storageRef = ref(storage, fileName);

    await withTimeout(
      uploadBytes(storageRef, buffer, { contentType: `image/${matches[1]}` }),
      15000
    );
    const url = await withTimeout(getDownloadURL(storageRef), 8000);
    logOperation('WRITE', 'storage', fileName, 1, 'image_upload');
    return url;
  } catch (err) {
    console.error('[Storage] Error uploading image to Firebase Storage:', err);
    return null;
  }
}

// 1. Properties - Single document query with clean URL arrays (zero N+1 subcollection reads)
export async function fetchPropertiesFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'properties')), 4000);
    if (snap.empty) {
      logOperation('READ', 'properties', 'all', 0, 'startup_sync');
      return [];
    }

    const list = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data };
    });

    logOperation('READ', 'properties', 'all', list.length, 'startup_sync');
    return list;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Free daily read quota limit reached for today. Retaining local memory cache.');
    } else {
      console.error('[Firestore] Error fetching properties:', err);
    }
    return [];
  }
}

export async function persistPropertyToFirestore(property: any, caller = 'property_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !property || !property.id) return;
  try {
    const cleanDoc = sanitizeForFirestore({
      ...property,
      updatedAt: new Date().toISOString()
    });
    await withTimeout(setDoc(doc(db, 'properties', property.id), cleanDoc), 5000);
    logOperation('WRITE', 'properties', property.id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error saving property ${property.id}:`, err);
  }
}

export async function removePropertyFromFirestore(id: string, caller = 'property_delete'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await deleteDoc(doc(db, 'properties', id));
    logOperation('DELETE', 'properties', id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error removing property ${id}:`, err);
  }
}

// 2. Blocked Slots
export async function fetchBlockedSlotsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'blockedSlots')), 4000);
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    logOperation('READ', 'blockedSlots', 'all', list.length, 'startup_sync');
    return list;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached when fetching blocked slots.');
    } else {
      console.error('[Firestore] Error fetching blocked slots:', err);
    }
    return [];
  }
}

export async function persistBlockedSlotToFirestore(slot: any, caller = 'block_slot_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !slot || !slot.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(slot);
    await withTimeout(setDoc(doc(db, 'blockedSlots', slot.id), cleanDoc), 5000);
    logOperation('WRITE', 'blockedSlots', slot.id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error saving blocked slot ${slot.id}:`, err);
  }
}

export async function removeBlockedSlotFromFirestore(id: string, caller = 'unblock_slot_delete'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await withTimeout(deleteDoc(doc(db, 'blockedSlots', id)), 5000);
    logOperation('DELETE', 'blockedSlots', id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error removing blocked slot ${id}:`, err);
  }
}

// 3. Reservations
export async function fetchReservationsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'reservations')), 4000);
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    logOperation('READ', 'reservations', 'all', list.length, 'startup_sync');
    return list;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached when fetching reservations.');
    } else {
      console.error('[Firestore] Error fetching reservations:', err);
    }
    return [];
  }
}

export async function persistReservationToFirestore(res: any, caller = 'reservation_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !res || !res.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(res);
    await withTimeout(setDoc(doc(db, 'reservations', res.id), cleanDoc), 5000);
    logOperation('WRITE', 'reservations', res.id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error saving reservation ${res.id}:`, err);
  }
}

export async function removeReservationFromFirestore(id: string, caller = 'reservation_delete'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await withTimeout(deleteDoc(doc(db, 'reservations', id)), 5000);
    logOperation('DELETE', 'reservations', id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error removing reservation ${id}:`, err);
  }
}

// 4. Settings - Targeted single document read (doc: settings/config) instead of full collection query
export async function fetchSettingsFromFirestore(): Promise<any | null> {
  const db = getFirestoreInstance();
  if (!db) return null;
  try {
    const snap = await withTimeout(getDoc(doc(db, 'settings', 'config')), 3000);
    if (snap.exists()) {
      logOperation('READ', 'settings', 'config', 1, 'startup_sync');
      return snap.data();
    }
    logOperation('READ', 'settings', 'config', 0, 'startup_sync');
    return null;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached when fetching settings.');
    } else {
      console.error('[Firestore] Error fetching settings:', err);
    }
    return null;
  }
}

export async function persistSettingsToFirestore(settings: any, caller = 'settings_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) return;
  try {
    const cleanDoc = sanitizeForFirestore(settings);
    await withTimeout(setDoc(doc(db, 'settings', 'config'), cleanDoc), 5000);
    logOperation('WRITE', 'settings', 'config', 1, caller);
  } catch (err) {
    console.error('[Firestore] Error saving settings to Firestore:', err);
  }
}

// 5. Notifications
export async function fetchNotificationsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'notifications')), 4000);
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    logOperation('READ', 'notifications', 'all', list.length, 'startup_sync');
    return list;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached when fetching notifications.');
    } else {
      console.error('[Firestore] Error fetching notifications:', err);
    }
    return [];
  }
}

export async function persistNotificationToFirestore(notif: any, caller = 'notification_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !notif || !notif.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(notif);
    await withTimeout(setDoc(doc(db, 'notifications', notif.id), cleanDoc), 5000);
    logOperation('WRITE', 'notifications', notif.id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error saving notification ${notif.id}:`, err);
  }
}

// 6. Folders & Groupings
export async function fetchFoldersFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'folders')), 4000);
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    logOperation('READ', 'folders', 'all', list.length, 'startup_sync');
    return list;
  } catch (err: any) {
    console.error('[Firestore] Error fetching folders:', err);
    return [];
  }
}

export async function persistFolderToFirestore(folder: any, caller = 'folder_save'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !folder || !folder.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(folder);
    await withTimeout(setDoc(doc(db, 'folders', folder.id), cleanDoc), 5000);
    logOperation('WRITE', 'folders', folder.id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error saving folder ${folder.id}:`, err);
  }
}

export async function removeFolderFromFirestore(id: string, caller = 'folder_delete'): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await withTimeout(deleteDoc(doc(db, 'folders', id)), 5000);
    logOperation('DELETE', 'folders', id, 1, caller);
  } catch (err) {
    console.error(`[Firestore] Error removing folder ${id}:`, err);
  }
}


