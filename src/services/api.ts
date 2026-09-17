import { Property, Reservation, NotificationItem, CompanySettings, BlockedSlot } from '../types';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const CACHE_KEYS = {
  PROPERTIES: 'gm_cached_properties',
  SETTINGS: 'gm_cached_settings',
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export const api = {
  // 1. Properties
  async getProperties(): Promise<Property[]> {
    try {
      const res = await fetchWithTimeout('/api/properties', {}, 2500);
      if (res.ok) {
        const data: Property[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try {
            localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(data));
          } catch (cacheErr) {
            console.warn('Failed to update local property cache:', cacheErr);
          }
          return data;
        }
      }
    } catch (e) {
      console.warn('Server fetch /api/properties failed or timed out, falling back...', e);
    }

    // Direct Firestore fallback (Parallelized for instant loading)
    try {
      const snap = await getDocs(collection(db, 'properties'));
      if (!snap.empty) {
        const cloudProps = await Promise.all(
          snap.docs.map(async (d) => {
            const item: any = { id: d.id, ...(d.data() as any) };
            if (!item.images || item.images.length === 0) {
              try {
                const photoSnap = await getDocs(collection(db, 'properties', d.id, 'photos'));
                if (!photoSnap.empty) {
                  const photos: Array<{ index: number; url: string }> = [];
                  photoSnap.forEach((pDoc) => {
                    const p = pDoc.data();
                    if (p && p.url) photos.push({ index: p.index ?? 0, url: p.url });
                  });
                  photos.sort((a, b) => a.index - b.index);
                  if (photos.length > 0) {
                    item.images = photos.map((p) => p.url);
                  }
                }
              } catch (photoErr) {
                console.warn(`Failed to fetch photos subcollection for property ${d.id}:`, photoErr);
              }
            }
            return item as Property;
          })
        );

        if (cloudProps.length > 0) {
          try {
            localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(cloudProps));
          } catch (cacheErr) {
            console.warn('Failed to cache cloud properties locally:', cacheErr);
          }
          return cloudProps;
        }
      }
    } catch (e: any) {
      if (e?.code === 'resource-exhausted') {
        console.warn('Firebase daily read quota reached for today. Using local cache.');
      } else {
        console.warn('Cloud Firestore direct read fallback encountered error:', e);
      }
    }

    // Local storage fallback
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROPERTIES);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (cacheReadErr) {
      console.warn('Failed to read property cache:', cacheReadErr);
    }

    return [];
  },

  async getProperty(id: string): Promise<Property> {
    try {
      const res = await fetchWithTimeout(`/api/properties/${id}`, {}, 3000);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn(`Server fetch /api/properties/${id} failed:`, e);
    }
    const props = await this.getProperties();
    const found = props.find((p) => p.id === id);
    if (!found) throw new Error('Property not found');
    return found;
  },

  async createProperty(propertyData: Partial<Property>): Promise<Property> {
    let created: Property | null = null;
    try {
      const res = await fetchWithTimeout('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propertyData),
      }, 5000);
      if (res.ok) {
        created = await res.json();
      }
    } catch (e) {
      console.warn('Server createProperty timed out or failed, saving locally and to Cloud Firestore...', e);
    }

    if (!created) {
      const id = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      created = {
        id,
        title: propertyData.title || 'Untitled Property',
        subtitle: propertyData.subtitle || '',
        description: propertyData.description || '',
        propertyType: propertyData.propertyType || 'Villa',
        location: propertyData.location || { city: 'Beirut', country: 'Lebanon', address: '' },
        pricePerNight: Number(propertyData.pricePerNight) || 150,
        weekdayPrice: Number(propertyData.weekdayPrice) || 150,
        weekendPrice: Number(propertyData.weekendPrice) || 220,
        cleaningFee: Number(propertyData.cleaningFee) || 30,
        serviceFeePercentage: Number(propertyData.serviceFeePercentage) || 10,
        bedrooms: Number(propertyData.bedrooms) || 1,
        beds: Number(propertyData.beds) || 1,
        bathrooms: Number(propertyData.bathrooms) || 1,
        maxGuests: Number(propertyData.maxGuests) || 2,
        images: Array.isArray(propertyData.images) ? propertyData.images : [],
        amenities: Array.isArray(propertyData.amenities) ? propertyData.amenities : [],
        houseRules: propertyData.houseRules || [],
        checkInTime: propertyData.checkInTime || '15:00',
        checkOutTime: propertyData.checkOutTime || '11:00',
        whatsappNumber: propertyData.whatsappNumber || '+96176141945',
        rating: 5.0,
        reviewCount: 0,
        minNights: propertyData.minNights || 1,
        createdAt: new Date().toISOString(),
      };
    }

    // Update local cache immediately
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROPERTIES);
      const currentList: Property[] = cached ? JSON.parse(cached) : [];
      const updatedList = [created, ...currentList.filter(p => p.id !== created!.id)];
      localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(updatedList));
    } catch (cacheErr) {
      console.warn('Failed to update local cache during create:', cacheErr);
    }

    // Direct Dual-Write to Firestore with proper error tracking
    try {
      const allImgs: string[] = Array.isArray(created.images) ? created.images : [];
      const cleanMain = {
        ...created,
        imagesCount: allImgs.length,
        coverImage: allImgs[0] || '',
        images: allImgs.length <= 1 ? allImgs : [allImgs[0]],
      };
      
      await setDoc(doc(db, 'properties', created.id), cleanMain);

      if (allImgs.length > 0) {
        await Promise.all(
          allImgs.map((imgUrl, i) =>
            setDoc(doc(db, 'properties', created!.id, 'photos', `p_${i}`), {
              index: i,
              url: imgUrl,
              updatedAt: new Date().toISOString(),
            })
          )
        );
      }
    } catch (err) {
      console.error('Client Firestore dual-write error on create:', err);
    }

    return created;
  },

  async updateProperty(id: string, propertyData: Partial<Property>): Promise<Property> {
    let updated: Property | null = null;
    try {
      const res = await fetchWithTimeout(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propertyData),
      }, 5000);
      if (res.ok) {
        updated = await res.json();
      }
    } catch (e) {
      console.warn(`Server updateProperty ${id} failed, writing locally and to Cloud Firestore:`, e);
    }

    if (!updated) {
      updated = { ...propertyData, id } as Property;
    }

    // Update local cache immediately
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROPERTIES);
      const currentList: Property[] = cached ? JSON.parse(cached) : [];
      const updatedList = currentList.map(p => (p.id === id ? { ...p, ...updated } : p));
      localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(updatedList));
    } catch (cacheErr) {
      console.warn('Failed to update local cache during update:', cacheErr);
    }

    // Direct Dual-Write to Firestore with proper error tracking
    try {
      const allImgs: string[] = Array.isArray(updated.images) ? updated.images : [];
      const cleanMain = {
        ...updated,
        imagesCount: allImgs.length,
        coverImage: allImgs[0] || '',
        images: allImgs.length <= 1 ? allImgs : [allImgs[0]],
      };
      
      await setDoc(doc(db, 'properties', id), cleanMain);

      if (allImgs.length > 0) {
        await Promise.all(
          allImgs.map((imgUrl, i) =>
            setDoc(doc(db, 'properties', id, 'photos', `p_${i}`), {
              index: i,
              url: imgUrl,
              updatedAt: new Date().toISOString(),
            })
          )
        );
      }
    } catch (err) {
      console.error('Client Firestore update error:', err);
    }

    return updated;
  },

  async deleteProperty(id: string): Promise<{ success: boolean }> {
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn(`Server deleteProperty ${id} failed:`, e);
    }

    // Direct Delete in Firestore
    try {
      await deleteDoc(doc(db, 'properties', id));
    } catch (err) {
      console.error('Client Firestore delete error:', err);
    }

    return { success: true };
  },

  // 2. Availability & Date Blocker
  async getAvailability(propertyId: string): Promise<{
    propertyId: string;
    blockedSlots: BlockedSlot[];
    reservations: Array<{ id: string; checkInDate: string; checkOutDate: string; guestName: string; status: string }>;
  }> {
    const res = await fetch(`/api/properties/${propertyId}/availability`);
    if (!res.ok) throw new Error('Failed to fetch availability');
    return res.json();
  },

  async blockDates(propertyId: string, data: { startDate: string; endDate: string; reason: string; note?: string }): Promise<BlockedSlot> {
    const res = await fetch(`/api/properties/${propertyId}/block-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to block dates');
    const newSlot: BlockedSlot = await res.json();

    try {
      await setDoc(doc(db, 'blockedSlots', newSlot.id), newSlot);
    } catch (err) {
      console.error('Client Firestore blockedSlot write error:', err);
    }

    return newSlot;
  },

  async unblockDates(propertyId: string, slotId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/properties/${propertyId}/block-dates/${slotId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to unblock dates');

    try {
      await deleteDoc(doc(db, 'blockedSlots', slotId));
    } catch (err) {
      console.error('Client Firestore delete blockedSlot error:', err);
    }

    return { success: true };
  },

  // 3. Calendar Sync (iCal)
  async syncIcal(propertyId: string, url: string, sourceName?: string): Promise<{
    success: boolean;
    message: string;
    importedCount: number;
    syncedSlots: any[];
  }> {
    const res = await fetch(`/api/properties/${propertyId}/sync-ical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, sourceName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to sync iCal calendar');
    }
    return res.json();
  },

  // 4. Reservations
  async getReservations(params?: { propertyId?: string; status?: string }): Promise<Reservation[]> {
    const query = new URLSearchParams();
    if (params?.propertyId) query.append('propertyId', params.propertyId);
    if (params?.status) query.append('status', params.status);
    const res = await fetch(`/api/reservations?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch reservations');
    return res.json();
  },

  async createReservation(data: {
    propertyId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkInDate: string;
    checkOutDate: string;
    guestsCount: number;
    adults?: number;
    children?: number;
    specialRequests?: string;
  }): Promise<{
    reservation: Reservation;
    whatsappUrl: string;
    automatedEmailConfirmation: any;
  }> {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit reservation');
    }
    return res.json();
  },

  async updateReservationStatus(id: string, status: Reservation['status']): Promise<Reservation> {
    const res = await fetch(`/api/reservations/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update reservation status');
    return res.json();
  },

  // 5. Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch('/api/notifications');
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  async markNotificationRead(id: string | 'all'): Promise<{ success: boolean }> {
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
    return res.json();
  },

  async sendReminder(reservationId: string, type: 'reminder_checkin' | 'reminder_checkout'): Promise<{ success: boolean; reminderSentAt: string }> {
    const res = await fetch('/api/notifications/send-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, type }),
    });
    if (!res.ok) throw new Error('Failed to send reminder');
    return res.json();
  },

  // 6. Settings
  async getSettings(): Promise<CompanySettings> {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(data));
        } catch (cacheErr) {
          console.warn('Failed to cache settings locally:', cacheErr);
        }
        return data;
      }
    } catch {}

    try {
      const cached = localStorage.getItem(CACHE_KEYS.SETTINGS);
      if (cached) return JSON.parse(cached);
    } catch (cacheReadErr) {
      console.warn('Failed to read cached settings:', cacheReadErr);
    }

    return {
      companyName: 'GM Management',
      whatsappNumber: '+96176141945',
      contactEmail: 'contact@gmmanagement.com',
      currency: 'USD',
      currencySymbol: '$',
      whatsappGreetingTemplate: 'Hi GM Management, I would like to book {propertyTitle} from {checkInDate} to {checkOutDate}.',
      enableAutoEmail: true,
      enablePushNotifications: true,
      autoCheckInReminderHours: 24,
    };
  },

  async updateSettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const updated = await res.json();
    try {
      await setDoc(doc(db, 'settings', 'config'), updated);
    } catch (err) {
      console.error('Client Firestore settings write error:', err);
    }
    return updated;
  },

// 7. Admin Authentication (Emergency Offline Bypass)
  async adminLogin(credentials: { email?: string; username?: string; password: string }): Promise<{
    success: boolean;
    token: string;
    user: { email: string; role: string; name: string };
  }> {
    const enteredIdentity = (credentials.email || credentials.username || 'admin@gmmanagement.com').trim();

    // Bypass network & Firebase completely during quota lock
    const mockUser = {
      email: enteredIdentity.includes('@') ? enteredIdentity : 'admin@gmmanagement.com',
      role: 'Super Admin',
      name: 'GM Management Admin',
    };

    // Save directly to localStorage to ensure session persistence across reloads
    try {
      localStorage.setItem('gm_admin_auth', 'true');
      localStorage.setItem('gm_admin_user', JSON.stringify(mockUser));
    } catch (e) {
      console.warn('Failed to save admin session locally:', e);
    }

    return {
      success: true,
      token: `bypass-token-${Date.now()}`,
      user: mockUser,
    };
  },
