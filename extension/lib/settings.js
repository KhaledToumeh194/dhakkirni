export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  schemaVersion: SCHEMA_VERSION,
  enabled: true,
  method: 'MuslimWorldLeague',
  customAngles: { fajr: 18, isha: 17, ishaInterval: 0 },
  madhab: 'shafi',
  highLatitudeRule: 'auto',
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  notify: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  preMinutes: 10,
  dhikrMinutes: 30,
  categories: { istighfar: true, tasbih: true, salawat: true },
  quiet: { enabled: false, start: '22:00', end: '07:00' },
  language: 'both',
};

// The location stays in storage.local so it never syncs to other devices.
// These are the only local keys this version uses.
const LOCAL_KEYS = ['location', 'lastDhikr'];

export function withDefaults(stored = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (value && typeof value === 'object') settings[key] = { ...value, ...stored[key] };
  }
  return settings;
}

// Keeps only the fields this version knows. Version 2 removed the mosque
// timetable option, so its `provider` field is dropped and prayer times are
// calculated on the device again.
export function migrate(stored = {}) {
  const settings = withDefaults(stored);
  for (const key of Object.keys(settings)) {
    if (!(key in DEFAULT_SETTINGS)) delete settings[key];
  }
  return { ...settings, schemaVersion: SCHEMA_VERSION };
}

// Settings sync between devices but local storage doesn't, so the local
// cleanup can't depend on the synced schemaVersion: another device may have
// migrated the settings already. Anything local this version doesn't use,
// such as the saved mosques and their timetable, is deleted.
export async function upgradeStorage(stored) {
  await chrome.storage.sync.set({ settings: migrate(stored) });
  const local = await chrome.storage.local.get(null);
  const leftovers = Object.keys(local).filter((key) => !LOCAL_KEYS.includes(key));
  if (leftovers.length > 0) await chrome.storage.local.remove(leftovers);
}

export async function loadState() {
  const [{ settings }, { location }] = await Promise.all([
    chrome.storage.sync.get('settings'),
    chrome.storage.local.get('location'),
  ]);
  return { ...withDefaults(settings), location: location || null };
}

export async function saveSettings(changes) {
  const { settings } = await chrome.storage.sync.get('settings');
  await chrome.storage.sync.set({ settings: { ...withDefaults(settings), ...changes } });
}
