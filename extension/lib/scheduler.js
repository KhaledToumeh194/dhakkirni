import { pickDhikr } from '../adhkar.js';
import { notifyBefore, notifyDhikr, notifyPrayer } from './notify.js';
import { loadState } from './settings.js';
import { calculatedTimes, PRAYERS } from './times.js';

// A prayer alarm that fires this late (the computer was asleep) would show a
// wrong time, so it is dropped.
export const LATE_LIMIT_MS = 5 * 60 * 1000;

export function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Today's and tomorrow's alarms, so tonight's Fajr exists even if the
// midnight refresh runs late.
export function prayerAlarms(state, now) {
  const alarms = [];
  for (const step of [0, 1]) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + step);
    const times = calculatedTimes(day, state, state.location);
    if (!times) continue;
    for (const prayer of PRAYERS) {
      const at = times[prayer];
      if (!at || !state.notify[prayer]) continue;
      if (at > now) alarms.push({ name: `prayer:${prayer}:${dayKey(day)}`, when: at.getTime() });
      const before = at.getTime() - state.preMinutes * 60000;
      if (state.preMinutes > 0 && before > now.getTime()) {
        alarms.push({ name: `pre:${prayer}:${dayKey(day)}`, when: before });
      }
    }
  }
  return alarms;
}

function minutesOfDay(text) {
  const [hours, minutes] = text.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isQuiet(date, quiet) {
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  const start = minutesOfDay(quiet.start);
  const end = minutesOfDay(quiet.end);
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

// One minute past local midnight. Built from local date parts so DST days,
// which are 23 or 25 hours long, still land after midnight.
export function nextRefresh(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1).getTime();
}

async function ensureDhikrAlarm(state, existing) {
  const current = existing.find((alarm) => alarm.name === 'dhikr');
  if (!state.enabled || !Object.values(state.categories).some(Boolean)) {
    if (current) await chrome.alarms.clear('dhikr');
    return;
  }
  // Recreating an unchanged periodic alarm would restart its countdown.
  if (current && current.periodInMinutes === state.dhikrMinutes) return;
  await chrome.alarms.create('dhikr', {
    delayInMinutes: state.dhikrMinutes,
    periodInMinutes: state.dhikrMinutes,
  });
}

export async function reschedule(now = new Date()) {
  const state = await loadState();
  const existing = await chrome.alarms.getAll();
  const stale = existing.filter((alarm) => /^(prayer|pre):/.test(alarm.name));
  await Promise.all(stale.map((alarm) => chrome.alarms.clear(alarm.name)));
  await chrome.alarms.create('refresh', { when: nextRefresh(now) });
  await ensureDhikrAlarm(state, existing);
  if (!state.enabled) return;
  for (const alarm of prayerAlarms(state, now)) {
    await chrome.alarms.create(alarm.name, { when: alarm.when });
  }
}

async function remindDhikr(state, now) {
  if (isQuiet(new Date(now), state.quiet)) return;
  const { lastDhikr } = await chrome.storage.local.get('lastDhikr');
  const index = pickDhikr(state.categories, lastDhikr);
  if (index < 0) return;
  await chrome.storage.local.set({ lastDhikr: index });
  await notifyDhikr(index, state.language);
}

export async function handleAlarm(alarm, now = Date.now()) {
  if (alarm.name === 'refresh') return reschedule(new Date(now));
  const state = await loadState();
  if (!state.enabled) return;
  if (alarm.name === 'dhikr') return remindDhikr(state, now);
  const [kind, prayer] = alarm.name.split(':');
  if (now - alarm.scheduledTime > LATE_LIMIT_MS) return;
  if (kind === 'prayer') await notifyPrayer(prayer, new Date(alarm.scheduledTime), state.language);
  if (kind === 'pre') await notifyBefore(prayer, state.preMinutes, state.language);
}

export async function sendTestNotification() {
  const state = await loadState();
  const { lastDhikr } = await chrome.storage.local.get('lastDhikr');
  const index = pickDhikr({ istighfar: true, tasbih: true, salawat: true }, lastDhikr);
  await chrome.storage.local.set({ lastDhikr: index });
  await notifyDhikr(index, state.language);
}
