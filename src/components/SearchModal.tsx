import React, { useState } from 'react';
import { X, Search, MapPin, Users, Calendar, Sparkles } from 'lucide-react';

interface SearchModalProps {
  onClose: () => void;
  onApplySearch: (filters: { city: string; maxGuests: number; propertyType: string }) => void;
  currentCity: string;
  currentGuests: number;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  onClose,
  onApplySearch,
  currentCity,
  currentGuests,
}) => {
  const [city, setCity] = useState(currentCity);
  const [guests, setGuests] = useState(currentGuests || 1);
  const [propertyType, setPropertyType] = useState('all');

  const popularDestinations = [
    { city: 'Batroun', desc: 'Coastal villas & nightlife' },
    { city: 'Beirut', desc: 'Luxury city penthouses' },
    { city: 'Faraya / Kfardebian', desc: 'Mountain chalets & snow' },
    { city: 'Faqa', desc: 'Scenic mountain views' },
    { city: 'Byblos (Jbeil)', desc: 'Historic beach houses' },
    { city: 'Broumana', desc: 'Pine forests & breeze' },
  ];

  const handleSearch = () => {
    onApplySearch({ city, maxGuests: guests, propertyType });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#DDDDDD] animate-in fade-in zoom-in-95 text-[#222222]">
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F1F1]">
          <h3 className="text-lg font-bold text-[#222222]">Find your next stay with GM Management</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F1F1F1] text-[#717171] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Destination */}
          <div>
            <label className="block text-xs font-bold text-[#222222] uppercase tracking-wide mb-1">
              Where to?
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#717171] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Search city, region..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#DDDDDD] text-sm text-[#222222] focus:outline-none focus:border-[#222222] bg-[#FAFAFA]"
              />
            </div>

            {/* Quick destination chips in Natural Tones */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {popularDestinations.map((dest) => (
                <button
                  key={dest.city}
                  type="button"
                  onClick={() => setCity(dest.city)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                    city.toLowerCase() === dest.city.toLowerCase()
                      ? 'bg-[#222222] text-white border-[#222222] font-semibold'
                      : 'bg-[#F1F1F1] text-[#222222] border-[#DDDDDD] hover:bg-[#EBEBEB]'
                  }`}
                >
                  {dest.city}
                </button>
              ))}
            </div>
          </div>

          {/* Number of Guests */}
          <div>
            <label className="block text-xs font-bold text-[#222222] uppercase tracking-wide mb-1">
              Guests
            </label>
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#DDDDDD] bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#717171]" />
                <span className="text-sm font-semibold text-[#222222]">
                  {guests} Guest{guests > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-8 h-8 rounded-full border border-[#DDDDDD] bg-white flex items-center justify-center font-bold text-[#222222] hover:border-[#222222] cursor-pointer"
                >
                  -
                </button>
                <span className="w-6 text-center font-bold text-sm text-[#222222]">{guests}</span>
                <button
                  type="button"
                  onClick={() => setGuests(guests + 1)}
                  className="w-8 h-8 rounded-full border border-[#DDDDDD] bg-white flex items-center justify-center font-bold text-[#222222] hover:border-[#222222] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Property Category */}
          <div>
            <label className="block text-xs font-bold text-[#222222] uppercase tracking-wide mb-1">
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#DDDDDD] text-sm text-[#222222] bg-[#FAFAFA] focus:outline-none focus:border-[#222222] cursor-pointer"
            >
              <option value="all">Any Property Type</option>
              <option value="Villa">Villa with Private Pool</option>
              <option value="Chalet">Mountain Chalet</option>
              <option value="Penthouse">Luxury Penthouse</option>
              <option value="Beach House">Beachfront House</option>
              <option value="Mansion">Mansion</option>
              <option value="Apartment">Modern Apartment</option>
            </select>
          </div>

          {/* Submit Search button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSearch}
              className="w-full py-3.5 rounded-xl bg-[#222222] hover:bg-black text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search Available Properties</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
