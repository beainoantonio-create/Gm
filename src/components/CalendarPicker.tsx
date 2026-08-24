import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Ban, CheckCircle2 } from 'lucide-react';
import { BlockedSlot } from '../types';

interface CalendarPickerProps {
  checkInDate: string;  // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  onChange: (checkIn: string, checkOut: string) => void;
  pricePerNight?: number;
  weekdayPrice?: number;
  weekendPrice?: number;
  blockedSlots?: BlockedSlot[];
  bookedRanges?: Array<{ checkInDate: string; checkOutDate: string }>;
  minNights?: number;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  checkInDate,
  checkOutDate,
  onChange,
  pricePerNight,
  weekdayPrice,
  weekendPrice,
  blockedSlots = [],
  bookedRanges = [],
  minNights = 1,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (checkInDate) return new Date(checkInDate);
    return new Date();
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to format Date -> 'YYYY-MM-DD'
  const formatDateStr = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isNightOccupied = (dateStr: string): { occupied: boolean; reason?: string } => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);

    if (d < today) {
      return { occupied: true, reason: 'Past date' };
    }

    // Check staff & iCal blocked slots
    // In hospitality standard (RFC 5545 iCal and standard reservations),
    // startDate is check-in night, and endDate is checkout day.
    // The occupied nights are [startDate, endDate).
    for (const slot of blockedSlots) {
      if (slot.startDate === slot.endDate) {
        if (dateStr === slot.startDate) {
          return { occupied: true, reason: `Blocked: ${slot.reason || 'Unavailable'}` };
        }
      } else {
        if (dateStr >= slot.startDate && dateStr < slot.endDate) {
          return { occupied: true, reason: `Blocked: ${slot.reason || 'Unavailable'}` };
        }
      }
    }

    // Check confirmed/pending reservations
    for (const resv of bookedRanges) {
      if (dateStr >= resv.checkInDate && dateStr < resv.checkOutDate) {
        return { occupied: true, reason: 'Reserved by guest' };
      }
    }

    return { occupied: false };
  };

  // Check if a date is a checkout morning (previous guest leaves at 11 AM, check-in open at 3 PM)
  const isCheckOutMorning = (dateStr: string): boolean => {
    for (const resv of bookedRanges) {
      if (resv.checkOutDate === dateStr) return true;
    }
    for (const slot of blockedSlots) {
      if (slot.startDate < slot.endDate && slot.endDate === dateStr) return true;
    }
    return false;
  };

  const isDateUnavailable = (dateStr: string): { unavailable: boolean; reason?: string } => {
    const { occupied, reason } = isNightOccupied(dateStr);
    return { unavailable: occupied, reason };
  };

  const isRangeAvailable = (startStr: string, endStr: string): boolean => {
    if (!startStr || !endStr || startStr >= endStr) return false;
    let curr = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (curr < end) {
      const str = formatDateStr(curr);
      if (isNightOccupied(str).occupied) {
        return false;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return true;
  };

  const handleDateClick = (dateStr: string) => {
    if (!checkInDate || (checkInDate && checkOutDate)) {
      // Start fresh check-in selection
      const { occupied } = isNightOccupied(dateStr);
      if (occupied) return;
      onChange(dateStr, '');
    } else if (checkInDate && !checkOutDate) {
      if (dateStr <= checkInDate) {
        // Clicked before or on current check-in: if valid night, switch checkIn
        const { occupied } = isNightOccupied(dateStr);
        if (!occupied) {
          onChange(dateStr, '');
        } else {
          onChange('', '');
        }
      } else {
        // Check if all nights from checkInDate to dateStr are free
        if (isRangeAvailable(checkInDate, dateStr)) {
          onChange(checkInDate, dateStr);
        } else {
          // Range is blocked by an intermediate booking; if clicked date is free, start new check-in
          const { occupied } = isNightOccupied(dateStr);
          if (!occupied) {
            onChange(dateStr, '');
          } else {
            onChange('', '');
          }
        }
      }
    }
  };

  const getMonthDays = (monthOffset: number = 0) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + monthOffset;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Array<{ date: Date; dateStr: string; isCurrentMonth: boolean }> = [];

    // Leading blanks for start of week (Sunday = 0)
    const startDayIndex = firstDay.getDay();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({
        date: prevDate,
        dateStr: formatDateStr(prevDate),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: formatDateStr(d),
        isCurrentMonth: true,
      });
    }

    return {
      monthLabel: firstDay.toLocaleString('default', { month: 'long', year: 'numeric' }),
      days,
    };
  };

  const month1 = getMonthDays(0);
  const month2 = getMonthDays(1);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const renderMonthGrid = (monthData: { monthLabel: string; days: Array<any> }) => {
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
      <div className="flex-1 min-w-[280px]">
        <div className="text-center font-bold text-[#222222] mb-3 text-sm">
          {monthData.monthLabel}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekdays.map((w, idx) => (
            <div key={idx} className="text-[11px] font-semibold text-[#717171] py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {monthData.days.map((dayItem, idx) => {
            const { dateStr, isCurrentMonth } = dayItem;
            if (!isCurrentMonth) {
              return <div key={idx} className="h-9" />;
            }

            const { unavailable, reason } = isDateUnavailable(dateStr);
            const isCheckIn = dateStr === checkInDate;
            const isCheckOut = dateStr === checkOutDate;
            const isInRange = checkInDate && checkOutDate && dateStr > checkInDate && dateStr < checkOutDate;
            const hasCheckoutTurnover = isCheckOutMorning(dateStr) && !unavailable;

            // Check if clickable in current state
            const isClickable = (() => {
              if (!checkInDate || (checkInDate && checkOutDate)) {
                return !unavailable;
              }
              if (dateStr <= checkInDate) {
                return !unavailable;
              }
              return isRangeAvailable(checkInDate, dateStr);
            })();

            let dayClasses = 'h-9 w-9 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-semibold transition-colors relative ';

            if (!isClickable && unavailable) {
              dayClasses += 'text-[#B0B0B0] line-through cursor-not-allowed bg-[#F1F1F1]/70';
            } else if (isCheckIn || isCheckOut) {
              dayClasses += 'bg-[#FF385C] text-white font-bold shadow-sm cursor-pointer z-10';
            } else if (isInRange) {
              dayClasses += 'bg-[#FFF8F6] text-[#FF385C] font-semibold cursor-pointer rounded-none w-full';
            } else if (hasCheckoutTurnover) {
              dayClasses += 'text-[#222222] border border-emerald-500/50 bg-emerald-50/40 hover:border-emerald-600 cursor-pointer';
            } else {
              dayClasses += 'text-[#222222] hover:border hover:border-[#222222] cursor-pointer hover:bg-[#FAFAFA]';
            }

            return (
              <div key={idx} className="relative py-0.5 flex justify-center items-center">
                {/* Connecting strip for range in natural tones */}
                {isInRange && (
                  <div className="absolute inset-y-0.5 left-0 right-0 bg-[#FFF8F6] -z-0" />
                )}
                {isCheckIn && checkOutDate && (
                  <div className="absolute inset-y-0.5 right-0 w-1/2 bg-[#FFF8F6] -z-0" />
                )}
                {isCheckOut && (
                  <div className="absolute inset-y-0.5 left-0 w-1/2 bg-[#FFF8F6] -z-0" />
                )}
                <button
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  disabled={!isClickable}
                  title={
                    hasCheckoutTurnover
                      ? `Available for Check-in after 3:00 PM (Morning Check-out)`
                      : unavailable
                      ? reason
                      : `Select ${dateStr}`
                  }
                  className={dayClasses}
                >
                  <span>{dayItem.date.getDate()}</span>
                  {hasCheckoutTurnover && !isCheckIn && !isCheckOut && !isInRange && (
                    <span className="w-1 h-1 rounded-full bg-emerald-500 -mt-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#DDDDDD] p-4 md:p-6 shadow-sm">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-base font-bold text-[#222222]">
            {checkInDate && checkOutDate
              ? `${Math.max(1, Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)))} nights stay`
              : 'Select check-in & check-out dates'}
          </h4>
          <p className="text-xs text-[#717171] mt-0.5">
            {checkInDate ? `Check-in: ${checkInDate}` : 'Add your travel dates for exact pricing'}
            {checkOutDate ? ` • Check-out: ${checkOutDate}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-full hover:bg-[#F1F1F1] text-[#222222] transition cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-full hover:bg-[#F1F1F1] text-[#222222] transition cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Months container */}
      <div className="flex flex-col md:flex-row gap-6">
        {renderMonthGrid(month1)}
        <div className="hidden md:block">{renderMonthGrid(month2)}</div>
      </div>

      {/* Legend & Clear */}
      <div className="mt-5 pt-3 border-t border-[#F1F1F1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#717171]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF385C]" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#F1F1F1] border border-[#DDDDDD] text-[8px] flex items-center justify-center line-through text-[#717171]">×</span>
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-[#DDDDDD] bg-white" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-emerald-500 bg-emerald-50 relative flex items-center justify-center">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
            </span>
            <span>Check-in available (11 AM Check-out)</span>
          </div>
          {(weekdayPrice !== undefined || weekendPrice !== undefined) && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium pl-2 border-l border-slate-200">
              <span className="text-blue-600 font-semibold">Sun–Thu: Weekday</span>
              <span>•</span>
              <span className="text-rose-600 font-semibold">Fri–Sat: Weekend</span>
            </div>
          )}
        </div>

        {(checkInDate || checkOutDate) && (
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="font-medium text-[#222222] underline hover:text-[#FF385C] transition cursor-pointer"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
};
