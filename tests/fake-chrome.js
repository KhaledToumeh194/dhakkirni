import { readFileSync } from 'node:fs';

function fakeArea(initial = {}) {
  const items = structuredClone(initial);
  return {
    items,
    async get(keys) {
      if (keys === null) return structuredClone(items);
      const list = typeof keys === 'string' ? [keys] : keys;
      return Object.fromEntries(list.filter((key) => key in items).map((key) => [key, structuredClone(items[key])]));
    },
    async set(values) {
      Object.assign(items, structuredClone(values));
    },
    async remove(keys) {
      for (const key of keys) delete items[key];
    },
  };
}

// Just enough of the extension APIs for the worker and scheduler: alarms live in a Map,
// notifications are recorded instead of shown.
export function installFakeChrome({ sync = {}, local = {} } = {}) {
  const alarms = new Map();
  const shown = [];
  const listeners = {};
  const event = (name) => ({ addListener: (listener) => { listeners[name] = listener; } });
  globalThis.chrome = {
    storage: { sync: fakeArea(sync), local: fakeArea(local) },
    alarms: {
      onAlarm: event('alarm'),
      async create(name, info) {
        const scheduledTime = info.when ?? Date.now() + info.delayInMinutes * 60000;
        alarms.set(name, { name, scheduledTime, periodInMinutes: info.periodInMinutes });
      },
      async clear(name) {
        return alarms.delete(name);
      },
      async getAll() {
        return [...alarms.values()];
      },
    },
    notifications: {
      onClicked: event('notificationClicked'),
      async create(id, options) {
        shown.push({ id, ...options });
        return id;
      },
    },
    runtime: {
      id: 'test',
      openedOptions: 0,
      getURL: (path) => new URL(`../extension/${path}`, import.meta.url).href,
      openOptionsPage() { this.openedOptions++; },
      onInstalled: event('installed'),
      onStartup: event('startup'),
      onMessage: event('message'),
    },
    action: { onClicked: event('actionClicked') },
  };
  chrome.storage.onChanged = event('storageChanged');
  globalThis.fetch = async (url) => {
    const text = readFileSync(new URL(url), 'utf8');
    return { ok: true, json: async () => JSON.parse(text), text: async () => text };
  };
  return { alarms, shown, listeners };
}
