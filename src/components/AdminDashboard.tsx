import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Calendar,
  MessageCircle,
  Bell,
  Settings as SettingsIcon,
  Trash2,
  Edit,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Phone,
  Mail,
  User,
  AlertTriangle,
  Send,
  Download,
  Ban,
  Check,
  DollarSign,
  LogOut,
  KeyRound,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Property, Reservation, NotificationItem, CompanySettings, BlockedSlot } from '../types';
import { api } from '../services/api';
import { Logo } from './Logo';

interface AdminDashboardProps {
  onClose: () => void;
  currencySymbol?: string;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onClose,
  currencySymbol = '$',
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'availability' | 'reservations' | 'calendar-sync' | 'notifications' | 'settings'>('properties');
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Property Form State
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState<Partial<Property>>({
    title: '',
    subtitle: '',
    description: '',
    propertyType: 'Villa',
    location: { city: 'Beirut', country: 'Lebanon', address: '' },
    pricePerNight: 200,
    cleaningFee: 40,
    serviceFeePercentage: 10,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    maxGuests: 4,
    images: [],
    amenities: ['Fast Wi-Fi', 'Air conditioning', 'Full kitchen', 'Free parking', 'Smart TV'],
    houseRules: ['No smoking indoors', 'Quiet hours after 10 PM', 'No unauthorized parties'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    whatsappNumber: '+96176141945',
    minNights: 1,
  });

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSavingProperty, setIsSavingProperty] = useState(false);

  // Availability Blocker State
  const [selectedPropertyIdForBlock, setSelectedPropertyIdForBlock] = useState<string>('');
  const [propertyAvailability, setPropertyAvailability] = useState<{
    blockedSlots: BlockedSlot[];
    reservations: any[];
  }>({ blockedSlots: [], reservations: [] });
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState<'Staff Block' | 'Maintenance' | 'Owner Stay' | 'Offline Booking'>('Staff Block');
  const [blockNote, setBlockNote] = useState('');
  const [blockingInProgress, setBlockingInProgress] = useState(false);

  // Toast / Status banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // iCal Sync State
  const [icalUrlInput, setIcalUrlInput] = useState('');
  const [icalSourceName, setIcalSourceName] = useState('Airbnb');
  const [isSyncingIcal, setIsSyncingIcal] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      // Using allSettled (not all) so one failing fetch - e.g. a brief network
      // hiccup on notifications - doesn't wipe out data that loaded fine, like
      // properties. Each piece is handled independently below.
      const [propsResult, resvsResult, notifsResult, settsResult] = await Promise.allSettled([
        api.getProperties(),
        api.getReservations(),
        api.getNotifications(),
        api.getSettings(),
      ]);

      if (propsResult.status === 'fulfilled') {
        setProperties(propsResult.value);
        if (propsResult.value.length > 0 && !selectedPropertyIdForBlock) {
          setSelectedPropertyIdForBlock(propsResult.value[0].id);
          loadPropertyAvailability(propsResult.value[0].id);
        }
      } else {
        console.error('Failed to load properties:', propsResult.reason);
      }

      if (resvsResult.status === 'fulfilled') {
        setReservations(resvsResult.value);
      } else {
        console.error('Failed to load reservations:', resvsResult.reason);
      }

      if (notifsResult.status === 'fulfilled') {
        setNotifications(notifsResult.value);
      } else {
        console.error('Failed to load notifications:', notifsResult.reason);
      }

      if (settsResult.status === 'fulfilled') {
        setSettings(settsResult.value);
      } else {
        console.error('Failed to load settings:', settsResult.reason);
      }

      const failedCount = [propsResult, resvsResult, notifsResult, settsResult].filter(
        (r) => r.status === 'rejected'
      ).length;
      if (failedCount > 0) {
        showToast(`${failedCount} of 4 dashboard sections failed to load - try the refresh button.`, 'error');
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPropertyAvailability = async (propId: string) => {
    try {
      const data = await api.getAvailability(propId);
      setPropertyAvailability({
        blockedSlots: data.blockedSlots || [],
        reservations: data.reservations || []
      });
    } catch (err) {
      console.error('Error fetching availability', err);
    }
  };

  const handlePropertySelectForBlock = (propId: string) => {
    setSelectedPropertyIdForBlock(propId);
    loadPropertyAvailability(propId);
  };

  // Image Upload helper with client-side image compression and loading indicator
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    const fileList: File[] = Array.from(files);
    let loadedCount = 0;
    const newImages: string[] = [];

    fileList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const rawBase64 = uploadEvent.target?.result as string;
        if (!rawBase64) {
          loadedCount++;
          if (loadedCount === fileList.length) setIsUploadingImages(false);
          return;
        }

        // Compress image using canvas to ensure fast saves, responsive gallery loads & ultra-reliable cloud persistence
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            newImages.push(compressed);
          } else {
            newImages.push(rawBase64);
          }

