// Renders store/logo.svg, the only logo source, to everything that uses it:
// the manifest icon sizes, the options page header copy and a 512 px store preview.
// Usage: node tools/render-icons.cjs   (needs Playwright with Chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'store', 'logo.svg');
const svg = fs.readFileSync(source, 'utf8');
const icons = path.join(root, 'extension', 'icons');

// [canvas size, tile size, output]. The Store wants the 128 px icon's artwork
// at about 96 px with transparent padding; the small sizes stay full-bleed.
const outputs = [
  [16, 16, path.join(icons, 'icon-16.png')],
  [32, 32, path.join(icons, 'icon-32.png')],
  [48, 48, path.join(icons, 'icon-48.png')],
  [128, 96, path.join(icons, 'icon-128.png')],
  [512, 512, path.join(root, 'store', 'logo-512.png')],
];

(async () => {
  fs.copyFileSync(source, path.join(icons, 'logo.svg'));
  const browser = await chromium.launch();
  for (const [canvas, tile, file] of outputs) {
    const page = await browser.newPage({ viewport: { width: canvas, height: canvas } });
    const padding = (canvas - tile) / 2;
    await page.setContent(`<style>html,body{margin:0;background:transparent}body{padding:${padding}px}svg{width:${tile}px;height:${tile}px;display:block}</style>${svg}`);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
  }
  await browser.close();
})();
