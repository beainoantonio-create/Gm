/**
 * A custom nightly price for a specific date range (e.g. Christmas week, summer peak).
 * Both dates are INCLUSIVE night dates: startDate = first night, endDate = last night.
 * Overrides the normal weekday/weekend rate for those nights.
 */
export interface SpecialPrice {
  id: string;
  startDate: string; // YYYY-MM-DD (first night)
  endDate: string;   // YYYY-MM-DD (last night, inclusive)
  price: number;     // price per night for this range
  label?: string;    // e.g. "Christmas", "Summer peak"
}

export type PricingMode = 'nightly' | 'monthly' | 'yearly';

export interface Property {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  propertyType: 'Villa' | 'Apartment' | 'Chalet' | 'Penthouse' | 'Mansion' | 'Beach House' | 'Cottage' | 'Studio';
  location: {
    city: string;
    region?: string;
    country: string;
    address?: string;
  };
  pricePerNight: number;
  weekdayPrice?: number; // Sunday till Thursday (Sun, Mon, Tue, Wed, Thu)
  weekendPrice?: number; // Friday & Saturday
  /** 'nightly' (default) = per-night rates. 'monthly' / 'yearly' = one fixed price per rental term. */
  pricingMode?: PricingMode;
  /** Monthly / yearly mode: price for ONE rental term, e.g. 2000 for "$2000 / 1 month". */
  periodPrice?: number;
  /** Monthly / yearly mode: length of the term in months or years, e.g. 1 or 6 (months) / 1 (year). */
  periodCount?: number;
  /** Nightly mode: custom prices for specific date ranges (override weekday/weekend rates). */
  specialPrices?: SpecialPrice[];
  cleaningFee: number;
  serviceFeePercentage: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  maxGuests: number;
  images: string[];
  amenities: string[];
  houseRules: string[];
  checkInTime: string;
  checkOutTime: string;
  whatsappNumber?: string;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  minNights?: number;
  icalImportUrls?: {
    name: string; // e.g. "Airbnb", "VRBO", "Google Calendar"
    url: string;  // .ics URL
    lastSyncedAt?: string;
  }[];
  createdAt: string;
}

export interface BlockedSlot {
  id: string;
  propertyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: 'Maintenance' | 'Owner Stay' | 'Offline Booking' | 'Staff Block' | 'Other';
  note?: string;
  createdAt: string;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface Reservation {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyCity: string;
  propertyImage?: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;  // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  nights: number;
  weekdayNights?: number;
  weekendNights?: number;
  weekdayPrice?: number;
  weekendPrice?: number;
  /** Nights charged at a custom date-range price (nightly mode). */
  specialNights?: number;
  specialTotal?: number;
  /** 'monthly' / 'yearly' bookings are charged one flat term price. */
  pricingMode?: PricingMode;
  /** Human label of the term for monthly/yearly bookings, e.g. "1 month". */
  periodLabel?: string;
  guestsCount: number;
  adults: number;
  children: number;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  totalPrice: number;
  currency: string;
  status: ReservationStatus;
  specialRequests?: string;
  whatsappSentAt?: string;
  emailConfirmationSent: boolean;
  emailSentAt?: string;
  reminderSent?: boolean;
  reminderSentAt?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: 'booking_inquiry' | 'reminder_checkin' | 'reminder_checkout' | 'system' | 'whatsapp_lead' | 'slot_blocked';
  title: string;
  message: string;
  targetEmail?: string;
  targetPhone?: string;
  date: string;
  read: boolean;
  relatedReservationId?: string;
  relatedPropertyId?: string;
}

export interface CompanySettings {
  companyName: string;
  whatsappNumber: string; // e.g. "+96170123456" or "+1234567890"
  contactEmail: string;
  currency: string;
  currencySymbol: string;
  whatsappGreetingTemplate: string;
  enableAutoEmail: boolean;
  enablePushNotifications: boolean;
  autoCheckInReminderHours: number;
  customLogoData?: string; // Optional custom base64 or URL logo
  adminEmail?: string;
  adminPassword?: string;
}
