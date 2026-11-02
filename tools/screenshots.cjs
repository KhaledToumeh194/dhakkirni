// Loads the unpacked extension in Chromium, saves options page screenshots to
// store/ and checks the contrast of every text/background pair on the page.
// Usage: node tools/screenshots.cjs
//   store/options-<lang>-1280.png  1280x800, the Chrome Web Store screenshot size
//   store/options-<lang>-400.png   full page at a narrow width
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const extensionDir = path.join(root, 'extension');
const outDir = path.join(root, 'store');

// Runs in the page. Walks every visible element that renders text and blends
// its background stack to find the color the text actually sits on.
function auditPage() {
  // color-mix() computes to color(srgb r g b / a) with 0-1 channels.
  const parse = (value) => {
    const scale = value.startsWith('color(') ? 255 : 1;
    const [r, g, b, a = 1] = value.replace('srgb', '').match(/[\d.]+/g).map(Number);
    return { r: r * scale, g: g * scale, b: b * scale, a };
  };
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = ({ r, g, b }) => {
    const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const backgroundOf = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color.a > 0) layers.push(color);
      if (color.a === 1) break;
    }
    return layers.reverse().reduce((under, layer) => blend(layer, under), parse(getComputedStyle(document.documentElement).backgroundColor));
  };

  const pairs = new Map();
  const record = (element, sample) => {
    const style = getComputedStyle(element);
    const background = backgroundOf(element);
    const foreground = blend(parse(style.color), background);
    const key = `${hex(foreground)} on ${hex(background)}`;
    if (!pairs.has(key)) pairs.set(key, { pair: key, ratio: ratio(foreground, background), sample: sample.slice(0, 40) });
  };
  for (const element of document.querySelectorAll('body *')) {
    if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
    if (element.closest('.visually-hidden')) continue;
    const text = [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent.trim()).join(' ');
    if (text) record(element, text);
    else if (element.matches('input[type=number], input[type=text], input[type=time], select')) record(element, element.value || element.name || element.id);
  }

  // States a static screenshot never shows, from the palette itself.
  const color = (name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = parse(getComputedStyle(probe).color);
    probe.remove();
    return value;
  };
  const surface = color('--surface');
  const states = [
    ['--on-accent', '--accent-hover', 'primary button hover', 4.5],
    ['--on-accent', '--accent-pressed', 'primary button pressed', 4.5],
    ['--danger', '--surface-raised', 'error message', 4.5],
    ['--text', '--surface-raised', 'notice and buttons', 4.5],
    ['--control-border', '--surface', 'control outline (non-text)', 3],
    ['--control-border', '--bg', 'control outline on page (non-text)', 3],
    ['--accent', '--surface', 'switch, next-prayer bar (non-text)', 3],
    ['--accent', '--bg', 'focus ring (non-text)', 3],
  ].map(([fg, bg, use, minimum]) => ({ pair: `${fg} on ${bg}`, use, minimum, ratio: ratio(color(fg), color(bg)) }));
  const wash = blend(color('--accent-wash'), surface);
  states.push({ pair: '--text on --accent-wash', use: 'next prayer label', minimum: 4.5, ratio: ratio(color('--text'), wash) });
  return { pairs: [...pairs.values()], states };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dhakkirni-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: 'chromium',
    colorScheme: 'dark',
    timezoneId: 'Europe/Bucharest',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await page.evaluate(() => chrome.storage.local.set({ location: { latitude: 44.4268, longitude: 26.1025 } }));

  const low = [];
  const seen = new Map();
  let states;
  for (const language of ['en', 'ar']) {
    for (const width of [1280, 400]) {
      await page.evaluate(async (lang) => {
        const { settings } = await chrome.storage.sync.get('settings');
        await chrome.storage.sync.set({ settings: { ...settings, language: lang } });
      }, language);
      await page.setViewportSize({ width, height: 800 });
      await page.reload();
      await page.waitForSelector('main:not([hidden])');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(outDir, `options-${language}-${width}.png`), fullPage: width < 1280 });
      const audit = await page.evaluate(auditPage);
      states = audit.states;
      for (const pair of audit.pairs) seen.set(pair.pair, pair);
    }
  }
  console.log('Text on page (ratio, pair, example):');
  for (const pair of [...seen.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.log(`  ${pair.ratio.toFixed(2).padStart(5)}  ${pair.pair}  "${pair.sample}"`);
    if (pair.ratio < 4.5) low.push(pair.pair);
  }
  console.log('States and non-text:');
  for (const state of states) {
    console.log(`  ${state.ratio.toFixed(2).padStart(5)}  ${state.pair}  (${state.use}, needs ${state.minimum})`);
    if (state.ratio < state.minimum) low.push(state.pair);
  }
  console.log(low.length ? `BELOW MINIMUM: ${low.join('; ')}` : 'all pairs meet their minimum');
  console.log(problems.length ? `page errors:\n${problems.join('\n')}` : 'no page errors');
  await context.close();
  process.exitCode = low.length || problems.length ? 1 : 0;
})();
