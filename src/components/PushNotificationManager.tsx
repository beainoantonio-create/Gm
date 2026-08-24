import React, { useState, useEffect } from 'react';
import { Bell, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

interface PushNotificationManagerProps {
  onNotificationReceived?: (title: string, message: string) => void;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  onNotificationReceived,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => setShowPromptBanner(true), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPromptBanner(false);
      if (result === 'granted') {
        triggerNotification(
          'GM Management Notifications Active',
          'You will receive instant updates and WhatsApp confirmations for all reservation inquiries.'
        );
      }
    } catch (err) {
      console.error('Push permission error', err);
    }
  };

  const triggerNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch {
        // Fallback for browsers with restricted notification constructors in iframe
      }
    }

    // In-app visual notification toast
    setActiveToast({ title, body });
    if (onNotificationReceived) onNotificationReceived(title, body);
    setTimeout(() => setActiveToast(null), 5000);
  };

  return (
    <>
      {/* Permission Request Prompt Banner */}
      {showPromptBanner && permission === 'default' && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-bottom-5">
          <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-sm text-white">Enable Booking & WhatsApp Alerts</h4>
            <p className="text-slate-300 mt-0.5 leading-snug">
              Get instant automated notifications when your reservation inquiry is confirmed by GM Management.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={requestPermission}
                className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white font-bold text-xs hover:opacity-90 transition cursor-pointer"
              >
                Enable Notifications
              </button>
              <button
                type="button"
                onClick={() => setShowPromptBanner(false)}
                className="py-1.5 px-2.5 rounded-lg text-slate-400 hover:text-white transition"
              >
                Later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPromptBanner(false)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In-app Toast Banner */}
      {activeToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full bg-white text-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 flex items-start gap-3 animate-in slide-in-from-top-4">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-slate-900">{activeToast.title}</h4>
            <p className="text-slate-600 mt-0.5">{activeToast.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
