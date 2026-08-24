import React, { useState } from 'react';
import {
  X,
  MessageCircle,
  Mail,
  Calendar,
  CheckCircle2,
  Phone,
  User,
  ShieldCheck,
  ExternalLink,
  Download,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Property, Reservation } from '../types';
import { api } from '../services/api';
import { calculateStayPricing } from '../utils/pricing';
import { Logo } from './Logo';

interface ReservationModalProps {
  property: Property;
  checkInDate: string;
  checkOutDate: string;
  onClose: () => void;
  onSuccess: (reservation: Reservation) => void;
  currencySymbol?: string;
  customLogo?: string;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  property,
  checkInDate,
  checkOutDate,
  onClose,
  onSuccess,
  currencySymbol = '$',
  customLogo,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+961'); // default Lebanon/International
  const [guestsCount, setGuestsCount] = useState(2);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state after booking creation
  const [createdReservation, setCreatedReservation] = useState<Reservation | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  // Calculate pricing with dual weekday (Sun-Thu) and weekend (Fri-Sat) rates
  const pricing = calculateStayPricing(property, checkInDate, checkOutDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!guestName.trim()) {
      setError('Please provide your full name');
      return;
    }
    if (!guestPhone.trim()) {
      setError('Please provide your WhatsApp phone number');
      return;
    }
    if (!checkInDate || !checkOutDate) {
      setError('Please select check-in and check-out dates first');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullPhoneNumber = guestPhone.startsWith('+') ? guestPhone : `${countryCode}${guestPhone.replace(/^0+/, '')}`;

      const res = await api.createReservation({
        propertyId: property.id,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || 'guest@gmmanagement.com',
        guestPhone: fullPhoneNumber,
        checkInDate,
        checkOutDate,
        guestsCount: Number(adults) + Number(children),
        adults: Number(adults),
        children: Number(children),
        specialRequests: specialRequests.trim(),
      });

      setCreatedReservation(res.reservation);
      setWhatsappUrl(res.whatsappUrl);
      onSuccess(res.reservation);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reservation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateGoogleCalendarUrl = () => {
    if (!createdReservation) return '#';
    const title = encodeURIComponent(`Stay at ${property.title} (GM Management)`);
    const details = encodeURIComponent(
      `Reservation ID: ${createdReservation.id}\nProperty: ${property.title}\nCity: ${property.location.city}\nGuests: ${createdReservation.guestsCount}\nGM Management Support: ${property.whatsappNumber || '+96176141945'}`
    );
    const location = encodeURIComponent(`${property.title}, ${property.location.city}, ${property.location.country}`);
    const startStr = checkInDate.replace(/-/g, '') + 'T150000Z';
    const endStr = checkOutDate.replace(/-/g, '') + 'T110000Z';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      id="reservation-modal-backdrop"
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 relative my-auto animate-in fade-in zoom-in-95 duration-200"
        id="reservation-modal-content"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500 transition z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {!createdReservation ? (
          /* Step 1: Booking & Guest Details Form */
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Direct Booking & WhatsApp Verification</span>
              </div>
              <Logo size="sm" customLogo={customLogo} showText={false} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Request to Book</h2>
            <p className="text-sm text-slate-500 mt-1">
              {property.title} • {property.location.city}
            </p>

            {/* Dates & Pricing Summary Card */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-2 gap-3 text-sm pb-3 border-b border-slate-200">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">CHECK-IN</span>
                  <span className="font-semibold text-slate-800">{checkInDate || 'Not selected'}</span>
                  <span className="text-[11px] text-slate-500 block">From {property.checkInTime}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">CHECK-OUT</span>
                  <span className="font-semibold text-slate-800">{checkOutDate || 'Not selected'}</span>
                  <span className="text-[11px] text-slate-500 block">By {property.checkOutTime}</span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {pricing.weekdayNights > 0 && (
                  <div className="flex justify-between">
                    <span>{currencySymbol}{pricing.weekdayRate} x {pricing.weekdayNights} weekday night{pricing.weekdayNights > 1 ? 's' : ''} (Sun–Thu)</span>
                    <span className="font-medium text-slate-800">{currencySymbol}{pricing.weekdayTotal}</span>
                  </div>
                )}
                {pricing.weekendNights > 0 && (
                  <div className="flex justify-between">
                    <span>{currencySymbol}{pricing.weekendRate} x {pricing.weekendNights} weekend night{pricing.weekendNights > 1 ? 's' : ''} (Fri–Sat)</span>
                    <span className="font-medium text-slate-800">{currencySymbol}{pricing.weekendTotal}</span>
                  </div>
                )}
                {pricing.cleaningFee > 0 && (
                  <div className="flex justify-between">
                    <span>Cleaning fee</span>
                    <span className="font-medium text-slate-800">{currencySymbol}{pricing.cleaningFee}</span>
                  </div>
                )}
                {pricing.serviceFee > 0 && (
                  <div className="flex justify-between">
                    <span>GM Service fee</span>
                    <span className="font-medium text-slate-800">{currencySymbol}{pricing.serviceFee}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Total Due ({pricing.nights} night{pricing.nights > 1 ? 's' : ''})</span>
                  <span className="text-[#E00B41]">{currencySymbol}{pricing.totalPrice}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Guest Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Antonio Beaino"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF385C] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#FF385C]"
                  >
                    <option value="+961">🇱🇧 +961 (Lebanon)</option>
                    <option value="+1">🇺🇸 +1 (US/Canada)</option>
                    <option value="+971">🇦🇪 +971 (UAE)</option>
                    <option value="+44">🇬🇧 +44 (UK)</option>
                    <option value="+33">🇫🇷 +33 (France)</option>
                    <option value="+966">🇸🇦 +966 (Saudi Arabia)</option>
                    <option value="+965">🇰🇼 +965 (Kuwait)</option>
                    <option value="+974">🇶🇦 +974 (Qatar)</option>
                    <option value="+49">🇩🇪 +49 (Germany)</option>
                    <option value="+39">🇮🇹 +39 (Italy)</option>
                  </select>
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="e.g. 70 123 456"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF385C] focus:border-transparent"
                    />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  We will instantly send you booking confirmation and key instructions on WhatsApp.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (For Automated Receipt)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="e.g. yourname@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF385C] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Guests Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Adults</label>
                  <select
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF385C]"
                  >
                    {Array.from({ length: property.maxGuests }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} adult{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Children</label>
                  <select
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF385C]"
                  >
                    <option value={0}>0 children</option>
                    <option value={1}>1 child</option>
                    <option value={2}>2 children</option>
                    <option value={3}>3+ children</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Special Requests or Notes</label>
                <textarea
                  rows={2}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Estimated arrival time, early check-in request, airport transfer..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF385C] focus:border-transparent"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white font-bold text-base shadow-lg hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  id="submit-inquiry-button"
                >
                  {isSubmitting ? (
                    <span>Submitting Reservation...</span>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5 fill-white text-transparent" />
                      <span>Confirm & Connect on WhatsApp</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Instant connection with GM Management team • No prepayment required
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* Step 2: Instant Booking Confirmation & Action Hub */
          <div className="p-6 md:p-8 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>

            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-2">
              RESERVATION REQUEST SUBMITTED
            </span>
            <h2 className="text-2xl font-black text-slate-900">You're All Set, {createdReservation.guestName}!</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Your inquiry for <strong className="text-slate-900">{property.title}</strong> has been logged. Reference code:{' '}
              <span className="font-mono font-bold text-[#E00B41] bg-rose-50 px-2 py-0.5 rounded-md">
                {createdReservation.id}
              </span>
            </p>

            {/* Direct WhatsApp CTA */}
            <div className="mt-6 p-5 bg-[#E8F8F0] border border-[#25D366]/30 rounded-2xl text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MessageCircle className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Direct WhatsApp Confirmation</h4>
                  <p className="text-xs text-slate-600">Message GM Management right now to finalize details & keys.</p>
                </div>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  id="whatsapp-direct-link"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Open WhatsApp with GM Management</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Automated Email & Google Calendar Actions */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Google Calendar Sync */}
              <a
                href={generateGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Add to Google Calendar</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              {/* Download .ICS */}
              <a
                href={`/api/calendar/export/${property.id}.ics`}
                download
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Download .ICS Feed</span>
              </a>
            </div>

            {/* Automated Email Confirmation Note */}
            <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5 text-left">
              <Mail className="w-4 h-4 text-[#FF385C] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Automated Email Receipt Sent</span>
                A copy with check-in instructions and total invoice was dispatched to{' '}
                <strong className="text-slate-800">{createdReservation.guestEmail}</strong>.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
