import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Globe,
  Menu,
  User,
  ShieldCheck,
  Building2,
  MessageCircle,
  Sparkles,
  Home,
  Waves,
  Palmtree,
  Mountain,
  Building,
  Key,
  Compass,
  Crown,
  Calendar,
  X
} from 'lucide-react';
import { Logo } from './Logo';

interface NavbarProps {
  onOpenAdmin: () => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchCity: string;
  onSearchCityChange: (city: string) => void;
  onOpenSearchModal: () => void;
  unreadNotificationsCount?: number;
  companyWhatsApp?: string;
  activeView: 'home' | 'detail' | 'admin' | 'my-trips';
  onNavigateHome: () => void;
  onNavigateTrips: () => void;
  customLogo?: string;
  isAdminAuthenticated?: boolean;
  onLogoutAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAdmin,
  selectedCategory,
  onSelectCategory,
  searchCity,
  onSearchCityChange,
  onOpenSearchModal,
  unreadNotificationsCount = 0,
  companyWhatsApp = '+96176141945',
  activeView,
  onNavigateHome,
  onNavigateTrips,
  customLogo,
  isAdminAuthenticated = false,
  onLogoutAdmin,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'All Properties', icon: Compass },
    { id: 'Villa', label: 'Luxury Villas', icon: Crown },
    { id: 'Beachfront', label: 'Beachfront', icon: Waves },
    { id: 'Chalet', label: 'Mountain Chalets', icon: Mountain },
    { id: 'Penthouse', label: 'Penthouses', icon: Building },
    { id: 'Mansion', label: 'Mansions', icon: Building2 },
    { id: 'Apartment', label: 'City Apartments', icon: Home },
    { id: 'Cottage', label: 'Countryside', icon: Palmtree },
  ];

  const whatsappClean = companyWhatsApp.replace(/[^\d+]/g, '');
  const waUrl = `https://wa.me/${whatsappClean.replace('+', '')}?text=${encodeURIComponent(
    'Hello GM Management, I am browsing your property listings and would like some assistance.'
  )}`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DDDDDD] transition-all">
      {/* Top Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div onClick={onNavigateHome} className="shrink-0 cursor-pointer">
          <Logo size="md" customLogo={customLogo} />
        </div>

        {/* Center: Search Pill with Natural Tones */}
        <div
          onClick={onOpenSearchModal}
          className="hidden md:flex items-center divide-x divide-[#DDDDDD] rounded-full border border-[#DDDDDD] py-2 px-4 shadow-sm hover:shadow-md transition cursor-pointer text-xs font-semibold text-[#222222]"
          id="airbnb-search-bar"
        >
          <button type="button" className="px-3 hover:text-black transition">
            {searchCity ? searchCity : 'Anywhere'}
          </button>
          <button type="button" className="px-3 hover:text-black transition">
            Any week
          </button>
          <div className="pl-3 pr-1 flex items-center gap-2">
            <span className="text-[#717171] font-normal">Add guests</span>
            <div className="w-8 h-8 rounded-full bg-[#FF385C] text-white flex items-center justify-center shrink-0">
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick WhatsApp Support Link */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 py-2 px-3 rounded-full hover:bg-[#F1F1F1] text-xs font-semibold text-[#222222] transition"
            title="Chat with GM Management on WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
            <span>WhatsApp</span>
          </a>

          {/* User Menu Dropdown (3 Horizontal Bars Button) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-2 pl-3 rounded-full border border-[#DDDDDD] hover:shadow-md transition text-[#222222] cursor-pointer bg-white"
              aria-label="User navigation menu"
              id="main-user-hamburger-menu-btn"
            >
              <Menu className="w-4 h-4 text-[#717171]" />
              <div className="w-7 h-7 rounded-full bg-[#222222] text-white flex items-center justify-center text-xs font-bold">
                GM
              </div>
              {unreadNotificationsCount > 0 && isAdminAuthenticated && (
                <span className="w-2 h-2 rounded-full bg-[#FF385C] animate-pulse -ml-1" />
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-60 rounded-2xl bg-white shadow-xl border border-[#DDDDDD] py-2 text-xs font-medium text-[#222222] z-50 animate-in fade-in zoom-in-95">
                {/* Admin Portal (Trigger Login if not logged in, or open dashboard) */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FAFAFA] font-bold text-[#222222] flex items-center justify-between group cursor-pointer"
                  id="menu-admin-portal-item"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
                    <span>{isAdminAuthenticated ? 'Admin Dashboard' : 'Staff Admin Login'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isAdminAuthenticated
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-[#FF385C] border border-rose-200'
                  }`}>
                    {isAdminAuthenticated ? 'Active' : 'Login'}
                  </span>
                </button>

                {isAdminAuthenticated && onLogoutAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogoutAdmin();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#FFF5F5] text-rose-600 font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Log Out Admin</span>
                  </button>
                )}

                <div className="my-1 border-t border-[#F1F1F1]" />

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onNavigateTrips();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FAFAFA] flex items-center gap-2 text-[#222222] cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#717171]" />
                  <span>My Reservations</span>
                </button>

                <div className="my-1 border-t border-[#F1F1F1]" />

                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FAFAFA] flex items-center gap-2 text-[#25D366] font-semibold"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Direct WhatsApp Support</span>
                </a>

                <div className="px-4 py-2 text-[10px] text-[#717171] bg-[#FAFAFA] border-t border-[#F1F1F1] mt-1">
                  GM Management • Luxury Rentals
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar Pill (visible on mobile only) */}
      <div className="px-4 pb-3 md:hidden">
        <div
          onClick={onOpenSearchModal}
          className="flex items-center gap-3 p-3 rounded-full border border-[#DDDDDD] shadow-sm bg-[#FAFAFA] text-xs text-[#222222] cursor-pointer"
        >
          <Search className="w-4 h-4 text-[#717171]" />
          <div className="flex flex-col text-left">
            <span className="font-bold text-[#222222]">Where to?</span>
            <span className="text-[10px] text-[#717171]">Anywhere • Any week • Add guests</span>
          </div>
        </div>
      </div>

      {/* Category Filter Carousel with Natural Tones */}
      {activeView === 'home' && (
        <div className="border-t border-[#F1F1F1]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-8 overflow-x-auto scrollbar-none">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex flex-col items-center gap-1.5 pb-2 border-b-2 transition whitespace-nowrap group cursor-pointer ${
                    isSelected
                      ? 'border-[#222222] text-[#222222] font-semibold opacity-100'
                      : 'border-transparent text-[#717171] hover:text-[#222222] hover:border-[#DDDDDD] opacity-70 hover:opacity-100'
                  }`}
                >
                  <Icon className={`w-6 h-6 stroke-[1.7] transition group-hover:scale-105 ${isSelected ? 'text-[#222222]' : 'text-[#717171]'}`} />
                  <span className="text-xs">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
