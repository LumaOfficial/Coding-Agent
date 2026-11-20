import path from 'node:path';
import { listWorkspaceFiles, readWorkspaceFile } from './store.js';

/**
 * Store readiness tests.
 *
 * Deterministic checks of the workspace files against the packaging rules of the
 * stores this agent can ship to. Nothing here calls a store API: it reports what
 * the current workspace is missing before submission, so the agent can point at
 * concrete gaps instead of guessing.
 */

const MAX_FILES = 400;
const MAX_BYTES = 256 * 1024;
const MAX_SCAN_FILES = 120;

export const PASS = 'pass';
export const WARN = 'warn';
export const FAIL = 'fail';

const check = (id, label, status, detail = '') => ({ id, label, status, detail });

/* ---------------- workspace snapshot ---------------- */

async function snapshot(sessionId) {
  const listed = (await listWorkspaceFiles(sessionId)).slice(0, MAX_FILES);
  const cache = new Map();
  const names = listed.map((file) => file.path);
  const sizes = new Map(listed.map((file) => [file.path, file.size]));

  async function read(rel) {
    if (cache.has(rel)) return cache.get(rel);
    let text = '';
    const size = sizes.get(rel);
    if (size !== undefined && size <= MAX_BYTES) {
      try {
        text = await readWorkspaceFile(sessionId, rel);
      } catch {
        text = '';
      }
    }
    cache.set(rel, text);
    return text;
  }

  async function readJson(rel) {
    try {
      return JSON.parse(await read(rel));
    } catch {
      return null;
    }
  }

  return {
    names,
    count: listed.length,
    find: (re) => names.find((file) => re.test(file)),
    all: (re) => names.filter((file) => re.test(file)),
    read,
    readJson,
  };
}

/* ---------------- shared scanners ---------------- */

async function scanSource(ws, tests) {
  const files = ws.all(/\.(m?js|cjs|jsx|tsx?|html?)$/i).slice(0, MAX_SCAN_FILES);
  const hits = [];
  for (const file of files) {
    const code = await ws.read(file);
    if (!code) continue;
    for (const [label, re] of tests) {
      if (re.test(code)) hits.push(`${file} — ${label}`);
    }
  }
  return [...new Set(hits)].slice(0, 6);
}

async function scanMinified(ws) {
  const files = ws.all(/\.(m?js|cjs)$/i).slice(0, MAX_SCAN_FILES);
  const hits = [];
  for (const file of files) {
    const code = await ws.read(file);
    if (!code) continue;
    const longest = code.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
    if (longest > 2000) hits.push(file);
  }
  return hits.slice(0, 5);
}

