import type { SpecialPrice } from '../types';

/**
 * Shared pricing logic - used by the website (property page, booking modal)
 * AND by the server (server.ts) so the price a guest sees is always the price
 * that gets saved on the reservation.
 *
 * Three ways a property can be priced:
 *   1. Nightly (default): weekday rate (Sun-Thu) + weekend rate (Fri-Sat).
 *   2. Nightly + special prices: custom per-night price for specific date ranges,
 *      which override the weekday/weekend rate on those nights.
 *   3. Monthly / yearly: ONE fixed price per rental term, e.g. $2000 / 1 month
 *      or $20000 / 1 year. The check-out date is derived from the start date.
 *   4. Get a quote: no price is shown. The guest picks dates and requests a quote.
 *      This is also the mode of any property that has no pricing mode saved yet.
 */

export type PricingProperty = {
  pricePerNight?: number;
  weekdayPrice?: number;
  weekendPrice?: number;
  cleaningFee?: number;
  serviceFeePercentage?: number;
  pricingMode?: 'nightly' | 'monthly' | 'yearly' | 'quote';
  periodPrice?: number;
  periodCount?: number;
  specialPrices?: SpecialPrice[];
};

export function isWeekendNight(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  // Friday (5) and Saturday (6) are weekends. Sunday (0) through Thursday (4) are weekdays.
  return day === 5 || day === 6;
}

export function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Monthly / yearly ("period") pricing helpers
// ---------------------------------------------------------------------------

/** The effective pricing mode. A property with no (or an unknown) mode saved is "Get a quote". */
export function getPricingMode(
  p?: Pick<PricingProperty, 'pricingMode'> | null
): 'nightly' | 'monthly' | 'yearly' | 'quote' {
  const m = p?.pricingMode;
  return m === 'nightly' || m === 'monthly' || m === 'yearly' ? m : 'quote';
}

/**
 * One-time default: puts every property that hasn't been through it yet on "Get a quote" and
 * stamps it (quoteDefaultApplied), so a mode the owner picks afterwards is never overwritten.
 * Mutates the given properties and returns only the ones that changed (the ones to save).
 */
export function applyQuoteDefault<T extends { pricingMode?: string; quoteDefaultApplied?: boolean }>(
  properties: T[]
): T[] {
  const changed: T[] = [];
  for (const p of properties) {
    if (p && !p.quoteDefaultApplied) {
      p.pricingMode = 'quote';
      p.quoteDefaultApplied = true;
      changed.push(p);
    }
  }
  return changed;
}

export function isQuoteProperty(p?: Pick<PricingProperty, 'pricingMode'> | null): boolean {
  return getPricingMode(p) === 'quote';
}

export function isPeriodProperty(p?: Pick<PricingProperty, 'pricingMode'> | null): boolean {
  const m = getPricingMode(p);
  return m === 'monthly' || m === 'yearly';
}

export function getPeriodUnit(p?: Pick<PricingProperty, 'pricingMode'> | null): 'month' | 'year' {
  return getPricingMode(p) === 'yearly' ? 'year' : 'month';
}

