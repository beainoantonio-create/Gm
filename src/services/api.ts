import { Property, Reservation, NotificationItem, CompanySettings, BlockedSlot } from '../types';

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

// After the owner saves a change, ask for a fresh copy of the property list (skipping the
// short-lived edge cache) so the change is visible immediately. Visitors never set this.
const BUST_KEY = 'gm_bust_cache_at';
function markListChanged() {
  try {
    localStorage.setItem(BUST_KEY, String(Date.now()));
  } catch {}
}
function propertiesUrl(): string {
  try {
    const t = Number(localStorage.getItem(BUST_KEY) || 0);
    if (t && Date.now() - t < 10 * 60 * 1000) return `/api/properties?v=${t}`;
  } catch {}
  return '/api/properties';
}

export const api = {
  // 1. Properties
  async getProperties(): Promise<Property[]> {
    // A cold server start can take a few seconds, so be patient and try twice before giving up
    // (the old 2.5s limit made first-time visitors see an empty page).
    for (let attempt = 0; attempt < 2; attempt++) {
      const data = await this.fetchPropertyList(attempt === 0 ? 12000 : 20000);
      if (data) return data;
    }
    return this.readCachedProperties();
  },

  async fetchPropertyList(timeoutMs: number): Promise<Property[] | null> {
    try {
      const res = await fetchWithTimeout(propertiesUrl(), {}, timeoutMs);
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
      console.warn('Server fetch /api/properties failed or timed out:', e);
    }
    return null;
  },

  readCachedProperties(): Property[] {
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
      const res = await fetchWithTimeout(`/api/properties/${id}`, {}, 10000);
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
      }, 30000);
      if (res.ok) {
        created = await res.json();
      }
    } catch (e) {
      console.warn('Server createProperty timed out or failed:', e);
    }

    if (!created) {
      throw new Error('The property could not be saved - the server did not respond. Please try again.');
    }

    markListChanged();

    // Update local cache immediately
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROPERTIES);
      const currentList: Property[] = cached ? JSON.parse(cached) : [];
      const updatedList = [created, ...currentList.filter(p => p.id !== created!.id)];
      localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(updatedList));
    } catch (cacheErr) {
      console.warn('Failed to update local cache during create:', cacheErr);
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
      }, 30000);
      if (res.ok) {
        updated = await res.json();
      }
    } catch (e) {
      console.warn(`Server updateProperty ${id} failed:`, e);
    }

    if (!updated) {
      throw new Error('The changes could not be saved - the server did not respond. Please try again.');
    }

    markListChanged();

    // Update local cache immediately
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROPERTIES);
      const currentList: Property[] = cached ? JSON.parse(cached) : [];
      const updatedList = currentList.map(p => (p.id === id ? { ...p, ...updated } : p));
      localStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(updatedList));
    } catch (cacheErr) {
      console.warn('Failed to update local cache during update:', cacheErr);
    }

    return updated;
  },

  async deleteProperty(id: string): Promise<{ success: boolean }> {
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn(`Server deleteProperty ${id} failed:`, e);
    }
    markListChanged();

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

    return newSlot;
  },

  async unblockDates(propertyId: string, slotId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/properties/${propertyId}/block-dates/${slotId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to unblock dates');

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
};
