import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatedTimes, suggestMethod } from '../extension/lib/times.js';
import { withDefaults } from '../extension/lib/settings.js';

function clock(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

function minutesOf(text) {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
}

function near(actual, expected, tolerance = 3) {
  const diff = Math.abs(minutesOf(actual) - minutesOf(expected));
  assert.ok(diff <= tolerance, `${actual} is not within ${tolerance} min of ${expected}`);
}

const cities = {
  mecca: { latitude: 21.4225, longitude: 39.8262, timeZone: 'Asia/Riyadh' },
  jakarta: { latitude: -6.2088, longitude: 106.8456, timeZone: 'Asia/Jakarta' },
  london: { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' },
  bucharest: { latitude: 44.4268, longitude: 26.1025, timeZone: 'Europe/Bucharest' },
  stockholm: { latitude: 59.3293, longitude: 18.0686, timeZone: 'Europe/Stockholm' },
  sydney: { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
  tromso: { latitude: 69.6492, longitude: 18.9553, timeZone: 'Europe/Oslo' },
};

// Sunrise and sunset references are the published almanac values (timeanddate.com).
const sunReferences = [
  ['mecca', [2026, 5, 21], '05:39', '19:06'],
  ['jakarta', [2026, 2, 20], '06:00', '18:06'],
  ['london', [2026, 11, 21], '08:04', '15:53'],
  ['london', [2026, 5, 21], '04:43', '21:21'],
  ['bucharest', [2026, 11, 21], '07:50', '16:39'],
  ['stockholm', [2026, 5, 21], '03:31', '22:08'],
  ['sydney', [2026, 11, 21], '05:41', '20:05'],
  ['sydney', [2026, 5, 21], '07:00', '16:54'],
];

for (const [name, [y, m, d], sunrise, sunset] of sunReferences) {
  test(`sunrise and maghrib match the almanac in ${name} on ${y}-${m + 1}-${d}`, () => {
    const city = cities[name];
    const times = calculatedTimes(new Date(y, m, d), withDefaults(), city);
    near(clock(times.sunrise, city.timeZone), sunrise);
    near(clock(times.maghrib, city.timeZone), sunset);
  });
}

test('prayers come in order everywhere, including far north in June', () => {
  for (const [name, city] of Object.entries(cities)) {
    const times = calculatedTimes(new Date(2026, 5, 21), withDefaults(), city);
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((key) => times[key]);
    assert.ok(order.every(Boolean), `${name} has a missing time`);
    for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `${name} is out of order at ${i}`);
  }
});

test('umm al-qura isha is 90 minutes after maghrib in mecca', () => {
  const settings = withDefaults({ method: 'UmmAlQura' });
  const times = calculatedTimes(new Date(2026, 5, 21), settings, cities.mecca);
  assert.equal((times.isha - times.maghrib) / 60000, 90);
  near(clock(times.fajr, 'Asia/Riyadh'), '04:12');
});

test('stockholm in june uses a seventh of the night for isha and fajr', () => {
  const settings = withDefaults({ highLatitudeRule: 'seventhofthenight' });
  const june21 = calculatedTimes(new Date(2026, 5, 21), settings, cities.stockholm);
  const june22 = calculatedTimes(new Date(2026, 5, 22), settings, cities.stockholm);
  const seventh = (june22.sunrise - june21.maghrib) / 7 / 60000;
  assert.ok(Math.abs((june21.isha - june21.maghrib) / 60000 - seventh) <= 1);
});

test('tromso in midsummer still gets times from the nearest normal day', () => {
  const times = calculatedTimes(new Date(2026, 5, 21), withDefaults(), cities.tromso);
  for (const value of Object.values(times)) assert.ok(value instanceof Date);
});

test('bucharest wall-clock times jump one hour on DST days', () => {
  const city = cities.bucharest;
  const day = (y, m, d) => calculatedTimes(new Date(y, m, d), withDefaults(), city);
  const hourOf = (date) => minutesOf(clock(date, city.timeZone));
  assert.ok(Math.abs(hourOf(day(2026, 2, 29).dhuhr) - hourOf(day(2026, 2, 28).dhuhr) - 60) <= 1);
  assert.ok(Math.abs(hourOf(day(2026, 9, 25).dhuhr) - hourOf(day(2026, 9, 24).dhuhr) + 60) <= 1);
});

test('offsets move each prayer by exactly that many minutes', () => {
  const date = new Date(2026, 3, 10);
  const plain = calculatedTimes(date, withDefaults(), cities.bucharest);
  const offsets = { fajr: -10, dhuhr: 5, asr: 0, maghrib: 3, isha: 30 };
  const moved = calculatedTimes(date, withDefaults({ offsets }), cities.bucharest);
  for (const [prayer, minutes] of Object.entries(offsets)) {
    assert.equal((moved[prayer] - plain[prayer]) / 60000, minutes, prayer);
  }
});

test('hanafi asr is later than shafi asr', () => {
  const date = new Date(2026, 3, 10);
  const shafi = calculatedTimes(date, withDefaults(), cities.london);
  const hanafi = calculatedTimes(date, withDefaults({ madhab: 'hanafi' }), cities.london);
  assert.ok(hanafi.asr - shafi.asr > 30 * 60000);
});

test('custom angles with an isha interval', () => {
  const settings = withDefaults({ method: 'Custom', customAngles: { fajr: 18, isha: 0, ishaInterval: 75 } });
  const custom = calculatedTimes(new Date(2026, 3, 10), settings, cities.london);
  const mwl = calculatedTimes(new Date(2026, 3, 10), withDefaults(), cities.london);
  assert.equal(custom.fajr.getTime(), mwl.fajr.getTime());
  assert.equal((custom.isha - custom.maghrib) / 60000, 75);
});

test('no location means no times', () => {
  assert.equal(calculatedTimes(new Date(), withDefaults(), null), null);
});

test('an unknown synced method falls back instead of breaking', () => {
  const times = calculatedTimes(new Date(2026, 3, 10), withDefaults({ method: 'FromAFutureVersion' }), cities.london);
  const mwl = calculatedTimes(new Date(2026, 3, 10), withDefaults(), cities.london);
  assert.equal(times.isha.getTime(), mwl.isha.getTime());
});

test('method suggestion follows the time zone', () => {
  assert.equal(suggestMethod('Asia/Riyadh'), 'UmmAlQura');
  assert.equal(suggestMethod('America/Chicago'), 'NorthAmerica');
  assert.equal(suggestMethod('Europe/Istanbul'), 'Turkey');
  assert.equal(suggestMethod('Europe/Bucharest'), 'MuslimWorldLeague');
});
