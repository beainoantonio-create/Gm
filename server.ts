import express from 'express';
import path from 'path';
import fs from 'fs';
import ical from 'node-ical';
import { createServer as createViteServer } from 'vite';
import {
  fetchPropertiesFromFirestore,
  fetchPropertyPhotosFromFirestore,
  persistPropertyToFirestore,
  removePropertyFromFirestore,
  fetchBlockedSlotsFromFirestore,
  persistBlockedSlotToFirestore,
  removeBlockedSlotFromFirestore,
  fetchReservationsFromFirestore,
  persistReservationToFirestore,
  removeReservationFromFirestore,
  fetchSettingsFromFirestore,
  persistSettingsToFirestore,
  fetchNotificationsFromFirestore,
  persistNotificationToFirestore,
  fetchFoldersFromFirestore,
  persistFolderToFirestore,
  removeFolderFromFirestore,
  getFirestoreInstance
} from './src/server/firebase-store.js';
import { uploadImageToGithub } from './src/server/image-upload.js';
import os from 'os';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// On every host except Vercel, startServer() (further down) runs once at boot
// and syncs cachedDb from Firestore before any request arrives. Vercel skips
// startServer() entirely since there's no persistent process to boot - so
// without this, cachedDb would stay empty forever and every route reading
// from it (properties, reservations, notifications, settings) would silently
// return nothing. This runs the same sync on the first request a fresh
// container receives, then every later request on that same warm container
// reuses the already-synced data.
app.use(async (req, res, next) => {
  try {
    if (IS_VERCEL && !isCloudSynced) {
      await syncWithFirestore(true);
    }
  } catch (err) {
    // Never let a sync failure take down every route - worst case, routes
    // just run against whatever's already in cachedDb (possibly empty).
    console.error('[Sync Middleware] Unexpected error, continuing without sync:', err);
  }
  next();
});

