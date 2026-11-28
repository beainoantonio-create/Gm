/**
 * Picks the database the server talks to.
 *
 *   DB_PROVIDER=turso   -> Turso (free libSQL/SQLite)   see turso-store.ts
 *   anything else       -> Firebase Firestore (the original behaviour)
 *
 * The export names below are the original Firestore-era names, kept on purpose
 * so none of the routes in server.ts had to change.
 *
 * The Turso code (and its database client) is only loaded when Turso is actually
 * switched on, so a problem there can never affect a site running on Firebase.
 */
import * as fb from './firebase-store.js';
import type * as TursoStore from './turso-store.js';

export const STORE_PROVIDER: 'turso' | 'firebase' = (process.env.DB_PROVIDER || '').toLowerCase() === 'turso' ? 'turso' : 'firebase';
const useTurso = STORE_PROVIDER === 'turso';

/** Turso reports failures by throwing, so an empty list always means "really empty". */
export const STORE_IS_AUTHORITATIVE = useTurso;

let tursoModule: Promise<typeof TursoStore> | null = null;
const turso = () => (tursoModule ??= import('./turso-store.js'));

export const fetchPropertiesFromFirestore = (): Promise<any[]> =>
  useTurso ? turso().then((t) => t.fetchProperties()) : fb.fetchPropertiesFromFirestore();
export const fetchPropertyPhotosFromFirestore = (id: string): Promise<string[] | null> =>
  useTurso ? turso().then((t) => t.fetchPropertyPhotos(id)) : fb.fetchPropertyPhotosFromFirestore(id);
export const persistPropertyToFirestore = (p: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistProperty(p, caller)) : fb.persistPropertyToFirestore(p, caller);
export const removePropertyFromFirestore = (id: string, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.removeProperty(id, caller)) : fb.removePropertyFromFirestore(id, caller);

export const fetchBlockedSlotsFromFirestore = (): Promise<any[]> =>
  useTurso ? turso().then((t) => t.fetchBlockedSlots()) : fb.fetchBlockedSlotsFromFirestore();
export const persistBlockedSlotToFirestore = (s: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistBlockedSlot(s, caller)) : fb.persistBlockedSlotToFirestore(s, caller);
export const removeBlockedSlotFromFirestore = (id: string, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.removeBlockedSlot(id, caller)) : fb.removeBlockedSlotFromFirestore(id, caller);

export const fetchReservationsFromFirestore = (): Promise<any[]> =>
  useTurso ? turso().then((t) => t.fetchReservations()) : fb.fetchReservationsFromFirestore();
export const persistReservationToFirestore = (r: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistReservation(r, caller)) : fb.persistReservationToFirestore(r, caller);
export const removeReservationFromFirestore = (id: string, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.removeReservation(id, caller)) : fb.removeReservationFromFirestore(id, caller);

export const fetchSettingsFromFirestore = (): Promise<any | null> =>
  useTurso ? turso().then((t) => t.fetchSettings()) : fb.fetchSettingsFromFirestore();
export const persistSettingsToFirestore = (s: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistSettings(s, caller)) : fb.persistSettingsToFirestore(s, caller);

export const fetchNotificationsFromFirestore = (): Promise<any[]> =>
  useTurso ? turso().then((t) => t.fetchNotifications()) : fb.fetchNotificationsFromFirestore();
export const persistNotificationToFirestore = (n: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistNotification(n, caller)) : fb.persistNotificationToFirestore(n, caller);

export const fetchFoldersFromFirestore = (): Promise<any[]> =>
  useTurso ? turso().then((t) => t.fetchFolders()) : fb.fetchFoldersFromFirestore();
export const persistFolderToFirestore = (f: any, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.persistFolder(f, caller)) : fb.persistFolderToFirestore(f, caller);
export const removeFolderFromFirestore = (id: string, caller?: string): Promise<void> =>
  useTurso ? turso().then((t) => t.removeFolder(id, caller)) : fb.removeFolderFromFirestore(id, caller);

/** Truthy when a cloud database is available to sync with (otherwise: local-only mode). */
export function getFirestoreInstance(): unknown | null {
  return useTurso ? (process.env.TURSO_DATABASE_URL ? true : null) : fb.getFirestoreInstance();
}

/** Waits for in-flight writes (no-op for Firebase, which behaves as before). */
export async function flushPendingWrites(): Promise<void> {
  if (useTurso) await (await turso()).flushPending();
}
