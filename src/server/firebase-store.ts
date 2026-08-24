import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Fallback configuration ensuring zero downtime across builds
const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'fresh-shore-5q6d2',
  appId: '1:31520475548:web:76ee886169704893ebe059',
  apiKey: 'AIzaSyCFKspoQvBoURlsp-WVywql8RooLd0-lR0',
  authDomain: 'fresh-shore-5q6d2.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-gmmanagementprop-36c98631-02a4-4db3-95b1-4b26c5d7f464',
  storageBucket: 'fresh-shore-5q6d2.firebasestorage.app',
  messagingSenderId: '31520475548'
};

let firestoreDb: Firestore | null = null;

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
    let config = DEFAULT_FIREBASE_CONFIG;
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        config = { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(raw) };
      } catch {
        // Fallback to DEFAULT_FIREBASE_CONFIG
      }
    }

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const databaseId = config.firestoreDatabaseId || 'ai-studio-gmmanagementprop-36c98631-02a4-4db3-95b1-4b26c5d7f464';
    firestoreDb = getFirestore(app, databaseId);
    console.log(`[Firestore] Initialized Google Cloud Firestore: ${databaseId}`);
    return firestoreDb;
  } catch (err) {
    console.error('[Firestore] Failed to initialize Firebase Firestore:', err);
    return null;
  }
}

// 1. Properties
export async function fetchPropertiesFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await withTimeout(getDocs(collection(db, 'properties')), 3000);
    if (snap.empty) return [];

    const list = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const propItem: Record<string, any> = { id: d.id, ...data };

        // Fetch photos from subcollection only if images array is empty
        if (!propItem.images || propItem.images.length === 0) {
          try {
            const photoSnap = await withTimeout(getDocs(collection(db, 'properties', d.id, 'photos')), 1500);
            if (!photoSnap.empty) {
              const photos: Array<{ index: number; url: string }> = [];
              photoSnap.forEach((pDoc) => {
                const pData = pDoc.data();
                if (pData && pData.url) {
                  photos.push({ index: pData.index ?? 0, url: pData.url });
                }
              });
              photos.sort((a, b) => a.index - b.index);
              if (photos.length > 0) {
                propItem.images = photos.map((p) => p.url);
              }
            }
          } catch {}
        }

        return propItem;
      })
    );

    return list;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Free daily read quota limit reached for today. Retaining cached properties.');
    } else {
      console.error('[Firestore] Error fetching properties:', err);
    }
    return [];
  }
}

export async function persistPropertyToFirestore(property: any): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !property || !property.id) return;
  try {
    const allImages: string[] = Array.isArray(property.images) ? property.images : [];
    
    // Store lightweight property document without massive base64 payload to prevent 1MB limit crash
    const mainDocData = {
      ...property,
      imagesCount: allImages.length,
      // Keep only first photo as quick thumbnail in main doc if needed, or leave empty
      coverImage: allImages[0] || '',
      images: allImages.length <= 1 ? allImages : [allImages[0]],
    };
    
    const cleanDoc = sanitizeForFirestore(mainDocData);
    await withTimeout(setDoc(doc(db, 'properties', property.id), cleanDoc));

    // Save individual photos in subcollection in parallel
    if (allImages.length > 0) {
      await withTimeout(
        Promise.all(
          allImages.map((imgUrl, i) =>
            setDoc(doc(db, 'properties', property.id, 'photos', `p_${i}`), {
              index: i,
              url: imgUrl,
              updatedAt: new Date().toISOString(),
            })
          )
        ),
        5000
      );

      // If previous photos existed beyond the new length, remove excess asynchronously
      withTimeout(getDocs(collection(db, 'properties', property.id, 'photos')), 3000)
        .then((existingPhotosSnap) => {
          existingPhotosSnap.docs.forEach((pDoc) => {
            const idx = parseInt(pDoc.id.replace('p_', ''), 10);
            if (!isNaN(idx) && idx >= allImages.length) {
              deleteDoc(doc(db, 'properties', property.id, 'photos', pDoc.id)).catch(() => {});
            }
          });
        })
        .catch(() => {});
    }

    console.log(`[Firestore] Successfully persisted property & ${allImages.length} photos to Cloud Firestore: ${property.title || property.id}`);
  } catch (err) {
    console.error(`[Firestore] Error saving property ${property.id}:`, err);
  }
}

export async function removePropertyFromFirestore(id: string): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    // Delete subcollection photos
    try {
      const photosSnap = await getDocs(collection(db, 'properties', id, 'photos'));
      for (const pDoc of photosSnap.docs) {
        await deleteDoc(doc(db, 'properties', id, 'photos', pDoc.id));
      }
    } catch {}

    await deleteDoc(doc(db, 'properties', id));
    console.log(`[Firestore] Successfully removed property from Cloud Firestore: ${id}`);
  } catch (err) {
    console.error(`[Firestore] Error removing property ${id}:`, err);
  }
}

// 2. Blocked Slots
export async function fetchBlockedSlotsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'blockedSlots'));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err) {
    console.error('[Firestore] Error fetching blocked slots:', err);
    return [];
  }
}

export async function persistBlockedSlotToFirestore(slot: any): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !slot || !slot.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(slot);
    await setDoc(doc(db, 'blockedSlots', slot.id), cleanDoc);
  } catch (err) {
    console.error(`[Firestore] Error saving blocked slot ${slot.id}:`, err);
  }
}

export async function removeBlockedSlotFromFirestore(id: string): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await deleteDoc(doc(db, 'blockedSlots', id));
  } catch (err) {
    console.error(`[Firestore] Error removing blocked slot ${id}:`, err);
  }
}

// 3. Reservations
export async function fetchReservationsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'reservations'));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err) {
    console.error('[Firestore] Error fetching reservations:', err);
    return [];
  }
}

export async function persistReservationToFirestore(res: any): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !res || !res.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(res);
    await setDoc(doc(db, 'reservations', res.id), cleanDoc);
  } catch (err) {
    console.error(`[Firestore] Error saving reservation ${res.id}:`, err);
  }
}

export async function removeReservationFromFirestore(id: string): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !id) return;
  try {
    await deleteDoc(doc(db, 'reservations', id));
  } catch (err) {
    console.error(`[Firestore] Error removing reservation ${id}:`, err);
  }
}

// 4. Settings
export async function fetchSettingsFromFirestore(): Promise<any | null> {
  const db = getFirestoreInstance();
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'settings'));
    let settings = null;
    snap.forEach((d) => {
      if (d.id === 'config') settings = d.data();
    });
    return settings;
  } catch (err) {
    console.error('[Firestore] Error fetching settings:', err);
    return null;
  }
}

export async function persistSettingsToFirestore(settings: any): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) return;
  try {
    const cleanDoc = sanitizeForFirestore(settings);
    await setDoc(doc(db, 'settings', 'config'), cleanDoc);
  } catch (err) {
    console.error('[Firestore] Error saving settings to Firestore:', err);
  }
}

// 5. Notifications
export async function fetchNotificationsFromFirestore(): Promise<any[]> {
  const db = getFirestoreInstance();
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'notifications'));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err) {
    console.error('[Firestore] Error fetching notifications:', err);
    return [];
  }
}

export async function persistNotificationToFirestore(notif: any): Promise<void> {
  const db = getFirestoreInstance();
  if (!db || !notif || !notif.id) return;
  try {
    const cleanDoc = sanitizeForFirestore(notif);
    await setDoc(doc(db, 'notifications', notif.id), cleanDoc);
  } catch (err) {
    console.error(`[Firestore] Error saving notification ${notif.id}:`, err);
  }
}
