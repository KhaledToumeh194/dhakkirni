import { formatClock, loadMessages, numberLocale, translate } from './lib/i18n.js';
import { loadState, saveSettings } from './lib/settings.js';
import { calculatedTimes, METHODS, PRAYERS } from './lib/times.js';

const form = document.querySelector('main');
const presetIntervals = ['15', '30', '45', '60'];
let state;
let messages;
let uiLanguage;

const t = (key, substitutions) => translate(messages, key, substitutions);

function pickUiLanguage(setting) {
  if (setting !== 'both') return setting;
  return chrome.i18n.getUILanguage().startsWith('ar') ? 'ar' : 'en';
}

async function applyLanguage() {
  uiLanguage = pickUiLanguage(state.language);
  messages = await loadMessages(uiLanguage);
  document.documentElement.lang = uiLanguage;
  document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
  document.title = t('optionsTitle');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  const method = document.getElementById('method');
  method.replaceChildren(...[...METHODS, 'Custom'].map((name) => new Option(t(`method${name}`), name)));
  method.value = state.method;
  buildPrayerRows();
}

function buildPrayerRows() {
  const rows = PRAYERS.map((prayer) => {
    const name = t(`prayer${prayer[0].toUpperCase()}${prayer.slice(1)}`);
    const row = document.createElement('tr');
    row.innerHTML = `
      <th scope="row"></th>
      <td><input type="checkbox" name="notify.${prayer}"></td>
      <td><input type="number" name="offsets.${prayer}" min="-30" max="30" step="1" dir="ltr"></td>`;
    row.querySelector('th').textContent = name;
    row.querySelector('[type=checkbox]').setAttribute('aria-label', `${t('colNotify')}: ${name}`);
    row.querySelector('[type=number]').setAttribute('aria-label', `${t('colOffset')}: ${name}`);
    return row;
  });
  document.getElementById('prayer-rows').replaceChildren(...rows);
  fillFields();
}

function readPath(path) {
  return path.split('.').reduce((value, key) => value[key], state);
}

function fillFields() {
  for (const field of form.querySelectorAll('[name]')) {
    const value = readPath(field.name);
    if (field.type === 'checkbox') field.checked = value;
    else field.value = value;
  }
  const interval = String(state.dhikrMinutes);
  const custom = !presetIntervals.includes(interval);
  document.getElementById('interval').value = custom ? 'custom' : interval;
  const customInput = document.getElementById('interval-custom');
  customInput.hidden = !custom;
  customInput.value = interval;
  document.getElementById('latitude').value = state.location ? state.location.latitude : '';
  document.getElementById('longitude').value = state.location ? state.location.longitude : '';
  document.getElementById('custom-block').hidden = state.method !== 'Custom';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fieldValue(field) {
  if (field.type === 'checkbox') return field.checked;
  if (field.type !== 'number') return field.value;
  const number = Number(field.value) || 0;
  return clamp(number, Number(field.min), Number(field.max));
}

function changesFor(field) {
  const value = fieldValue(field);
  const [key, inner] = field.name.split('.');
  if (!inner) return { [key]: value };
  return { [key]: { ...state[key], [inner]: value } };
}

let statusTimer;
function showSaved() {
  const status = document.getElementById('status');
  status.textContent = t('saved');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 1500);
}

async function save(changes) {
  Object.assign(state, changes);
  await saveSettings(changes);
  fillFields();
  renderToday();
  showSaved();
}

function prayerLabel(prayer) {
  return t(`prayer${prayer[0].toUpperCase()}${prayer.slice(1)}`);
}

function renderToday() {
  const now = new Date();
  const dateLocale = uiLanguage === 'ar' ? numberLocale('ar') : undefined;
  document.getElementById('today-date').textContent = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(now);
  const list = document.getElementById('today-times');
  const source = document.getElementById('today-source');
  const times = calculatedTimes(now, state, state.location);
  if (!times) {
    list.replaceChildren();
    source.textContent = t('noLocation');
    return;
  }
  const next = PRAYERS.find((prayer) => times[prayer] && times[prayer] > now);
  list.replaceChildren(...['fajr', 'sunrise', ...PRAYERS.slice(1)].map((prayer) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const time = document.createElement('time');
    name.textContent = prayerLabel(prayer);
    time.textContent = times[prayer] ? formatClock(times[prayer], uiLanguage) : '–';
    if (times[prayer]) time.dateTime = times[prayer].toISOString();
    if (prayer === 'sunrise') item.className = 'sunrise';
    if (prayer === next) {
      item.className = 'next';
      item.setAttribute('aria-current', 'time');
      name.title = t('nextLabel');
    }
    item.append(name, time);
    return item;
  }));
  source.textContent = t('sourceCalc', [t(`method${state.method}`)]);
}

function showLocationError(key) {
  const error = document.getElementById('location-error');
  error.textContent = key ? t(key) : '';
  error.hidden = !key;
}

async function saveLocation(latitude, longitude) {
  if (!(Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180)) {
    showLocationError('locationInvalid');
    return;
  }
  showLocationError('');
  // Four decimals is about 10 m, plenty for prayer times.
  const location = { latitude: Number(latitude.toFixed(4)), longitude: Number(longitude.toFixed(4)) };
  state.location = location;
  await chrome.storage.local.set({ location });
  fillFields();
  renderToday();
  showSaved();
}

function bindEvents() {
  form.addEventListener('change', async (event) => {
    const field = event.target;
    if (!field.name) return;
    if (field.type === 'time' && !field.value) {
      fillFields();
      return;
    }
    await save(changesFor(field));
    if (field.name === 'language') {
      await applyLanguage();
      renderToday();
    }
  });

  document.getElementById('interval').addEventListener('change', (event) => {
    const customInput = document.getElementById('interval-custom');
    if (event.target.value === 'custom') {
      customInput.hidden = false;
      customInput.focus();
      return;
    }
    save({ dhikrMinutes: Number(event.target.value) });
  });

  document.getElementById('interval-custom').addEventListener('change', (event) => {
    save({ dhikrMinutes: Math.round(clamp(Number(event.target.value) || 30, 5, 720)) });
  });

  document.getElementById('location-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    if (latitude === '' || longitude === '') {
      showLocationError('locationInvalid');
      return;
    }
    saveLocation(Number(latitude), Number(longitude));
  });

  document.getElementById('locate').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
      (position) => saveLocation(position.coords.latitude, position.coords.longitude),
      () => showLocationError('locationDenied'),
      { maximumAge: 600000, timeout: 15000 },
    );
  });

  document.getElementById('test').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'test-notification' });
  });

  // Keeps the "next prayer" mark current while the page stays open.
  setInterval(renderToday, 60000);
}

async function init() {
  state = await loadState();
  await applyLanguage();
  renderToday();
  bindEvents();
  form.hidden = false;
}

init();
