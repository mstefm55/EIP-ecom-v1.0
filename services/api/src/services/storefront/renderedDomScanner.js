import fs from "node:fs";
import path from "node:path";
import { assertOutboundUrlAllowed } from "../gateway/outbound.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_WAIT_MS = 900;
const DEFAULT_MAX_HTML_CHARS = 1024 * 1024;
const DEFAULT_MAX_REQUESTS = 300;
const BLOCKED_RESOURCE_TYPES = new Set(["image", "media", "font", "websocket", "eventsource"]);
const CHROMIUM_COMMANDS = process.platform === "win32"
  ? ["chrome.exe", "msedge.exe", "chromium.exe"]
  : ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
const CHROMIUM_PATHS = process.platform === "win32"
  ? [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    ]
  : [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable"
    ];

function normalizeText(value) {
  return String(value || "").trim();
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function executableExists(candidate) {
  const value = normalizeText(candidate);
  if (!value) return "";
  try {
    return fs.statSync(value).isFile() ? value : "";
  } catch {
    return "";
  }
}

function findExecutableOnPath(commands = CHROMIUM_COMMANDS) {
  const pathEntries = normalizeText(process.env.PATH).split(path.delimiter).filter(Boolean);
  for (const directory of pathEntries) {
    for (const command of commands) {
      const found = executableExists(path.join(directory, command));
      if (found) return found;
    }
  }
  return "";
}

function resolveChromiumExecutable(config = {}) {
  for (const candidate of [
    config.STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    ...CHROMIUM_PATHS
  ]) {
    const found = executableExists(candidate);
    if (found) return found;
  }
  return findExecutableOnPath();
}

function resolveRenderedScanConfig(config = {}) {
  return {
    enabled: config.STOREFRONT_RENDERED_SCAN_ENABLED !== false,
    executable_path: resolveChromiumExecutable(config),
    timeout_ms: boundedInteger(config.STOREFRONT_RENDERED_SCAN_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 3000, 30000),
    wait_ms: boundedInteger(config.STOREFRONT_RENDERED_SCAN_WAIT_MS, DEFAULT_WAIT_MS, 0, 5000),
    max_html_chars: boundedInteger(
      config.STOREFRONT_RENDERED_SCAN_MAX_HTML_CHARS,
      DEFAULT_MAX_HTML_CHARS,
      10000,
      2 * 1024 * 1024
    ),
    max_requests: boundedInteger(config.STOREFRONT_RENDERED_SCAN_MAX_REQUESTS, DEFAULT_MAX_REQUESTS, 20, 1000),
    allow_no_sandbox: config.STOREFRONT_RENDERED_SCAN_ALLOW_NO_SANDBOX === true
  };
}

function shouldAllowRenderedResource({ url, method, resourceType } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: "RENDERED_DOM_RESOURCE_URL_INVALID" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { allowed: false, reason: "RENDERED_DOM_RESOURCE_SCHEME_FORBIDDEN" };
  }
  if (parsed.username || parsed.password) {
    return { allowed: false, reason: "RENDERED_DOM_RESOURCE_CREDENTIALS_FORBIDDEN" };
  }
  if (!["GET", "HEAD"].includes(normalizeText(method).toUpperCase())) {
    return { allowed: false, reason: "RENDERED_DOM_RESOURCE_METHOD_FORBIDDEN" };
  }
  if (BLOCKED_RESOURCE_TYPES.has(normalizeText(resourceType).toLowerCase())) {
    return { allowed: false, reason: "RENDERED_DOM_RESOURCE_TYPE_BLOCKED" };
  }
  return { allowed: true, url: parsed.toString() };
}

function safeRenderError(error) {
  const message = normalizeText(error?.message || error);
  if (/timeout/i.test(message)) return "RENDERED_DOM_TIMEOUT";
  if (/playwright-core/i.test(message) || error?.code === "ERR_MODULE_NOT_FOUND") {
    return "RENDERED_DOM_ADAPTER_NOT_INSTALLED";
  }
  return "RENDERED_DOM_RENDER_FAILED";
}

