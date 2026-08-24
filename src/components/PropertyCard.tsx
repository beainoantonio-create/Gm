import React, { useState } from 'react';
import { Star, Heart, ChevronLeft, ChevronRight, MapPin, Users, BedDouble, Building2 } from 'lucide-react';
import { Property } from '../types';

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
  currencySymbol?: string;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onClick,
  currencySymbol = '$',
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  const images = property.images && property.images.length > 0 ? property.images : [];

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer flex flex-col transition-all duration-200"
      id={`property-card-${property.id}`}
    >
      {/* Image Container with Airbnb ratio & natural rounded styling */}
      <div className="relative aspect-[20/19] w-full overflow-hidden rounded-xl bg-[#EBEBEB] mb-3 border border-[#F1F1F1]">
        {images.length > 0 ? (
          <img
            src={images[activeImageIndex]}
            alt={property.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-[#EBEBEB] text-[#717171] p-4 text-center">
            <Building2 className="w-10 h-10 mb-2 stroke-1 text-[#717171]" />
            <span className="text-xs font-semibold text-[#222222]">{property.title}</span>
            <span className="text-[11px] text-[#717171] mt-1">Photo upload in Admin</span>
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:scale-110 active:scale-95 transition-transform z-10"
          aria-label="Favorite property"
        >
          <Heart
            className={`w-6 h-6 stroke-[2] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-colors ${
              isLiked
                ? 'fill-[#FF385C] stroke-[#FF385C]'
                : 'fill-black/30 stroke-white'
            }`}
          />
        </button>

        {/* Carousel arrows (shows on hover if multiple images) */}
        {images.length > 1 && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white hover:scale-105 active:scale-90 transition text-[#222222]"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white hover:scale-105 active:scale-90 transition text-[#222222]"
              aria-label="Next photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Carousel Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {images.slice(0, 5).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === activeImageIndex
                    ? 'w-4 bg-white shadow-sm'
                    : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}

        {/* Property Type Pill */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-semibold text-[#222222] shadow-sm border border-[#DDDDDD]/40">
          {property.propertyType}
        </div>
      </div>

      {/* Property Details in Natural Tones */}
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-[#222222] text-sm leading-snug line-clamp-1">
          {property.location.city}, {property.location.country}
        </h3>
        <div className="flex items-center gap-1 text-xs shrink-0 font-medium text-[#222222]">
          <Star className="w-3.5 h-3.5 fill-[#222222] stroke-[#222222]" />
          <span>{property.rating ? property.rating.toFixed(2) : '4.95'}</span>
        </div>
      </div>

      <p className="text-xs text-[#717171] line-clamp-1 mt-0.5 font-normal">
        {property.subtitle || property.title}
      </p>

      {/* Quick Specs */}
      <div className="flex items-center gap-2 text-xs text-[#717171] mt-1">
        <span>{property.maxGuests} guests</span>
        <span>•</span>
        <span>{property.bedrooms} {property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</span>
      </div>

      {/* Price */}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[#222222] text-sm">
        <div className="flex items-baseline gap-1">
          <span className="font-bold">
            {currencySymbol}{property.weekdayPrice ?? property.pricePerNight}
          </span>
          <span className="text-[#717171] text-xs font-normal">night</span>
        </div>
        {(property.weekendPrice && property.weekendPrice !== (property.weekdayPrice ?? property.pricePerNight)) ? (
          <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">
            {currencySymbol}{property.weekendPrice} Fri–Sat
          </span>
        ) : null}
      </div>
    </div>
  );
};