          loadedCount++;
          if (loadedCount === fileList.length) {
            const combined = [...(propertyForm.images || []), ...newImages];
            setPropertyForm((prev) => ({
              ...prev,
              images: combined,
            }));
            setIsUploadingImages(false);
            showToast(`${newImages.length} photo(s) uploaded successfully!`);
          }
        };

        img.onerror = () => {
          newImages.push(rawBase64);
          loadedCount++;
          if (loadedCount === fileList.length) {
            const combined = [...(propertyForm.images || []), ...newImages];
            setPropertyForm((prev) => ({
              ...prev,
              images: combined,
            }));
            setIsUploadingImages(false);
            showToast(`${newImages.length} photo(s) uploaded!`);
          }
        };

        img.src = rawBase64;
      };

      reader.onerror = () => {
        loadedCount++;
        if (loadedCount === fileList.length) setIsUploadingImages(false);
      };

      reader.readAsDataURL(file);
    });

    // Reset input so user can re-upload if needed
    e.target.value = '';
  };

  const handleMoveImage = (fromIdx: number, toIdx: number) => {
    const list = [...(propertyForm.images || [])];
    if (toIdx < 0 || toIdx >= list.length) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    setPropertyForm((prev) => ({
      ...prev,
      images: list,
    }));
  };

  const handleSetCoverImage = (index: number) => {
    handleMoveImage(index, 0);
    showToast('Cover photo set to the first position');
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const newImgs = [...(propertyForm.images || []), imageUrlInput.trim()];
    setPropertyForm((prev) => ({
      ...prev,
      images: newImgs,
    }));
    setImageUrlInput('');
    showToast('Image URL added!');
  };

  const handleRemoveImage = (index: number) => {
    setPropertyForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyForm.title?.trim()) {
      showToast('Property title is required', 'error');
      return;
    }

    if (!propertyForm.location?.city?.trim()) {
      showToast('City/Region is required', 'error');
      return;
    }

    try {
      setIsSavingProperty(true);
      if (editingPropertyId) {
        const updated = await api.updateProperty(editingPropertyId, propertyForm);
        setProperties((prev) => prev.map((p) => (p.id === editingPropertyId ? updated : p)));
        showToast(`Property "${updated.title}" updated successfully!`);
      } else {
        const created = await api.createProperty(propertyForm);
        setProperties((prev) => [created, ...prev]);
        if (!selectedPropertyIdForBlock) {
          setSelectedPropertyIdForBlock(created.id);
          loadPropertyAvailability(created.id);
        }
        showToast(`Property "${created.title}" listed successfully!`);
      }
      setIsCreatingProperty(false);
      setEditingPropertyId(null);
      resetPropertyForm();
    } catch (err: any) {
      showToast(err.message || 'Failed to save property', 'error');
    } finally {
      setIsSavingProperty(false);
    }
  };

  const resetPropertyForm = () => {
    setPropertyForm({
      title: '',
      subtitle: '',
      description: '',
      propertyType: 'Villa',
      location: { city: 'Beirut', country: 'Lebanon', address: '' },
      pricePerNight: 150,
      weekdayPrice: 150,
      weekendPrice: 220,
      cleaningFee: 40,
      serviceFeePercentage: 10,
      bedrooms: 2,
      beds: 2,
      bathrooms: 2,
      maxGuests: 4,
      images: [],
      amenities: ['Fast Wi-Fi', 'Air conditioning', 'Full kitchen', 'Free parking', 'Smart TV'],
      houseRules: ['No smoking indoors', 'Quiet hours after 10 PM', 'No unauthorized parties'],
      checkInTime: '15:00',
      checkOutTime: '11:00',
      whatsappNumber: settings?.whatsappNumber || '+96176141945',
      minNights: 1,
    });
  };

  const handleEditProperty = (prop: Property) => {
    setPropertyForm({ ...prop });
    setEditingPropertyId(prop.id);
    setIsCreatingProperty(true);
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property? This will also remove associated calendar blocks.')) return;
    try {
      await api.deleteProperty(id);
      setProperties((prev) => prev.filter((p) => p.id !== id));
      showToast('Property deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete property', 'error');
    }
  };

  // Availability Blocker handlers
  const handleBlockDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyIdForBlock || !blockStartDate || !blockEndDate) {
      showToast('Please select a property, start date, and end date', 'error');
      return;
    }
    if (blockStartDate > blockEndDate) {
      showToast('Start date must be before end date', 'error');
      return;
    }

    try {
      setBlockingInProgress(true);
      const newSlot = await api.blockDates(selectedPropertyIdForBlock, {
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason,
        note: blockNote,
      });
      setPropertyAvailability((prev) => ({
        ...prev,
        blockedSlots: [...prev.blockedSlots, newSlot],
      }));
      setBlockStartDate('');
      setBlockEndDate('');
      setBlockNote('');
      showToast(`Dates ${newSlot.startDate} to ${newSlot.endDate} blocked in real-time!`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to block dates', 'error');
    } finally {
      setBlockingInProgress(false);
    }
  };

  const handleUnblockSlot = async (slotId: string) => {
    if (!selectedPropertyIdForBlock) return;
    try {
      await api.unblockDates(selectedPropertyIdForBlock, slotId);
      setPropertyAvailability((prev) => ({
        ...prev,
        blockedSlots: prev.blockedSlots.filter((s) => s.id !== slotId),
      }));
      showToast('Slot unblocked & opened for booking');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to unblock slot', 'error');
    }
  };

  // iCal Sync Handler (Airbnb, VRBO, Google Calendar, Apple Calendar)
  const handleSyncIcal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyIdForBlock || !icalUrlInput.trim()) {
      showToast('Please paste a valid iCal (.ics) URL', 'error');
      return;
    }

    try {
      setIsSyncingIcal(true);
      const res = await api.syncIcal(selectedPropertyIdForBlock, icalUrlInput.trim(), icalSourceName);
      showToast(res.message || `Successfully synced ${res.importedCount} dates from ${icalSourceName}!`);
      setIcalUrlInput('');
      loadPropertyAvailability(selectedPropertyIdForBlock);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to sync calendar feed', 'error');
    } finally {
      setIsSyncingIcal(false);
    }
  };

  // Reservation Status change
  const handleUpdateStatus = async (id: string, status: Reservation['status']) => {
    try {
      const updated = await api.updateReservationStatus(id, status);
      setReservations((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast(`Reservation ${id} updated to ${status}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Send Check-in / Check-out Reminder
  const handleSendReminder = async (reservationId: string, type: 'reminder_checkin' | 'reminder_checkout') => {
    try {
      await api.sendReminder(reservationId, type);
      showToast(`Automated reminder dispatched to guest!`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send reminder', 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showToast('Company settings saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  const allAmenitiesOptions = [
    'Fast Wi-Fi',
    'Air conditioning',
    'Private Swimming Pool',
    'Full kitchen',
    'Free parking',
    'Smart TV',
    'Sea View',
    'Mountain View',
    'Hot tub / Jacuzzi',
    'Washer & Dryer',
    'Dedicated workspace',
    'BBQ Grill',
    'Balcony / Terrace',
    'Gym / Fitness',
    '24/7 Concierge',
    'Elevator'
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20 font-sans" id="admin-dashboard-container">
      {/* Toast message */}
      {statusMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
            statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Top Admin Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" customLogo={settings?.customLogoData} showText={true} textDark={false} />
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-md bg-rose-500/20 text-[#FF385C] text-[11px] font-bold tracking-wider uppercase border border-rose-500/30">
              Staff Portal
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadAllData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs flex items-center gap-1.5 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
              id="back-to-public-site-button"
            >
              Exit to Site
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="py-2 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                id="admin-logout-btn"
                title="Log out of Staff Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-2 py-2 text-xs font-semibold scrollbar-none">
          {[
            { id: 'properties', label: 'Properties & Listings', icon: Building2, badge: properties.length },
            { id: 'availability', label: 'Real-Time Availability & Blocker', icon: Calendar },
            { id: 'reservations', label: 'Inquiries & Reservations', icon: MessageCircle, badge: reservations.length },
            { id: 'calendar-sync', label: 'Google Calendar & iCal Sync', icon: Calendar },
            { id: 'notifications', label: 'Automated Reminders & Alerts', icon: Bell, badge: notifications.filter(n => !n.read).length },
            { id: 'settings', label: 'Business & WhatsApp Config', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Metric Cards Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Total Properties</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-white">{properties.length}</span>
              <Building2 className="w-5 h-5 text-rose-500" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Live on website</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Reservations & Inquiries</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-white">{reservations.length}</span>
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              {reservations.filter(r => r.status === 'confirmed').length} Confirmed
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">Staff Blocked Slots</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-white">
                {propertyAvailability.blockedSlots.length}
              </span>
              <Ban className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-[11px] text-amber-400 mt-1 block">Zero double-booking guarantee</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl">
            <span className="text-xs text-slate-400 font-medium">WhatsApp Sync Status</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-white truncate">{settings?.whatsappNumber || 'Active'}</span>
              <Phone className="w-5 h-5 text-[#25D366]" />
            </div>
            <span className="text-[11px] text-emerald-400 mt-1 block">Instant guest chat link</span>
          </div>
        </div>

        {/* TAB 1: PROPERTIES MANAGEMENT */}
        {activeTab === 'properties' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Property Listings</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create, configure, and upload photos for properties managed by GM Management.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPropertyForm();
                  setEditingPropertyId(null);
                  setIsCreatingProperty(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white text-xs font-bold shadow-lg hover:opacity-90 transition flex items-center justify-center gap-2 cursor-pointer"
                id="add-new-property-button"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Property</span>
              </button>
            </div>

            {/* Properties List */}
            {properties.length === 0 ? (
              <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-3xl p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-200">No properties listed yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click the button below to add your first property listing with custom photos, pricing, amenities, and WhatsApp booking.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetPropertyForm();
                    setIsCreatingProperty(true);
                  }}
                  className="mt-4 py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Listing</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {properties.map((prop) => (
                  <div
                    key={prop.id}
                    className="bg-slate-800/80 border border-slate-700/70 rounded-2xl overflow-hidden flex flex-col justify-between shadow-md"
                  >
                    <div>
                      {/* Photo preview */}
                      <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden">
                        {prop.images && prop.images.length > 0 ? (
                          <img
                            src={prop.images[0]}
                            alt={prop.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                            <ImageIcon className="w-8 h-8 mb-1 text-slate-600" />
                            <span>No photos uploaded</span>
                          </div>
                        )}
                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white">
                          {prop.propertyType}
                        </div>
                        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] font-bold text-white">
                            {currencySymbol}{prop.weekdayPrice ?? prop.pricePerNight} <span className="text-slate-400 font-normal">Sun-Thu</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                            {currencySymbol}{prop.weekendPrice ?? prop.weekdayPrice ?? prop.pricePerNight} <span className="text-rose-200 font-normal">Fri-Sat</span>
                          </span>
                        </div>
                        {prop.images && prop.images.length > 0 && (
                          <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white">
                            {prop.images.length} photo{prop.images.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h4 className="font-bold text-white text-base truncate">{prop.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {prop.location.city}, {prop.location.country}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-700/50 flex-wrap">
                          <span>{prop.maxGuests} guests</span>
                          <span>•</span>
                          <span>{prop.bedrooms} {prop.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 pt-0 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditProperty(prop)}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Listing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProperty(prop.id)}
                        className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition cursor-pointer"
                        title="Delete Property"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create/Edit Property Modal */}
            {isCreatingProperty && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 text-slate-100 shadow-2xl my-auto animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-white">
                      {editingPropertyId ? 'Edit Property' : 'Add New Property Listing'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCreatingProperty(false)}
                      className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveProperty} className="mt-4 space-y-4 text-xs">
                    {/* Basic info */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Property Title *</label>
                      <input
                        type="text"
                        required
                        value={propertyForm.title || ''}
                        onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                        placeholder="e.g. Villa Horizon - Private Pool & Sea Views"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Property Type</label>
                        <select
                          value={propertyForm.propertyType || 'Villa'}
                          onChange={(e) => setPropertyForm({ ...propertyForm, propertyType: e.target.value as any })}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="Villa">Villa</option>
                          <option value="Apartment">Apartment</option>
                          <option value="Chalet">Chalet</option>
                          <option value="Penthouse">Penthouse</option>
                          <option value="Mansion">Mansion</option>
                          <option value="Beach House">Beach House</option>
                          <option value="Cottage">Cottage</option>
                          <option value="Studio">Studio</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">City / Region *</label>
                        <input
                          type="text"
                          required
                          value={propertyForm.location?.city || ''}
                          onChange={(e) =>
                            setPropertyForm({
                              ...propertyForm,
                              location: { ...propertyForm.location!, city: e.target.value },
                            })
                          }
                          placeholder="e.g. Batroun or Beirut"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    {/* Photos Uploader with AI Image Sorting */}
                    <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block font-bold text-slate-200 text-xs sm:text-sm">
                            Property Photos ({propertyForm.images?.length || 0} uploaded)
                          </label>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Upload photos or paste URLs. The first photo serves as the listing's main cover photo.
                          </p>
                        </div>

                        {isUploadingImages && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full animate-pulse self-start">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Compressing & uploading...</span>
                          </div>
                        )}
                      </div>

                      {/* Photo Reordering & Management Info Box */}
                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">
                              Photo Gallery Manager
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Upload photos below. The first photo is used as the cover. You can reorder, delete, or set any photo as cover.
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* File upload input */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className={`flex-1 cursor-pointer py-2.5 px-4 rounded-xl border border-dashed text-center flex items-center justify-center gap-2 transition font-semibold ${
                          isUploadingImages 
                            ? 'border-slate-600 bg-slate-800/50 text-slate-400 cursor-not-allowed'
                            : 'border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                        }`}>
                          {isUploadingImages ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>{isUploadingImages ? 'Processing Images...' : 'Choose Photos from Computer / Phone'}</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            disabled={isUploadingImages}
                            onChange={handleImageFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* URL input fallback */}
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          placeholder="Or paste image URL (https://...)"
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold cursor-pointer"
                        >
                          Add URL
                        </button>
                      </div>

                      {/* Uploaded thumbnails with Reordering and Cover Controls */}
                      {propertyForm.images && propertyForm.images.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Photo Gallery Order ({propertyForm.images.length} photos)</span>
                            <span className="text-[11px] text-slate-400">Photo #1 is the Cover</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {propertyForm.images.map((img, idx) => {
                              const isCover = idx === 0;

                              return (
                                <div
                                  key={idx}
                                  className={`relative aspect-[4/3] rounded-xl overflow-hidden group bg-slate-900 border ${
                                    isCover ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-700'
                                  }`}
                                >
                                  <img
                                    src={img}
                                    alt={`Photo ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />

                                  {/* Top Badges */}
                                  <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                                    <span className="px-1.5 py-0.5 rounded-md bg-black/75 text-white font-mono text-[10px] font-bold">
                                      #{idx + 1}
                                    </span>
                                    {isCover && (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black tracking-wide shadow-sm">
                                        COVER
                                      </span>
                                    )}
                                  </div>

                                  {/* Hover Actions Toolbar */}
                                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                    <div className="flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveImage(idx)}
                                        className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                                        title="Delete photo"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <div className="flex items-center justify-between gap-1 pt-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveImage(idx, idx - 1)}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition cursor-pointer"
                                        title="Move Left"
                                      >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                      </button>

                                      {!isCover && (
                                        <button
                                          type="button"
                                          onClick={() => handleSetCoverImage(idx)}
                                          className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                                        >
                                          Set Cover
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        disabled={idx === propertyForm.images.length - 1}
                                        onClick={() => handleMoveImage(idx, idx + 1)}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition cursor-pointer"
                                        title="Move Right"
                                      >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dual Pricing Rates (Weekdays: Sun-Thu, Weekends: Fri-Sat) */}
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          Nightly Pricing Rates
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Sun–Thu (Weekday) · Fri–Sat (Weekend)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/80">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="font-semibold text-slate-200 text-xs">
                              Weekday Price ({currencySymbol}) *
                            </label>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                              Sunday till Thursday
                            </span>
                          </div>
                          <input
                            type="number"
                            required
                            min="1"
                            value={propertyForm.weekdayPrice ?? propertyForm.pricePerNight ?? ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPropertyForm({
                                ...propertyForm,
                                weekdayPrice: val,
                                pricePerNight: val,
                              });
                            }}
                            placeholder="e.g. 150"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Applied for Sun, Mon, Tue, Wed, and Thu nights.
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/80 border border-rose-500/30">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="font-semibold text-slate-200 text-xs">
                              Weekend Price ({currencySymbol}) *
                            </label>
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                              Friday & Saturday
                            </span>
                          </div>
                          <input
                            type="number"
                            required
                            min="1"
                            value={propertyForm.weekendPrice ?? propertyForm.pricePerNight ?? ''}
                            onChange={(e) =>
                              setPropertyForm({
                                ...propertyForm,
                                weekendPrice: Number(e.target.value),
                              })
                            }
                            placeholder="e.g. 220"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Applied for Friday and Saturday nights.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Capacity & Room Specifications */}
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          Capacity & Room Specifications
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Guests, bedrooms, beds & bathrooms
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">Max Guests</label>
                          <input
                            type="number"
                            min="1"
                            value={propertyForm.maxGuests ?? 2}
                            onChange={(e) => setPropertyForm({ ...propertyForm, maxGuests: Math.max(1, Number(e.target.value)) })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">Bedrooms</label>
                          <input
                            type="number"
                            min="0"
                            value={propertyForm.bedrooms ?? 1}
                            onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: Math.max(0, Number(e.target.value)) })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">Beds</label>
                          <input
                            type="number"
                            min="1"
                            value={propertyForm.beds ?? 1}
                            onChange={(e) => setPropertyForm({ ...propertyForm, beds: Math.max(1, Number(e.target.value)) })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Bathrooms *</span>
                            <span className="text-[10px] text-cyan-400 font-normal">e.g. 1, 2, 2.5</span>
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            required
                            value={propertyForm.bathrooms ?? 1}
                            onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: Math.max(0.5, Number(e.target.value)) })}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-cyan-500/50 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fees & Stay Requirements */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Cleaning Fee ({currencySymbol})</label>
                        <input
                          type="number"
                          min="0"
                          value={propertyForm.cleaningFee ?? 30}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cleaningFee: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Min. Nights Stay</label>
                        <input
                          type="number"
                          min="1"
                          value={propertyForm.minNights ?? 1}
                          onChange={(e) => setPropertyForm({ ...propertyForm, minNights: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Service Fee (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={propertyForm.serviceFeePercentage ?? 10}
                          onChange={(e) => setPropertyForm({ ...propertyForm, serviceFeePercentage: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white"
                        />
                      </div>
                    </div>

                    {/* WhatsApp & Contact */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Dedicated WhatsApp Number for Inquiries
                      </label>
                      <input
                        type="text"
                        value={propertyForm.whatsappNumber || ''}
                        onChange={(e) => setPropertyForm({ ...propertyForm, whatsappNumber: e.target.value })}
                        placeholder="+96176141945"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Full Description</label>
                      <textarea
                        rows={3}
                        value={propertyForm.description || ''}
                        onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                        placeholder="Highlight the property amenities, views, location advantages..."
                        className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white"
                      />
                    </div>

                    {/* Amenities Checkbox selection */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-2">Amenities</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allAmenitiesOptions.map((amenity) => {
                          const isChecked = (propertyForm.amenities || []).includes(amenity);
                          return (
                            <label
                              key={amenity}
                              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-2 cursor-pointer transition ${
                                isChecked
                                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPropertyForm({
                                      ...propertyForm,
                                      amenities: [...(propertyForm.amenities || []), amenity],
                                    });
                                  } else {
                                    setPropertyForm({
                                      ...propertyForm,
                                      amenities: (propertyForm.amenities || []).filter((a) => a !== amenity),
                                    });
                                  }
                                }}
                                className="hidden"
                              />
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${isChecked ? 'bg-rose-600 text-white' : 'border border-slate-600'}`}>
                                {isChecked && '✓'}
                              </span>
                              <span>{amenity}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        {isUploadingImages && (
                          <span className="text-amber-400 font-medium">Please wait while photos finish uploading...</span>
                        )}
                        {!propertyForm.title?.trim() && !isUploadingImages && (
                          <span className="text-slate-400">Title and City are required to publish.</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isSavingProperty || isUploadingImages}
                          onClick={() => setIsCreatingProperty(false)}
                          className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 disabled:opacity-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProperty || isUploadingImages}
                          className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#e03153] hover:to-[#c70938] text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                          {(isSavingProperty || isUploadingImages) && (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          )}
                          <span>
                            {isUploadingImages
                              ? 'Uploading Photos...'
                              : isSavingProperty
                              ? 'Saving Property...'
                              : editingPropertyId
                              ? 'Update Listing'
                              : 'Publish Property Listing'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REAL-TIME AVAILABILITY & STAFF SLOT BLOCKER */}
        {activeTab === 'availability' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Real-Time Availability & Slot Blocker</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Instantly block or open specific time slots for maintenance, owner stays, or offline bookings to prevent double-bookings.
              </p>
            </div>

            {/* Property Selector */}
            <div className="flex items-center gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
              <span className="text-xs font-semibold text-slate-300">Select Property:</span>
              <select
                value={selectedPropertyIdForBlock}
                onChange={(e) => handlePropertySelectForBlock(e.target.value)}
                className="py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.location.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Quick Date Blocker Form (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <Ban className="w-4 h-4" />
                    <span>Block Time Slot Instantly</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Selected dates will immediately turn unavailable on the public website and sync to Google Calendar.
                  </p>

                  <form onSubmit={handleBlockDates} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        required
                        value={blockStartDate}
                        onChange={(e) => setBlockStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">End Date</label>
                      <input
                        type="date"
                        required
                        value={blockEndDate}
                        onChange={(e) => setBlockEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Block Reason</label>
                      <select
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      >
                        <option value="Staff Block">Staff Block (General)</option>
                        <option value="Maintenance">Maintenance & Cleaning</option>
                        <option value="Owner Stay">Owner Personal Stay</option>
                        <option value="Offline Booking">Offline / Direct Cash Booking</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Internal Note (Optional)</label>
                      <input
                        type="text"
                        value={blockNote}
                        onChange={(e) => setBlockNote(e.target.value)}
                        placeholder="e.g. VIP guest or AC maintenance"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={blockingInProgress}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                      <span>{blockingInProgress ? 'Blocking...' : 'Block Selected Dates Now'}</span>
                    </button>
                  </form>
                </div>

                {/* 2-Way Calendar Sync (Airbnb, VRBO, Google Calendar, Apple Calendar) */}
                <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-indigo-500/30 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Sync with Airbnb, VRBO & Google</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 uppercase">
                      2-Way iCal
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Paste your Airbnb or VRBO calendar export link below. Any reservation booked on Airbnb will instantly block those dates on your GM Management website.
                  </p>

                  {/* Import iCal Link Form */}
                  <form onSubmit={handleSyncIcal} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Platform Source</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['Airbnb', 'VRBO', 'Google', 'Apple'].map((platform) => (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => setIcalSourceName(platform)}
                            className={`py-1.5 rounded-lg font-semibold text-[11px] transition ${
                              icalSourceName === platform
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            }`}
                          >
                            {platform}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Paste {icalSourceName} iCal URL (.ics link)
                      </label>
                      <input
                        type="url"
                        required
                        value={icalUrlInput}
                        onChange={(e) => setIcalUrlInput(e.target.value)}
                        placeholder={`https://www.airbnb.com/calendar/ical/...`}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSyncingIcal || !icalUrlInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSyncingIcal ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>{isSyncingIcal ? 'Syncing Calendar...' : `Import & Sync from ${icalSourceName}`}</span>
                    </button>
                  </form>

                  {/* Export feed link to Airbnb/Google */}
                  <div className="pt-3 border-t border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">Your Live Export Link for Airbnb/VRBO:</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                      <input
                        readOnly
                        value={`${window.location.origin}/api/properties/${selectedPropertyIdForBlock}/calendar.ics`}
                        className="flex-1 bg-transparent text-[10px] text-slate-400 font-mono focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/api/properties/${selectedPropertyIdForBlock}/calendar.ics`;
                          navigator.clipboard.writeText(url);
                          showToast('iCal link copied! Paste this into Airbnb/VRBO Calendar Sync.');
                        }}
                        className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Paste this export link in Airbnb / VRBO so your website bookings automatically block on their calendar too.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Active Blocked Slots & Bookings (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                  <h3 className="font-bold text-white text-sm mb-3">
                    Active Staff Blocked Dates ({propertyAvailability.blockedSlots.length})
                  </h3>

                  {propertyAvailability.blockedSlots.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No dates are currently blocked by staff for this property.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {propertyAvailability.blockedSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-rose-400 block">
                              {slot.startDate} → {slot.endDate} {slot.startDate !== slot.endDate ? `(Check-out ${slot.endDate})` : '(Single day)'}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              Reason: {slot.reason} {slot.note ? `(${slot.note})` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnblockSlot(slot.id)}
                            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-semibold transition"
                          >
                            Unblock / Open
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirmed Guest Reservations for this property */}
                <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
                  <h3 className="font-bold text-white text-sm mb-3">
                    Customer Reservations ({propertyAvailability.reservations.length})
                  </h3>
                  {propertyAvailability.reservations.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No active bookings on this property.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {propertyAvailability.reservations.map((resv: any) => (
                        <div
                          key={resv.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-emerald-400 block">
                              {resv.checkInDate} → {resv.checkOutDate}
                            </span>
                            <span className="text-slate-300 font-medium">Guest: {resv.guestName}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-bold">
                            {resv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESERVATIONS & INQUIRIES */}
        {activeTab === 'reservations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Inquiries & Reservations</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  View all booking requests, chat with guests on WhatsApp, and manage reservations.
                </p>
              </div>
            </div>

            {reservations.length === 0 ? (
              <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-3xl p-12 text-center text-slate-400 text-xs">
                <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                No reservations or inquiries submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map((resv) => {
                  const whatsappClean = (resv.guestPhone || '').replace(/[^\d+]/g, '');
                  const waChatUrl = `https://wa.me/${whatsappClean.replace('+', '')}?text=${encodeURIComponent(
                    `Hello ${resv.guestName}, this is GM Management regarding your reservation #${resv.id} for ${resv.propertyTitle} (${resv.checkInDate} to ${resv.checkOutDate}). We are glad to confirm your booking.`
                  )}`;

                  return (
                    <div
                      key={resv.id}
                      className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-400 text-xs bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                              #{resv.id}
                            </span>
                            <h4 className="font-bold text-white text-sm">{resv.propertyTitle}</h4>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {resv.checkInDate} → {resv.checkOutDate} ({resv.nights} nights) • {resv.guestsCount} guests
                          </p>
                          {(resv.weekdayNights !== undefined && resv.weekendNights !== undefined) && (
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                              {resv.weekdayNights > 0 && (
                                <span className="bg-blue-950/60 text-blue-300 px-2 py-0.5 rounded border border-blue-800/40">
                                  {resv.weekdayNights} Wkday ({currencySymbol}{resv.weekdayPrice ?? ''})
                                </span>
                              )}
                              {resv.weekendNights > 0 && (
                                <span className="bg-rose-950/60 text-rose-300 px-2 py-0.5 rounded border border-rose-800/40">
                                  {resv.weekendNights} Wkend ({currencySymbol}{resv.weekendPrice ?? ''})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              resv.status === 'confirmed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : resv.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {resv.status}
                          </span>
                          <span className="text-sm font-black text-white">
                            {currencySymbol}{resv.totalPrice}
                          </span>
                        </div>
                      </div>

                      {/* Guest contact info & actions */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-white">{resv.guestName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{resv.guestPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate">{resv.guestEmail}</span>
                        </div>
                      </div>

                      {resv.specialRequests && (
                        <div className="p-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs">
                          <strong className="text-slate-400">Special Request:</strong> {resv.specialRequests}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                        {/* Direct WhatsApp Message button */}
                        <a
                          href={waChatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                        >
                          <MessageCircle className="w-4 h-4 fill-current" />
                          <span>Message Guest on WhatsApp</span>
                          <ExternalLink className="w-3 h-3 text-white/80" />
                        </a>

                        <div className="flex items-center gap-2">
                          {/* Send Check-in Reminder */}
                          <button
                            type="button"
                            onClick={() => handleSendReminder(resv.id, 'reminder_checkin')}
                            className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                            title="Send automated check-in reminder to guest"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Check-in Reminder</span>
                          </button>

                          {/* Status changer */}
                          {resv.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(resv.id, 'confirmed')}
                              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                            >
                              Confirm Booking
                            </button>
                          )}
                          {resv.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(resv.id, 'cancelled')}
                              className="py-2 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-semibold transition"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GOOGLE CALENDAR & ICAL SYNC */}
        {activeTab === 'calendar-sync' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>2-Way Calendar Sync (Airbnb, VRBO, Google & Apple Calendar)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Import reservations from Airbnb/VRBO to prevent double bookings, and export your GM Management calendar to any platform.
                </p>
              </div>
            </div>

            {/* Quick 2-Way Sync Tool */}
            <div className="bg-gradient-to-br from-indigo-950/40 via-slate-800/90 to-slate-900/90 border border-indigo-500/40 p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Import & Sync External Calendar (.ics URL)</h3>
                    <p className="text-xs text-slate-400">Paste your Airbnb, VRBO, or Google Calendar link to block booked dates automatically.</p>
                  </div>
                </div>
                <span className="self-start sm:self-auto text-[10px] font-bold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Prevent Double Bookings
                </span>
              </div>

              <form onSubmit={handleSyncIcal} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1">
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Property to Sync</label>
                  <select
                    value={selectedPropertyIdForBlock}
                    onChange={(e) => {
                      setSelectedPropertyIdForBlock(e.target.value);
                      loadPropertyAvailability(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.location.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Platform Source</label>
                  <div className="grid grid-cols-4 gap-1">
                    {['Airbnb', 'VRBO', 'Google', 'Apple'].map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setIcalSourceName(platform)}
                        className={`py-2 rounded-xl font-bold text-[11px] transition ${
                          icalSourceName === platform
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                        }`}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Paste {icalSourceName} iCal (.ics) Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={icalUrlInput}
                      onChange={(e) => setIcalUrlInput(e.target.value)}
                      placeholder={`https://www.airbnb.com/calendar/ical/....ics`}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSyncingIcal || !icalUrlInput.trim()}
                      className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-950/50 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isSyncingIcal ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{isSyncingIcal ? 'Syncing...' : 'Sync Dates'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Connected Feeds List */}
              {(() => {
                const currentProp = properties.find((p) => p.id === selectedPropertyIdForBlock);
                const feeds = currentProp?.icalImportUrls || [];
                if (feeds.length === 0) return null;
                return (
                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-[11px] font-bold text-slate-300 block mb-2">
                      Connected External Feeds for {currentProp?.title}:
                    </span>
                    <div className="space-y-1.5">
                      {feeds.map((feed, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                              {feed.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 truncate max-w-md">{feed.url}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {feed.lastSyncedAt && (
                              <span className="text-[10px] text-slate-500">
                                Synced: {new Date(feed.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                setIsSyncingIcal(true);
                                try {
                                  const res = await api.syncIcal(selectedPropertyIdForBlock, feed.url, feed.name);
                                  showToast(res.message);
                                  loadPropertyAvailability(selectedPropertyIdForBlock);
                                } catch (e: any) {
                                  showToast(e.message, 'error');
                                } finally {
                                  setIsSyncingIcal(false);
                                }
                              }}
                              className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Re-Sync</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Individual Property Feeds to Export */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">Export GM Management Calendars to Airbnb, VRBO & Google</h3>
                <span className="text-xs text-slate-400">Copy these URLs into other platforms</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map((prop) => {
                  const icsUrl = `${window.location.origin}/api/properties/${prop.id}/calendar.ics`;
                  return (
                    <div key={prop.id} className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3 text-xs shadow-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-white text-sm block">{prop.title}</span>
                          <span className="text-slate-400 text-[11px]">{prop.location.city} • Export Feed</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                          Live .ICS Link
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-700/80 font-mono text-[11px] text-slate-300 truncate select-all">
                        {icsUrl}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(icsUrl, `${prop.title} iCal URL`)}
                          className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy for Airbnb / VRBO</span>
                        </button>
                        <a
                          href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(icsUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 transition"
                        >
                          <span>Google Cal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Master Calendar Feed */}
            <div className="bg-slate-800/60 border border-slate-700 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Master All-Properties Calendar Feed</h3>
                  <p className="text-xs text-slate-400">All bookings across all properties in a single combined feed.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-xl border border-slate-700 text-xs font-mono text-slate-300">
                <span className="flex-1 truncate">{window.location.origin}/api/calendar/export-all.ics</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/calendar/export-all.ics`, 'Master iCal URL')}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-sans text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <a
                  href="/api/calendar/export-all.ics"
                  download
                  className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUTOMATED NOTIFICATIONS & ALERTS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Automated Notifications & Reminders</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  History of incoming booking inquiries, automated check-in reminder dispatches, and push alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await api.markNotificationRead('all');
                  setNotifications(notifications.map((n) => ({ ...n, read: true })));
                  showToast('All notifications marked as read');
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Mark all read
              </button>
            </div>

            <div className="space-y-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 rounded-2xl border transition flex items-start gap-3 text-xs ${
                    notif.read
                      ? 'bg-slate-800/50 border-slate-700/50 text-slate-300'
                      : 'bg-slate-800 border-rose-500/50 text-white shadow-sm'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-900 shrink-0 text-rose-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                      <span className="text-[10px] text-slate-400">{new Date(notif.date).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{notif.message}</p>
                    {notif.targetPhone && (
                      <span className="text-[11px] text-emerald-400 mt-1 block">
                        Target WhatsApp: {notif.targetPhone}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {activeTab === 'settings' && settings && (
          <div className="max-w-2xl bg-slate-800/90 border border-slate-700 p-6 rounded-3xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white">GM Management Settings</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure your company details, WhatsApp contact number, and automated messaging.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold self-start">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Cloud Storage Active</span>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              {/* Brand Logo Upload & Google Drive Link in UI */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-300">Brand Logo (Google Drive Link or File Upload)</label>
                  {settings.customLogoData && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, customLogoData: '' })}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium transition"
                    >
                      Reset to Default Logo
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-28 h-20 rounded-xl bg-white p-2 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    <Logo size="md" customLogo={settings.customLogoData} showText={false} />
                  </div>

                  <div className="space-y-2 flex-1 w-full">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Google Drive Sharing Link or Image URL:
                      </label>
                      <input
                        type="text"
                        placeholder="https://drive.google.com/file/d/... or direct image URL"
                        value={settings.customLogoData || ''}
                        onChange={(e) => {
                          setSettings({ ...settings, customLogoData: e.target.value });
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:border-[#FF385C] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-500 font-medium">Or upload file:</span>
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] border border-slate-600 cursor-pointer transition">
                        <Upload className="w-3 h-3 text-[#FF385C]" />
                        <span>Choose File (.png, .jpg, .svg)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (uploadEvent) => {
                                const base64 = uploadEvent.target?.result as string;
                                setSettings({ ...settings, customLogoData: base64 });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  You can paste any public Google Drive sharing link (e.g. <code className="text-amber-400">https://drive.google.com/file/d/.../view</code>) or upload a logo file. It updates seamlessly across the whole site.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Primary WhatsApp Number (for customer bookings) *
                </label>
                <input
                  type="text"
                  required
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  placeholder="+96176141945"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  All WhatsApp inquiries from guests will be directed directly to this number.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Notification Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Currency Code</label>
                  <input
                    type="text"
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currencySymbol}
                    onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-semibold">
                  <KeyRound className="w-4 h-4" />
                  <span>Admin Authentication & Password</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Admin Email / Username</label>
                    <input
                      type="text"
                      value={settings.adminEmail || 'admin@gmmanagement.com'}
                      onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Admin Password</label>
                    <input
                      type="text"
                      value={settings.adminPassword || 'admin123'}
                      onChange={(e) => setSettings({ ...settings, adminPassword: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  These credentials are used for the secure Staff Admin Login popup.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Automated WhatsApp Inquiry Template
                </label>
                <textarea
                  rows={4}
                  value={settings.whatsappGreetingTemplate}
                  onChange={(e) => setSettings({ ...settings, whatsappGreetingTemplate: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Supported tags: &#123;propertyTitle&#125;, &#123;checkInDate&#125;, &#123;checkOutDate&#125;, &#123;nights&#125;, &#123;guestsCount&#125;, &#123;reservationId&#125;
                </span>
              </div>

              <div className="pt-3 border-t border-slate-700 flex justify-end">
                <button
                  type="submit"
                  className="py-3 px-6 rounded-xl bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white font-bold text-xs shadow-lg hover:opacity-90 transition cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