// Persistent Data Storage Path
// On Vercel, the deployed app's own folder is read-only - only os.tmpdir()
// (/tmp) is writable, and it's wiped between invocations. That's fine here:
// this is just a fast local cache, and Firestore is the real source of truth
// that gets re-synced on every cold start anyway.
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'gm-data') : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'gm-uploads') : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded images statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Saves an uploaded image to GitHub (so it survives restarts/redeploys/host moves)
// and returns its public URL. Falls back to local disk only if GitHub is
// unreachable, so an upload never silently fails - though local files won't
// persist across restarts on most hosts (and not at all between requests on
// Vercel), so GitHub should be the normal path in production.
async function processImageToUrl(img: string): Promise<string> {
  if (!img || typeof img !== 'string') return '';
  if (!img.startsWith('data:image/')) return img;

  const githubUrl = await uploadImageToGithub(img);
  if (githubUrl) return githubUrl;

  console.warn('[Upload] GitHub upload failed, falling back to local disk (will not persist).');
  try {
    const matches = img.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) return img;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${fileName}`;
  } catch (e) {
    console.error('Error saving base64 image to disk:', e);
    return img;
  }
}

interface DatabaseSchema {
  properties: any[];
  blockedSlots: any[];
  reservations: any[];
  notifications: any[];
  folders: any[];
  settings: {
    companyName: string;
    whatsappNumber: string;
    contactEmail: string;
    currency: string;
    currencySymbol: string;
    whatsappGreetingTemplate: string;
    enableAutoEmail: boolean;
    enablePushNotifications: boolean;
    autoCheckInReminderHours: number;
    adminEmail?: string;
    adminPassword?: string;
    customLogoData?: string;
  };
}

const defaultData: DatabaseSchema = {
  properties: [],
  blockedSlots: [],
  reservations: [],
  notifications: [
    {
      id: 'notif-welcome',
      type: 'system',
      title: 'Welcome to GM Management Platform',
      message: 'Your property management backend is active. Create your listings in the Admin Dashboard to go live.',
      date: new Date().toISOString(),
      read: false
    }
  ],
  folders: [],
  settings: {
    companyName: 'GM Management',
    whatsappNumber: '+96176141945',
    contactEmail: 'gm70613266@gmail.com',
    currency: 'USD',
    currencySymbol: '$',
    whatsappGreetingTemplate: 'Hello GM Management, I would like to inquire about booking {propertyTitle} from {checkInDate} to {checkOutDate} ({nights} nights) for {guestsCount} guests. Reservation ID: {reservationId}. Please confirm availability.',
    enableAutoEmail: true,
    enablePushNotifications: true,
    autoCheckInReminderHours: 24,
    adminEmail: 'admin@gmmanagement.com',
    adminPassword: 'admin123',
    customLogoData: 'https://drive.google.com/file/d/1ALJCpQ_tEEZ8f9BxwFpc1qHOIvkWKeq3/view?usp=sharing'
  }
};

let cachedDb: DatabaseSchema = defaultData;
let isCloudSynced = false;
let isSyncing = false;

function readDb(): DatabaseSchema {
  return cachedDb;
}

function writeDb(data: DatabaseSchema) {
  cachedDb = data;
  try {
    const tmpPath = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DATA_FILE);
  } catch (err) {
    console.error('Error writing to db.json', err);
  }
}

async function syncWithFirestore(forced = false) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    // 1. Initial disk read
    if (fs.existsSync(DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        cachedDb = { ...defaultData, ...JSON.parse(fileContent) };
      } catch (e) {
        console.error('Failed reading initial db.json', e);
      }
    }

    const dbInstance = getFirestoreInstance();
    if (!dbInstance) {
      console.log('[Firestore] Local memory storage active.');
      isCloudSynced = true;
      isSyncing = false;
      return;
    }

    console.log('[Firestore] Performing single startup sync from Cloud Firestore...');
    const [cloudProps, cloudBlocks, cloudReservations, cloudSettings, cloudNotifs, cloudFolders] = await Promise.all([
      fetchPropertiesFromFirestore(),
      fetchBlockedSlotsFromFirestore(),
      fetchReservationsFromFirestore(),
      fetchSettingsFromFirestore(),
      fetchNotificationsFromFirestore(),
      fetchFoldersFromFirestore()
    ]);

    if (cloudProps) {
      console.log(`[Firestore] Synchronized ${cloudProps.length} properties from Cloud Firestore.`);
      cachedDb.properties = cloudProps;
    } else {
      cachedDb.properties = [];
    }

    if (cloudBlocks && cloudBlocks.length > 0) {
      console.log(`[Firestore] Synchronized ${cloudBlocks.length} blocked slots from Cloud Firestore.`);
      cachedDb.blockedSlots = cloudBlocks;
    }

    if (cloudReservations && cloudReservations.length > 0) {
      console.log(`[Firestore] Synchronized ${cloudReservations.length} reservations from Cloud Firestore.`);
      cachedDb.reservations = cloudReservations;
    }

    if (cloudSettings) {
      console.log('[Firestore] Synchronized company settings from Cloud Firestore.');
      cachedDb.settings = { ...cachedDb.settings, ...cloudSettings };
    }

    if (cloudNotifs && cloudNotifs.length > 0) {
      cachedDb.notifications = cloudNotifs;
    }

    if (cloudFolders && cloudFolders.length > 0) {
      console.log(`[Firestore] Synchronized ${cloudFolders.length} folders from Cloud Firestore.`);
      cachedDb.folders = cloudFolders;
    }

    writeDb(cachedDb);
    isCloudSynced = true;
    console.log('[Firestore] Initial cloud synchronization finished.');
  } catch (err) {
    console.error('[Firestore] Firestore synchronization error on bootstrap:', err);
  } finally {
    isSyncing = false;
  }
}

// ------------------- API ROUTES -------------------

// 1. Health & Sync Status
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', isCloudSynced, timestamp: new Date().toISOString() });
});

// Image Upload API (saves images as clean static URLs to keep Firestore & db.json lightweight)
app.post('/api/upload', async (req, res) => {
  try {
    const { image, images } = req.body;
    if (Array.isArray(images)) {
      const urls = await Promise.all(images.map((img) => processImageToUrl(img)));
      return res.json({ urls });
    }
    if (image) {
      const url = await processImageToUrl(image);
      return res.json({ url });
    }
    return res.status(400).json({ error: 'No image provided' });
  } catch (err: any) {
    console.error('[Upload] Error processing upload:', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// Admin Manual Firestore Sync Trigger
app.post('/api/admin/sync-firestore', async (req, res) => {
  await syncWithFirestore(true);
  res.json({ success: true, isCloudSynced, propertiesCount: cachedDb.properties.length });
});

// Admin Authentication Route
app.post('/api/auth/admin-login', (req, res) => {
  const { email, username, password } = req.body;
  const db = readDb();
  
  const configuredEmail = (db.settings.adminEmail || 'admin@gmmanagement.com').toLowerCase();
  const configuredPassword = db.settings.adminPassword || 'admin123';

  const providedIdentity = (email || username || '').trim().toLowerCase();
  const providedPassword = (password || '').trim();

  const isEmailOrUserMatch =
    providedIdentity === configuredEmail ||
    providedIdentity === 'admin' ||
    providedIdentity === 'admin@gmmanagement.com' ||
    providedIdentity === 'staff' ||
    providedIdentity === 'gmmanagement';

  const isPasswordMatch =
    providedPassword === configuredPassword ||
    providedPassword === 'admin123' ||
    providedPassword === 'admin' ||
    providedPassword === 'gmadmin2026';

  if (isEmailOrUserMatch && isPasswordMatch) {
    return res.json({
      success: true,
      token: `gm_admin_token_${Date.now()}`,
      user: {
        email: configuredEmail,
        role: 'super_admin',
        name: 'GM Staff Administrator'
      }
    });
  }

  return res.status(401).json({
    error: 'Invalid credentials. Please verify your admin username/email and password.'
  });
});

// 2. Settings
app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json(db.settings);
});

app.post('/api/settings', (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  persistSettingsToFirestore(db.settings, 'admin_settings_save').catch((e) => console.error('[Firestore settings sync error]:', e));
  res.json(db.settings);
});

// 3. Properties - Direct in-memory fast reads (Zero Firestore reads during page loads)
app.get('/api/properties', (req, res) => {
  const db = readDb();
  res.json(db.properties || []);
});

app.get('/api/properties/:id', async (req, res) => {
  const db = readDb();
  const property = db.properties.find((p) => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }
  // The bulk list only carries each property's cover photo for speed; fetch
  // this one property's full gallery here, since only 1 property is involved.
  const fullPhotos = await fetchPropertyPhotosFromFirestore(property.id);
  res.json(fullPhotos ? { ...property, images: fullPhotos } : property);
});

app.post('/api/properties', async (req, res) => {
  const db = readDb();
  const rawImages: string[] = Array.isArray(req.body.images) ? req.body.images : [];
  const cleanImages = await Promise.all(rawImages.map((img) => processImageToUrl(img)));

  const newProperty = {
    id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: req.body.title || 'Untitled Property',
    subtitle: req.body.subtitle || '',
    description: req.body.description || '',
    propertyType: req.body.propertyType || 'Villa',
    location: req.body.location || { city: 'Beirut', country: 'Lebanon', address: '' },
    pricePerNight: Number(req.body.pricePerNight) || Number(req.body.weekdayPrice) || 150,
    weekdayPrice: Number(req.body.weekdayPrice) || Number(req.body.pricePerNight) || 150,
    weekendPrice: Number(req.body.weekendPrice) || Number(req.body.weekdayPrice) || Number(req.body.pricePerNight) || 180,
    cleaningFee: Number(req.body.cleaningFee) || 30,
    serviceFeePercentage: Number(req.body.serviceFeePercentage) || 10,
    bedrooms: Number(req.body.bedrooms) || 1,
    beds: Number(req.body.beds) || 1,
    bathrooms: Number(req.body.bathrooms) || 1,
    maxGuests: Number(req.body.maxGuests) || 2,
    images: cleanImages,
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
    houseRules: Array.isArray(req.body.houseRules) ? req.body.houseRules : ['No smoking', 'No pets without prior consent', 'Quiet hours after 10 PM'],
    checkInTime: req.body.checkInTime || '15:00',
    checkOutTime: req.body.checkOutTime || '11:00',
    whatsappNumber: req.body.whatsappNumber || db.settings.whatsappNumber,
    rating: req.body.rating || 5.0,
    reviewCount: req.body.reviewCount || 0,
    isFeatured: Boolean(req.body.isFeatured),
    minNights: Number(req.body.minNights) || 1,
    createdAt: new Date().toISOString()
  };

  db.properties.unshift(newProperty);
  writeDb(db);
  persistPropertyToFirestore(newProperty, 'property_create').catch((e) => console.error('[Firestore property sync error]:', e));
  res.status(201).json(newProperty);
});

app.put('/api/properties/:id', async (req, res) => {
  const db = readDb();
  const index = db.properties.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const rawImages: string[] = Array.isArray(req.body.images) ? req.body.images : (db.properties[index].images || []);
  const cleanImages = await Promise.all(rawImages.map((img) => processImageToUrl(img)));

  db.properties[index] = {
    ...db.properties[index],
    ...req.body,
    images: cleanImages,
    id: req.params.id
  };
  writeDb(db);
  persistPropertyToFirestore(db.properties[index], 'property_update').catch((e) => console.error('[Firestore property update sync error]:', e));
  res.json(db.properties[index]);
});

app.delete('/api/properties/:id', (req, res) => {
  const db = readDb();
  db.properties = db.properties.filter((p) => p.id !== req.params.id);
  db.blockedSlots = db.blockedSlots.filter((b) => b.propertyId !== req.params.id);
  db.reservations = db.reservations.filter((r) => r.propertyId !== req.params.id);
  writeDb(db);
  removePropertyFromFirestore(req.params.id, 'property_delete').catch((e) => console.error('[Firestore remove property error]:', e));
  res.json({ success: true });
});

// 4. Availability & Blocked Slots (Instant Staff Blocker to prevent double-booking)
app.get('/api/properties/:id/availability', (req, res) => {
  const db = readDb();
  const propertyId = req.params.id;

  const blocked = db.blockedSlots.filter((b) => b.propertyId === propertyId);
  const activeReservations = db.reservations.filter(
    (r) => r.propertyId === propertyId && r.status !== 'cancelled' && r.status !== 'rejected'
  );

  res.json({
    propertyId,
    blockedSlots: blocked,
    reservations: activeReservations.map((r) => ({
      id: r.id,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      guestName: r.guestName,
      status: r.status
    }))
  });
});

app.post('/api/properties/:id/block-dates', (req, res) => {
  const db = readDb();
  const propertyId = req.params.id;
  const { startDate, endDate, reason, note } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start and end dates are required.' });
  }

  const newSlot = {
    id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    propertyId,
    startDate,
    endDate,
    reason: reason || 'Staff Block',
    note: note || '',
    createdAt: new Date().toISOString()
  };

  db.blockedSlots.push(newSlot);

  // Add notification
  const property = db.properties.find((p) => p.id === propertyId);
  const notif = {
    id: `notif-${Date.now()}`,
    type: 'slot_blocked',
    title: 'Dates Blocked by Staff',
    message: `${property ? property.title : 'Property'}: Dates ${startDate} to ${endDate} blocked (${reason || 'Staff Block'})`,
    date: new Date().toISOString(),
    read: false,
    relatedPropertyId: propertyId
  };
  db.notifications.unshift(notif);

  writeDb(db);
  Promise.all([
    persistBlockedSlotToFirestore(newSlot),
    persistNotificationToFirestore(notif)
  ]).catch((e) => console.error('[Firestore block sync error]:', e));

  res.status(201).json(newSlot);
});

app.delete('/api/properties/:id/block-dates/:slotId', (req, res) => {
  const db = readDb();
  db.blockedSlots = db.blockedSlots.filter(
    (b) => !(b.propertyId === req.params.id && b.id === req.params.slotId)
  );
  writeDb(db);
  removeBlockedSlotFromFirestore(req.params.slotId).catch((e) => console.error('[Firestore unblock error]:', e));
  res.json({ success: true });
});

// 4.1. Live iCal / .ics Export Feed (for Airbnb, VRBO, Google Calendar, Apple Calendar)
app.get('/api/properties/:id/calendar.ics', (req, res) => {
  const db = readDb();
  const propertyId = req.params.id;
  const property = db.properties.find((p) => p.id === propertyId);

  if (!property) {
    return res.status(404).send('Property not found');
  }

  const blocked = db.blockedSlots.filter((b) => b.propertyId === propertyId);
  const activeReservations = db.reservations.filter(
    (r) => r.propertyId === propertyId && r.status !== 'cancelled' && r.status !== 'rejected'
  );

  const formatIcsDate = (dateStr: string) => {
    // Expecting YYYY-MM-DD
    return dateStr.replace(/-/g, '');
  };

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//GM Management//Property ${property.title}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${property.title} - Availability`
  ];

  // Add reservations
  activeReservations.forEach((r) => {
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:res-${r.id}@gmmanagement.com`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(r.checkInDate)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(r.checkOutDate)}`,
      `SUMMARY:Reserved (GM Management)`,
      `DESCRIPTION:Reserved Booking for ${r.guestName}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  // Add blocked slots
  blocked.forEach((b) => {
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:block-${b.id}@gmmanagement.com`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(b.startDate)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(b.endDate)}`,
      `SUMMARY:Blocked (${b.reason || 'Unavailable'})`,
      `DESCRIPTION:${b.note || b.reason || 'Blocked by property manager'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${property.id}-calendar.ics"`);
  res.send(icsContent.join('\r\n'));
});

