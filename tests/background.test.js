process.env.TZ = 'Europe/Bucharest';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeChrome } from './fake-chrome.js';

const fake = installFakeChrome({ local: { location: { latitude: 44.4268, longitude: 26.1025 } } });
await import('../extension/background.js');

test('first install stores defaults with a suggested method and opens the settings', async () => {
  await fake.listeners.installed({ reason: 'install' });
  const { settings } = chrome.storage.sync.items;
  assert.equal(settings.schemaVersion, 2);
  assert.equal(settings.method, 'MuslimWorldLeague');
  assert.equal(chrome.runtime.openedOptions, 1);
  assert.ok(fake.alarms.has('dhikr'));
});

test('an update migrates old settings and keeps what the user chose', async () => {
  chrome.storage.sync.items.settings = { schemaVersion: 0, method: 'Karachi', offsets: { isha: 5 } };
  await fake.listeners.installed({ reason: 'update' });
  const { settings } = chrome.storage.sync.items;
  assert.equal(settings.schemaVersion, 2);
  assert.equal(settings.method, 'Karachi');
  assert.equal(settings.offsets.isha, 5);
  assert.equal(settings.offsets.fajr, 0);
  assert.equal(settings.dhikrMinutes, 30);
  assert.equal(chrome.runtime.openedOptions, 1);
});

// Version 1 could take times from a mosque's Mawaqit page. Version 2 drops
// that option: the settings go back to calculated times and the saved mosques
// and their cached timetable are deleted from local storage.
test('updating from version 1 drops the mosque provider and its stored data', async () => {
  chrome.storage.sync.items.settings = { schemaVersion: 1, provider: 'mawaqit', method: 'Turkey', offsets: { maghrib: 7 } };
  Object.assign(chrome.storage.local.items, {
    lastDhikr: 4,
    mosques: { favorites: [{ slug: 'example', name: 'Example' }], active: 'example' },
    mawaqitCache: { slug: 'example', months: {} },
    mawaqitError: { at: 1, reason: 'http-500' },
  });
  fake.alarms.clear();
  await fake.listeners.installed({ reason: 'update' });
  const { settings } = chrome.storage.sync.items;
  assert.equal(settings.schemaVersion, 2);
  assert.equal('provider' in settings, false);
  assert.equal(settings.method, 'Turkey');
  assert.equal(settings.offsets.maghrib, 7);
  assert.deepEqual(Object.keys(chrome.storage.local.items).sort(), ['lastDhikr', 'location']);
  assert.ok(fake.alarms.has('dhikr'));
  assert.ok([...fake.alarms.keys()].some((name) => name.startsWith('prayer:')));
});

test('a new device cleans up local leftovers even if synced settings are already new', async () => {
  chrome.storage.sync.items.settings = { schemaVersion: 2, method: 'Karachi' };
  chrome.storage.local.items.mosques = { favorites: [], active: '' };
  await fake.listeners.installed({ reason: 'install' });
  assert.equal(chrome.storage.sync.items.settings.method, 'Karachi');
  assert.equal('mosques' in chrome.storage.local.items, false);
});

test('only messages from this extension are answered', () => {
  let answered = false;
  const keepOpen = fake.listeners.message({ type: 'test-notification' }, { id: 'someone-else' }, () => { answered = true; });
  assert.equal(keepOpen, false);
  assert.equal(answered, false);
});
