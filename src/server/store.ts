/**
 * Picks the database the server talks to.
 *
 *   DB_PROVIDER=turso   -> Turso (free libSQL/SQLite)   see turso-store.ts
 *   anything else       -> Firebase Firestore (the original behaviour)
 *
 * The export names below are the original Firestore-era names, kept on purpose
 * so none of the routes in server.ts had to change.
 */
import * as fb from './firebase-store.js';
import * as turso from './turso-store.js';

export const STORE_PROVIDER: 'turso' | 'firebase' = (process.env.DB_PROVIDER || '').toLowerCase() === 'turso' ? 'turso' : 'firebase';
const useTurso = STORE_PROVIDER === 'turso';

/** Turso reports failures by throwing, so an empty list always means "really empty". */
export const STORE_IS_AUTHORITATIVE = useTurso;

export const fetchPropertiesFromFirestore: () => Promise<any[]> = useTurso ? turso.fetchProperties : fb.fetchPropertiesFromFirestore;
export const fetchPropertyPhotosFromFirestore: (id: string) => Promise<string[] | null> = useTurso ? turso.fetchPropertyPhotos : fb.fetchPropertyPhotosFromFirestore;
export const persistPropertyToFirestore: (p: any, caller?: string) => Promise<void> = useTurso ? turso.persistProperty : fb.persistPropertyToFirestore;
export const removePropertyFromFirestore: (id: string, caller?: string) => Promise<void> = useTurso ? turso.removeProperty : fb.removePropertyFromFirestore;
export const fetchBlockedSlotsFromFirestore: () => Promise<any[]> = useTurso ? turso.fetchBlockedSlots : fb.fetchBlockedSlotsFromFirestore;
export const persistBlockedSlotToFirestore: (s: any, caller?: string) => Promise<void> = useTurso ? turso.persistBlockedSlot : fb.persistBlockedSlotToFirestore;
export const removeBlockedSlotFromFirestore: (id: string, caller?: string) => Promise<void> = useTurso ? turso.removeBlockedSlot : fb.removeBlockedSlotFromFirestore;
export const fetchReservationsFromFirestore: () => Promise<any[]> = useTurso ? turso.fetchReservations : fb.fetchReservationsFromFirestore;
export const persistReservationToFirestore: (r: any, caller?: string) => Promise<void> = useTurso ? turso.persistReservation : fb.persistReservationToFirestore;
export const removeReservationFromFirestore: (id: string, caller?: string) => Promise<void> = useTurso ? turso.removeReservation : fb.removeReservationFromFirestore;
export const fetchSettingsFromFirestore: () => Promise<any | null> = useTurso ? turso.fetchSettings : fb.fetchSettingsFromFirestore;
export const persistSettingsToFirestore: (s: any, caller?: string) => Promise<void> = useTurso ? turso.persistSettings : fb.persistSettingsToFirestore;
export const fetchNotificationsFromFirestore: () => Promise<any[]> = useTurso ? turso.fetchNotifications : fb.fetchNotificationsFromFirestore;
export const persistNotificationToFirestore: (n: any, caller?: string) => Promise<void> = useTurso ? turso.persistNotification : fb.persistNotificationToFirestore;
export const fetchFoldersFromFirestore: () => Promise<any[]> = useTurso ? turso.fetchFolders : fb.fetchFoldersFromFirestore;
export const persistFolderToFirestore: (f: any, caller?: string) => Promise<void> = useTurso ? turso.persistFolder : fb.persistFolderToFirestore;
export const removeFolderFromFirestore: (id: string, caller?: string) => Promise<void> = useTurso ? turso.removeFolder : fb.removeFolderFromFirestore;

/** Truthy when a cloud database is available to sync with (otherwise: local-only mode). */
export function getFirestoreInstance(): unknown | null {
  return useTurso ? (turso.isTursoConfigured() ? true : null) : fb.getFirestoreInstance();
}

/** Waits for in-flight writes (no-op for Firebase, which behaves as before). */
export async function flushPendingWrites(): Promise<void> {
  if (useTurso) await turso.flushPending();
}
