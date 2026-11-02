import { ADHKAR } from '../adhkar.js';
import { formatClock, loadMessages, minutesText, translate } from './i18n.js';

const prayerKeys = {
  fajr: 'prayerFajr',
  dhuhr: 'prayerDhuhr',
  asr: 'prayerAsr',
  maghrib: 'prayerMaghrib',
  isha: 'prayerIsha',
};

const categoryKeys = {
  istighfar: 'categoryIstighfar',
  tasbih: 'categoryTasbih',
  salawat: 'categorySalawat',
};

function languagesFor(setting) {
  return setting === 'both' ? ['ar', 'en'] : [setting];
}

// One fixed id per kind, so a new notification replaces the previous one.
function show(id, title, message, contextMessage = '') {
  return chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
    contextMessage,
    silent: true,
    priority: 0,
  });
}

export async function prayerNotification(prayer, time, language) {
  const languages = languagesFor(language);
  const lines = [];
  for (const lang of languages) {
    const messages = await loadMessages(lang);
    lines.push(translate(messages, 'prayerNow', [translate(messages, prayerKeys[prayer])]));
  }
  const clock = formatClock(time, languages[languages.length - 1]);
  return { title: lines[0], message: [lines[1], clock].filter(Boolean).join(' · ') };
}

export async function beforeNotification(prayer, minutes, language) {
  const lines = [];
  for (const lang of languagesFor(language)) {
    const messages = await loadMessages(lang);
    lines.push(translate(messages, 'prayerSoon', [
      translate(messages, prayerKeys[prayer]),
      minutesText(messages, lang, minutes),
    ]));
  }
  return { title: lines[0], message: lines[1] || '' };
}

export async function dhikrNotification(index, language) {
  const item = ADHKAR[index];
  const languages = languagesFor(language);
  const titles = [];
  for (const lang of languages) {
    titles.push(translate(await loadMessages(lang), categoryKeys[item.category]));
  }
  return {
    title: titles.join(' · '),
    message: languages.map((lang) => item[lang]).join('\n'),
    contextMessage: item.source,
  };
}

export async function notifyPrayer(prayer, time, language) {
  const { title, message } = await prayerNotification(prayer, time, language);
  return show('prayer', title, message);
}

export async function notifyBefore(prayer, minutes, language) {
  const { title, message } = await beforeNotification(prayer, minutes, language);
  return show('pre', title, message);
}

export async function notifyDhikr(index, language) {
  const { title, message, contextMessage } = await dhikrNotification(index, language);
  return show('dhikr', title, message, contextMessage);
}