async function closeQuietly(resource) {
  if (!resource) return;
  try {
    await resource.close();
  } catch {
    // Cleanup must not replace the scanner result.
  }
}

async function renderStorefrontDom({
  url,
  profile,
  config = {},
  playwrightLoader = () => import("playwright-core"),
  outboundGuard = assertOutboundUrlAllowed
} = {}) {
  const settings = resolveRenderedScanConfig(config);
  if (!settings.enabled) {
    return { ok: false, error: "RENDERED_DOM_SCANNER_DISABLED" };
  }
  if (!settings.executable_path) {
    return { ok: false, error: "RENDERED_DOM_BROWSER_NOT_FOUND" };
  }

  let initial;
  try {
    initial = await outboundGuard(url, profile, { purpose: "storefront_rendered_scan" });
  } catch {
    return { ok: false, error: "RENDERED_DOM_TARGET_FORBIDDEN" };
  }

  let browser;
  let context;
  const validatedOrigins = new Map();
  const validateOrigin = async (rawUrl) => {
    const origin = new URL(rawUrl).origin;
    if (!validatedOrigins.has(origin)) {
      validatedOrigins.set(
        origin,
        outboundGuard(origin, profile, { purpose: "storefront_rendered_scan_subresource" })
      );
    }
    return validatedOrigins.get(origin);
  };

  try {
    const playwright = await playwrightLoader();
    if (!playwright?.chromium?.launch) {
      return { ok: false, error: "RENDERED_DOM_ADAPTER_NOT_INSTALLED" };
    }
    browser = await playwright.chromium.launch({
      headless: true,
      executablePath: settings.executable_path,
      args: [
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-sync",
        "--no-default-browser-check",
        "--no-first-run",
        ...(settings.allow_no_sandbox ? ["--no-sandbox"] : [])
      ]
    });
    context = await browser.newContext({
      acceptDownloads: false,
      ignoreHTTPSErrors: false,
      javaScriptEnabled: true,
      serviceWorkers: "block"
    });
    const page = await context.newPage();
    let requestCount = 0;
    await page.route("**/*", async (route) => {
      const request = route.request();
      const policy = shouldAllowRenderedResource({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
      if (!policy.allowed) return route.abort("blockedbyclient");
      requestCount += 1;
      if (requestCount > settings.max_requests) return route.abort("blockedbyclient");
      try {
        await validateOrigin(policy.url);
        return route.continue();
      } catch {
        return route.abort("blockedbyclient");
      }
    });
    page.on("dialog", (dialog) => void dialog.dismiss());
    page.on("download", (download) => void download.cancel());
    await page.goto(initial.url, { waitUntil: "domcontentloaded", timeout: settings.timeout_ms });
    if (settings.wait_ms) await page.waitForTimeout(settings.wait_ms);
    const html = await page.evaluate((maxChars) => {
      const root = document.documentElement?.cloneNode(true);
      if (!root) return "";
      root
        .querySelectorAll("script,style,noscript,template,iframe,object,embed,svg,canvas")
        .forEach((node) => node.remove());
      const allowed = new Set(["id", "class", "role", "aria-label", "type", "data-eip-parent", "data-eip-page"]);
      root.querySelectorAll("*").forEach((node) => {
        Array.from(node.attributes || []).forEach((attribute) => {
          const name = String(attribute.name || "").toLowerCase();
          if (!allowed.has(name) && !name.startsWith("data-eip-")) node.removeAttribute(attribute.name);
        });
        ["value", "checked", "selected", "placeholder", "action", "formaction"].forEach((name) => {
          node.removeAttribute(name);
        });
      });
      return String(root.outerHTML || "").slice(0, maxChars);
    }, settings.max_html_chars);
    if (!normalizeText(html)) {
      return { ok: false, error: "RENDERED_DOM_EMPTY" };
    }
    return {
      ok: true,
      html,
      source_kind: "rendered_dom",
      source_url: initial.url,
      scanned_at: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, error: safeRenderError(error) };
  } finally {
    await closeQuietly(context);
    await closeQuietly(browser);
  }
}

export {
  renderStorefrontDom,
  resolveRenderedScanConfig,
  shouldAllowRenderedResource
};
