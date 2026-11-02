import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrate } from '../tools/calibrate.js';
import { calculatedTimes } from '../extension/lib/times.js';
import { withDefaults } from '../extension/lib/settings.js';

// A made-up Bucharest timetable: Diyanet angles shifted by known offsets,
// with Dhuhr held at 13:45 from April to September the way many mosques do.
function syntheticMosque() {
  process.env.TZ = 'Europe/Bucharest';
  const location = { latitude: 44.4268, longitude: 26.1025 };
  const offsets = { fajr: 0, dhuhr: 2, asr: -3, maghrib: 5, isha: 10 };
  const settings = withDefaults({ method: 'Turkey', offsets });
  const clock = (date) => date.toTimeString().slice(0, 5);
  const calendar = Array.from({ length: 12 }, (_, month) => {
    const days = {};
    for (let day = 1; day <= new Date(2026, month + 1, 0).getDate(); day++) {
      const times = calculatedTimes(new Date(2026, month, day), settings, location);
      const summer = month >= 3 && month <= 8;
      days[String(day)] = [times.fajr, times.sunrise, times.dhuhr, times.asr, times.maghrib, times.isha].map(clock);
      if (summer) days[String(day)][2] = '13:45';
    }
    return days;
  });
  return { name: 'Synthetic', timeZone: 'Europe/Bucharest', ...location, calendar };
}

test('calibration recovers the method and offsets and flags a fixed dhuhr', () => {
  const report = calibrate(syntheticMosque(), 2026);
  assert.equal(report.days, 365);
  assert.equal(report.best.config.method, 'Turkey');
  assert.equal(report.best.config.madhab, 'shafi');
  assert.equal(report.best.prayers.asr.offset, -3);
  assert.equal(report.best.prayers.maghrib.offset, 5);
  assert.equal(report.best.prayers.isha.offset, 10);
  assert.equal(report.best.prayers.fajr.median, 0);
  assert.deepEqual(report.flagged, ['dhuhr']);
});