export function getPeriodCount(p?: Pick<PricingProperty, 'periodCount'> | null): number {
  const n = Math.floor(Number(p?.periodCount));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** "1 month", "6 months", "1 year", "2 years" */
export function getPeriodLabel(p?: Pick<PricingProperty, 'pricingMode' | 'periodCount'> | null): string {
  const unit = getPeriodUnit(p);
  const count = getPeriodCount(p);
  return `${count} ${unit}${count > 1 ? 's' : ''}`;
}

/** Suffix for price display: "month" / "6 months" / "year" - so it reads "$2000 / month". */
export function getPeriodPriceSuffix(p?: Pick<PricingProperty, 'pricingMode' | 'periodCount'> | null): string {
  return getPeriodCount(p) === 1 ? getPeriodUnit(p) : getPeriodLabel(p);
}

/**
 * Adds N months/years to a YYYY-MM-DD date. Clamps to the last day of the target
 * month (Jan 31 + 1 month = Feb 28/29), so a term never spills into the next month.
 */
export function addPeriodToDate(startStr: string, unit: 'month' | 'year', count: number): string {
  const [y, m, d] = startStr.split('-').map(Number);
  const monthsToAdd = unit === 'year' ? count * 12 : count;
  const target = new Date(y, m - 1 + monthsToAdd, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return formatDateStr(target);
}

/** For monthly/yearly properties: the check-out date for a given start date. */
export function getPeriodEndDate(p: PricingProperty, startStr: string): string {
  return addPeriodToDate(startStr, getPeriodUnit(p), getPeriodCount(p));
}

// ---------------------------------------------------------------------------
// Nightly pricing helpers
// ---------------------------------------------------------------------------

/** The custom price covering a given night, if any. If ranges overlap, the one added last wins. */
export function getSpecialPriceForDate(
  specialPrices: SpecialPrice[] | undefined,
  dateStr: string
): SpecialPrice | undefined {
  if (!specialPrices || specialPrices.length === 0) return undefined;
  for (let i = specialPrices.length - 1; i >= 0; i--) {
    const sp = specialPrices[i];
    if (sp && dateStr >= sp.startDate && dateStr <= sp.endDate && Number(sp.price) > 0) return sp;
  }
  return undefined;
}

/** The nightly rate that applies to one specific night. */
export function getNightRate(
  property: PricingProperty,
  dateStr: string
): { rate: number; kind: 'special' | 'weekend' | 'weekday'; special?: SpecialPrice } {
  const weekdayRate = property.weekdayPrice ?? property.pricePerNight ?? 0;
  const weekendRate = property.weekendPrice ?? property.weekdayPrice ?? property.pricePerNight ?? 0;
  const special = getSpecialPriceForDate(property.specialPrices, dateStr);
  if (special) return { rate: Number(special.price), kind: 'special', special };
  if (isWeekendNight(dateStr)) return { rate: weekendRate, kind: 'weekend' };
  return { rate: weekdayRate, kind: 'weekday' };
}

export interface StayPricingBreakdown {
  mode: 'nightly' | 'monthly' | 'yearly' | 'quote';
  nights: number;
  /** Nights charged at the normal weekday / weekend rate (NOT counting special-price nights). */
  weekdayNights: number;
  weekendNights: number;
  weekdayRate: number;
  weekendRate: number;
  weekdayTotal: number;
  weekendTotal: number;
  /** Nights charged at a custom date-range price, grouped by price. */
  specialNights: number;
  specialTotal: number;
  specialGroups: Array<{ rate: number; nights: number; total: number; label?: string }>;
  /** Monthly / yearly bookings. */
  periodLabel?: string;
  periodPrice?: number;
  /** Check-out date (derived from the start date for monthly/yearly bookings). */
  checkOutDate: string;
  basePrice: number;
  cleaningFee: number;
  serviceFee: number;
  totalPrice: number;
}

export function calculateStayPricing(
  property: PricingProperty,
  checkInDate: string,
  checkOutDate: string
): StayPricingBreakdown {
  const weekdayRate = property.weekdayPrice ?? property.pricePerNight ?? 0;
  const weekendRate = property.weekendPrice ?? property.weekdayPrice ?? property.pricePerNight ?? 0;

  // ---- Monthly / yearly: one flat price for the whole term ------------------
  if (isPeriodProperty(property)) {
    const periodPrice = Number(property.periodPrice) || 0;
    const end = checkInDate ? getPeriodEndDate(property, checkInDate) : '';
    let nights = 0;
    if (checkInDate && end) {
      nights = Math.max(
        1,
        Math.round(
          (new Date(end + 'T00:00:00').getTime() - new Date(checkInDate + 'T00:00:00').getTime()) / 86400000
        )
      );
    }
    return {
      mode: getPricingMode(property) as 'monthly' | 'yearly',
      nights,
      weekdayNights: 0,
      weekendNights: 0,
      weekdayRate,
      weekendRate,
      weekdayTotal: 0,
      weekendTotal: 0,
      specialNights: 0,
      specialTotal: 0,
      specialGroups: [],
      periodLabel: getPeriodLabel(property),
      periodPrice,
      checkOutDate: end,
      basePrice: periodPrice,
      // Long-term rentals are charged as one flat term price - no per-stay cleaning/service fees.
      cleaningFee: 0,
      serviceFee: 0,
      totalPrice: periodPrice,
    };
  }

  // ---- Get a quote: no price, just the dates ------------------------------------
  if (isQuoteProperty(property)) {
    let nights = 0;
    if (checkInDate && checkOutDate) {
      nights = Math.max(
        1,
        Math.round(
          (new Date(checkOutDate + 'T00:00:00').getTime() - new Date(checkInDate + 'T00:00:00').getTime()) / 86400000
        )
      );
    }
    return {
      mode: 'quote',
      nights,
      weekdayNights: 0,
      weekendNights: 0,
      weekdayRate: weekdayRate,
      weekendRate: weekendRate,
      weekdayTotal: 0,
      weekendTotal: 0,
      specialNights: 0,
      specialTotal: 0,
      specialGroups: [],
      checkOutDate: checkOutDate || '',
      basePrice: 0,
      cleaningFee: 0,
      serviceFee: 0,
      totalPrice: 0,
    };
  }

  // ---- Nightly ----------------------------------------------------------------
  if (!checkInDate || !checkOutDate) {
    return {
      mode: 'nightly',
      nights: 0,
      weekdayNights: 0,
      weekendNights: 0,
      weekdayRate,
      weekendRate,
      weekdayTotal: 0,
      weekendTotal: 0,
      specialNights: 0,
      specialTotal: 0,
      specialGroups: [],
      checkOutDate: checkOutDate || '',
      basePrice: 0,
      cleaningFee: property.cleaningFee || 0,
      serviceFee: 0,
      totalPrice: weekdayRate + (property.cleaningFee || 0),
    };
  }

  const start = new Date(checkInDate + 'T00:00:00');
  const end = new Date(checkOutDate + 'T00:00:00');
  let weekdayNights = 0;
  let weekendNights = 0;
  let specialTotal = 0;
  let specialNights = 0;
  const specialByKey = new Map<string, { rate: number; nights: number; total: number; label?: string }>();

  const curr = new Date(start);
  while (curr < end) {
    const night = getNightRate(property, formatDateStr(curr));
    if (night.kind === 'special') {
      specialNights++;
      specialTotal += night.rate;
      const key = `${night.rate}|${night.special?.label || ''}`;
      const g = specialByKey.get(key) || { rate: night.rate, nights: 0, total: 0, label: night.special?.label };
      g.nights++;
      g.total += night.rate;
      specialByKey.set(key, g);
    } else if (night.kind === 'weekend') {
      weekendNights++;
    } else {
      weekdayNights++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const totalNights = Math.max(1, weekdayNights + weekendNights + specialNights);
  const weekdayTotal = weekdayNights * weekdayRate;
  const weekendTotal = weekendNights * weekendRate;
  const basePrice = weekdayTotal + weekendTotal + specialTotal;
  const cleaningFee = property.cleaningFee || 0;
  const serviceFee = Math.round((basePrice * (property.serviceFeePercentage || 10)) / 100);
  const totalPrice = basePrice + cleaningFee + serviceFee;

  return {
    mode: 'nightly',
    nights: totalNights,
    weekdayNights,
    weekendNights,
    weekdayRate,
    weekendRate,
    weekdayTotal,
    weekendTotal,
    specialNights,
    specialTotal,
    specialGroups: Array.from(specialByKey.values()),
    checkOutDate,
    basePrice,
    cleaningFee,
    serviceFee,
    totalPrice,
  };
}
