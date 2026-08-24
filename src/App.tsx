import React, { useState, useEffect } from 'react';
import { Property, Reservation, CompanySettings } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { PropertyCard } from './components/PropertyCard';
import { PropertyDetail } from './components/PropertyDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { MyTripsView } from './components/MyTripsView';
import { SearchModal } from './components/SearchModal';
import { PushNotificationManager } from './components/PushNotificationManager';
import { Logo } from './components/Logo';
import {
  Compass,
  Building2,
  Plus,
  MessageCircle,
  Calendar,
  ShieldCheck,
  Award,
  Sparkles,
  Phone,
  Mail,
  Key,
  Home,
  Heart,
  User,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [properties, setProperties] = useState<Property[]>(() => {
    try {
      const cached = localStorage.getItem('gm_cached_properties');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(() => {
    try {
      const cached = localStorage.getItem('gm_cached_settings');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('gm_admin_auth') === 'true' ||
        sessionStorage.getItem('gm_admin_auth') === 'true'
      );
    } catch {
      return false;
    }
  });
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('gm_cached_properties');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [activeView, setActiveView] = useState<'home' | 'detail' | 'admin' | 'my-trips'>('home');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchCity, setSearchCity] = useState<string>('');
  const [searchGuests, setSearchGuests] = useState<number>(1);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent && properties.length === 0) {
        setLoading(true);
      }

      // Fast critical path: load properties and company settings first
      const [propsData, settsData] = await Promise.all([
        api.getProperties(),
        api.getSettings(),
      ]);

      if (Array.isArray(propsData) && propsData.length > 0) {
        setProperties(propsData);
      }
      if (settsData) {
        setSettings(settsData);
      }
      setLoading(false);

      // Secondary non-blocking fetches in background
      api.getReservations().then((resvs) => {
        if (Array.isArray(resvs)) setReservations(resvs);
      }).catch(() => {});

      api.getNotifications().then((notifs) => {
        if (Array.isArray(notifs)) {
          setUnreadNotificationsCount(notifs.filter((n) => !n.read).length);
        }
      }).catch(() => {});
    } catch (err) {
      console.error('Error loading app data', err);
      setLoading(false);
    }
  };

  // Filter properties
  const filteredProperties = properties.filter((p) => {
    if (selectedCategory !== 'all' && p.propertyType !== selectedCategory) {
      return false;
    }
    if (searchCity && !p.location.city.toLowerCase().includes(searchCity.toLowerCase()) &&
        !p.title.toLowerCase().includes(searchCity.toLowerCase())) {
      return false;
    }
    if (searchGuests > 1 && p.maxGuests < searchGuests) {
      return false;
    }
    return true;
  });

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    setActiveView('detail');
  };

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      setActiveView('admin');
    } else {
      setAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    setAdminLoginModalOpen(false);
    setActiveView('admin');
  };

  const handleAdminLogout = () => {
    try {
      localStorage.removeItem('gm_admin_auth');
      localStorage.removeItem('gm_admin_user');
      sessionStorage.removeItem('gm_admin_auth');
    } catch (e) {
      console.error(e);
    }
    setIsAdminAuthenticated(false);
    if (activeView === 'admin') {
      setActiveView('home');
    }
  };

  const handleApplySearch = (filters: { city: string; maxGuests: number; propertyType: string }) => {
    setSearchCity(filters.city);
    setSearchGuests(filters.maxGuests);
    if (filters.propertyType && filters.propertyType !== 'all') {
      setSelectedCategory(filters.propertyType);
    }
  };

  const currencySymbol = settings?.currencySymbol || '$';
  const whatsappTarget = settings?.whatsappNumber || '+96176141945';
  const waUrl = `https://wa.me/${whatsappTarget.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
    'Hello GM Management, I would like to inquire about booking a property.'
  )}`;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans text-[#222222] selection:bg-[#FF385C] selection:text-white" id="gm-management-app">
      <PushNotificationManager />

      {/* Admin Dashboard View */}
      {activeView === 'admin' ? (
        <AdminDashboard
          onClose={() => {
            setActiveView('home');
            loadData();
          }}
          currencySymbol={currencySymbol}
          onLogout={handleAdminLogout}
        />
      ) : (
        <>
          {/* Main Navigation Bar */}
          <Navbar
            onOpenAdmin={handleOpenAdmin}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => setSelectedCategory(cat)}
            searchCity={searchCity}
            onSearchCityChange={setSearchCity}
            onOpenSearchModal={() => setSearchModalOpen(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            companyWhatsApp={whatsappTarget}
            activeView={activeView}
            onNavigateHome={() => {
              setActiveView('home');
              setSelectedProperty(null);
            }}
            onNavigateTrips={() => setActiveView('my-trips')}
            customLogo={settings?.customLogoData}
            isAdminAuthenticated={isAdminAuthenticated}
            onLogoutAdmin={handleAdminLogout}
          />

          {/* View Controller */}
          {activeView === 'detail' && selectedProperty ? (
            <PropertyDetail
              property={selectedProperty}
              onBack={() => {
                setActiveView('home');
                setSelectedProperty(null);
              }}
              currencySymbol={currencySymbol}
              customLogo={settings?.customLogoData}
            />
          ) : activeView === 'my-trips' ? (
            <div className="flex-1 bg-white">
              <MyTripsView
                reservations={reservations}
                properties={properties}
                onSelectProperty={handleSelectProperty}
                currencySymbol={currencySymbol}
                companyWhatsApp={whatsappTarget}
              />
            </div>
          ) : (
            /* Home / Properties Grid View */
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
              {/* Active Search Filter Pill reset button */}
              {(searchCity || selectedCategory !== 'all') && (
                <div className="mb-6 flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#DDDDDD] shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#222222]">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#717171]" />
                    <span>
                      Filtered by: {searchCity ? `"${searchCity}"` : ''}{' '}
                      {selectedCategory !== 'all' ? `• Type: ${selectedCategory}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchCity('');
                      setSelectedCategory('all');
                      setSearchGuests(1);
                    }}
                    className="text-xs font-bold text-[#FF385C] underline hover:opacity-80 transition cursor-pointer"
                  >
                    Reset all filters
                  </button>
                </div>
              )}

              {/* Properties Grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="animate-pulse space-y-3">
                      <div className="aspect-[20/19] bg-[#EBEBEB] rounded-xl w-full" />
                      <div className="h-4 bg-[#EBEBEB] rounded-md w-3/4" />
                      <div className="h-3 bg-[#EBEBEB] rounded-md w-1/2" />
                      <div className="h-4 bg-[#EBEBEB] rounded-md w-1/3" />
                    </div>
                  ))}
                </div>
              ) : filteredProperties.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {filteredProperties.map((prop) => (
                    <PropertyCard
                      key={prop.id}
                      property={prop}
                      onClick={() => handleSelectProperty(prop)}
                      currencySymbol={currencySymbol}
                    />
                  ))}
                </div>
              ) : (
                /* Empty state when no properties match or none added yet */
                <div className="bg-white rounded-2xl border border-[#DDDDDD] p-8 sm:p-12 text-center my-6 shadow-sm max-w-2xl mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFF8F6] border border-[#FF385C20] flex items-center justify-center mx-auto mb-4 text-[#FF385C]">
                    <Building2 className="w-8 h-8 stroke-[1.8]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#222222]">
                    {properties.length === 0
                      ? (isAdminAuthenticated ? 'Welcome to GM Management Admin' : 'Luxury Stays & Villas')
                      : 'No properties found for this search'}
                  </h3>
                  <p className="text-sm text-[#717171] mt-2 max-w-md mx-auto">
                    {properties.length === 0
                      ? (isAdminAuthenticated
                          ? 'Your platform is active. You are signed in as Admin. Click below to add your first property listing, photos, and availability.'
                          : 'Our curated collection of luxury properties and chalets is currently being updated. For immediate booking assistance or VIP inquiries, contact our concierge directly on WhatsApp.')
                      : 'Try broadening your search or resetting category filters to see other luxury stays.'}
                  </p>

                  {properties.length === 0 ? (
                    isAdminAuthenticated ? (
                      <button
                        type="button"
                        onClick={handleOpenAdmin}
                        className="mt-6 py-3 px-6 rounded-xl bg-[#222222] hover:bg-black text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
                        id="create-first-property-btn"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Your First Property</span>
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/${whatsappTarget}?text=${encodeURIComponent('Hello GM Management, I would like to inquire about available luxury properties and bookings.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 py-3 px-6 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm transition inline-flex items-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-white text-transparent" />
                        <span>Inquire on WhatsApp</span>
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchCity('');
                        setSelectedCategory('all');
                      }}
                      className="mt-6 py-2.5 px-5 rounded-xl bg-[#222222] text-white font-semibold text-xs hover:bg-black transition"
                    >
                      Show All Properties
                    </button>
                  )}
                </div>
              )}

              {/* Bottom GM Management Guarantee Banner */}
              <div className="mt-16 bg-white rounded-2xl border border-[#DDDDDD] p-6 sm:p-8 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F1F1F1] text-[#222222] flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5 fill-[#222222] text-transparent" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#222222] text-sm">Direct WhatsApp Confirmation</h4>
                      <p className="text-xs text-[#717171] mt-0.5">
                        Inquire instantly for any stay and connect directly with the GM Management host on WhatsApp.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F1F1F1] text-[#222222] flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#222222] text-sm">Live Calendar Synchronization</h4>
                      <p className="text-xs text-[#717171] mt-0.5">
                        All availability and bookings sync automatically in real-time to avoid any double bookings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F1F1F1] text-[#222222] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-[#25D366]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#222222] text-sm">Automated Confirmations</h4>
                      <p className="text-xs text-[#717171] mt-0.5">
                        Automated email confirmation receipts and reminder push alerts dispatched for every reservation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          )}

          {/* Footer in Natural Tones */}
          <footer className="bg-white border-t border-[#DDDDDD] mt-12 py-8 pb-24 md:pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#717171]">
              <div className="flex items-center gap-3">
                <Logo size="sm" customLogo={settings?.customLogoData} />
                <span>© {new Date().getFullYear()} GM Management • Premium Vacation Rentals</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-medium">
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#222222] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>WhatsApp: {whatsappTarget}</span>
                </a>
                <a href={`mailto:${settings?.contactEmail || 'gm70613266@gmail.com'}`} className="hover:text-[#222222] flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#6C7D93]" />
                  <span>{settings?.contactEmail || 'gm70613266@gmail.com'}</span>
                </a>
                <button type="button" onClick={handleOpenAdmin} className="hover:text-black flex items-center gap-1 font-bold text-[#222222]">
                  <Key className="w-3 h-3 text-amber-500" />
                  <span>Staff Admin</span>
                </button>
              </div>
            </div>
          </footer>

          {/* Mobile Bottom Navigation Bar (Hidden when on Property Detail view so the Booking/Reservation Bar has full space and visibility) */}
          {activeView !== 'detail' && activeView !== 'admin' && (
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#DDDDDD] py-2 px-6 flex items-center justify-around z-40 shadow-lg" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveView('home');
                  setSelectedProperty(null);
                }}
                className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
                  activeView === 'home' ? 'text-[#FF385C]' : 'text-[#717171]'
                }`}
              >
                <Compass className="w-5 h-5" />
                <span>Explore</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#717171]"
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Filters</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('my-trips')}
                className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
                  activeView === 'my-trips' ? 'text-[#FF385C]' : 'text-[#717171]'
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span>My Trips</span>
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#25D366]"
              >
                <MessageCircle className="w-5 h-5 fill-[#25D366]" />
                <span>WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={handleOpenAdmin}
                className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
                  activeView === 'admin' ? 'text-[#FF385C]' : 'text-[#717171]'
                }`}
              >
                <Key className="w-5 h-5" />
                <span>Admin</span>
              </button>
            </nav>
          )}

          {/* Search Modal */}
          {searchModalOpen && (
            <SearchModal
              onClose={() => setSearchModalOpen(false)}
              onApplySearch={handleApplySearch}
              currentCity={searchCity}
              currentGuests={searchGuests}
            />
          )}

          {/* Admin Authentication Login Modal */}
          <AdminLoginModal
            isOpen={adminLoginModalOpen}
            onClose={() => setAdminLoginModalOpen(false)}
            onLoginSuccess={handleAdminLoginSuccess}
            customLogo={settings?.customLogoData}
          />
        </>
      )}
    </div>
  );
}
