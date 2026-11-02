// Static checks before packaging: manifest, permissions, locales, remote code
// and JS syntax. Usage: npm run check
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const extension = new URL('../extension/', import.meta.url).pathname;
const problems = [];
const fail = (message) => problems.push(message);

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const files = listFiles(extension);
const scripts = files.filter((path) => path.endsWith('.js'));
const ownScripts = scripts.filter((path) => !path.endsWith('lib/adhan.js'));
const code = ownScripts.map((path) => readFileSync(path, 'utf8')).join('\n');
const html = files.filter((path) => path.endsWith('.html')).map((path) => readFileSync(path, 'utf8')).join('\n');
const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
const messages = {
  en: JSON.parse(readFileSync(join(extension, '_locales/en/messages.json'), 'utf8')),
  ar: JSON.parse(readFileSync(join(extension, '_locales/ar/messages.json'), 'utf8')),
};

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
for (const key of ['name', 'version', 'description', 'icons', 'background', 'default_locale']) {
  if (!manifest[key]) fail(`manifest is missing ${key}`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail('version must be 1-4 dot-separated numbers');

const referenced = [
  manifest.background.service_worker,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
];
for (const path of referenced) {
  if (!existsSync(join(extension, path))) fail(`manifest points to missing file ${path}`);
}

const permissionUse = { alarms: 'chrome.alarms', notifications: 'chrome.notifications', storage: 'chrome.storage' };
const permissions = manifest.permissions || [];
for (const permission of permissions) {
  if (!permissionUse[permission]) fail(`unexpected permission ${permission}`);
  else if (!code.includes(permissionUse[permission])) fail(`permission ${permission} is never used`);
}
for (const [permission, api] of Object.entries(permissionUse)) {
  if (!permissions.includes(permission)) fail(`code uses ${api} but ${permission} is not declared`);
}
if (permissions.length !== 3) fail(`expected exactly alarms, notifications and storage, got ${permissions.join(', ')}`);
for (const key of ['host_permissions', 'optional_host_permissions', 'optional_permissions']) {
  if (manifest[key]) fail(`${key} must not be declared: the extension works offline`);
}
if (manifest.content_scripts || manifest.web_accessible_resources) fail('no content scripts or exposed resources expected');

for (const key of ['extName', 'extShortName', 'extDescription', 'actionTitle']) {
  if (!messages.en[key] || !messages.ar[key]) fail(`manifest message ${key} is missing`);
}
for (const lang of ['en', 'ar']) {
  if (messages[lang].extName.message.length > 45) fail(`${lang} name is longer than 45 characters`);
  if (messages[lang].extShortName.message.length > 12) fail(`${lang} short name is longer than 12 characters`);
  if (messages[lang].extDescription.message.length > 132) fail(`${lang} description is longer than 132 characters`);
}
const enKeys = Object.keys(messages.en).sort().join();
if (enKeys !== Object.keys(messages.ar).sort().join()) fail('en and ar message files have different keys');
const usedKeys = new Set([
  ...[...html.matchAll(/data-i18n="(\w+)"/g)].map((match) => match[1]),
  ...[...code.matchAll(/\bt\('(\w+)'/g)].map((match) => match[1]),
  ...[...code.matchAll(/translate\(\w+, '(\w+)'/g)].map((match) => match[1]),
  ...[...code.matchAll(/'(\w+)'/g)].map((match) => match[1]).filter((key) => /^(prayer|category|minutes|location)[A-Z]/.test(key)),
]);
for (const key of usedKeys) {
  if (!messages.en[key]) fail(`message key ${key} is used but not defined`);
}

// No remote code and no network: scripts and styles come from the package,
// and fetch() only reads the extension's own files.
if (/<script[^>]+src="(https?:)?\/\//i.test(html) || /<link[^>]+href="(https?:)?\/\//i.test(html)) fail('remote script or style in HTML');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('inline script in HTML');
if (/\beval\(|new Function\(|setTimeout\(\s*['"`]/.test(code)) fail('dynamic code evaluation found');
if (/import\s*\(|from\s+['"]https?:/.test(code)) fail('remote or dynamic import found');
for (const match of code.matchAll(/https?:\/\/[^\s'"`)]+/g)) fail(`unexpected URL in code: ${match[0]}`);
for (const match of code.matchAll(/\bfetch\((?!chrome\.runtime\.getURL\()/g)) fail(`fetch outside the package at offset ${match.index}`);
if (/XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(code)) fail('network API found');
const shippedText = files.filter((path) => /\.(js|html|css|json)$/.test(path) && !path.endsWith('lib/adhan.js'))
  .map((path) => readFileSync(path, 'utf8')).join('\n');
if (/mawaqit/i.test(shippedText)) fail('the removed mosque provider is still mentioned in the package');
if (/\bsetInterval\(|\bsetTimeout\(/.test(readFileSync(join(extension, 'background.js'), 'utf8') +
  readFileSync(join(extension, 'lib/scheduler.js'), 'utf8'))) fail('the service worker must schedule with chrome.alarms only');
if (/console\.log/.test(code)) fail('leftover console.log');

for (const path of scripts) {
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  } catch (error) {
    fail(`syntax error in ${relative(extension, path)}: ${error.stderr}`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`ok: manifest, permissions, ${usedKeys.size} message keys, no remote code, ${scripts.length} scripts parse`);
