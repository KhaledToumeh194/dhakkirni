import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  PolarCircleResolution,
  PrayerTimes,
} from './adhan.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const METHODS = [
  'MuslimWorldLeague',
  'UmmAlQura',
  'Egyptian',
  'Karachi',
  'NorthAmerica',
  'MoonsightingCommittee',
  'Dubai',
  'Qatar',
  'Kuwait',
  'Singapore',
  'Turkey',
  'Tehran',
];

const methodByZone = {
  'Asia/Riyadh': 'UmmAlQura',
  'Asia/Aden': 'UmmAlQura',
  'Asia/Bahrain': 'UmmAlQura',
  'Asia/Dubai': 'Dubai',
  'Asia/Muscat': 'Dubai',
  'Asia/Qatar': 'Qatar',
  'Asia/Kuwait': 'Kuwait',
  'Africa/Cairo': 'Egyptian',
  'Asia/Karachi': 'Karachi',
  'Asia/Kolkata': 'Karachi',
  'Asia/Calcutta': 'Karachi',
  'Asia/Dhaka': 'Karachi',
  'Asia/Kabul': 'Karachi',
  'Asia/Singapore': 'Singapore',
  'Asia/Kuala_Lumpur': 'Singapore',
  'Asia/Kuching': 'Singapore',
  'Asia/Brunei': 'Singapore',
  'Asia/Jakarta': 'Singapore',
  'Asia/Makassar': 'Singapore',
  'Asia/Jayapura': 'Singapore',
  'Europe/Istanbul': 'Turkey',
  'Asia/Tehran': 'Tehran',
  'Europe/London': 'MoonsightingCommittee',
};

const northAmericanZones = /^(America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+|Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Regina|Halifax|St_Johns|Moncton)|Pacific\/Honolulu)$/;

export function suggestMethod(timeZone) {
  if (methodByZone[timeZone]) return methodByZone[timeZone];
  if (northAmericanZones.test(timeZone)) return 'NorthAmerica';
  return 'MuslimWorldLeague';
}

function calculationParameters(settings, coordinates) {
  let params;
  if (settings.method === 'Custom') {
    const { fajr, isha, ishaInterval } = settings.customAngles;
    params = new CalculationParameters('Other', fajr, isha, ishaInterval);
  } else {
    // Settings sync between devices, so a newer version elsewhere may store a
    // method this version doesn't know.
    params = (CalculationMethod[settings.method] || CalculationMethod.MuslimWorldLeague)();
  }
  params.madhab = settings.madhab;
  params.highLatitudeRule = settings.highLatitudeRule === 'auto'
    ? HighLatitudeRule.recommended(coordinates)
    : settings.highLatitudeRule;
  // Without this, places inside the polar circles get Invalid Date for whole seasons.
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  for (const prayer of PRAYERS) params.adjustments[prayer] = settings.offsets[prayer];
  return params;
}

function validOrNull(date) {
  return Number.isNaN(date.getTime()) ? null : date;
}

// adhan reads only the local year/month/day of `date`.
export function calculatedTimes(date, settings, location) {
  if (!location) return null;
  const coordinates = new Coordinates(location.latitude, location.longitude);
  const prayerTimes = new PrayerTimes(coordinates, date, calculationParameters(settings, coordinates));
  return {
    fajr: validOrNull(prayerTimes.fajr),
    sunrise: validOrNull(prayerTimes.sunrise),
    dhuhr: validOrNull(prayerTimes.dhuhr),
    asr: validOrNull(prayerTimes.asr),
    maghrib: validOrNull(prayerTimes.maghrib),
    isha: validOrNull(prayerTimes.isha),
  };
}
