// chrome.i18n only follows the browser language, but the user can pick Arabic,
// English or both, so pages and notifications read the message files directly.
const loaded = {};

export async function loadMessages(language) {
  if (!loaded[language]) {
    const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
    loaded[language] = await response.json();
  }
  return loaded[language];
}

export function translate(messages, key, substitutions = []) {
  const entry = messages[key];
  if (!entry) return key;
  let text = entry.message;
  for (const [name, placeholder] of Object.entries(entry.placeholders || {})) {
    const value = placeholder.content.replace(/\$(\d)/g, (match, n) => substitutions[n - 1] ?? '');
    text = text.replaceAll(`$${name}$`, () => value);
  }
  return text;
}

export function numberLocale(language) {
  return language === 'ar' ? 'ar-u-nu-arab' : 'en';
}

// Arabic counts change form: 1 and 2 have their own words, 3-10 take the
// plural, 11 and above go back to the singular.
export function minutesText(messages, language, count) {
  const number = new Intl.NumberFormat(numberLocale(language)).format(count);
  if (count === 1) return translate(messages, 'minutesOne');
  if (count === 2) return translate(messages, 'minutesTwo');
  if (language === 'ar' && count <= 10) return translate(messages, 'minutesFew', [number]);
  return translate(messages, 'minutesMany', [number]);
}

export function formatClock(date, language) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-u-nu-arab' : undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
