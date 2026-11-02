process.env.TZ = 'Europe/Bucharest';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './fake-chrome.js';
import { handleAlarm, isQuiet, nextRefresh, reschedule } from '../extension/lib/scheduler.js';
import { pickDhikr } from '../extension/adhkar.js';

const bucharest = { latitude: 44.4268, longitude: 26.1025 };

function setup(settings = {}) {
  return installFakeChrome({ sync: { settings }, local: { location: bucharest } });
}

function names(alarms) {
  return [...alarms.keys()].sort();
}

test('rescheduling twice gives the same alarms', async () => {
  const { alarms } = setup();
  const now = new Date(2026, 5, 10, 9, 0);
  await reschedule(now);
  const first = [...alarms.values()].map((a) => `${a.name}@${a.scheduledTime}`).sort();
  await reschedule(now);
  const second = [...alarms.values()].map((a) => `${a.name}@${a.scheduledTime}`).sort();
  assert.deepEqual(second, first);
  assert.ok(alarms.has('dhikr'));
  assert.ok(alarms.has('refresh'));
  assert.ok(alarms.has('prayer:dhuhr:2026-06-10'));
  assert.ok(alarms.has('pre:dhuhr:2026-06-10'));
  assert.ok(alarms.has('prayer:fajr:2026-06-11'));
  assert.ok(!alarms.has('prayer:fajr:2026-06-10'), 'fajr already passed today');
});

test('the dhikr alarm keeps its countdown unless the interval changes', async () => {
  const { alarms } = setup();
  await reschedule(new Date(2026, 5, 10, 9, 0));
  alarms.get('dhikr').scheduledTime = 123;
  await reschedule(new Date(2026, 5, 10, 9, 5));
  assert.equal(alarms.get('dhikr').scheduledTime, 123);
  chrome.storage.sync.items.settings.dhikrMinutes = 45;
  await reschedule(new Date(2026, 5, 10, 9, 5));
  assert.equal(alarms.get('dhikr').periodInMinutes, 45);
});

test('turning a prayer off or pre-reminders to 0 removes their alarms', async () => {
  const { alarms } = setup({ notify: { asr: false }, preMinutes: 0 });
  await reschedule(new Date(2026, 5, 10, 9, 0));
  assert.ok(!names(alarms).some((name) => name.startsWith('pre:')));
  assert.ok(!names(alarms).some((name) => name.includes(':asr:')));
});

test('the master switch clears everything but the refresh alarm', async () => {
  const { alarms } = setup();
  await reschedule(new Date(2026, 5, 10, 9, 0));
  chrome.storage.sync.items.settings.enabled = false;
  await reschedule(new Date(2026, 5, 10, 9, 1));
  assert.deepEqual(names(alarms), ['refresh']);
});

test('the daily refresh drops yesterday and adds the next day', async () => {
  const { alarms } = setup();
  await reschedule(new Date(2026, 5, 10, 23, 0));
  const refresh = alarms.get('refresh');
  assert.equal(new Date(refresh.scheduledTime).toString(), new Date(2026, 5, 11, 0, 1).toString());
  await handleAlarm(refresh, refresh.scheduledTime);
  assert.ok(!names(alarms).some((name) => name.endsWith('2026-06-10')));
  assert.ok(alarms.has('prayer:isha:2026-06-11'));
  assert.ok(alarms.has('prayer:fajr:2026-06-12'));
});

test('refresh time is one minute after midnight on DST days too', () => {
  assert.equal(new Date(nextRefresh(new Date(2026, 2, 28, 22, 0))).toString(), new Date(2026, 2, 29, 0, 1).toString());
  assert.equal(new Date(nextRefresh(new Date(2026, 9, 25, 1, 0))).toString(), new Date(2026, 9, 26, 0, 1).toString());
});

test('a prayer alarm more than 5 minutes late is skipped', async () => {
  const { shown } = setup();
  const scheduledTime = new Date(2026, 5, 10, 13, 20).getTime();
  await handleAlarm({ name: 'prayer:dhuhr:2026-06-10', scheduledTime }, scheduledTime + 6 * 60000);
  assert.equal(shown.length, 0);
  await handleAlarm({ name: 'prayer:dhuhr:2026-06-10', scheduledTime }, scheduledTime + 4 * 60000);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].id, 'prayer');
  assert.equal(shown[0].silent, true);
  assert.equal(shown[0].title, 'حان وقت صلاة الظهر');
  assert.match(shown[0].message, /^It's time for Dhuhr prayer · 1:20\sPM$/);
});

test('the pre-prayer text counts minutes in Arabic correctly', async () => {
  const { shown } = setup({ preMinutes: 10 });
  const scheduledTime = Date.now();
  await handleAlarm({ name: 'pre:asr:2026-06-10', scheduledTime }, scheduledTime);
  assert.equal(shown[0].title, 'بقي ١٠ دقائق على صلاة العصر');
  assert.equal(shown[0].message, 'Asr in 10 minutes');
});

test('quiet hours across midnight', () => {
  const quiet = { enabled: true, start: '22:00', end: '07:00' };
  const at = (h, m) => new Date(2026, 5, 10, h, m);
  assert.equal(isQuiet(at(23, 30), quiet), true);
  assert.equal(isQuiet(at(0, 0), quiet), true);
  assert.equal(isQuiet(at(6, 59), quiet), true);
  assert.equal(isQuiet(at(7, 0), quiet), false);
  assert.equal(isQuiet(at(12, 0), quiet), false);
  assert.equal(isQuiet(at(23, 30), { ...quiet, enabled: false }), false);
  assert.equal(isQuiet(at(13, 0), { enabled: true, start: '12:30', end: '14:00' }), true);
});

test('quiet hours silence dhikr but not prayers', async () => {
  const { shown } = setup({ quiet: { enabled: true, start: '22:00', end: '07:00' } });
  const late = new Date(2026, 5, 10, 23, 15).getTime();
  await handleAlarm({ name: 'dhikr', scheduledTime: late }, late);
  assert.equal(shown.length, 0);
  await handleAlarm({ name: 'prayer:isha:2026-06-10', scheduledTime: late }, late);
  assert.equal(shown.length, 1);
  const noon = new Date(2026, 5, 11, 12, 0).getTime();
  await handleAlarm({ name: 'dhikr', scheduledTime: noon }, noon);
  assert.equal(shown[1].id, 'dhikr');
});

test('dhikr never repeats the previous pick', async () => {
  const all = { istighfar: true, tasbih: true, salawat: true };
  for (let last = 0; last < 40; last++) {
    assert.notEqual(pickDhikr(all, last, () => 0.999), last);
    assert.notEqual(pickDhikr(all, last, () => 0), last);
  }
  assert.equal(pickDhikr({}, 3), -1);
});
