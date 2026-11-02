import { migrate, upgradeStorage } from './lib/settings.js';
import { handleAlarm, reschedule, sendTestNotification } from './lib/scheduler.js';
import { suggestMethod } from './lib/times.js';

// Every listener is registered at the top level so Chrome can wake the worker
// for any of these events. Nothing is kept in memory between wakes.

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { settings } = await chrome.storage.sync.get('settings');
  if (!settings) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await chrome.storage.sync.set({ settings: migrate({ method: suggestMethod(timeZone) }) });
  } else {
    // Also on a fresh install: Chrome sync may bring settings from an older
    // version on another device.
    await upgradeStorage(settings);
  }
  await reschedule();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

// Chrome may drop alarms when the browser restarts.
chrome.runtime.onStartup.addListener(() => reschedule());

chrome.storage.onChanged.addListener((changes, area) => {
  const relevant = area === 'sync' ? changes.settings : changes.location;
  if (relevant) reschedule();
});

chrome.alarms.onAlarm.addListener((alarm) => handleAlarm(alarm));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message.type !== 'test-notification') return false;
  sendTestNotification().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.notifications.onClicked.addListener((id) => chrome.notifications.clear(id));