const REMOTE_CODE = [
  ['eval()', /\beval\s*\(/],
  ['new Function()', /\bnew\s+Function\s*\(/],
  ['remote <script src>', /<script[^>]+src\s*=\s*["']https?:/i],
  ['remote importScripts()', /importScripts\s*\(\s*["']https?:/],
];

/* ---------------- browser extensions ---------------- */

async function extensionChecks(ws, { allowMv2 = false, gecko = false } = {}) {
  const checks = [];
  const manifestPath = ws.find(/(^|\/)manifest\.json$/i);

  if (!manifestPath) {
    checks.push(
      check(
        'manifest',
        'manifest.json present',
        FAIL,
        'No manifest.json in the workspace — a browser store needs a packaged extension.'
      )
    );
    return checks;
  }
  checks.push(check('manifest', 'manifest.json present', PASS, manifestPath));

  const manifest = await ws.readJson(manifestPath);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    checks.push(
      check('manifest-json', 'manifest.json parses as JSON', FAIL, 'Fix the JSON syntax before packaging.')
    );
    return checks;
  }
  checks.push(check('manifest-json', 'manifest.json parses as JSON', PASS));

  const dir = manifestPath.includes('/') ? path.posix.dirname(manifestPath) : '';
  const resolve = (rel) => {
    const clean = String(rel).replace(/^\/+/, '');
    return dir ? path.posix.normalize(`${dir}/${clean}`) : clean;
  };
  const exists = (rel) => ws.names.includes(resolve(rel));

  const version = Number(manifest.manifest_version);
  if (version === 3) {
    checks.push(check('mv3', 'Manifest V3', PASS));
  } else if (version === 2) {
    checks.push(
      check(
        'mv3',
        'Manifest V3',
        allowMv2 ? WARN : FAIL,
        'Manifest V2 is not accepted by Chrome Web Store, Edge Add-ons or Opera; Firefox is phasing it out.'
      )
    );
  } else {
    checks.push(check('mv3', 'Manifest V3', FAIL, 'manifest_version must be 3.'));
  }

  const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';
  checks.push(
    name
      ? check(
          'name',
          'Extension name',
          name.length <= 75 ? PASS : WARN,
          `${name.length}/75 characters`
        )
      : check('name', 'Extension name', FAIL, 'manifest.name is required.')
  );

  const description = typeof manifest.description === 'string' ? manifest.description.trim() : '';
  checks.push(
    description
      ? check(
          'description',
          'Store description',
          description.length <= 132 ? PASS : WARN,
          `${description.length}/132 characters`
        )
      : check('description', 'Store description', FAIL, 'manifest.description is required for the listing.')
  );

  const versionOk = /^\d{1,5}(\.\d{1,5}){0,3}$/.test(String(manifest.version || ''));
  checks.push(
    versionOk
      ? check('version', 'Version format', PASS, String(manifest.version))
      : check(
          'version',
          'Version format',
          FAIL,
          'manifest.version must be 1–4 dot-separated integers, e.g. 1.2.0.'
        )
  );

  const icons = manifest.icons && typeof manifest.icons === 'object' ? manifest.icons : {};
  const sizes = Object.keys(icons)
    .map(Number)
    .filter((size) => Number.isFinite(size) && size > 0);
  const missingSizes = [16, 48, 128].filter((size) => !sizes.includes(size));
  const brokenIcons = Object.values(icons).filter(
    (rel) => typeof rel === 'string' && !exists(rel)
  );

  if (!sizes.length) {
    checks.push(
      check('icons', 'Icons declared', FAIL, 'Add 16, 48 and 128 px icons to manifest.icons.')
    );
  } else if (brokenIcons.length) {
    checks.push(
      check('icons', 'Icons declared', FAIL, `Icon file(s) missing: ${brokenIcons.join(', ')}`)
    );
  } else if (missingSizes.length) {
    checks.push(
      check(
        'icons',
        'Icons declared',
        WARN,
        `Add ${missingSizes.join(', ')} px icons — the store listing shows them.`
      )
    );
  } else {
    checks.push(check('icons', 'Icons declared', PASS, '16, 48 and 128 px'));
  }

  const action = manifest.action || manifest.browser_action || manifest.page_action;
  checks.push(
    action
      ? check('action', 'Toolbar action', PASS, action.default_title || action.default_popup || 'declared')
      : check('action', 'Toolbar action', WARN, 'No action/browser_action — the extension has no toolbar button.')
  );

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const hosts = [
    ...(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : []),
    ...permissions.filter(
      (permission) =>
        typeof permission === 'string' && (permission === '<all_urls>' || permission.includes('://'))
    ),
  ];
  checks.push(
    hosts.length
      ? check(
          'permissions',
          'Permission review',
          WARN,
          `Host access requested: ${hosts.slice(0, 4).join(', ')}${
            hosts.length > 4 ? ` +${hosts.length - 4}` : ''
          }. Stores review broad permissions.`
        )
      : check('permissions', 'Permission review', PASS, 'No broad host access requested.')
  );

  const privacy = ws.find(/(^|\/)(privacy|privacy[-_.]?policy)[^/]*$/i);
  checks.push(
    privacy
      ? check('privacy', 'Privacy policy', PASS, privacy)
      : check(
          'privacy',
          'Privacy policy',
          hosts.length ? FAIL : WARN,
          'A privacy policy is required when the extension requests permissions — add privacy.md and link it in the listing.'
        )
  );

  const remote = await scanSource(ws, REMOTE_CODE);
  checks.push(
    remote.length
      ? check('remote-code', 'No remote or eval’d code', FAIL, remote.join('; '))
      : check('remote-code', 'No remote or eval’d code', PASS)
  );

  const minified = await scanMinified(ws);
  checks.push(
    minified.length
      ? check(
          'source',
          'Readable source',
          WARN,
          `Minified-looking file(s): ${minified.join(', ')} — stores may ask for the unminified source.`
        )
      : check('source', 'Readable source', PASS)
  );

  const listing = ws.all(/(^|\/)(screenshots?|store|listing)\//i);
  checks.push(
    listing.length
      ? check('listing', 'Listing screenshots', PASS, `${listing.length} file(s)`)
      : check(
          'listing',
          'Listing screenshots',
          WARN,
          'No screenshots found — the store listing needs at least one 1280×800 screenshot.'
        )
  );

  if (gecko) {
    const geckoId =
      manifest.browser_specific_settings?.gecko?.id || manifest.applications?.gecko?.id;
    checks.push(
      geckoId
        ? check('gecko-id', 'Firefox add-on ID', PASS, String(geckoId))
        : check(
            'gecko-id',
            'Firefox add-on ID',
            FAIL,
            'Add browser_specific_settings.gecko.id — Mozilla requires a stable add-on ID.'
          )
    );

    const minVersion = manifest.browser_specific_settings?.gecko?.strict_min_version;
    checks.push(
      minVersion
        ? check('gecko-min', 'Firefox minimum version', PASS, String(minVersion))
        : check(
            'gecko-min',
            'Firefox minimum version',
            WARN,
            'Set browser_specific_settings.gecko.strict_min_version (e.g. "128.0").'
          )
    );

    const chromeApi = await scanSource(ws, [['chrome.* API used', /\bchrome\.\w+/]]);
    const polyfill = ws.find(/webextension-polyfill|browser-polyfill/i);
    checks.push(
      chromeApi.length && !polyfill
        ? check(
            'gecko-api',
            'Firefox API compatibility',
            WARN,
            `chrome.* namespace used in ${chromeApi
              .slice(0, 3)
              .map((hit) => hit.split(' — ')[0])
              .join(', ')} — Firefox exposes browser.*; include webextension-polyfill or guard the namespace.`
          )
        : check('gecko-api', 'Firefox API compatibility', PASS)
    );
  }

  return checks;
}

/* ---------------- Google Play ---------------- */

const SENSITIVE_PERMISSIONS = new Set([
  'CAMERA',
  'RECORD_AUDIO',
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'READ_CONTACTS',
  'READ_SMS',
  'SEND_SMS',
  'READ_PHONE_STATE',
  'CALL_PHONE',
  'BODY_SENSORS',
  'POST_NOTIFICATIONS',
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'QUERY_ALL_PACKAGES',
  'MANAGE_EXTERNAL_STORAGE',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
  'BLUETOOTH_CONNECT',
]);

async function playChecks(ws) {
  const checks = [];
  const manifestPath = ws.find(/(^|\/)AndroidManifest\.xml$/i);
  const gradlePath =
    ws.find(/(^|\/)app\/build\.gradle(\.kts)?$/i) || ws.find(/(^|\/)build\.gradle(\.kts)?$/i);
  const gradle = gradlePath ? await ws.read(gradlePath) : '';
  const manifest = manifestPath ? await ws.read(manifestPath) : '';

  checks.push(
    manifestPath
      ? check('manifest', 'AndroidManifest.xml present', PASS, manifestPath)
      : check(
          'manifest',
          'AndroidManifest.xml present',
          FAIL,
          'No AndroidManifest.xml — Play needs a signed Android App Bundle (AAB).'
        )
  );
  checks.push(
    gradlePath
      ? check('gradle', 'Gradle build file present', PASS, gradlePath)
      : check(
          'gradle',
          'Gradle build file present',
          FAIL,
          'No app/build.gradle — versionCode, targetSdk and signing live there.'
        )
  );

  const appId =
    gradle.match(/applicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1] ||
    manifest.match(/package\s*=\s*["']([^"']+)["']/)?.[1];
  checks.push(
    appId
      ? check('app-id', 'Application ID', PASS, appId)
      : check(
          'app-id',
          'Application ID',
          FAIL,
          'Set applicationId in build.gradle; it must stay stable across releases.'
        )
  );

  const versionCode = gradle.match(/versionCode\s*(?:=\s*)?(\d+)/)?.[1];
  const versionName = gradle.match(/versionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1];
  checks.push(
    versionCode && versionName
      ? check('version', 'Version code + name', PASS, `${versionName} (${versionCode})`)
      : check(
          'version',
          'Version code + name',
          FAIL,
          'Set versionCode and versionName in defaultConfig; every Play upload needs a higher versionCode.'
        )
  );

  const targetSdk = Number(gradle.match(/targetSdk(?:Version)?\s*(?:=\s*)?(\d+)/)?.[1] || 0);
  if (!targetSdk) {
    checks.push(
      check('target-sdk', 'Target SDK', FAIL, 'Set targetSdk — Play requires a recent API level for new releases.')
    );
  } else if (targetSdk < 35) {
    checks.push(
      check(
        'target-sdk',
        'Target SDK',
        WARN,
        `targetSdk ${targetSdk} — new Play releases must target API 35 or higher.`
      )
    );
  } else {
    checks.push(check('target-sdk', 'Target SDK', PASS, `API ${targetSdk}`));
  }

  const minSdk = gradle.match(/minSdk(?:Version)?\s*(?:=\s*)?(\d+)/)?.[1];
  checks.push(
    minSdk
      ? check('min-sdk', 'Minimum SDK', PASS, `API ${minSdk}`)
      : check('min-sdk', 'Minimum SDK', WARN, 'Set minSdkVersion; Play shows it on the listing.')
  );

  checks.push(
    /android:debuggable\s*=\s*"true"/i.test(manifest)
      ? check(
          'debuggable',
          'Release build not debuggable',
          FAIL,
          'android:debuggable="true" in AndroidManifest.xml — Play rejects debuggable builds.'
        )
      : check('debuggable', 'Release build not debuggable', PASS)
  );

  const signed =
    /signingConfigs\s*[{(]/.test(gradle) ||
    /signingConfig\s+signingConfigs\./.test(gradle) ||
    Boolean(ws.find(/(^|\/)keystore\.properties$/i)) ||
    Boolean(ws.find(/\.keystore$|\.jks$/i));
  checks.push(
    signed
      ? check('signing', 'Release signing configured', PASS)
      : check(
          'signing',
          'Release signing configured',
          WARN,
          'No signingConfigs / keystore found — Play needs an upload key for the AAB.'
        )
  );

  checks.push(
    /usesCleartextTraffic\s*=\s*"true"/i.test(manifest)
      ? check(
          'cleartext',
          'HTTPS only',
          WARN,
          'usesCleartextTraffic="true" — Play flags plain HTTP; scope it to debug builds.'
        )
      : check('cleartext', 'HTTPS only', PASS)
  );

  const permissions = [...manifest.matchAll(/uses-permission[^>]*android:name\s*=\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );
  const sensitive = permissions.filter((permission) =>
    SENSITIVE_PERMISSIONS.has(permission.split('.').pop())
  );
  checks.push(
    sensitive.length
      ? check(
          'permissions',
          'Data safety review',
          WARN,
          `Declare in Play Console Data safety: ${sensitive
            .map((permission) => permission.split('.').pop())
            .join(', ')}.`
        )
      : check(
          'permissions',
          'Data safety review',
          PASS,
          permissions.length ? `${permissions.length} normal permission(s)` : 'No permissions requested'
        )
  );

  const exported = [];
  const tagRe = /<(activity|service|receiver|provider)\b([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(manifest))) {
    if (/android:exported/.test(match[2])) continue;
    const rest = manifest.slice(match.index);
    const close = rest.indexOf(`</${match[1]}>`);
    const body = close === -1 ? '' : rest.slice(0, close);
    if (/<intent-filter/.test(body)) exported.push(match[1]);
  }
  checks.push(
    exported.length
      ? check(
          'exported',
          'android:exported declared',
          FAIL,
          `${exported.join(', ')} declare an intent-filter without android:exported — required since Android 12.`
        )
      : check('exported', 'android:exported declared', PASS)
  );

  const privacy = ws.find(/(^|\/)privacy[^/]*$/i);
  checks.push(
    privacy
      ? check('privacy', 'Privacy policy', PASS, privacy)
      : check(
          'privacy',
          'Privacy policy',
          FAIL,
          'Play requires a privacy policy URL for every app — add privacy.md and paste its URL in Play Console.'
        )
  );

  const assets =
    ws.all(/(^|\/)(play|store|listing)\//i).length ||
    ws.all(/feature[-_ ]?graphic|icon[-_]?512/i).length;
  checks.push(
    assets
      ? check('assets', 'Store graphics', PASS)
      : check(
          'assets',
          'Store graphics',
          WARN,
          'Play listing needs a 512×512 icon and a 1024×500 feature graphic.'
        )
  );

  return checks;
}

/* ---------------- Apple App Store ---------------- */

function plistValue(text, key) {
  const match = text.match(
    new RegExp(`<key>\\s*${key}\\s*</key>\\s*<string>([^<]*)</string>`)
  );
  return match ? match[1].trim() : null;
}

async function appleChecks(ws) {
  const checks = [];
  const plistPath = ws.find(/(^|\/)Info\.plist$/i);
  const project = ws.find(
    /(\.xcodeproj|\.xcworkspace)\/|(^|\/)Package\.swift$|(^|\/)project\.yml$/i
  );

  checks.push(
    project
      ? check('project', 'Xcode project present', PASS, project)
      : check(
          'project',
          'Xcode project present',
          FAIL,
          'No .xcodeproj, Package.swift or project.yml — App Store Connect needs a signed archive.'
        )
  );
  checks.push(
    plistPath
      ? check('plist', 'Info.plist present', PASS, plistPath)
      : check('plist', 'Info.plist present', FAIL, 'No Info.plist — bundle id and versions are read from it.')
  );

  const plist = plistPath ? await ws.read(plistPath) : '';
  const bundleId = plistValue(plist, 'CFBundleIdentifier');
  const shortVersion = plistValue(plist, 'CFBundleShortVersionString');
  const build = plistValue(plist, 'CFBundleVersion');

  checks.push(
    bundleId && !bundleId.includes('$(')
      ? check('bundle-id', 'Bundle identifier', PASS, bundleId)
      : check(
          'bundle-id',
          'Bundle identifier',
          FAIL,
          'Set CFBundleIdentifier to a reverse-DNS id registered in App Store Connect.'
        )
  );
  checks.push(
    shortVersion && build
      ? check('version', 'Marketing + build version', PASS, `${shortVersion} (${build})`)
      : check(
          'version',
          'Marketing + build version',
          FAIL,
          'Set CFBundleShortVersionString and CFBundleVersion — every upload needs a new build number.'
        )
  );

  const privacyManifest = ws.find(/(^|\/)PrivacyInfo\.xcprivacy$/i);
  checks.push(
    privacyManifest
      ? check('privacy-manifest', 'Privacy manifest', PASS, privacyManifest)
      : check(
          'privacy-manifest',
          'Privacy manifest',
          FAIL,
          'Add PrivacyInfo.xcprivacy — Apple requires it for apps using required-reason APIs and third-party SDKs.'
        )
  );

  const icons = ws.find(/AppIcon\.appiconset\/Contents\.json$/i) || ws.find(/\.appiconset\//i);
  checks.push(
    icons
      ? check('icons', 'App icon asset catalog', PASS, icons)
      : check(
          'icons',
          'App icon asset catalog',
          FAIL,
          'Add an AppIcon.appiconset with a 1024×1024 icon — the store rejects a missing icon.'
        )
  );

  checks.push(
    /<key>\s*NSAllowsArbitraryLoads\s*<\/key>\s*<true\s*\/>/.test(plist)
      ? check(
          'ats',
          'App Transport Security',
          WARN,
          'NSAllowsArbitraryLoads is enabled — review flags plain HTTP; scope exceptions per domain.'
        )
      : check('ats', 'App Transport Security', PASS)
  );

  checks.push(
    plist.includes('ITSAppUsesNonExemptEncryption')
      ? check('export', 'Export compliance', PASS)
      : check(
          'export',
          'Export compliance',
          WARN,
          'Add ITSAppUsesNonExemptEncryption to Info.plist to answer App Store Connect export questions automatically.'
        )
  );

  const entitlements = ws.find(/\.entitlements$/i);
  checks.push(
    entitlements
      ? check('entitlements', 'Entitlements file', PASS, entitlements)
      : check(
          'entitlements',
          'Entitlements file',
          WARN,
          'No .entitlements file — add one if the app uses capabilities (push, iCloud, Sign in with Apple).'
        )
  );

  const privacy = ws.find(/(^|\/)privacy[^/]*$/i);
  checks.push(
    privacy
      ? check('privacy', 'Privacy policy', PASS, privacy)
      : check(
          'privacy',
          'Privacy policy',
          FAIL,
          'App Store Connect requires a privacy policy URL for every app.'
        )
  );

  const shots = ws.all(/(^|\/)(screenshots?|fastlane\/screenshots)\//i);
  checks.push(
    shots.length
      ? check('screenshots', 'App Store screenshots', PASS, `${shots.length} file(s)`)
      : check(
          'screenshots',
          'App Store screenshots',
          WARN,
          'Add screenshots for 6.9" iPhone and 13" iPad — required for the listing.'
        )
  );

  return checks;
}

/* ---------------- VS Code Marketplace ---------------- */

async function vscodeChecks(ws) {
  const checks = [];
  const pkgPath = ws.find(/(^|\/)package\.json$/i);
  if (!pkgPath) {
    checks.push(check('package', 'package.json present', FAIL, 'A VS Code extension starts from package.json.'));
    return checks;
  }
  checks.push(check('package', 'package.json present', PASS, pkgPath));

  const pkg = await ws.readJson(pkgPath);
  if (!pkg) {
    checks.push(check('package-json', 'package.json parses', FAIL, 'Fix the JSON syntax first.'));
    return checks;
  }
  checks.push(check('package-json', 'package.json parses', PASS));

  const field = (id, label, value, status = FAIL, detail = '') => {
    checks.push(
      value
        ? check(id, label, PASS, typeof value === 'string' ? value : '')
        : check(id, label, status, detail)
    );
  };

  field(
    'publisher',
    'Publisher',
    pkg.publisher,
    FAIL,
    'Add "publisher" — the Marketplace id you create at marketplace.visualstudio.com/manage.'
  );
  field('display-name', 'Display name', pkg.displayName, WARN, 'Add "displayName" for the Marketplace listing.');
  field('description', 'Description', pkg.description, WARN, 'Add "description" for the listing.');
  field('license', 'License', pkg.license, WARN, 'Add "license" (e.g. MIT) — Marketplace requires one.');
  field('engines', 'VS Code engine', pkg.engines?.vscode, FAIL, 'Add engines.vscode (e.g. "^1.90.0").');
  field(
    'repository',
    'Repository',
    pkg.repository?.url || pkg.repository,
    WARN,
    'Add "repository" so the Marketplace links the source.'
  );

  checks.push(
    pkg.private === true
      ? check('private', 'Publishable package', FAIL, '"private": true blocks publishing — remove it.')
      : check('private', 'Publishable package', PASS)
  );

  const main = typeof pkg.main === 'string' ? pkg.main : '';
  const mainExists = main
    ? ws.names.some((name) => name.endsWith(main.replace(/^\.\//, '')))
    : false;
  checks.push(
    main
      ? mainExists
        ? check('main', 'Entry point', PASS, main)
        : check('main', 'Entry point', FAIL, `"main" points at ${main}, which is not in the workspace.`)
      : check('main', 'Entry point', FAIL, 'Add "main" (e.g. "./dist/extension.js").')
  );

  const icon = typeof pkg.icon === 'string' ? pkg.icon : '';
  const iconExists = icon ? ws.names.some((name) => name.endsWith(icon.replace(/^\.\//, ''))) : false;
  checks.push(
    icon
      ? iconExists
        ? check('icon', 'Extension icon', PASS, icon)
        : check('icon', 'Extension icon', FAIL, `Icon file ${icon} not found.`)
      : check('icon', 'Extension icon', WARN, 'Add a 128×128 PNG "icon".')
  );

  const contributes = pkg.contributes && Object.keys(pkg.contributes).length > 0;
  const activation = Array.isArray(pkg.activationEvents) && pkg.activationEvents.length > 0;
  checks.push(
    contributes || activation
      ? check(
          'activation',
          'Activation declared',
          PASS,
          contributes ? Object.keys(pkg.contributes).join(', ') : pkg.activationEvents.slice(0, 3).join(', ')
        )
      : check(
          'activation',
          'Activation declared',
          WARN,
          'Add "contributes" or "activationEvents" — otherwise the extension never activates.'
        )
  );

  checks.push(
    ws.find(/(^|\/)README\.md$/i)
      ? check('readme', 'README', PASS)
      : check('readme', 'README', WARN, 'The Marketplace listing shows README.md — add one.')
  );
  checks.push(
    ws.find(/(^|\/)\.vscodeignore$/i)
      ? check('ignore', '.vscodeignore', PASS)
      : check('ignore', '.vscodeignore', WARN, 'Add .vscodeignore to keep source and node_modules out of the .vsix.')
  );

  return checks;
}

/* ---------------- Hugging Face Spaces ---------------- */

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return data;
}

async function spaceChecks(ws) {
  const checks = [];
  const readmePath = ws.find(/(^|\/)README\.md$/i);
  if (!readmePath) {
    checks.push(
      check(
        'readme',
        'README.md with Space config',
        FAIL,
        'A Hugging Face Space is configured by README.md front matter.'
      )
    );
    return checks;
  }

  const config = frontmatter(await ws.read(readmePath));
  checks.push(
    config
      ? check('readme', 'README.md with Space config', PASS, readmePath)
      : check(
          'readme',
          'README.md with Space config',
          FAIL,
          'Add a YAML front matter block with title, emoji, sdk and app_file.'
        )
  );

  const meta = config || {};
  checks.push(
    meta.title
      ? check('title', 'Space title', PASS, meta.title)
      : check('title', 'Space title', WARN, 'Add "title" to the front matter.')
  );
  checks.push(
    meta.emoji
      ? check('emoji', 'Space emoji', PASS, meta.emoji)
      : check('emoji', 'Space emoji', WARN, 'Add "emoji" so the Space card looks right.')
  );

  const sdk = (meta.sdk || '').toLowerCase();
  checks.push(
    sdk
      ? check('sdk', 'SDK declared', PASS, sdk)
      : check('sdk', 'SDK declared', FAIL, 'Add "sdk: gradio", "sdk: streamlit", "sdk: static" or "sdk: docker".')
  );

  const appFile = meta.app_file || '';
  if (sdk === 'docker') {
    checks.push(
      ws.find(/(^|\/)Dockerfile$/i)
        ? check('runtime', 'Dockerfile', PASS)
        : check('runtime', 'Dockerfile', FAIL, 'sdk: docker needs a Dockerfile at the Space root.')
    );
  } else if (sdk === 'static') {
    checks.push(
      ws.find(/(^|\/)index\.html$/i)
        ? check('runtime', 'index.html', PASS)
        : check('runtime', 'index.html', FAIL, 'sdk: static serves index.html — add one.')
    );
  } else if (sdk) {
    checks.push(
      appFile
        ? ws.names.includes(appFile)
          ? check('runtime', 'App file', PASS, appFile)
          : check('runtime', 'App file', FAIL, `app_file "${appFile}" is not in the workspace.`)
        : check('runtime', 'App file', FAIL, 'Add "app_file" to the front matter.')
    );
    checks.push(
      ws.find(/(^|\/)requirements\.txt$/i)
        ? check('deps', 'requirements.txt', PASS)
        : check('deps', 'requirements.txt', WARN, 'Add requirements.txt so the Space installs your dependencies.')
    );
  }

  if (sdk === 'gradio') {
    const hits = await scanSource(ws, [['Gradio interface', /\bgr\.(Interface|Blocks|ChatInterface)\s*\(/]]);
    checks.push(
      hits.length
        ? check('interface', 'Gradio interface', PASS, hits[0].split(' — ')[0])
        : check(
            'interface',
            'Gradio interface',
            FAIL,
            'No gr.Interface/Blocks/ChatInterface found — the Space will start with a blank app.'
          )
    );
  }

  checks.push(
    ws.find(/(^|\/)\.gitattributes$/i)
      ? check('lfs', '.gitattributes', PASS)
      : check(
          'lfs',
          '.gitattributes',
          WARN,
          'Add .gitattributes with LFS rules if the Space stores models or large assets.'
        )
  );

  return checks;
}

/* ---------------- catalog ---------------- */

export const STORE_TARGETS = [
  {
    id: 'chrome',
    name: 'Chrome Web Store',
    group: 'Browser extensions',
    aliases: ['chrome', 'chrome web store'],
    docs: 'https://developer.chrome.com/docs/webstore/program-policies',
    run: (ws) => extensionChecks(ws),
  },
  {
    id: 'edge',
    name: 'Microsoft Edge Add-ons',
    group: 'Browser extensions',
    aliases: ['edge', 'microsoft edge'],
    docs: 'https://learn.microsoft.com/microsoft-edge/extensions/publish/',
    run: (ws) => extensionChecks(ws),
  },
  {
    id: 'firefox',
    name: 'Mozilla Add-ons',
    group: 'Browser extensions',
    aliases: ['firefox', 'mozilla', 'amo'],
    docs: 'https://extensionworkshop.com/documentation/publish/',
    run: (ws) => extensionChecks(ws, { gecko: true, allowMv2: true }),
  },
  {
    id: 'opera',
    name: 'Opera Add-ons',
    group: 'Browser extensions',
    aliases: ['opera'],
    docs: 'https://dev.opera.com/extensions/publishing/',
    run: (ws) => extensionChecks(ws, { allowMv2: true }),
  },
  {
    id: 'play',
    name: 'Google Play Store',
    group: 'Mobile apps',
    aliases: ['play', 'play store', 'google play', 'android'],
    docs: 'https://support.google.com/googleplay/android-developer/answer/9859152',
    run: playChecks,
  },
  {
    id: 'apple',
    name: 'Apple App Store',
    group: 'Mobile apps',
    aliases: ['apple', 'apple store', 'app store', 'ios', 'macos'],
    docs: 'https://developer.apple.com/app-store/review/guidelines/',
    run: appleChecks,
  },
  {
    id: 'vscode',
    name: 'VS Code Marketplace',
    group: 'Developer marketplaces',
    aliases: ['vscode', 'vs code', 'marketplace'],
    docs: 'https://code.visualstudio.com/api/working-with-extensions/publishing-extension',
    run: vscodeChecks,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Spaces',
    group: 'Developer marketplaces',
    aliases: ['huggingface', 'hugging face', 'hf', 'spaces'],
    docs: 'https://huggingface.co/docs/hub/spaces-config-reference',
    run: spaceChecks,
  },
];

export function listStoreTargets() {
  return STORE_TARGETS.map(({ id, name, group, docs, aliases }) => ({
    id,
    name,
    group,
    docs,
    aliases,
  }));
}

function resolveTargets(requested) {
  if (!requested) return STORE_TARGETS;
  const list = Array.isArray(requested) ? requested : [requested];
  const wanted = new Set();

  for (const raw of list) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) continue;
    if (value === 'all' || value === '*') return STORE_TARGETS;
    const target = STORE_TARGETS.find(
      (item) => item.id === value || item.name.toLowerCase() === value || item.aliases.includes(value)
    );
    if (target) wanted.add(target.id);
  }

  return wanted.size ? STORE_TARGETS.filter((target) => wanted.has(target.id)) : STORE_TARGETS;
}

/** Map free text ("publish to chrome and the play store") to store ids. */
export function detectTargets(text) {
  const lower = String(text || '').toLowerCase();
  const ids = STORE_TARGETS.filter(
    (target) =>
      target.aliases.some((alias) => lower.includes(alias)) ||
      lower.includes(target.name.toLowerCase())
  ).map((target) => target.id);
  return ids.length ? ids : undefined;
}

export async function runStoreTests(sessionId, requested, { compact = false } = {}) {
  const ws = await snapshot(sessionId);
  const targets = resolveTargets(requested);
  const results = [];

  for (const target of targets) {
    let checks;
    if (!ws.count) {
      checks = [
        check(
          'workspace',
          'Workspace has files',
          FAIL,
          'The workspace is empty — add the project files before running store tests.'
        ),
      ];
    } else {
      try {
        checks = await target.run(ws);
      } catch (error) {
        checks = [check('run', 'Checks completed', FAIL, error.message)];
      }
    }

    const counts = { pass: 0, warn: 0, fail: 0 };
    for (const item of checks) counts[item.status] = (counts[item.status] || 0) + 1;

    const points = counts.pass + counts.warn * 0.5;
    const score = checks.length ? Math.round((points / checks.length) * 100) : 0;

    results.push({
      id: target.id,
      name: target.name,
      group: target.group,
      docs: target.docs,
      score,
      status: counts.fail ? 'blocked' : counts.warn ? 'needs-work' : 'ready',
      counts,
      checks,
      missing: checks.filter((item) => item.status === FAIL).map((item) => item.label),
    });
  }

  const totals = results.reduce(
    (acc, target) => ({
      fails: acc.fails + target.counts.fail,
      warns: acc.warns + target.counts.warn,
      ready: acc.ready + (target.status === 'ready' ? 1 : 0),
      blocked: acc.blocked + (target.status === 'blocked' ? 1 : 0),
    }),
    { fails: 0, warns: 0, ready: 0, blocked: 0 }
  );

  if (compact) {
    for (const result of results) {
      result.checks = result.checks
        .filter((item) => item.status !== PASS)
        .slice(0, 12)
        .map((item) => ({ ...item, detail: String(item.detail || '').slice(0, 220) }));
    }
  }

  return { workspace_files: ws.count, targets: results, totals };
}