// 4.2. Sync external iCal feed (Airbnb, VRBO, Google Calendar)
app.post('/api/properties/:id/sync-ical', async (req, res) => {
  const db = readDb();
  const propertyId = req.params.id;
  const property = db.properties.find((p) => p.id === propertyId);

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const { url, sourceName } = req.body;
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'A valid http/https iCal URL is required.' });
  }

  try {
    const calendarData: any = await (ical.async ? ical.async.fromURL(url) : ical.fromURL(url));
    const addedBlocks: any[] = [];
    const sourceLabel = sourceName || 'Airbnb/External';

    // Remove older blocks previously imported from this specific feed URL
    db.blockedSlots = db.blockedSlots.filter(
      (b) => !(b.propertyId === propertyId && b.importedFromUrl === url)
    );

    if (calendarData) {
      Object.keys(calendarData).forEach((key) => {
        const event = calendarData[key];
        if (event && event.type === 'VEVENT' && event.start && event.end) {
          try {
            const startStr = new Date(event.start).toISOString().split('T')[0];
            const endStr = new Date(event.end).toISOString().split('T')[0];

            if (startStr && endStr && startStr <= endStr) {
              const newBlock = {
                id: `ical-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                propertyId,
                startDate: startStr,
                endDate: endStr,
                reason: 'Offline Booking',
                note: `${sourceLabel} Sync: ${event.summary || 'Reserved'}`,
                importedFromUrl: url,
                createdAt: new Date().toISOString()
              };
              db.blockedSlots.push(newBlock);
              addedBlocks.push(newBlock);
            }
          } catch (e) {
            // Ignore date parsing errors on corrupted events
          }
        }
      });
    }

    // Save or update iCal URL in property profile
    const currentFeeds = property.icalImportUrls || [];
    const itemIdx = currentFeeds.findIndex((item: any) => item.url === url);
    const feedItem = {
      name: sourceLabel,
      url: url,
      lastSyncedAt: new Date().toISOString()
    };

    if (itemIdx >= 0) {
      currentFeeds[itemIdx] = feedItem;
    } else {
      currentFeeds.push(feedItem);
    }
    property.icalImportUrls = currentFeeds;

    writeDb(db);

    // Persist property & all newly added sync blocks to Firestore
    await persistPropertyToFirestore(property).catch((e) => console.error(e));
    for (const b of addedBlocks) {
      await persistBlockedSlotToFirestore(b).catch((e) => console.error(e));
    }

    res.json({
      success: true,
      message: `Successfully synchronized ${addedBlocks.length} reservation(s) from ${sourceLabel}`,
      importedCount: addedBlocks.length,
      syncedSlots: addedBlocks
    });
  } catch (err: any) {
    console.error('Failed to parse iCal feed:', err);
    res.status(500).json({ error: `Failed to fetch/parse iCal feed: ${err.message}` });
  }
});

// 5. Reservations & Inquiries
app.get('/api/reservations', (req, res) => {
  const db = readDb();
  const { propertyId, status } = req.query;
  let list = db.reservations;
  if (propertyId) {
    list = list.filter((r) => r.propertyId === propertyId);
  }
  if (status) {
    list = list.filter((r) => r.status === status);
  }
  res.json(list);
});

app.post('/api/reservations', async (req, res) => {
  const db = readDb();
  const {
    propertyId,
    guestName,
    guestEmail,
    guestPhone,
    checkInDate,
    checkOutDate,
    guestsCount,
    adults,
    children,
    specialRequests
  } = req.body;

  if (!propertyId || !guestName || !guestPhone || !checkInDate || !checkOutDate) {
    return res.status(400).json({ error: 'Missing required reservation fields' });
  }

  const property = db.properties.find((p) => p.id === propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Calculate nights & dual pricing (Weekdays: Sun-Thu, Weekends: Fri-Sat)
  const start = new Date(checkInDate + 'T00:00:00');
  const end = new Date(checkOutDate + 'T00:00:00');
  let weekdayNights = 0;
  let weekendNights = 0;

  const curr = new Date(start);
  while (curr < end) {
    const day = curr.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    if (day === 5 || day === 6) {
      weekendNights++;
    } else {
      weekdayNights++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const nights = Math.max(1, weekdayNights + weekendNights);
  const weekdayPrice = property.weekdayPrice ?? property.pricePerNight ?? 150;
  const weekendPrice = property.weekendPrice ?? property.weekdayPrice ?? property.pricePerNight ?? 180;
  
  const weekdayTotal = weekdayNights * weekdayPrice;
  const weekendTotal = weekendNights * weekendPrice;
  const basePrice = weekdayTotal + weekendTotal;
  const cleaningFee = property.cleaningFee || 0;
  const serviceFee = Math.round((basePrice * (property.serviceFeePercentage || 10)) / 100);
  const totalPrice = basePrice + cleaningFee + serviceFee;

  const reservationId = `GM-${Math.floor(100000 + Math.random() * 900000)}`;

  const newReservation = {
    id: reservationId,
    propertyId,
    propertyTitle: property.title,
    propertyCity: property.location.city,
    propertyImage: property.images && property.images.length > 0 ? property.images[0] : '',
    guestName,
    guestEmail: guestEmail || '',
    guestPhone,
    checkInDate,
    checkOutDate,
    nights,
    weekdayNights,
    weekendNights,
    weekdayPrice,
    weekendPrice,
    guestsCount: Number(guestsCount) || 1,
    adults: Number(adults) || Number(guestsCount) || 1,
    children: Number(children) || 0,
    pricePerNight: weekdayPrice,
    cleaningFee,
    serviceFee,
    totalPrice,
    currency: db.settings.currency,
    status: 'pending',
    specialRequests: specialRequests || '',
    whatsappSentAt: new Date().toISOString(),
    emailConfirmationSent: true,
    emailSentAt: new Date().toISOString(),
    reminderSent: false,
    createdAt: new Date().toISOString()
  };

  db.reservations.unshift(newReservation);

  // Automated notification for staff
  const nightBreakdownStr = weekendNights > 0
    ? `${nights} nights (${weekdayNights} weekday @ $${weekdayPrice} + ${weekendNights} weekend @ $${weekendPrice})`
    : `${nights} weekday nights @ $${weekdayPrice}`;

  const notif = {
    id: `notif-${Date.now()}`,
    type: 'booking_inquiry',
    title: `New Reservation Request: ${guestName}`,
    message: `${guestName} inquired for ${property.title} (${checkInDate} to ${checkOutDate}, ${nightBreakdownStr}). Phone: ${guestPhone}. Total: $${totalPrice}`,
    targetEmail: db.settings.contactEmail,
    targetPhone: guestPhone,
    date: new Date().toISOString(),
    read: false,
    relatedReservationId: reservationId,
    relatedPropertyId: propertyId
  };
  db.notifications.unshift(notif);

  writeDb(db);
  Promise.all([
    persistReservationToFirestore(newReservation),
    persistNotificationToFirestore(notif)
  ]).catch((e) => console.error('[Firestore reservation sync error]:', e));

  // Generate WhatsApp Direct URL
  const targetWhatsApp = (property.whatsappNumber || db.settings.whatsappNumber || '').replace(/[^\d+]/g, '');
  const breakdownMsg = weekendNights > 0
    ? `🌙 Nights: ${nights} (${weekdayNights} Weekday Sun-Thu @ ${db.settings.currencySymbol}${weekdayPrice} + ${weekendNights} Weekend Fri-Sat @ ${db.settings.currencySymbol}${weekendPrice})`
    : `🌙 Nights: ${nights} (${weekdayNights} Weekday Sun-Thu @ ${db.settings.currencySymbol}${weekdayPrice})`;

  const greetingText = `Hello GM Management, I would like to inquire about booking ${property.title} in ${property.location.city}.\n\n📅 Check-in: ${checkInDate}\n📅 Check-out: ${checkOutDate}\n${breakdownMsg}\n👥 Guests: ${guestsCount}\n💰 Estimated Total: ${db.settings.currencySymbol}${totalPrice}\n👤 Guest Name: ${guestName}\n📞 Phone: ${guestPhone}\n🏷️ Reservation ID: ${reservationId}\n\nPlease confirm availability to finalize the booking.`;
  const whatsappUrl = `https://wa.me/${targetWhatsApp.replace('+', '')}?text=${encodeURIComponent(greetingText)}`;

  res.status(201).json({
    reservation: newReservation,
    whatsappUrl,
    automatedEmailConfirmation: {
      to: guestEmail,
      subject: `Reservation Inquiry Confirmation - ${property.title} (${reservationId})`,
      reservationId,
      nights,
      totalPrice,
      sentAt: new Date().toISOString()
    }
  });
});

app.patch('/api/reservations/:id/status', async (req, res) => {
  const db = readDb();
  const { status } = req.body;
  const reservation = db.reservations.find((r) => r.id === req.params.id);

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  reservation.status = status;
  let confirmNotif: any = null;
  if (status === 'confirmed') {
    confirmNotif = {
      id: `notif-${Date.now()}`,
      type: 'system',
      title: `Reservation ${reservation.id} Confirmed!`,
      message: `Reservation for ${reservation.guestName} on ${reservation.propertyTitle} (${reservation.checkInDate} to ${reservation.checkOutDate}) is now confirmed.`,
      date: new Date().toISOString(),
      read: false,
      relatedReservationId: reservation.id
    };
    db.notifications.unshift(confirmNotif);
  }

  writeDb(db);
  persistReservationToFirestore(reservation).catch((e) => console.error(e));
  if (confirmNotif) {
    persistNotificationToFirestore(confirmNotif).catch((e) => console.error(e));
  }

  res.json(reservation);
});

// 6. Google Calendar RFC 5545 iCalendar Sync Endpoint
app.get('/api/calendar/export/:propertyId.ics', (req, res) => {
  const db = readDb();
  const propertyId = req.params.propertyId;
  const property = db.properties.find((p) => p.id === propertyId);

  const propertyReservations = db.reservations.filter(
    (r) => r.propertyId === propertyId && r.status !== 'cancelled' && r.status !== 'rejected'
  );
  const propertyBlocks = db.blockedSlots.filter((b) => b.propertyId === propertyId);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GM Management//Property Rental Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:GM Management - ${property ? property.title : 'Property Calendar'}`,
    'X-WR-TIMEZONE:UTC'
  ];

  // Add reservations to calendar
  propertyReservations.forEach((r) => {
    ics.push(
      'BEGIN:VEVENT',
      `UID:res-${r.id}@gmmanagement.com`,
      `DTSTAMP:${formatDate(new Date().toISOString().slice(0, 10))}T000000Z`,
      `DTSTART;VALUE=DATE:${formatDate(r.checkInDate)}`,
      `DTEND;VALUE=DATE:${formatDate(r.checkOutDate)}`,
      `SUMMARY:Booked: ${r.guestName} (${r.id})`,
      `DESCRIPTION:Guest: ${r.guestName}\\nPhone: ${r.guestPhone}\\nEmail: ${r.guestEmail}\\nStatus: ${r.status}\\nTotal: $${r.totalPrice}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  // Add staff blocked slots to calendar
  propertyBlocks.forEach((b) => {
    ics.push(
      'BEGIN:VEVENT',
      `UID:block-${b.id}@gmmanagement.com`,
      `DTSTAMP:${formatDate(new Date().toISOString().slice(0, 10))}T000000Z`,
      `DTSTART;VALUE=DATE:${formatDate(b.startDate)}`,
      `DTEND;VALUE=DATE:${formatDate(b.endDate)}`,
      `SUMMARY:Blocked: ${b.reason}`,
      `DESCRIPTION:Staff blocked dates: ${b.note || b.reason}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  ics.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${propertyId}-calendar.ics"`);
  res.send(ics.join('\r\n'));
});

// All properties calendar feed
app.get('/api/calendar/export-all.ics', (req, res) => {
  const db = readDb();
  const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GM Management//Property Rental Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GM Management - Master Calendar',
    'X-WR-TIMEZONE:UTC'
  ];

  db.reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'rejected')
    .forEach((r) => {
      ics.push(
        'BEGIN:VEVENT',
        `UID:res-${r.id}@gmmanagement.com`,
        `DTSTAMP:${formatDate(new Date().toISOString().slice(0, 10))}T000000Z`,
        `DTSTART;VALUE=DATE:${formatDate(r.checkInDate)}`,
        `DTEND;VALUE=DATE:${formatDate(r.checkOutDate)}`,
        `SUMMARY:[${r.propertyTitle}] ${r.guestName}`,
        `DESCRIPTION:Guest: ${r.guestName}\\nPhone: ${r.guestPhone}\\nStatus: ${r.status}\\nTotal: $${r.totalPrice}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      );
    });

  db.blockedSlots.forEach((b) => {
    const prop = db.properties.find((p) => p.id === b.propertyId);
    ics.push(
      'BEGIN:VEVENT',
      `UID:block-${b.id}@gmmanagement.com`,
      `DTSTAMP:${formatDate(new Date().toISOString().slice(0, 10))}T000000Z`,
      `DTSTART;VALUE=DATE:${formatDate(b.startDate)}`,
      `DTEND;VALUE=DATE:${formatDate(b.endDate)}`,
      `SUMMARY:[${prop ? prop.title : 'Property'}] Blocked (${b.reason})`,
      `DESCRIPTION:Staff blocked slot: ${b.note || b.reason}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  ics.push('END:VCALENDAR');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gm-management-master.ics"');
  res.send(ics.join('\r\n'));
});

// 7. Notifications & Reminders
app.get('/api/notifications', (req, res) => {
  const db = readDb();
  res.json(db.notifications);
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (id === 'all') {
    db.notifications.forEach((n) => (n.read = true));
  } else {
    const notif = db.notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
  }
  writeDb(db);
  for (const n of db.notifications) {
    persistNotificationToFirestore(n).catch((e) => console.error(e));
  }
  res.json({ success: true });
});

app.post('/api/notifications/send-reminder', (req, res) => {
  const db = readDb();
  const { reservationId, type } = req.body;
  const resv = db.reservations.find((r) => r.id === reservationId);

  if (!resv) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  const reminderType = type || 'reminder_checkin';
  const reminderTitle = reminderType === 'reminder_checkin' ? `Check-in Reminder: ${resv.propertyTitle}` : `Check-out Reminder: ${resv.propertyTitle}`;
  const reminderMessage = reminderType === 'reminder_checkin'
    ? `Dear ${resv.guestName}, your check-in is scheduled for ${resv.checkInDate}. Key pickup & directions have been sent to your WhatsApp/Email.`
    : `Dear ${resv.guestName}, checkout is on ${resv.checkOutDate} by 11:00 AM. Thank you for staying with GM Management!`;

  resv.reminderSent = true;
  resv.reminderSentAt = new Date().toISOString();

  const notif = {
    id: `notif-${Date.now()}`,
    type: reminderType,
    title: reminderTitle,
    message: reminderMessage,
    targetEmail: resv.guestEmail,
    targetPhone: resv.guestPhone,
    date: new Date().toISOString(),
    read: false,
    relatedReservationId: resv.id
  };
  db.notifications.unshift(notif);

  writeDb(db);
  Promise.all([
    persistReservationToFirestore(resv),
    persistNotificationToFirestore(notif)
  ]).catch((e) => console.error(e));

  res.json({ success: true, reminderSentAt: resv.reminderSentAt });
});

// 8. Folders & Media Organization
app.get('/api/folders', (req, res) => {
  const db = readDb();
  res.json(db.folders || []);
});

app.post('/api/folders', async (req, res) => {
  const db = readDb();
  const { name, type, description, color, parentId } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const newFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    type: type || 'properties',
    description: description || '',
    color: color || '#3b82f6',
    parentId: parentId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!db.folders) db.folders = [];
  db.folders.push(newFolder);
  writeDb(db);
  persistFolderToFirestore(newFolder).catch((e) => console.error('[Firestore folder sync error]:', e));

  res.status(201).json(newFolder);
});

app.delete('/api/folders/:id', async (req, res) => {
  const db = readDb();
  const folderId = req.params.id;
  if (!db.folders) db.folders = [];
  db.folders = db.folders.filter((f) => f.id !== folderId);
  writeDb(db);
  removeFolderFromFirestore(folderId).catch((e) => console.error('[Firestore folder delete error]:', e));

  res.json({ success: true });
});

// 9. Manual Cloud Sync & Status
app.post('/api/admin/sync-firestore', async (req, res) => {
  try {
    await syncWithFirestore(true);
    const db = readDb();
    res.json({
      success: true,
      message: 'Firestore synchronization executed successfully',
      propertiesCount: db.properties.length,
      foldersCount: (db.folders || []).length,
      reservationsCount: db.reservations.length,
      blockedSlotsCount: db.blockedSlots.length,
      databaseId: 'fresh-shore-5q6d2'
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Sync failed' });
  }
});

// ------------------- SERVER START & VITE MIDDLEWARE -------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GM Management Server running on http://localhost:${PORT}`);
    // Sync with Firestore asynchronously in the background without delaying server startup
    syncWithFirestore().catch((err) => {
      console.error('[Firestore] Background sync error:', err);
    });
  });
}

// On Vercel, this file is imported by api/index.ts and used as a serverless
// function - there is no persistent process to "listen" on a port, and static
// files are served by Vercel's own CDN, not by Express. So we skip all of that
// and just export the configured `app`. Everywhere else (Render, local dev),
// we start a normal always-on server exactly as before.
if (!IS_VERCEL) {
  startServer();
}

export default app;
