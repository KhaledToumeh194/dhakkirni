// Developer tool, not part of the extension. Finds the calculation method and
// per-prayer minute offsets that best reproduce a mosque's yearly timetable,
// so the user can enter them in the extension's Adjust fields.
//
// Usage:
//   node tools/calibrate.js <mosque>... [--year 2026]
//
// <mosque> is one of:
//   - a mosque page link, e.g. https://mawaqit.net/en/your-mosque (fetched once)
//   - a mosque page saved from the browser (.html)
//   - a JSON file with { name, timezone, latitude, longitude, calendar }
//
// Mawaqit mosque pages embed `confData = {...};` with a full year:
// calendar[month][day] = [fajr, shuruq, dhuhr, asr, maghrib, isha] in local time.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { calculatedTimes, METHODS, PRAYERS } from '../extension/lib/times.js';
import { withDefaults } from '../extension/lib/settings.js';

const columns = { fajr: 0, dhuhr: 2, asr: 3, maghrib: 4, isha: 5 };
const madhabs = ['shafi', 'hanafi'];
const highLatitudeRules = ['middleofthenight', 'seventhofthenight', 'twilightangle'];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const clocks = {};

function wallMinutes(date, timeZone) {
  clocks[timeZone] ||= new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const [hours, minutes] = clocks[timeZone].format(date).split(':').map(Number);
  return hours * 60 + minutes;
}

function mosqueDays(mosque, year) {
  const days = [];
  for (let month = 0; month < 12; month++) {
    for (const [day, row] of Object.entries(mosque.calendar[month])) {
      const date = new Date(year, month, Number(day));
      if (date.getMonth() !== month) continue;
      const minutes = row.map((time) => time.split(':').map(Number)).map(([h, m]) => h * 60 + m);
      days.push({ date, minutes });
    }
  }
  return days;
}

// Differences (mosque minus calculation) per prayer for one configuration.
function differences(mosque, days, config) {
  const settings = withDefaults(config);
  const location = { latitude: mosque.latitude, longitude: mosque.longitude };
  const result = Object.fromEntries(PRAYERS.map((prayer) => [prayer, []]));
  for (const { date, minutes } of days) {
    const times = calculatedTimes(date, settings, location);
    for (const prayer of PRAYERS) {
      if (!times[prayer]) continue;
      let diff = minutes[columns[prayer]] - wallMinutes(times[prayer], mosque.timeZone);
      if (diff > 720) diff -= 1440;
      if (diff < -720) diff += 1440;
      result[prayer].push(diff);
    }
  }
  return result;
}

// With the best offset applied, how far off is each prayer? A prayer where
// fewer than 60% of days land within 2 minutes is not following a calculation
// (fixed times, or a schedule set by hand).
function summarise(diffs) {
  const offset = Math.round(median(diffs));
  const residuals = diffs.map((diff) => Math.abs(diff - offset));
  return {
    offset,
    median: median(residuals),
    mean: residuals.reduce((sum, value) => sum + value, 0) / residuals.length,
    max: Math.max(...residuals),
    within2: residuals.filter((value) => value <= 2).length / residuals.length,
    rawMedian: median(diffs.map(Math.abs)),
  };
}

export function calibrate(mosque, year) {
  process.env.TZ = mosque.timeZone;
  const days = mosqueDays(mosque, year);
  const results = [];
  for (const method of METHODS) {
    for (const madhab of madhabs) {
      for (const highLatitudeRule of highLatitudeRules) {
        const config = { method, madhab, highLatitudeRule };
        const diffs = differences(mosque, days, config);
        const prayers = Object.fromEntries(PRAYERS.map((prayer) => [prayer, summarise(diffs[prayer])]));
        // Methods that differ only by fixed minute adjustments fit equally well
        // once offsets are applied; the tie goes to the one needing smaller offsets.
        const score = PRAYERS.reduce((sum, prayer) =>
          sum + prayers[prayer].median + prayers[prayer].mean / 10 + Math.abs(prayers[prayer].offset) / 1000, 0);
        results.push({ config, prayers, score });
      }
    }
  }
  results.sort((a, b) => a.score - b.score);
  const best = results[0];
  const flagged = PRAYERS.filter((prayer) => best.prayers[prayer].within2 < 0.6);
  return { days: days.length, best, runnersUp: results.slice(1, 5), flagged };
}

function printReport(mosque, report) {
  const { best } = report;
  const pad = (value, width) => String(value).padStart(width);
  console.log(`\n${mosque.name} (${mosque.timeZone}, ${mosque.latitude}, ${mosque.longitude}), ${report.days} days`);
  console.log(`Best fit: ${best.config.method}, Asr ${best.config.madhab}, high latitudes ${best.config.highLatitudeRule}`);
  console.log('prayer    offset  median  mean   max  within 2 min  (no offset: median)');
  for (const prayer of PRAYERS) {
    const p = best.prayers[prayer];
    const flag = report.flagged.includes(prayer) ? '  <- does not follow a calculation' : '';
    console.log(`${prayer.padEnd(8)} ${pad(p.offset, 6)} ${pad(p.median, 7)} ${pad(p.mean.toFixed(1), 5)} ${pad(p.max, 5)} ${pad(Math.round(p.within2 * 100) + '%', 13)}  ${pad(p.rawMedian, 8)}${flag}`);
  }
  console.log('Next best:');
  for (const other of report.runnersUp) {
    console.log(`  ${other.config.method}, ${other.config.madhab}, ${other.config.highLatitudeRule} (score ${other.score.toFixed(1)})`);
  }
}

function mosqueFromConf(conf, fallbackName) {
  const calendar = conf.calendar;
  const looksRight = Array.isArray(calendar) && calendar.length === 12 &&
    calendar.every((month) => Object.values(month).every((day) => Array.isArray(day) && day.length === 6));
  if (!looksRight || typeof conf.timezone !== 'string') throw new Error(`${fallbackName}: no yearly calendar found`);
  return {
    name: conf.name || conf.label || fallbackName,
    timeZone: conf.timezone,
    latitude: Number(conf.latitude),
    longitude: Number(conf.longitude),
    calendar,
  };
}

async function loadMosque(source) {
  let text;
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    text = await response.text();
  } else {
    text = readFileSync(source, 'utf8');
  }
  if (source.endsWith('.json')) return mosqueFromConf(JSON.parse(text), source);
  const match = text.match(/confData\s*=\s*(\{.*\});/);
  if (!match) throw new Error(`${source}: no confData in the page`);
  return mosqueFromConf(JSON.parse(match[1]), source);
}

async function main() {
  const args = process.argv.slice(2);
  const yearFlag = args.indexOf('--year');
  const year = yearFlag >= 0 ? Number(args.splice(yearFlag, 2)[1]) : new Date().getFullYear();
  if (args.length === 0) {
    console.log('Usage: node tools/calibrate.js <mosque page link | saved page.html | calendar.json>... [--year 2026]');
    process.exit(1);
  }
  for (const source of args) {
    const mosque = await loadMosque(source);
    printReport(mosque, calibrate(mosque, year));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
