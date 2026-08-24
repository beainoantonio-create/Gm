export function isWeekendNight(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  // Friday (5) and Saturday (6) are weekends. Sunday (0) through Thursday (4) are weekdays.
  return day === 5 || day === 6;
}

export interface StayPricingBreakdown {
  nights: number;
  weekdayNights: number;
  weekendNights: number;
  weekdayRate: number;
  weekendRate: number;
  weekdayTotal: number;
  weekendTotal: number;
  basePrice: number;
  cleaningFee: number;
  serviceFee: number;
  totalPrice: number;
}

export function calculateStayPricing(
  property: {
    pricePerNight?: number;
    weekdayPrice?: number;
    weekendPrice?: number;
    cleaningFee?: number;
    serviceFeePercentage?: number;
  },
  checkInDate: string,
  checkOutDate: string
): StayPricingBreakdown {
  const weekdayRate = property.weekdayPrice ?? property.pricePerNight ?? 0;
  const weekendRate = property.weekendPrice ?? property.weekdayPrice ?? property.pricePerNight ?? 0;

  if (!checkInDate || !checkOutDate) {
    return {
      nights: 0,
      weekdayNights: 0,
      weekendNights: 0,
      weekdayRate,
      weekendRate,
      weekdayTotal: 0,
      weekendTotal: 0,
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

  const curr = new Date(start);
  while (curr < end) {
    if (isWeekendNight(curr)) {
      weekendNights++;
    } else {
      weekdayNights++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const totalNights = Math.max(1, weekdayNights + weekendNights);
  const weekdayTotal = weekdayNights * weekdayRate;
  const weekendTotal = weekendNights * weekendRate;
  const basePrice = weekdayTotal + weekendTotal;
  const cleaningFee = property.cleaningFee || 0;
  const serviceFee = Math.round((basePrice * (property.serviceFeePercentage || 10)) / 100);
  const totalPrice = basePrice + cleaningFee + serviceFee;

  return {
    nights: totalNights,
    weekdayNights,
    weekendNights,
    weekdayRate,
    weekendRate,
    weekdayTotal,
    weekendTotal,
    basePrice,
    cleaningFee,
    serviceFee,
    totalPrice,
  };
}
