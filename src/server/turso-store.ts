import { createClient as createWebClient, type Client } from '@libsql/client/web';

/**
 * Turso (libSQL / SQLite) data store - a free, always-on replacement for the
 * Firestore store in firebase-store.ts.
 *
 * Everything lives in ONE small table, so adding a new kind of record never
 * needs a schema change:
 *
 *   records(collection, id, data JSON, updated_at)   PRIMARY KEY (collection, id)
 *
 * Collections: properties, blockedSlots, reservations, notifications, folders,
 * and settings (a single row, id = "config"). A property's FULL photo gallery
 * is kept inside its own row, so no extra photo reads are ever needed.
 *
 * Differences from the Firestore store that matter:
 *  - fetch*() THROWS when the database can't be reached instead of returning
 *    []. The caller must treat "can't read" and "really empty" differently,
 *    otherwise a temporary outage looks like "all your data is gone".
 *  - writes are retried, and every in-flight write is tracked so the server can
 *    wait for them before answering (serverless hosts freeze right after the
 *    response is sent, which would silently drop a fire-and-forget write).
 *
 * Configuration (environment variables):
 *   TURSO_DATABASE_URL  libsql://your-db.turso.io   (or file:/path/x.db for tests)
 *   TURSO_AUTH_TOKEN    token from the Turso dashboard (not needed for file:)
 */

export const COLLECTIONS = ['properties', 'blockedSlots', 'reservations', 'notifications', 'folders'] as const;
export type CollectionName = (typeof COLLECTIONS)[number] | 'settings';

let clientPromise: Promise<Client> | null = null;
const pending = new Set<Promise<unknown>>();

export function isTursoConfigured(): boolean {
  return !!process.env.TURSO_DATABASE_URL;
}

