import React, { useState } from 'react';
import {
  Calendar,
  MessageCircle,
  ExternalLink,
  MapPin,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  Phone,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { Reservation, Property } from '../types';

interface MyTripsViewProps {
  reservations: Reservation[];
  properties: Property[];
  onSelectProperty: (property: Property) => void;
  currencySymbol?: string;
  companyWhatsApp?: string;
}

export const MyTripsView: React.FC<MyTripsViewProps> = ({
  reservations,
  properties,
  onSelectProperty,
  currencySymbol = '$',
  companyWhatsApp = '+96176141945',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = reservations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.guestName.toLowerCase().includes(q) ||
      r.guestPhone.includes(q) ||
      r.propertyTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="my-reservations-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">My Reservations & Stays</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your reservation inquiries with GM Management, chat directly on WhatsApp, and view confirmation details.
          </p>
        </div>

        {/* Search by reference / phone */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID (e.g. GM-123456) or phone"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF385C]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 text-center py-12 px-4 rounded-3xl bg-slate-50 border border-dashed border-slate-200">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No reservations found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When you inquire for any property dates on GM Management, your confirmed booking details will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {filtered.map((resv) => {
            const property = properties.find((p) => p.id === resv.propertyId);
            const waTarget = (property?.whatsappNumber || companyWhatsApp).replace(/[^\d+]/g, '');
            const waChatUrl = `https://wa.me/${waTarget.replace('+', '')}?text=${encodeURIComponent(
              `Hello GM Management, I am inquiring about my booking ${resv.id} for ${resv.propertyTitle} (${resv.checkInDate} to ${resv.checkOutDate}).`
            )}`;

            const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
              `Stay at ${resv.propertyTitle}`
            )}&dates=${resv.checkInDate.replace(/-/g, '')}T150000Z/${resv.checkOutDate.replace(/-/g, '')}T110000Z&details=${encodeURIComponent(
              `GM Management Reservation: #${resv.id}\nGuest: ${resv.guestName}\nTotal: $${resv.totalPrice}`
            )}`;

            return (
              <div
                key={resv.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col md:flex-row"
              >
                {/* Image */}
                <div className="md:w-64 h-48 md:h-auto bg-slate-100 relative shrink-0">
                  {resv.propertyImage ? (
                    <img
                      src={resv.propertyImage}
                      alt={resv.propertyTitle}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-400 text-xs text-center">
                      <Building2 className="w-8 h-8 mb-1" />
                      <span>{resv.propertyTitle}</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm ${
                        resv.status === 'confirmed'
                          ? 'bg-emerald-600 text-white'
                          : resv.status === 'pending'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      {resv.status}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#E00B41] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                        REF #{resv.id}
                      </span>
                      <span className="text-xs text-slate-400">
                        Booked on {new Date(resv.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3
                      onClick={() => property && onSelectProperty(property)}
                      className="text-lg font-bold text-slate-900 mt-1 hover:text-[#FF385C] cursor-pointer"
                    >
                      {resv.propertyTitle}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {resv.propertyCity}, Lebanon
                    </p>

                    {/* Check-in / Check-out schedule */}
                    <div className="grid grid-cols-2 gap-4 mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[10px] block">CHECK-IN</span>
                        <span className="font-bold text-slate-800 text-sm">{resv.checkInDate}</span>
                        <span className="text-slate-500 text-[11px] block">From 3:00 PM</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[10px] block">CHECK-OUT</span>
                        <span className="font-bold text-slate-800 text-sm">{resv.checkOutDate}</span>
                        <span className="text-slate-500 text-[11px] block">By 11:00 AM</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-500">Total: </span>
                      <strong className="text-base text-slate-900">{currencySymbol}{resv.totalPrice}</strong>
                      <span className="text-slate-400"> ({resv.nights} nights • {resv.guestsCount} guests)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Direct WhatsApp button */}
                      <a
                        href={waChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>Chat on WhatsApp</span>
                      </a>

                      {/* Google Calendar sync */}
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Google Calendar</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
