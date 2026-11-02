# ذكّرني · Dhakkirni

A Chrome extension that reminds you, while you work, to make istighfar, dhikr and salawat on the Prophet ﷺ, and that shows a notification at each prayer time. Every reminder is a silent notification. There is no sound and no adhan.

Prayer times are calculated on your device with the [adhan](https://github.com/batoulapps/adhan-js) library. The extension makes no network requests. To match your mosque's timetable, pick the method your mosque uses and move each prayer a few minutes earlier or later in the Adjust column under "Prayer notifications".

## Load it in Chrome

1. Open `chrome://extensions` and turn on Developer mode.
2. Click Load unpacked and choose the `extension` folder.
3. The settings page opens. Set your location with "Use my location", or type the latitude and longitude, then click Save.
4. Check that today's times at the top match your mosque's timetable. If one prayer is off by a few minutes, enter the difference in its Adjust field. Click "Send test notification".

If no notification appears, allow notifications for Chrome in your system settings. On macOS this is under System Settings > Notifications > Google Chrome.

### Firing a reminder within a minute

On `chrome://extensions`, click "service worker" under Dhakkirni to open its console, then run one of these:

```js
chrome.alarms.create('prayer:dhuhr:test', { when: Date.now() + 5000 })
```

```js
chrome.alarms.create('pre:asr:test', { when: Date.now() + 5000 })
```

```js
chrome.alarms.create('dhikr', { delayInMinutes: 0.5, periodInMinutes: 1 })
```

Chrome rounds alarms up to about 30 seconds, so expect the notification within a minute. The last command switches dhikr reminders to every minute. Changing any setting afterwards puts your chosen interval back.

### Things to check by hand

- Close and reopen Chrome. Run `chrome.alarms.getAll().then(console.log)` in the service worker console. The `prayer:` and `pre:` alarms for today and tomorrow should be listed again.
- Click Reload on the extension card. Your settings and location should stay.
- If you had the earlier version with a mosque selected: after updating, today's times are calculated again and your method, adjustments and location are kept.
- Put the computer to sleep across a prayer time. When it wakes, that prayer's notification should not appear if more than 5 minutes have passed.

## Tests

```bash
npm install
```

```bash
npm test
```

```bash
npm run check
```

```bash
npm run package
```

`npm test` runs the unit tests. They cover prayer times for several cities, DST days and offsets, the scheduler with a fake `chrome.alarms`, and the settings migration. `npm run check` validates the manifest, confirms the only permissions are alarms, notifications and storage with no host access, and checks that nothing in the package makes network requests or loads remote code. It also checks the message files and JS syntax. `npm run package` writes `dist/dhakkirni.zip`, which holds only the `extension` folder with `manifest.json` at its root.

`node tools/screenshots.cjs` loads the extension in Chromium through Playwright, saves the screenshots in `store/` and checks the contrast of every text and background pair. `node tools/render-icons.cjs` redraws the icons from `store/logo.svg`.

## Finding the adjustments for a mosque

`tools/calibrate.js` is a developer tool and is not part of the extension. It compares a mosque's yearly timetable with every adhan method, with both Asr rules and each high-latitude rule. It reads the yearly calendar that Mawaqit mosque pages embed. For the best fit it reports the minute offset per prayer and the median, mean and maximum error left after that offset. It also flags prayers that don't follow any calculation, which is common when a mosque holds Dhuhr or Isha at a fixed time for some weeks. Ignore the suggested offset for a flagged prayer.

```bash
node tools/calibrate.js https://mawaqit.net/en/your-mosque-page --year 2026
```

You can also pass a mosque page saved from the browser (`.html`), or a JSON file with `name`, `timezone`, `latitude`, `longitude` and `calendar`. Then pick the reported method on the settings page and type the offsets into the Adjust fields.

### Result for Bucharest

Not run yet. The two mosques this was meant for (Altaqwa and Masjid Ar-Rahman) could not be fetched while building, so there is no fitted result for them. Until there is one, Bucharest uses the Muslim World League default with no offsets. To fill this in, run the command above with each mosque's page link and paste the output here.

The test `tests/calibrate.test.js` checks the script on a made-up Bucharest timetable: Diyanet angles with known offsets, and Dhuhr held at 13:45 from April to September. The script recovers the method and the offsets and flags Dhuhr.

## Layout

- `extension/`: the extension itself. This is the only folder that goes into the zip.
- `tests/`: unit tests (`node --test`).
- `tools/`: checks, packaging, the calibration script, icons and screenshots. None of it ships.
- `store/`: logo source, logo preview and store screenshots.
- `dist/`: the release zip.

The adhan library (MIT) and IBM Plex Sans Arabic (SIL Open Font License) are bundled with their licenses in `extension/lib` and `extension/fonts`.