async function openClient(): Promise<Client> {
  const url = (process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim() || undefined;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set');

  let client: Client;
  if (url.startsWith('file:')) {
    // Local file database (tests / local dev). Needs the native build, so it is
    // loaded on demand and never bundled for the serverless deployment.
    const specifier = '@libsql/client';
    const mod: any = await import(specifier);
    client = mod.createClient({ url });
  } else {
    // The web build talks plain HTTPS - works on Vercel with no native code.
    client = createWebClient({ url: url.replace(/^libsql:\/\//, 'https://'), authToken });
  }

  await client.execute(
    `CREATE TABLE IF NOT EXISTS records (
       collection TEXT NOT NULL,
       id         TEXT NOT NULL,
       data       TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       PRIMARY KEY (collection, id)
     )`
  );
  return client;
}

export function getTursoClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = openClient().catch((err) => {
      clientPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return clientPromise;
}

export function logOperation(type: 'READ' | 'WRITE' | 'DELETE', collectionName: string, docId: string, count: number, caller: string) {
  console.log(`[Turso ${type}] Collection: "${collectionName}" | Target: "${docId}" | Count: ${count} | Reason: [${caller}]`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

function track<T>(p: Promise<T>): Promise<T> {
  pending.add(p);
  const done = () => pending.delete(p);
  p.then(done, done);
  return p;
}

/** Resolves once every write that is currently in flight has finished. */
export async function flushPending(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}

// ------------------------- generic row helpers -------------------------

async function readCollection(collection: CollectionName, caller: string): Promise<any[]> {
  const c = await getTursoClient();
  const rs = await withRetry(() => c.execute({ sql: 'SELECT id, data FROM records WHERE collection = ? ORDER BY id', args: [collection] }));
  const list = rs.rows.map((row) => ({ ...JSON.parse(String(row.data)), id: String(row.id) }));
  logOperation('READ', collection, 'all', list.length, caller);
  return list;
}

async function writeRow(collection: CollectionName, id: string, doc: any, caller: string): Promise<void> {
  const data = JSON.stringify(doc);
  await track(
    (async () => {
      try {
        const c = await getTursoClient();
        await withRetry(() =>
          c.execute({
            sql: `INSERT INTO records (collection, id, data, updated_at) VALUES (?, ?, ?, ?)
                  ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
            args: [collection, id, data, new Date().toISOString()]
          })
        );
        logOperation('WRITE', collection, id, 1, caller);
      } catch (err) {
        console.error(`[Turso] FAILED to save ${collection}/${id} after retries:`, err);
      }
    })()
  );
}

async function deleteRow(collection: CollectionName, id: string, caller: string): Promise<void> {
  await track(
    (async () => {
      try {
        const c = await getTursoClient();
        await withRetry(() => c.execute({ sql: 'DELETE FROM records WHERE collection = ? AND id = ?', args: [collection, id] }));
        logOperation('DELETE', collection, id, 1, caller);
      } catch (err) {
        console.error(`[Turso] FAILED to delete ${collection}/${id} after retries:`, err);
      }
    })()
  );
}

// ------------------------------ public API ------------------------------

export const fetchProperties = () => readCollection('properties', 'sync');
export const fetchBlockedSlots = () => readCollection('blockedSlots', 'sync');
export const fetchReservations = () => readCollection('reservations', 'sync');
export const fetchNotifications = () => readCollection('notifications', 'sync');
export const fetchFolders = () => readCollection('folders', 'sync');

export async function fetchSettings(): Promise<any | null> {
  const c = await getTursoClient();
  const rs = await withRetry(() => c.execute({ sql: "SELECT data FROM records WHERE collection = 'settings' AND id = 'config'", args: [] }));
  logOperation('READ', 'settings', 'config', rs.rows.length, 'sync');
  return rs.rows.length ? JSON.parse(String(rs.rows[0].data)) : null;
}

/**
 * The full photo gallery already lives inside each property (and so inside the
 * server's in-memory copy), so there is nothing extra to fetch. Returning null
 * makes the route fall back to that copy - zero database reads per page view.
 */
export async function fetchPropertyPhotos(_propertyId: string): Promise<string[] | null> {
  return null;
}

export const persistProperty = (property: any, caller = 'property_save') =>
  property?.id ? writeRow('properties', property.id, { ...property, updatedAt: new Date().toISOString() }, caller) : Promise.resolve();
export const removeProperty = (id: string, caller = 'property_delete') => (id ? deleteRow('properties', id, caller) : Promise.resolve());

export const persistBlockedSlot = (slot: any, caller = 'block_slot_save') => (slot?.id ? writeRow('blockedSlots', slot.id, slot, caller) : Promise.resolve());
export const removeBlockedSlot = (id: string, caller = 'unblock_slot_delete') => (id ? deleteRow('blockedSlots', id, caller) : Promise.resolve());

export const persistReservation = (res: any, caller = 'reservation_save') => (res?.id ? writeRow('reservations', res.id, res, caller) : Promise.resolve());
export const removeReservation = (id: string, caller = 'reservation_delete') => (id ? deleteRow('reservations', id, caller) : Promise.resolve());

export const persistSettings = (settings: any, caller = 'settings_save') => (settings ? writeRow('settings', 'config', settings, caller) : Promise.resolve());

export const persistNotification = (notif: any, caller = 'notification_save') => (notif?.id ? writeRow('notifications', notif.id, notif, caller) : Promise.resolve());

export const persistFolder = (folder: any, caller = 'folder_save') => (folder?.id ? writeRow('folders', folder.id, folder, caller) : Promise.resolve());
export const removeFolder = (id: string, caller = 'folder_delete') => (id ? deleteRow('folders', id, caller) : Promise.resolve());

// ------------------------- migration helpers -------------------------

export async function countRecords(): Promise<Record<string, number>> {
  const c = await getTursoClient();
  const rs = await c.execute('SELECT collection, COUNT(*) AS n FROM records GROUP BY collection');
  const out: Record<string, number> = {};
  for (const row of rs.rows) out[String(row.collection)] = Number(row.n);
  return out;
}

/** Bulk upsert used by the one-time Firebase -> Turso copy. Throws on failure. */
export async function bulkUpsert(rows: Array<{ collection: CollectionName; id: string; doc: any }>): Promise<void> {
  const c = await getTursoClient();
  const now = new Date().toISOString();
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await withRetry(() =>
      c.batch(
        slice.map((r) => ({
          sql: `INSERT INTO records (collection, id, data, updated_at) VALUES (?, ?, ?, ?)
                ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          args: [r.collection, r.id, JSON.stringify(r.doc), now]
        })),
        'write'
      )
    );
  }
}
