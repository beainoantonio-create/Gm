import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Share2,
  Heart,
  Star,
  ShieldCheck,
  Award,
  Sparkles,
  MapPin,
  Users,
  BedDouble,
  Bath,
  Wifi,
  Tv,
  Car,
  Utensils,
  Waves,
  Flame,
  Wind,
  CheckCircle,
  MessageCircle,
  Calendar,
  Lock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Grid,
  Info,
  Clock
} from 'lucide-react';
import { Property, BlockedSlot } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { ReservationModal } from './ReservationModal';
import { api } from '../services/api';
import { Logo } from './Logo';
import { calculateStayPricing } from '../utils/pricing';

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
  currencySymbol?: string;
  customLogo?: string;
}

export const PropertyDetail: React.FC<PropertyDetailProps> = ({
  property,
  onBack,
  currencySymbol = '$',
  customLogo,
}) => {
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [galleryMode, setGalleryMode] = useState<'slideshow' | 'grid'>('slideshow');

  // Real-time availability from backend
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [bookedRanges, setBookedRanges] = useState<Array<{ checkInDate: string; checkOutDate: string }>>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  useEffect(() => {
    loadAvailability();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [property.id]);

  // Keyboard navigation for photo gallery modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!photoModalOpen) return;
      if (e.key === 'Escape') setPhotoModalOpen(false);
      if (e.key === 'ArrowRight') {
        setSelectedPhotoIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft') {
        setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoModalOpen, property.images]);

  const loadAvailability = async () => {
    try {
      setLoadingAvailability(true);
      const data = await api.getAvailability(property.id);
      setBlockedSlots(data.blockedSlots || []);
      setBookedRanges(data.reservations || []);
    } catch (err) {
      console.error('Failed to load availability', err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const images = property.images && property.images.length > 0 ? property.images : [];

  const openGalleryAt = (idx: number) => {
    setSelectedPhotoIndex(idx);
    setGalleryMode('slideshow');
    setPhotoModalOpen(true);
  };

  // Calculate pricing breakdown with dual weekday (Sun-Thu) & weekend (Fri-Sat) rates
  const pricing = calculateStayPricing(property, checkInDate, checkOutDate);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${property.title} - GM Management`,
        text: `Check out this luxury property on GM Management: ${property.title}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const getAmenityIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return <Wifi className="w-5 h-5 text-slate-700" />;
    if (lower.includes('pool') || lower.includes('swim')) return <Waves className="w-5 h-5 text-blue-600" />;
    if (lower.includes('air') || lower.includes('ac')) return <Wind className="w-5 h-5 text-sky-600" />;
    if (lower.includes('kitchen') || lower.includes('cook')) return <Utensils className="w-5 h-5 text-amber-600" />;
    if (lower.includes('park') || lower.includes('garage')) return <Car className="w-5 h-5 text-emerald-600" />;
    if (lower.includes('tv') || lower.includes('cable')) return <Tv className="w-5 h-5 text-purple-600" />;
    if (lower.includes('hot tub') || lower.includes('jacuzzi')) return <Flame className="w-5 h-5 text-rose-600" />;
    return <CheckCircle className="w-5 h-5 text-slate-700" />;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-36 lg:pb-16 text-[#222222]" id="property-detail-view">
      {/* Top action breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#222222] hover:text-black py-2 px-3 rounded-full hover:bg-[#F1F1F1] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Properties</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title Header in Natural Tones */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] tracking-tight">
              {property.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#717171] mt-1.5 font-medium">
              <span className="flex items-center gap-1 font-semibold text-[#222222]">
                <Star className="w-4 h-4 fill-[#222222] stroke-[#222222]" />
                {property.rating ? property.rating.toFixed(2) : '4.95'}
              </span>
              <span>•</span>
              <span className="underline cursor-pointer">{property.reviewCount || 12} reviews</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#222222]">
                <ShieldCheck className="w-4 h-4 text-[#25D366]" />
                Verified by GM Management
              </span>
              <span>•</span>
              <span className="text-[#222222] underline font-semibold">
                {property.location.city}, {property.location.country}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#DDDDDD] bg-white text-[#222222] text-sm font-medium hover:bg-[#FAFAFA] transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSaved(!isSaved)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#DDDDDD] bg-white text-[#222222] text-sm font-medium hover:bg-[#FAFAFA] transition cursor-pointer"
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-[#FF385C] stroke-[#FF385C]' : 'text-[#222222]'}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* 5-Photo Gallery Grid */}
        <div className="mt-4 rounded-2xl overflow-hidden bg-[#EBEBEB] shadow-sm border border-[#DDDDDD] relative">
          {images.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 max-h-[480px]">
              {/* Main large photo */}
              <div className="md:col-span-2 relative aspect-[4/3] md:aspect-auto md:h-[480px] overflow-hidden group">
                <img
                  src={images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                  onClick={() => openGalleryAt(0)}
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* 2nd column (2 photos) */}
              <div className="hidden md:grid grid-rows-2 gap-2 h-[480px]">
                <div className="overflow-hidden group">
                  <img
                    src={images[1] || images[0]}
                    alt="Photo 2"
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                    onClick={() => openGalleryAt(1 < images.length ? 1 : 0)}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden group">
                  <img
                    src={images[2] || images[0]}
                    alt="Photo 3"
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                    onClick={() => openGalleryAt(2 < images.length ? 2 : 0)}
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* 3rd column (2 photos) */}
              <div className="hidden md:grid grid-rows-2 gap-2 h-[480px]">
                <div className="overflow-hidden group">
                  <img
                    src={images[3] || images[0]}
                    alt="Photo 4"
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                    onClick={() => openGalleryAt(3 < images.length ? 3 : 0)}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="relative overflow-hidden group">
                  <img
                    src={images[4] || images[0]}
                    alt="Photo 5"
                    className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                    onClick={() => openGalleryAt(4 < images.length ? 4 : 0)}
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* "Show all photos" floating button (visible on both mobile & desktop) */}
              <button
                type="button"
                onClick={() => openGalleryAt(0)}
                className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-xs hover:bg-white text-[#222222] px-3.5 py-2 rounded-xl text-xs font-bold shadow-md border border-[#DDDDDD] flex items-center gap-1.5 transition hover:scale-105 active:scale-95 cursor-pointer z-10"
                id="show-all-photos-button"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Show all {images.length} photos</span>
              </button>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center p-8 text-center bg-[#EBEBEB] text-[#717171]">
              <Logo size="lg" customLogo={customLogo} showText={false} />
              <p className="font-semibold text-[#222222] mt-2">{property.title}</p>
              <p className="text-xs text-[#717171] mt-1">
                You can upload photos for this property in the Admin Dashboard.
              </p>
            </div>
          )}
        </div>

        {/* Main Content Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Property Details & Calendar */}
          <div className="lg:col-span-7 space-y-8">
            {/* Host info & Specs */}
            <div className="pb-6 border-b border-[#DDDDDD]">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#222222]">
                    {property.propertyType} in {property.location.city}, {property.location.country}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#717171] mt-1">
                    <span>{property.maxGuests} guests</span>
                    <span>•</span>
                    <span>{property.bedrooms} {property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <Logo size="md" customLogo={customLogo} showText={false} />
                </div>
              </div>
            </div>

            {/* Highlights */}
            <div className="space-y-4 pb-6 border-b border-[#DDDDDD]">
              <div className="flex items-start gap-4">
                <Award className="w-6 h-6 text-[#222222] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#222222] text-sm">Managed by GM Management</h4>
                  <p className="text-xs text-[#717171] mt-0.5">
                    Professionally cleaned, 24/7 dedicated guest support, and concierge services.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-[#FF385C] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#222222] text-sm">Direct WhatsApp Confirmation</h4>
                  <p className="text-xs text-[#717171] mt-0.5">
                    Connect directly with the management team on WhatsApp to confirm dates & key instructions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 text-[#222222] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-[#222222] text-sm">Check-in / Check-out</h4>
                  <p className="text-xs text-[#717171] mt-0.5">
                    Check-in after {property.checkInTime} • Check-out by {property.checkOutTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="pb-6 border-b border-[#DDDDDD]">
              <h3 className="text-lg font-bold text-[#222222] mb-3">About this space</h3>
              <p className="text-[#222222] text-sm leading-relaxed whitespace-pre-line">
                {property.description || 'Welcome to this exceptional property curated by GM Management. Designed with luxurious touches, comfort, and premium amenities for an unforgettable stay.'}
              </p>
            </div>

            {/* Amenities */}
            <div className="pb-6 border-b border-[#DDDDDD]">
              <h3 className="text-lg font-bold text-[#222222] mb-4">What this place offers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(property.amenities && property.amenities.length > 0
                  ? property.amenities
                  : ['Fast Wi-Fi', 'Air conditioning', 'Dedicated workspace', 'Full kitchen', 'Free parking', 'Smart TV', '24/7 Concierge']
                ).map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-[#222222]">
                    {getAmenityIcon(amenity)}
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Availability Calendar */}
            <div className="pb-6 border-b border-[#DDDDDD]" id="property-availability-section">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-[#222222]">Availability & Date Selection</h3>
                {loadingAvailability && <span className="text-xs text-[#717171] animate-pulse">Syncing...</span>}
              </div>
              <p className="text-xs text-[#717171] mb-4">
                Prices and availability are synced in real-time. Blocked dates are reserved or held by staff.
              </p>

              <CalendarPicker
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                onChange={(inDate, outDate) => {
                  setCheckInDate(inDate);
                  setCheckOutDate(outDate);
                }}
                pricePerNight={property.pricePerNight}
                weekdayPrice={property.weekdayPrice}
                weekendPrice={property.weekendPrice}
                blockedSlots={blockedSlots}
                bookedRanges={bookedRanges}
                minNights={property.minNights || 1}
              />
            </div>

            {/* House Rules */}
            <div className="pb-6">
              <h3 className="text-lg font-bold text-[#222222] mb-3">House rules & Policies</h3>
              <ul className="space-y-2 text-sm text-[#222222]">
                {(property.houseRules && property.houseRules.length > 0
                  ? property.houseRules
                  : ['Check-in: After 3:00 PM', 'Checkout: 11:00 AM', 'No smoking allowed indoors', 'Quiet hours from 10:00 PM', 'No parties or unauthorized events']
                ).map((rule, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#717171]" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Sticky Floating Booking Widget */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 rounded-2xl border border-[#DDDDDD] p-6 shadow-sm bg-white space-y-5">
              {/* Header Price with Dual Weekday & Weekend Rates */}
              <div className="pb-4 border-b border-[#F1F1F1] space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-[#222222]">
                      {currencySymbol}{property.weekdayPrice ?? property.pricePerNight}
                    </span>
                    <span className="text-[#717171] text-sm font-normal">/ night (Sun–Thu)</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-[#222222]">
                    <Star className="w-3.5 h-3.5 fill-[#222222] stroke-[#222222]" />
                    <span>{property.rating ? property.rating.toFixed(2) : '4.95'}</span>
                    <span className="text-[#DDDDDD]">•</span>
                    <span className="underline">{property.reviewCount || 12} reviews</span>
                  </div>
                </div>

                {/* Weekend Rate Badge */}
                <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Weekend Rate (Fri & Sat)
                  </span>
                  <span className="font-bold text-[#222222]">
                    {currencySymbol}{property.weekendPrice ?? property.weekdayPrice ?? property.pricePerNight} <span className="font-normal text-slate-500">/ night</span>
                  </span>
                </div>
              </div>

              {/* Date & Guest Inputs Selector Box */}
              <div className="rounded-xl border border-[#DDDDDD] overflow-hidden text-xs">
                <div className="grid grid-cols-2 divide-x divide-[#DDDDDD] border-b border-[#DDDDDD]">
                  <div
                    onClick={() => {
                      document.getElementById('property-availability-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-3 bg-[#FAFAFA] hover:bg-[#F1F1F1] transition cursor-pointer"
                  >
                    <span className="font-bold text-[#222222] uppercase text-[10px] block">CHECK-IN</span>
                    <span className="text-sm font-medium text-[#222222] truncate block mt-0.5">
                      {checkInDate || 'Add date'}
                    </span>
                  </div>
                  <div
                    onClick={() => {
                      document.getElementById('property-availability-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-3 bg-[#FAFAFA] hover:bg-[#F1F1F1] transition cursor-pointer"
                  >
                    <span className="font-bold text-[#222222] uppercase text-[10px] block">CHECK-OUT</span>
                    <span className="text-sm font-medium text-[#222222] truncate block mt-0.5">
                      {checkOutDate || 'Add date'}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <label className="font-bold text-[#222222] uppercase text-[10px] block">GUESTS</label>
                  <select
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="w-full mt-0.5 text-sm font-medium text-[#222222] bg-transparent border-0 focus:ring-0 p-0 cursor-pointer"
                  >
                    {Array.from({ length: property.maxGuests }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} guest{n > 1 ? 's' : ''} (Max {property.maxGuests})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (!checkInDate || !checkOutDate) {
                    document.getElementById('property-availability-section')?.scrollIntoView({ behavior: 'smooth' });
                    return;
                  }
                  setShowReservationModal(true);
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-[#222222] hover:bg-black text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                id="reserve-property-button"
              >
                <MessageCircle className="w-4 h-4 fill-white text-transparent" />
                <span>{checkInDate && checkOutDate ? 'Reserve & Inquire on WhatsApp' : 'Check Availability'}</span>
              </button>

              <p className="text-center text-xs text-[#717171]">
                Direct WhatsApp booking • Instant confirmation
              </p>

              {/* Price Calculation details if dates are selected */}
              {checkInDate && checkOutDate && (
                <div className="space-y-2.5 pt-4 border-t border-[#F1F1F1] text-sm text-[#717171]">
                  {pricing.weekdayNights > 0 && (
                    <div className="flex justify-between">
                      <span className="underline">
                        {currencySymbol}{pricing.weekdayRate} x {pricing.weekdayNights} weekday night{pricing.weekdayNights > 1 ? 's' : ''} (Sun–Thu)
                      </span>
                      <span className="text-[#222222] font-medium">{currencySymbol}{pricing.weekdayTotal}</span>
                    </div>
                  )}

                  {pricing.weekendNights > 0 && (
                    <div className="flex justify-between">
                      <span className="underline">
                        {currencySymbol}{pricing.weekendRate} x {pricing.weekendNights} weekend night{pricing.weekendNights > 1 ? 's' : ''} (Fri–Sat)
                      </span>
                      <span className="text-[#222222] font-medium">{currencySymbol}{pricing.weekendTotal}</span>
                    </div>
                  )}

                  {pricing.cleaningFee > 0 && (
                    <div className="flex justify-between">
                      <span className="underline">Cleaning fee</span>
                      <span className="text-[#222222] font-medium">{currencySymbol}{pricing.cleaningFee}</span>
                    </div>
                  )}
                  {pricing.serviceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="underline">GM Management service fee</span>
                      <span className="text-[#222222] font-medium">{currencySymbol}{pricing.serviceFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-[#DDDDDD] font-bold text-base text-[#222222]">
                    <span>Total ({pricing.nights} night{pricing.nights > 1 ? 's' : ''})</span>
                    <span className="text-[#222222]">{currencySymbol}{pricing.totalPrice}</span>
                  </div>
                </div>
              )}

              {/* Support & Quick Contact */}
              <div className="pt-3 border-t border-[#F1F1F1] text-xs text-[#717171] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[#25D366] font-medium">
                  <ShieldCheck className="w-4 h-4 text-[#25D366]" />
                  Best Rate Guaranteed
                </span>
                <span className="font-semibold text-[#222222]">GM Management Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Bar on Mobile with Safe-Area insets, high z-index and complete pricing visibility */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-md border-t border-[#DDDDDD] px-4 py-3 sm:px-6 shadow-[0_-4px_24px_rgba(0,0,0,0.18)] flex items-center justify-between gap-3 lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-[#222222] tracking-tight">
              {currencySymbol}{property.weekdayPrice ?? property.pricePerNight}
            </span>
            <span className="text-xs text-[#717171] font-normal">/ night</span>
          </div>
          <div className="text-xs font-semibold text-[#FF385C] truncate mt-0.5">
            {checkInDate && checkOutDate ? (
              <span>{pricing.nights} {pricing.nights === 1 ? 'night' : 'nights'} • {currencySymbol}{pricing.totalPrice} total</span>
            ) : (
              <span
                onClick={() => document.getElementById('property-availability-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="underline cursor-pointer text-[#222222]"
              >
                Select dates
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!checkInDate || !checkOutDate) {
              document.getElementById('property-availability-section')?.scrollIntoView({ behavior: 'smooth' });
              return;
            }
            setShowReservationModal(true);
          }}
          className="shrink-0 py-3 px-5 sm:px-6 rounded-xl bg-[#222222] hover:bg-black active:scale-95 text-white font-bold text-sm shadow-md flex items-center gap-2 transition cursor-pointer"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>{checkInDate && checkOutDate ? 'Reserve' : 'Check Dates'}</span>
        </button>
      </div>

      {/* Full Photo Gallery Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-neutral-800 text-white z-10 bg-black/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPhotoModalOpen(false)}
                className="p-2 rounded-full hover:bg-neutral-800 transition text-neutral-300 hover:text-white cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-white line-clamp-1">{property.title}</span>
                <span className="text-xs text-neutral-400">
                  Photo {selectedPhotoIndex + 1} of {images.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGalleryMode(galleryMode === 'slideshow' ? 'grid' : 'slideshow')}
                className="px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>{galleryMode === 'slideshow' ? 'Grid View' : 'Slideshow'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          {galleryMode === 'slideshow' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
              {/* Prev Button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-neutral-700 backdrop-blur-sm transition hover:scale-110 active:scale-90 z-20 cursor-pointer"
                  title="Previous (Left Arrow)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Main Image Display */}
              <div className="max-w-5xl max-h-[72vh] w-full h-full flex items-center justify-center select-none">
                <img
                  src={images[selectedPhotoIndex]}
                  alt={`${property.title} - Photo ${selectedPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Next Button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-neutral-700 backdrop-blur-sm transition hover:scale-110 active:scale-90 z-20 cursor-pointer"
                  title="Next (Right Arrow)"
                >
                  <Chevron
