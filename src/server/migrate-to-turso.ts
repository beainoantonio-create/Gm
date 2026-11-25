import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase-store.js';
import { bulkUpsert, countRecords, isTursoConfigured, type CollectionName } from './turso-store.js';

/**
 * One-time copy of everything in Firebase Firestore into Turso.
 *
 *  - dryRun: only counts what is in Firebase and what is already in Turso.
 *  - run:    copies it. Refuses if Turso already holds data unless force=true
 *            (so a re-run can never overwrite newer data by accident).
 *
 * Reads Firestore directly and THROWS on any problem (e.g. daily quota hit), so
 * a failed read is never mistaken for "no data" and half-copied silently.
 */
/** Where the data is read from. The default reads Firebase; tests plug in a fake. */
export interface MigrationSource {
  list(collectionName: string): Promise<Array<{ id: string; data: any }>>;
  photos(propertyId: string): Promise<Array<{ index?: number; url?: string }>>;
  settings(): Promise<any | null>;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => {
    t = setTimeout(() => rej(new Error(`Timed out after ${ms / 1000}s while reading ${what} from Firebase (it may be blocked by the daily limit).`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

function firebaseSource(): MigrationSource {
  const db: any = getFirestoreInstance();
  if (!db) throw new Error('Could not initialise Firebase.');
  return {
    async list(name) {
      const snap = await withTimeout(getDocs(collection(db, name)), 20000, name);
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async photos(id) {
      const snap = await withTimeout(getDocs(collection(db, 'properties', id, 'photos')), 20000, `photos of ${id}`);
      return snap.docs.map((d) => d.data() as any);
    },
    async settings() {
      const snap = await withTimeout(getDoc(doc(db, 'settings', 'config')), 20000, 'settings');
      return snap.exists() ? snap.data() : null;
    }
  };
}

const TOP_LEVEL = ['properties', 'blockedSlots', 'reservations', 'notifications', 'folders'] as const;

export interface MigrationReport {
  mode: 'dry-run' | 'copied' | 'skipped';
  message: string;
  firebase: Record<string, number>;
  tursoBefore: Record<string, number>;
  copied?: Record<string, number>;
}

export async function migrateFirestoreToTurso(
  opts: { run: boolean; force: boolean },
  source?: MigrationSource
): Promise<MigrationReport> {
  if (!isTursoConfigured()) throw new Error('TURSO_DATABASE_URL is not set on the server.');
  const src = source || firebaseSource();

  const tursoBefore = await countRecords();
  const tursoTotal = Object.values(tursoBefore).reduce((a, b) => a + b, 0);

  const firebase: Record<string, number> = {};
  const rows: Array<{ collection: CollectionName; id: string; doc: any }> = [];

  for (const name of TOP_LEVEL) {
    const docs = await src.list(name);
    firebase[name] = docs.length;
    if (!opts.run) continue;

    if (name === 'properties') {
      const built = await Promise.all(
        docs.map(async (d) => {
          const data: any = { ...d.data, id: d.id };
          // Older saves kept only the cover photo in the main doc and the full gallery in a
          // "photos" subcollection. Rebuild the complete gallery so nothing is lost.
          const photos = (await src.photos(d.id))
            .filter((p) => p && p.url)
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((p) => p.url as string);
          const existing: string[] = Array.isArray(data.images) ? data.images : [];
          if (photos.length > existing.length) data.images = photos;
          return { collection: name as CollectionName, id: d.id, doc: data };
        })
      );
      rows.push(...built);
    } else {
      for (const d of docs) rows.push({ collection: name, id: d.id, doc: { ...d.data, id: d.id } });
    }
  }

  const settingsDoc = await src.settings();
  firebase.settings = settingsDoc ? 1 : 0;
  if (opts.run && settingsDoc) rows.push({ collection: 'settings', id: 'config', doc: settingsDoc });

  if (!opts.run) {
    return { mode: 'dry-run', message: 'Nothing was copied. Add &run=1 to the address to copy the data.', firebase, tursoBefore };
  }

  if (tursoTotal > 0 && !opts.force) {
    return {
      mode: 'skipped',
      message: 'Turso already contains data, so nothing was copied (to protect newer data). Add &force=1 to overwrite it with Firebase data.',
      firebase,
      tursoBefore
    };
  }

  const firebaseTotal = Object.values(firebase).reduce((a, b) => a + b, 0);
  if (firebaseTotal === 0) {
    throw new Error('Firebase returned no data at all - refusing to copy an empty database.');
  }

  await bulkUpsert(rows);
  const copied: Record<string, number> = {};
  for (const r of rows) copied[r.collection] = (copied[r.collection] || 0) + 1;
  return {
    mode: 'copied',
    message: 'Done. Your data is now in Turso. Next: set DB_PROVIDER=turso in Vercel and redeploy.',
    firebase,
    tursoBefore,
    copied
  };
}
