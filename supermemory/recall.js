#!/usr/bin/env node
"use strict";

// ── Recall storm guard (added 2026-06-17) ─────────────────────────────
// OMP spawns several short-lived worker processes per turn; each fires this
// recall hook, producing N concurrent supermemory API calls that lag the
// first turn. Allow only one recall per (HERDR_PANE_ID|cwd) within a short
// window; redundant workers exit immediately. Disable with
// SUPERMEMORY_RECALL_NO_GATE=1; tune the window with SUPERMEMORY_RECALL_GATE_MS.
(function recallStormGuard() {
  try {
    if (process.env.SUPERMEMORY_RECALL_NO_GATE === "1") return;
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const gateMs = Number(process.env.SUPERMEMORY_RECALL_GATE_MS) || 12000;
    const key = String(process.env.HERDR_PANE_ID || process.cwd() || "global")
      .replace(/[^A-Za-z0-9]+/g, "_").slice(0, 80);
    const marker = path.join(os.tmpdir(), "omp-recall-gate-" + key);
    const now = Date.now();
    try {
      if (now - fs.statSync(marker).mtimeMs < gateMs) process.exit(0);
    } catch (e) { /* no marker yet → proceed */ }
    try { fs.writeFileSync(marker, String(now)); } catch (e) { /* best effort */ }
  } catch (e) { /* never block recall on guard failure */ }
})();

// src/hooks/recall.ts
var import_node_fs8 = require("node:fs");
var import_node_path7 = require("node:path");
var import_node_os8 = require("node:os");

// src/config.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var import_node_os2 = require("node:os");

// src/services/auth.ts
var import_node_http = require("node:http");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var import_node_child_process = require("node:child_process");
var import_node_crypto = require("node:crypto");
var SUPERMEMORY_DIR = (0, import_node_path.join)((0, import_node_os.homedir)(), ".omp", "supermemory");
var CREDENTIALS_FILE = (0, import_node_path.join)(SUPERMEMORY_DIR, "credentials.json");
var AUTH_BASE_URL = process.env.SUPERMEMORY_AUTH_URL || "https://console.supermemory.ai/auth/agent-connect";
var AUTH_TIMEOUT = Number(process.env.SUPERMEMORY_AUTH_TIMEOUT) || 6e4;
var AUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Connected - Supermemory</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;background:#faf9f6}
.dot{width:10px;height:10px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:8px}
h1{font-size:32px;font-weight:500;color:#1a1a1a;margin:16px 0}
p{color:#666;font-size:16px}
</style></head><body>
<div><span class="dot"></span><span style="color:#22c55e;font-size:14px">Connected</span></div>
<h1>Supermemory is ready</h1>
<p>You can close this tab and return to Codex.</p>
</body></html>`;
var AUTH_ERROR_HTML = `<!DOCTYPE html>
<html><head><title>Error - Supermemory</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;background:#faf9f6}
.dot{width:10px;height:10px;background:#ef4444;border-radius:50%;display:inline-block;margin-right:8px}
h1{font-size:32px;font-weight:500;color:#1a1a1a;margin:16px 0}
p{color:#666;font-size:16px}
</style></head><body>
<div><span class="dot"></span><span style="color:#ef4444;font-size:14px">Error</span></div>
<h1>Connection Failed</h1>
<p>Invalid API key received. Please try again.</p>
</body></html>`;
function loadCredentials() {
  try {
    if ((0, import_node_fs.existsSync)(CREDENTIALS_FILE)) {
      const data = JSON.parse((0, import_node_fs.readFileSync)(CREDENTIALS_FILE, "utf-8"));
      if (data.apiKey) return data.apiKey;
    }
  } catch {
  }
  return void 0;
}
function saveCredentials(apiKey) {
  (0, import_node_fs.mkdirSync)(SUPERMEMORY_DIR, { recursive: true, mode: 448 });
  (0, import_node_fs.writeFileSync)(
    CREDENTIALS_FILE,
    JSON.stringify({ apiKey, savedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
    { mode: 384 }
  );
}
function openBrowser(url) {
  const onError = () => {
  };
  if (process.platform === "win32") {
    (0, import_node_child_process.execFile)("explorer.exe", [url], onError);
  } else if (process.platform === "darwin") {
    (0, import_node_child_process.execFile)("open", [url], onError);
  } else {
    (0, import_node_child_process.execFile)("xdg-open", [url], onError);
  }
}
function startAuthFlow() {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const stateToken = (0, import_node_crypto.randomBytes)(16).toString("hex");
    const server = (0, import_node_http.createServer)((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/callback") {
        const callbackState = url.searchParams.get("state");
        if (callbackState !== stateToken) {
          res.writeHead(403, { "Content-Type": "text/html" });
          res.end(AUTH_ERROR_HTML);
          return;
        }
        const apiKey = url.searchParams.get("apikey") || url.searchParams.get("api_key");
        if (apiKey?.startsWith("sm_")) {
          saveCredentials(apiKey);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(AUTH_SUCCESS_HTML);
          resolved = true;
          clearTimeout(timer);
          server.close();
          resolve(apiKey);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(AUTH_ERROR_HTML);
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const callbackUrl = `http://localhost:${port}/callback?state=${stateToken}`;
      const params = new URLSearchParams({
        callback: callbackUrl,
        client: "codex",
        hostname: `codex - ${(0, import_node_os.hostname)()}`,
        os: `${(0, import_node_os.platform)()}-${(0, import_node_os.arch)()}`,
        cwd: process.cwd(),
        cli_version: "1.0.0"
      });
      const authUrl = `${AUTH_BASE_URL}?${params.toString()}`;
      openBrowser(authUrl);
    });
    server.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Failed to start auth server: ${err.message}`));
      }
    });
    const timer = setTimeout(() => {
      if (!resolved) {
        server.close();
        reject(new Error("AUTH_TIMEOUT"));
      }
    }, AUTH_TIMEOUT);
  });
}

// src/config.ts
var CONFIG_FILE = (0, import_node_path2.join)((0, import_node_os2.homedir)(), ".omp", "supermemory.json");
var DEFAULT_SIGNAL_KEYWORDS = [
  // Preferences (single words to match "i really like", "i always prefer", etc.)
  "prefer",
  "like",
  "love",
  "use",
  "hate",
  "dislike",
  "avoid",
  // Memory commands
  "remember",
  "forget",
  "note",
  // Decisions & Architecture
  "decision",
  "decided",
  "chose",
  "choose",
  "picked",
  "switched",
  "moved",
  "migrated",
  "architecture",
  "pattern",
  "approach",
  "design",
  "tradeoff",
  // Technical
  "implementation",
  "refactor",
  "upgrade",
  "deprecate",
  // Problem solving
  "bug",
  "fix",
  "fixed",
  "solved",
  "solution",
  "important",
  // Stack/tools
  "stack",
  "framework",
  "library",
  "tool",
  "database"
];
var DEFAULTS = {
  similarityThreshold: 0.6,
  maxMemories: 5,
  maxProfileItems: 5,
  injectProfile: true,
  containerTagPrefix: "codex",
  filterPrompt: "You are a stateful coding agent. Remember all the information, including but not limited to user's coding preferences, tech stack, behaviours, workflows, and any other relevant details.",
  debug: false,
  // Signal extraction - disabled by default, captures everything
  signalExtraction: false,
  signalKeywords: DEFAULT_SIGNAL_KEYWORDS,
  signalTurnsBefore: 3,
  // Auto-save interval
  autoSaveEveryTurns: 3
};
function loadConfig() {
  if ((0, import_node_fs2.existsSync)(CONFIG_FILE)) {
    try {
      const content = (0, import_node_fs2.readFileSync)(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    } catch {
    }
  }
  return {};
}
var fileConfig = loadConfig();
function getApiKey() {
  if (process.env.SUPERMEMORY_CODEX_API_KEY) return process.env.SUPERMEMORY_CODEX_API_KEY;
  if (fileConfig.apiKey) return fileConfig.apiKey;
  return loadCredentials();
}
var SUPERMEMORY_API_KEY = getApiKey();
function reloadApiKey() {
  SUPERMEMORY_API_KEY = getApiKey();
}
var CONFIG = {
  similarityThreshold: fileConfig.similarityThreshold ?? DEFAULTS.similarityThreshold,
  maxMemories: fileConfig.maxMemories ?? DEFAULTS.maxMemories,
  maxProfileItems: fileConfig.maxProfileItems ?? DEFAULTS.maxProfileItems,
  injectProfile: fileConfig.injectProfile ?? DEFAULTS.injectProfile,
  containerTagPrefix: fileConfig.containerTagPrefix ?? DEFAULTS.containerTagPrefix,
  userContainerTag: fileConfig.userContainerTag,
  projectContainerTag: fileConfig.projectContainerTag,
  filterPrompt: fileConfig.filterPrompt ?? DEFAULTS.filterPrompt,
  debug: fileConfig.debug ?? DEFAULTS.debug,
  // Signal extraction
  signalExtraction: fileConfig.signalExtraction ?? DEFAULTS.signalExtraction,
  signalKeywords: fileConfig.signalKeywords ?? DEFAULTS.signalKeywords,
  signalTurnsBefore: fileConfig.signalTurnsBefore ?? DEFAULTS.signalTurnsBefore,
  // Auto-save interval
  autoSaveEveryTurns: fileConfig.autoSaveEveryTurns ?? DEFAULTS.autoSaveEveryTurns
};
function isConfigured() {
  return !!SUPERMEMORY_API_KEY;
}
function getApiKeyValue() {
  return SUPERMEMORY_API_KEY;
}
function getSignalConfig() {
  return {
    enabled: CONFIG.signalExtraction,
    keywords: CONFIG.signalKeywords.map((k) => k.toLowerCase()),
    turnsBefore: CONFIG.signalTurnsBefore
  };
}

// node_modules/supermemory/internal/tslib.mjs
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

// node_modules/supermemory/internal/utils/uuid.mjs
var uuid4 = function() {
  const { crypto } = globalThis;
  if (crypto?.randomUUID) {
    uuid4 = crypto.randomUUID.bind(crypto);
    return crypto.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto ? () => crypto.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};

// node_modules/supermemory/internal/errors.mjs
function isAbortError(err) {
  return typeof err === "object" && err !== null && // Spec-compliant fetch implementations
  ("name" in err && err.name === "AbortError" || // Expo fetch
  "message" in err && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError = (err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === "[object Error]") {
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack)
          error.stack = err.stack;
        if (err.cause && !error.cause)
          error.cause = err.cause;
        if (err.name)
          error.name = err.name;
        return error;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(err));
    } catch {
    }
  }
  return new Error(err);
};

// node_modules/supermemory/core/error.mjs
var SupermemoryError = class extends Error {
};
var APIError = class _APIError extends SupermemoryError {
  constructor(status, error, message, headers) {
    super(`${_APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.error = error;
  }
  static makeMessage(status, error, message) {
    const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
    if (status && msg) {
      return `${status} ${msg}`;
    }
    if (status) {
      return `${status} status code (no body)`;
    }
    if (msg) {
      return msg;
    }
    return "(no status code or body)";
  }
  static generate(status, errorResponse, message, headers) {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }
    const error = errorResponse;
    if (status === 400) {
      return new BadRequestError(status, error, message, headers);
    }
    if (status === 401) {
      return new AuthenticationError(status, error, message, headers);
    }
    if (status === 403) {
      return new PermissionDeniedError(status, error, message, headers);
    }
    if (status === 404) {
      return new NotFoundError(status, error, message, headers);
    }
    if (status === 409) {
      return new ConflictError(status, error, message, headers);
    }
    if (status === 422) {
      return new UnprocessableEntityError(status, error, message, headers);
    }
    if (status === 429) {
      return new RateLimitError(status, error, message, headers);
    }
    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }
    return new _APIError(status, error, message, headers);
  }
};
var APIUserAbortError = class extends APIError {
  constructor({ message } = {}) {
    super(void 0, void 0, message || "Request was aborted.", void 0);
  }
};
var APIConnectionError = class extends APIError {
  constructor({ message, cause }) {
    super(void 0, void 0, message || "Connection error.", void 0);
    if (cause)
      this.cause = cause;
  }
};
var APIConnectionTimeoutError = class extends APIConnectionError {
  constructor({ message } = {}) {
    super({ message: message ?? "Request timed out." });
  }
};
var BadRequestError = class extends APIError {
};
var AuthenticationError = class extends APIError {
};
var PermissionDeniedError = class extends APIError {
};
var NotFoundError = class extends APIError {
};
var ConflictError = class extends APIError {
};
var UnprocessableEntityError = class extends APIError {
};
var RateLimitError = class extends APIError {
};
var InternalServerError = class extends APIError {
};

// node_modules/supermemory/internal/utils/values.mjs
var startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
var isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
};
var isArray = (val) => (isArray = Array.isArray, isArray(val));
var isReadonlyArray = isArray;
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
var validatePositiveInteger = (name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new SupermemoryError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new SupermemoryError(`${name} must be a positive integer`);
  }
  return n;
};
var safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return void 0;
  }
};

// node_modules/supermemory/internal/utils/sleep.mjs
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// node_modules/supermemory/version.mjs
var VERSION = "4.0.0";

// node_modules/supermemory/internal/detect-platform.mjs
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
var getPlatformProperties = () => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec(navigator.userAgent);
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var normalizeArch = (arch2) => {
  if (arch2 === "x32")
    return "x32";
  if (arch2 === "x86_64" || arch2 === "x64")
    return "x64";
  if (arch2 === "arm")
    return "arm";
  if (arch2 === "aarch64" || arch2 === "arm64")
    return "arm64";
  if (arch2)
    return `other:${arch2}`;
  return "unknown";
};
var normalizePlatform = (platform2) => {
  platform2 = platform2.toLowerCase();
  if (platform2.includes("ios"))
    return "iOS";
  if (platform2 === "android")
    return "Android";
  if (platform2 === "darwin")
    return "MacOS";
  if (platform2 === "win32")
    return "Windows";
  if (platform2 === "freebsd")
    return "FreeBSD";
  if (platform2 === "openbsd")
    return "OpenBSD";
  if (platform2 === "linux")
    return "Linux";
  if (platform2)
    return `Other:${platform2}`;
  return "Unknown";
};
var _platformHeaders;
var getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};

// node_modules/supermemory/internal/shims.mjs
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new Supermemory({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream = globalThis.ReadableStream;
  if (typeof ReadableStream === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {
    },
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      await iter.return?.();
    }
  });
}
async function CancelReadableStream(stream) {
  if (stream === null || typeof stream !== "object")
    return;
  if (stream[Symbol.asyncIterator]) {
    await stream[Symbol.asyncIterator]().return?.();
    return;
  }
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/supermemory/internal/request-options.mjs
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/supermemory/internal/uploads.mjs
var checkFileSupport = () => {
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof process2?.versions?.node === "string" && parseInt(process2.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value) {
  return (typeof value === "object" && value !== null && ("name" in value && value.name && String(value.name) || "url" in value && value.url && String(value.url) || "filename" in value && value.filename && String(value.filename) || "path" in value && value.path && String(value.path)) || "").split(/[\\/]/).pop() || void 0;
}
var isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function";
var multipartFormRequestOptions = async (opts, fetch2) => {
  return { ...opts, body: await createForm(opts.body, fetch2) };
};
var supportsFormDataMap = /* @__PURE__ */ new WeakMap();
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached)
    return cached;
  const promise = (async () => {
    try {
      const FetchResponse = "Response" in fetch2 ? fetch2.Response : (await fetch2("data:,")).constructor;
      const data = new FormData();
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var createForm = async (body, fetch2) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
  return form;
};
var isNamedBlob = (value) => value instanceof Blob && "name" in value;
var addFormValue = async (form, key, value) => {
  if (value === void 0)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    form.append(key, makeFile([await value.blob()], getName(value)));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value)));
  } else if (isNamedBlob(value)) {
    form.append(key, value, getName(value));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};

// node_modules/supermemory/internal/to-file.mjs
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function";
var isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value);
var isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  if (isFileLike(value)) {
    if (value instanceof File) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], value.name);
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
    return makeFile(await getBytes(blob), name, options);
  }
  const parts = await getBytes(value);
  name || (name = getName(value));
  if (!options?.type) {
    const type = parts.find((part) => typeof part === "object" && "type" in part && part.type);
    if (typeof type === "string") {
      options = { ...options, type };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
  value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = value?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null)
    return "";
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}

// node_modules/supermemory/core/resource.mjs
var APIResource = class {
  constructor(client) {
    this._client = client;
  }
};

// node_modules/supermemory/internal/headers.mjs
var brand_privateNullableHeaders = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === void 0)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}
var buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers();
  const nullHeaders = /* @__PURE__ */ new Set();
  for (const headers of newHeaders) {
    const seenHeaders = /* @__PURE__ */ new Set();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

// node_modules/supermemory/internal/utils/path.mjs
function encodeURIPath(str) {
  return str.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
var createPathTagFunction = (pathEncoder = encodeURIPath) => function path2(statics, ...params) {
  if (statics.length === 1)
    return statics[0];
  let postPath = false;
  const invalidSegments = [];
  const path3 = statics.reduce((previousValue, currentValue, index) => {
    if (/[?#]/.test(currentValue)) {
      postPath = true;
    }
    const value = params[index];
    let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
    if (index !== params.length && (value == null || typeof value === "object" && // handle values from other realms
    value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)?.toString)) {
      encoded = value + "";
      invalidSegments.push({
        start: previousValue.length + currentValue.length,
        length: encoded.length,
        error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
      });
    }
    return previousValue + currentValue + (index === params.length ? "" : encoded);
  }, "");
  const pathOnly = path3.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match;
  while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match.index,
      length: match[0].length,
      error: `Value "${match[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a, b) => a.start - b.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    const underline = invalidSegments.reduce((acc, segment) => {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      return acc + spaces + arrows;
    }, "");
    throw new SupermemoryError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e) => e.error).join("\n")}
${path3}
${underline}`);
  }
  return path3;
};
var path = /* @__PURE__ */ createPathTagFunction(encodeURIPath);

// node_modules/supermemory/resources/connections.mjs
var Connections = class extends APIResource {
  /**
   * Initialize connection and get authorization URL
   *
   * @example
   * ```ts
   * const connection = await client.connections.create(
   *   'notion',
   * );
   * ```
   */
  create(provider, body = {}, options) {
    return this._client.post(path`/v3/connections/${provider}`, { body, ...options });
  }
  /**
   * List all connections
   *
   * @example
   * ```ts
   * const connections = await client.connections.list();
   * ```
   */
  list(body = {}, options) {
    return this._client.post("/v3/connections/list", { body, ...options });
  }
  /**
   * Configure resources for a connection (supported providers: GitHub for now)
   *
   * @example
   * ```ts
   * const response = await client.connections.configure(
   *   'connectionId',
   *   { resources: [{ foo: 'bar' }] },
   * );
   * ```
   */
  configure(connectionID, body, options) {
    return this._client.post(path`/v3/connections/${connectionID}/configure`, { body, ...options });
  }
  /**
   * Delete a specific connection by ID
   *
   * @example
   * ```ts
   * const response = await client.connections.deleteByID(
   *   'connectionId',
   * );
   * ```
   */
  deleteByID(connectionID, options) {
    return this._client.delete(path`/v3/connections/${connectionID}`, options);
  }
  /**
   * Delete connection for a specific provider and container tags
   *
   * @example
   * ```ts
   * const response = await client.connections.deleteByProvider(
   *   'notion',
   *   { containerTags: ['user_123', 'project_123'] },
   * );
   * ```
   */
  deleteByProvider(provider, body, options) {
    return this._client.delete(path`/v3/connections/${provider}`, { body, ...options });
  }
  /**
   * Get connection details with id
   *
   * @example
   * ```ts
   * const response = await client.connections.getByID(
   *   'connectionId',
   * );
   * ```
   */
  getByID(connectionID, options) {
    return this._client.get(path`/v3/connections/${connectionID}`, options);
  }
  /**
   * Get connection details with provider and container tags
   *
   * @example
   * ```ts
   * const response = await client.connections.getByTag(
   *   'notion',
   *   { containerTags: ['user_123', 'project_123'] },
   * );
   * ```
   */
  getByTag(provider, body, options) {
    return this._client.post(path`/v3/connections/${provider}/connection`, { body, ...options });
  }
  /**
   * Initiate a manual sync of connections
   *
   * @example
   * ```ts
   * const response = await client.connections.import('notion');
   * ```
   */
  import(provider, body = {}, options) {
    return this._client.post(path`/v3/connections/${provider}/import`, {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "text/plain" }, options?.headers])
    });
  }
  /**
   * List documents indexed for a provider and container tags
   *
   * @example
   * ```ts
   * const response = await client.connections.listDocuments(
   *   'notion',
   * );
   * ```
   */
  listDocuments(provider, body = {}, options) {
    return this._client.post(path`/v3/connections/${provider}/documents`, { body, ...options });
  }
  /**
   * Fetch resources for a connection (supported providers: GitHub for now)
   *
   * @example
   * ```ts
   * const response = await client.connections.resources(
   *   'connectionId',
   * );
   * ```
   */
  resources(connectionID, query = {}, options) {
    return this._client.get(path`/v3/connections/${connectionID}/resources`, { query, ...options });
  }
};

// node_modules/supermemory/resources/documents.mjs
var Documents = class extends APIResource {
  /**
   * Update a document with any content type (text, url, file, etc.) and metadata
   *
   * @example
   * ```ts
   * const document = await client.documents.update('id');
   * ```
   */
  update(id, body = {}, options) {
    return this._client.patch(path`/v3/documents/${id}`, { body, ...options });
  }
  /**
   * Retrieves a paginated list of documents with their metadata and workflow status
   *
   * @example
   * ```ts
   * const documents = await client.documents.list();
   * ```
   */
  list(body = {}, options) {
    return this._client.post("/v3/documents/list", { body, ...options });
  }
  /**
   * Delete a document by ID or customId
   *
   * @example
   * ```ts
   * await client.documents.delete('id');
   * ```
   */
  delete(id, options) {
    return this._client.delete(path`/v3/documents/${id}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
    });
  }
  /**
   * Add a document with any content type (text, url, file, etc.) and metadata
   *
   * @example
   * ```ts
   * const response = await client.documents.add({
   *   content: 'content',
   * });
   * ```
   */
  add(body, options) {
    return this._client.post("/v3/documents", { body, ...options });
  }
  /**
   * Add multiple documents in a single request. Each document can have any content
   * type (text, url, file, etc.) and metadata
   *
   * @example
   * ```ts
   * const response = await client.documents.batchAdd({
   *   documents: [
   *     {
   *       content:
   *         'This is a detailed article about machine learning concepts...',
   *     },
   *   ],
   * });
   * ```
   */
  batchAdd(body, options) {
    return this._client.post("/v3/documents/batch", { body, ...options });
  }
  /**
   * Bulk delete documents by IDs or container tags
   *
   * @example
   * ```ts
   * const response = await client.documents.deleteBulk();
   * ```
   */
  deleteBulk(body = {}, options) {
    return this._client.delete("/v3/documents/bulk", { body, ...options });
  }
  /**
   * Get a document by ID
   *
   * @example
   * ```ts
   * const document = await client.documents.get('id');
   * ```
   */
  get(id, options) {
    return this._client.get(path`/v3/documents/${id}`, options);
  }
  /**
   * Get documents that are currently being processed
   *
   * @example
   * ```ts
   * const response = await client.documents.listProcessing();
   * ```
   */
  listProcessing(options) {
    return this._client.get("/v3/documents/processing", options);
  }
  /**
   * Upload a file to be processed
   *
   * @example
   * ```ts
   * const response = await client.documents.uploadFile({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  uploadFile(body, options) {
    return this._client.post("/v3/documents/file", multipartFormRequestOptions({ body, ...options }, this._client));
  }
};

// node_modules/supermemory/resources/memories.mjs
var Memories = class extends APIResource {
  /**
   * Update a document with any content type (text, url, file, etc.) and metadata
   *
   * @example
   * ```ts
   * const memory = await client.memories.update('id');
   * ```
   */
  update(id, body = {}, options) {
    return this._client.patch(path`/v3/documents/${id}`, { body, ...options });
  }
  /**
   * Retrieves a paginated list of documents with their metadata and workflow status
   *
   * @example
   * ```ts
   * const memories = await client.memories.list();
   * ```
   */
  list(body = {}, options) {
    return this._client.post("/v3/documents/list", { body, ...options });
  }
  /**
   * Delete a document by ID or customId
   *
   * @example
   * ```ts
   * await client.memories.delete('id');
   * ```
   */
  delete(id, options) {
    return this._client.delete(path`/v3/documents/${id}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
    });
  }
  /**
   * Add a document with any content type (text, url, file, etc.) and metadata
   *
   * @example
   * ```ts
   * const response = await client.memories.add({
   *   content: 'content',
   * });
   * ```
   */
  add(body, options) {
    return this._client.post("/v3/documents", { body, ...options });
  }
  /**
   * Forget (soft delete) a memory entry. The memory is marked as forgotten but not
   * permanently deleted.
   *
   * @example
   * ```ts
   * const response = await client.memories.forget({
   *   containerTag: 'user_123',
   * });
   * ```
   */
  forget(body, options) {
    return this._client.delete("/v4/memories", { body, ...options });
  }
  /**
   * Get a document by ID
   *
   * @example
   * ```ts
   * const memory = await client.memories.get('id');
   * ```
   */
  get(id, options) {
    return this._client.get(path`/v3/documents/${id}`, options);
  }
  /**
   * Update a memory by creating a new version. The original memory is preserved with
   * isLatest=false.
   *
   * @example
   * ```ts
   * const response = await client.memories.updateMemory({
   *   containerTag: 'user_123',
   *   newContent: 'John now prefers light mode',
   * });
   * ```
   */
  updateMemory(body, options) {
    return this._client.patch("/v4/memories", { body, ...options });
  }
  /**
   * Upload a file to be processed
   *
   * @example
   * ```ts
   * const response = await client.memories.uploadFile({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  uploadFile(body, options) {
    return this._client.post("/v3/documents/file", multipartFormRequestOptions({ body, ...options }, this._client));
  }
};

// node_modules/supermemory/resources/search.mjs
var Search = class extends APIResource {
  /**
   * Search memories with advanced filtering
   *
   * @example
   * ```ts
   * const response = await client.search.documents({
   *   q: 'machine learning concepts',
   * });
   * ```
   */
  documents(body, options) {
    return this._client.post("/v3/search", { body, ...options });
  }
  /**
   * Search memories with advanced filtering
   *
   * @example
   * ```ts
   * const response = await client.search.execute({
   *   q: 'machine learning concepts',
   * });
   * ```
   */
  execute(body, options) {
    return this._client.post("/v3/search", { body, ...options });
  }
  /**
   * Search memory entries - Low latency for conversational
   *
   * @example
   * ```ts
   * const response = await client.search.memories({
   *   q: 'machine learning concepts',
   * });
   * ```
   */
  memories(body, options) {
    return this._client.post("/v4/search", { body, ...options });
  }
};

// node_modules/supermemory/resources/settings.mjs
var Settings = class extends APIResource {
  /**
   * Update settings for an organization
   */
  update(body = {}, options) {
    return this._client.patch("/v3/settings", { body, ...options });
  }
  /**
   * Get settings for an organization
   */
  get(options) {
    return this._client.get("/v3/settings", options);
  }
};

// node_modules/supermemory/internal/utils/log.mjs
var levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
};
var parseLogLevel = (maybeLevel, sourceName, client) => {
  if (!maybeLevel) {
    return void 0;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return void 0;
};
function noop() {
}
function makeLogFn(fnLevel, logger, logLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger[fnLevel].bind(logger);
  }
}
var noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop
};
var cachedLoggers = /* @__PURE__ */ new WeakMap();
function loggerFor(client) {
  const logger = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger) {
    return noopLogger;
  }
  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger, logLevel),
    warn: makeLogFn("warn", logger, logLevel),
    info: makeLogFn("info", logger, logLevel),
    debug: makeLogFn("debug", logger, logLevel)
  };
  cachedLoggers.set(logger, [logLevel, levelLogger]);
  return levelLogger;
}
var formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "authorization" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};

// node_modules/supermemory/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = contentType?.split(";")[0]?.trim();
    const isJSON = mediaType?.includes("application/json") || mediaType?.endsWith("+json");
    if (isJSON) {
      const json = await response.json();
      return json;
    }
    const text = await response.text();
    return text;
  })();
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}

// node_modules/supermemory/core/api-promise.mjs
var _APIPromise_client;
var APIPromise = class _APIPromise extends Promise {
  constructor(client, responsePromise, parseResponse = defaultParseResponse) {
    super((resolve) => {
      resolve(null);
    });
    this.responsePromise = responsePromise;
    this.parseResponse = parseResponse;
    _APIPromise_client.set(this, void 0);
    __classPrivateFieldSet(this, _APIPromise_client, client, "f");
  }
  _thenUnwrap(transform) {
    return new _APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => transform(await this.parseResponse(client, props), props));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data and the raw `Response` instance.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response };
  }
  parse() {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
    }
    return this.parsedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.parse().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.parse().catch(onrejected);
  }
  finally(onfinally) {
    return this.parse().finally(onfinally);
  }
};
_APIPromise_client = /* @__PURE__ */ new WeakMap();

// node_modules/supermemory/internal/utils/env.mjs
var readEnv = (env) => {
  if (typeof globalThis.process !== "undefined") {
    return globalThis.process.env?.[env]?.trim() ?? void 0;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return globalThis.Deno.env?.get?.(env)?.trim();
  }
  return void 0;
};

// node_modules/supermemory/client.mjs
var _Supermemory_instances;
var _a;
var _Supermemory_encoder;
var _Supermemory_baseURLOverridden;
var Supermemory = class {
  /**
   * API Client for interfacing with the Supermemory API.
   *
   * @param {string | undefined} [opts.apiKey=process.env['SUPERMEMORY_API_KEY'] ?? undefined]
   * @param {string} [opts.baseURL=process.env['SUPERMEMORY_BASE_URL'] ?? https://api.supermemory.ai] - Override the default base URL for the API.
   * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   */
  constructor({ baseURL = readEnv("SUPERMEMORY_BASE_URL"), apiKey = readEnv("SUPERMEMORY_API_KEY"), ...opts } = {}) {
    _Supermemory_instances.add(this);
    _Supermemory_encoder.set(this, void 0);
    this.memories = new Memories(this);
    this.documents = new Documents(this);
    this.search = new Search(this);
    this.settings = new Settings(this);
    this.connections = new Connections(this);
    if (apiKey === void 0) {
      throw new SupermemoryError("The SUPERMEMORY_API_KEY environment variable is missing or empty; either provide it, or instantiate the Supermemory client with an apiKey option, like new Supermemory({ apiKey: 'My API Key' }).");
    }
    const options = {
      apiKey,
      ...opts,
      baseURL: baseURL || `https://api.supermemory.ai`
    };
    this.baseURL = options.baseURL;
    this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    const defaultLogLevel = "warn";
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("SUPERMEMORY_LOG"), "process.env['SUPERMEMORY_LOG']", this) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _Supermemory_encoder, FallbackEncoder, "f");
    this._options = options;
    this.apiKey = apiKey;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(options) {
    const client = new this.constructor({
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this.apiKey,
      ...options
    });
    return client;
  }
  /**
   * Add a document with any content type (text, url, file, etc.) and metadata
   */
  add(body, options) {
    return this.post("/v3/documents", { body, ...options });
  }
  /**
   * Get user profile with optional search results
   */
  profile(body, options) {
    return this.post("/v4/profile", { body, ...options });
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values, nulls }) {
    return;
  }
  async authHeaders(opts) {
    return buildHeaders([{ Authorization: `Bearer ${this.apiKey}` }]);
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(query) {
    return Object.entries(query).filter(([_, value]) => typeof value !== "undefined").map(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
      if (value === null) {
        return `${encodeURIComponent(key)}=`;
      }
      throw new SupermemoryError(`Cannot stringify type ${typeof value}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error, message, headers) {
    return APIError.generate(status, error, message, headers);
  }
  buildURL(path2, query, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _Supermemory_instances, "m", _Supermemory_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path2) ? new URL(path2) : new URL(baseURL + (baseURL.endsWith("/") && path2.startsWith("/") ? path2.slice(1) : path2));
    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(options) {
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(request, { url, options }) {
  }
  get(path2, opts) {
    return this.methodRequest("get", path2, opts);
  }
  post(path2, opts) {
    return this.methodRequest("post", path2, opts);
  }
  patch(path2, opts) {
    return this.methodRequest("patch", path2, opts);
  }
  put(path2, opts) {
    return this.methodRequest("put", path2, opts);
  }
  delete(path2, opts) {
    return this.methodRequest("delete", path2, opts);
  }
  methodRequest(method, path2, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path2, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, void 0));
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    await this.prepareRequest(req, { url, options });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === void 0 ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
      retryOfRequestLogID,
      method: options.method,
      url,
      options,
      headers: req.headers
    }));
    if (options.signal?.aborted) {
      throw new APIUserAbortError();
    }
    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof globalThis.Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if (options.signal?.aborted) {
        throw new APIUserAbortError();
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      if (retriesRemaining) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (isTimeout) {
        throw new APIConnectionTimeoutError();
      }
      throw new APIConnectionError({ cause: response });
    }
    const responseInfo = `[${requestLogID}${retryLogStr}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response);
      if (retriesRemaining && shouldRetry) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? void 0 : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  async fetchWithTimeout(url, init, ms, controller) {
    const { signal, method, ...options } = init || {};
    if (signal)
      signal.addEventListener("abort", () => controller.abort());
    const timeout = setTimeout(() => controller.abort(), ms);
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    try {
      return await this.fetch.call(void 0, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }
  async shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders?.get("retry-after");
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1e3;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1e3)) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1e3;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path2, query, defaultBaseURL } = options;
    const url = this.buildURL(path2, query, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1e3)) } : {},
        ...getPlatformHeaders()
      },
      await this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    this.validateHeaders(headers);
    return headers.values;
  }
  buildBody({ options: { body, headers: rawHeaders } }) {
    if (!body) {
      return { bodyHeaders: void 0, body: void 0 };
    }
    const headers = buildHeaders([rawHeaders]);
    if (
      // Pass raw type verbatim
      ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && // Preserve legacy string encoding behavior for now
      headers.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && body instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      body instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      body instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && body instanceof globalThis.ReadableStream
    ) {
      return { bodyHeaders: void 0, body };
    } else if (typeof body === "object" && (Symbol.asyncIterator in body || Symbol.iterator in body && "next" in body && typeof body.next === "function")) {
      return { bodyHeaders: void 0, body: ReadableStreamFrom(body) };
    } else {
      return __classPrivateFieldGet(this, _Supermemory_encoder, "f").call(this, { body, headers });
    }
  }
};
_a = Supermemory, _Supermemory_encoder = /* @__PURE__ */ new WeakMap(), _Supermemory_instances = /* @__PURE__ */ new WeakSet(), _Supermemory_baseURLOverridden = function _Supermemory_baseURLOverridden2() {
  return this.baseURL !== "https://api.supermemory.ai";
};
Supermemory.Supermemory = _a;
Supermemory.DEFAULT_TIMEOUT = 6e4;
Supermemory.SupermemoryError = SupermemoryError;
Supermemory.APIError = APIError;
Supermemory.APIConnectionError = APIConnectionError;
Supermemory.APIConnectionTimeoutError = APIConnectionTimeoutError;
Supermemory.APIUserAbortError = APIUserAbortError;
Supermemory.NotFoundError = NotFoundError;
Supermemory.ConflictError = ConflictError;
Supermemory.RateLimitError = RateLimitError;
Supermemory.BadRequestError = BadRequestError;
Supermemory.AuthenticationError = AuthenticationError;
Supermemory.InternalServerError = InternalServerError;
Supermemory.PermissionDeniedError = PermissionDeniedError;
Supermemory.UnprocessableEntityError = UnprocessableEntityError;
Supermemory.toFile = toFile;
Supermemory.Memories = Memories;
Supermemory.Documents = Documents;
Supermemory.Search = Search;
Supermemory.Settings = Settings;
Supermemory.Connections = Connections;

// src/services/logger.ts
var import_node_fs3 = require("node:fs");
var import_node_os3 = require("node:os");
var import_node_path3 = require("node:path");
var LOG_FILE = (0, import_node_path3.join)((0, import_node_os3.homedir)(), ".omp-supermemory.log");
var sessionStarted = false;
function ensureSessionStarted() {
  if (!sessionStarted) {
    sessionStarted = true;
    try {
      (0, import_node_fs3.appendFileSync)(
        LOG_FILE,
        `
--- Session started: ${(/* @__PURE__ */ new Date()).toISOString()} ---
`
      );
    } catch {
    }
  }
}
function log(message, data) {
  if (!CONFIG.debug && !process.env.SUPERMEMORY_DEBUG) return;
  ensureSessionStarted();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const line = data ? `[${timestamp}] ${message}: ${JSON.stringify(data)}
` : `[${timestamp}] ${message}
`;
  try {
    (0, import_node_fs3.appendFileSync)(LOG_FILE, line);
  } catch {
  }
}

// src/services/client.ts
var TIMEOUT_MS = 3e4;
function withTimeout(promise, ms) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}
var SupermemoryClient = class {
  client = null;
  getClient() {
    if (!this.client) {
      if (!isConfigured()) {
        throw new Error("SUPERMEMORY_API_KEY not set");
      }
      this.client = new Supermemory({ apiKey: getApiKeyValue() });
    }
    return this.client;
  }
  /**
   * Get user profile with embedded search results from a single container.
   * The recall hook pairs this with a separate `searchMemories()` call to
   * the project container so both user and project memories are surfaced.
   */
  async getProfileWithSearch(containerTag, query) {
    log("getProfileWithSearch: start", { containerTag, hasQuery: !!query });
    try {
      const result = await withTimeout(
        this.getClient().profile({
          containerTag,
          q: query
        }),
        TIMEOUT_MS
      );
      const seen = /* @__PURE__ */ new Set();
      const dedupeWithSeen = (items, getKey = (x) => String(x)) => items.filter((item) => {
        const key = getKey(item).toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const staticFacts = dedupeWithSeen(result.profile?.static || [], (x) => x);
      const dynamicFacts = dedupeWithSeen(result.profile?.dynamic || [], (x) => x);
      let searchResults;
      if (result.searchResults) {
        const mapped = result.searchResults.results.map((r) => ({
          id: r.id,
          memory: r.memory || r.content || String(r.context ?? ""),
          similarity: r.similarity,
          title: r.title,
          updatedAt: r.updatedAt
        }));
        searchResults = {
          results: dedupeWithSeen(mapped, (r) => r.memory),
          total: result.searchResults.total,
          timing: result.searchResults.timing
        };
      }
      log("getProfileWithSearch: success", {
        staticCount: staticFacts.length,
        dynamicCount: dynamicFacts.length,
        searchCount: searchResults?.results.length || 0
      });
      return {
        success: true,
        profile: { static: staticFacts, dynamic: dynamicFacts },
        searchResults
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("getProfileWithSearch: error", { error: errorMessage });
      return { success: false, error: errorMessage, profile: null };
    }
  }
  async searchMemories(query, containerTag) {
    log("searchMemories: start", { containerTag });
    try {
      const result = await withTimeout(
        this.getClient().search.documents({
          q: query,
          containerTags: [containerTag],
          limit: CONFIG.maxMemories,
        }),
        TIMEOUT_MS
      );
      const flatResults = (result.results || []).flatMap(r =>
        (r.chunks || []).map(chunk => ({
          id: r.documentId,
          memory: chunk.content || "",
          similarity: chunk.score || r.score || 0,
        }))
      );
      log("searchMemories: success", { count: flatResults.length });
      return { success: true, results: flatResults, total: flatResults.length, timing: result.timing || 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchMemories: error", { error: errorMessage });
      return { success: false, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }
  async getProfile(containerTag, query) {
    log("getProfile: start", { containerTag });
    try {
      const result = await withTimeout(
        this.getClient().profile({
          containerTag,
          q: query
        }),
        TIMEOUT_MS
      );
      log("getProfile: success", { hasProfile: !!result?.profile });
      return { success: true, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("getProfile: error", { error: errorMessage });
      return { success: false, error: errorMessage, profile: null };
    }
  }
  async addMemory(content, containerTag, metadata) {
    log("addMemory: start", { containerTag, contentLength: content.length });
    try {
      const payload = {
        content,
        containerTag,
        metadata
      };
      const result = await withTimeout(
        this.getClient().add(payload),
        TIMEOUT_MS
      );
      log("addMemory: success", { id: result.id });
      return { success: true, ...result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("addMemory: error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
  async forgetMemory(content, containerTag) {
    log("forgetMemory: start", { containerTag, contentLength: content.length });
    try {
      const result = await withTimeout(
        this.getClient().memories.forget({ containerTag, content }),
        TIMEOUT_MS
      );
      log("forgetMemory: success", { id: result.id });
      return { success: true, message: "Memory forgotten", id: result.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("forgetMemory: error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
};

// src/services/tags.ts
var import_node_crypto2 = require("node:crypto");
var import_node_child_process2 = require("node:child_process");
var import_node_os4 = require("node:os");
function sha256(input) {
  return (0, import_node_crypto2.createHash)("sha256").update(input).digest("hex").slice(0, 16);
}
function getGitEmail() {
  try {
    const email = (0, import_node_child_process2.execSync)("git config user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return email || null;
  } catch {
    return null;
  }
}
function getUserTag() {
  if (CONFIG.userContainerTag) return CONFIG.userContainerTag;
  const email = getGitEmail();
  if (email) return `${CONFIG.containerTagPrefix}_user_${sha256(email)}`;
  const fallback = process.env.USER || process.env.USERNAME || (0, import_node_os4.hostname)();
  return `${CONFIG.containerTagPrefix}_user_${sha256(fallback)}`;
}
function getProjectTag(directory) {
  if (CONFIG.projectContainerTag) return CONFIG.projectContainerTag;
  return `${CONFIG.containerTagPrefix}_project_${sha256(directory)}`;
}
function getTags(directory) {
  return {
    user: getUserTag(),
    project: getProjectTag(directory)
  };
}

// src/services/factCache.ts
var import_node_fs4 = require("node:fs");
var import_node_path4 = require("node:path");
var import_node_os5 = require("node:os");
var CACHE_DIR = (0, import_node_path4.join)((0, import_node_os5.homedir)(), ".omp-supermemory", "trackers");
function ensureDir() {
  if (!(0, import_node_fs4.existsSync)(CACHE_DIR)) (0, import_node_fs4.mkdirSync)(CACHE_DIR, { recursive: true });
}
function cacheFile(sessionId) {
  return (0, import_node_path4.join)(CACHE_DIR, `${sessionId}.facts.json`);
}
function normalizeFact(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function getSeenFacts(sessionId) {
  const file = cacheFile(sessionId);
  if (!(0, import_node_fs4.existsSync)(file)) return /* @__PURE__ */ new Set();
  try {
    const parsed = JSON.parse((0, import_node_fs4.readFileSync)(file, "utf-8"));
    return new Set(parsed.facts ?? []);
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function addSeenFacts(sessionId, facts) {
  if (facts.length === 0) return;
  ensureDir();
  const seen = getSeenFacts(sessionId);
  for (const f of facts) seen.add(normalizeFact(f));
  (0, import_node_fs4.writeFileSync)(cacheFile(sessionId), JSON.stringify({ facts: [...seen] }));
}

// src/services/context.ts
function formatCombinedContext(result, maxMemories, maxProfileItems, projectSearchResult, seenFacts = /* @__PURE__ */ new Set()) {
  const parts = [];
  const newFacts = [];
  if (result.success && result.profile) {
    const items = [...result.profile.static ?? [], ...result.profile.dynamic ?? []].map((s) => s.trim()).filter((s) => s.length > 0 && !seenFacts.has(normalizeFact(s))).slice(0, maxProfileItems);
    if (items.length > 0) {
      parts.push(
        `[User Profile]
${items.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      );
      newFacts.push(...items);
    }
  }
  const seenKeys = /* @__PURE__ */ new Set();
  function dedupKey(id, text) {
    if (id) return `id:${id}`;
    return `content:${text.toLowerCase().trim()}`;
  }
  const userMemories = [];
  if (result.searchResults && result.searchResults.results.length > 0) {
    for (const r of result.searchResults.results) {
      const text = r.memory || "";
      if (!text || seenFacts.has(normalizeFact(text))) continue;
      const key = dedupKey(r.id, text);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        userMemories.push(text);
      }
    }
  }
  const projectMemories = [];
  if (projectSearchResult?.success && projectSearchResult.results && projectSearchResult.results.length > 0) {
    for (const r of projectSearchResult.results) {
      const text = r.memory ?? r.chunk ?? r.content ?? "";
      if (!text || seenFacts.has(normalizeFact(text))) continue;
      const key = dedupKey(r.id, text);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        projectMemories.push(text);
      }
    }
  }
  const allMemories = [];
  let ui = 0;
  let pi = 0;
  while (allMemories.length < maxMemories && (ui < userMemories.length || pi < projectMemories.length)) {
    if (ui < userMemories.length) {
      allMemories.push(userMemories[ui++]);
    }
    if (allMemories.length < maxMemories && pi < projectMemories.length) {
      allMemories.push(projectMemories[pi++]);
    }
  }
  if (allMemories.length > 0) {
    const memories = allMemories.map((m, i) => `${i + 1}. ${m}`).filter((m) => m.trim().length > 2).join("\n");
    if (memories) {
      parts.push(`[Relevant Memories]
${memories}`);
      newFacts.push(...allMemories);
    }
  }
  return { text: parts.join("\n\n"), newFacts };
}

// src/services/capture.ts
var import_node_fs7 = require("node:fs");

// src/services/transcript.ts
var import_node_fs5 = require("node:fs");
var import_node_path5 = require("node:path");
var import_node_os6 = require("node:os");

// src/services/privacy.ts
function stripPrivateContent(content) {
  return content.replace(/<private>[\s\S]*?<\/private>/gi, "[REDACTED]");
}
function cleanContent(content) {
  return content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "").replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/gi, "").trim();
}

// src/services/transcript.ts
var SESSIONS_DIR = (0, import_node_path5.join)((0, import_node_os6.homedir)(), ".omp", "agent", "sessions");
function findTranscriptPath(sessionId) {
  if (!(0, import_node_fs5.existsSync)(SESSIONS_DIR)) {
    return null;
  }
  try {
    const subdirs = (0, import_node_fs5.readdirSync)(SESSIONS_DIR);
    for (const subdir of subdirs) {
      const fullPath = (0, import_node_path5.join)(SESSIONS_DIR, subdir);
      const found = searchDirForSession(fullPath, sessionId);
      if (found) return found;
    }
  } catch {
  }
  return null;
}
function searchDirForSession(dir, sessionId) {
  if (!(0, import_node_fs5.existsSync)(dir)) {
    return null;
  }
  try {
    const files = (0, import_node_fs5.readdirSync)(dir);
    for (const file of files) {
      if (file.endsWith(".jsonl") && file.includes(sessionId)) {
        return (0, import_node_path5.join)(dir, file);
      }
    }
  } catch {
  }
  return null;
}
function parseTranscript(transcriptPath) {
  const entries = [];
  if (!(0, import_node_fs5.existsSync)(transcriptPath)) {
    return entries;
  }
  try {
    const raw = (0, import_node_fs5.readFileSync)(transcriptPath, "utf-8");
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "event_msg" && parsed.payload) {
          const payload = parsed.payload;
          if (payload.type === "user_message" && payload.message) {
            const cleaned = cleanContent(stripPrivateContent(payload.message));
            if (cleaned && cleaned.length > 0) {
              entries.push({
                index: i,
                role: "user",
                content: cleaned
              });
            }
          }
          if (payload.type === "assistant_output_text" && payload.text) {
            const cleaned = cleanContent(stripPrivateContent(payload.text));
            if (cleaned && cleaned.length > 0) {
              entries.push({
                index: i,
                role: "assistant",
                content: cleaned
              });
            }
          }
        }
        // ── OMP `message` type ──────────────────────────────────────
        if (parsed.type === "message" && parsed.message) {
          const msg = parsed.message;
          const role = msg.role;
          if (role === "user" || role === "assistant") {
            if (Array.isArray(msg.content)) {
              const texts = [];
              for (const block of msg.content) {
                if (block.type === "text" && block.text) {
                  texts.push(block.text);
                }
              }
              const combined = texts.join("\n");
              const cleaned = cleanContent(stripPrivateContent(combined));
              if (cleaned && cleaned.length > 0) {
                entries.push({
                  index: i,
                  role: role,
                  content: cleaned
                });
              }
            }
          }
        }
        if (parsed.type === "response_item" && parsed.payload) {
          const payload = parsed.payload;
          if (payload.role === "assistant" && payload.content) {
            const content = payload.content;
            let text = "";
            if (typeof content === "string") {
              text = content;
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "output_text" && block.text) {
                  text += block.text + "\n";
                }
              }
            }
            const cleaned = cleanContent(stripPrivateContent(text));
            if (cleaned && cleaned.length > 0) {
              entries.push({
                index: i,
                role: "assistant",
                content: cleaned
              });
            }
          }
        }
      } catch {
      }
    }
  } catch {
  }
  return entries;
}
function getEntriesSince(entries, lastIndex) {
  if (lastIndex === null) {
    return entries;
  }
  return entries.filter((e) => e.index > lastIndex);
}
function formatTranscript(entries) {
  return entries.map((e, idx) => `${idx + 1}. [${e.role}] ${e.content}`).join("\n");
}

// src/services/tracker.ts
var import_node_fs6 = require("node:fs");
var import_node_path6 = require("node:path");
var import_node_os7 = require("node:os");
var TRACKER_DIR = (0, import_node_path6.join)((0, import_node_os7.homedir)(), ".omp-supermemory", "trackers");
function ensureTrackerDir() {
  if (!(0, import_node_fs6.existsSync)(TRACKER_DIR)) {
    (0, import_node_fs6.mkdirSync)(TRACKER_DIR, { recursive: true });
  }
}
function getLastCapturedIndex(sessionId) {
  ensureTrackerDir();
  const trackerFile = (0, import_node_path6.join)(TRACKER_DIR, `${sessionId}.txt`);
  if ((0, import_node_fs6.existsSync)(trackerFile)) {
    const content = (0, import_node_fs6.readFileSync)(trackerFile, "utf-8").trim();
    const num = parseInt(content, 10);
    return isNaN(num) ? null : num;
  }
  return null;
}
function setLastCapturedIndex(sessionId, index) {
  ensureTrackerDir();
  const trackerFile = (0, import_node_path6.join)(TRACKER_DIR, `${sessionId}.txt`);
  (0, import_node_fs6.writeFileSync)(trackerFile, String(index));
}

// src/services/signals.ts
function hasSignal(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}
function getEntryText(entry) {
  return entry.content || "";
}
function groupEntriesIntoTurns(entries) {
  const turns = [];
  let currentTurn = { userEntries: [], assistantEntries: [], allEntries: [] };
  for (const entry of entries) {
    if (entry.role === "user") {
      if (currentTurn.assistantEntries.length > 0) {
        turns.push(currentTurn);
        currentTurn = { userEntries: [], assistantEntries: [], allEntries: [] };
      }
      currentTurn.userEntries.push(entry);
      currentTurn.allEntries.push(entry);
    } else if (entry.role === "assistant") {
      currentTurn.assistantEntries.push(entry);
      currentTurn.allEntries.push(entry);
    }
  }
  if (currentTurn.allEntries.length > 0) {
    turns.push(currentTurn);
  }
  return turns;
}
function getTurnUserText(turn) {
  return turn.userEntries.map((e) => getEntryText(e)).join(" ").toLowerCase();
}
function findSignalTurnIndices(turns, keywords) {
  const signalIndices = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const userText = getTurnUserText(turn);
    if (hasSignal(userText, keywords)) {
      signalIndices.push(i);
      continue;
    }
    const assistantText = turn.assistantEntries.map((e) => getEntryText(e)).join(" ").toLowerCase();
    if (hasSignal(assistantText, keywords)) {
      signalIndices.push(i);
    }
  }
  return signalIndices;
}
function getTurnsAroundSignals(turns, signalIndices, turnsBefore) {
  if (signalIndices.length === 0) return [];
  const includeSet = /* @__PURE__ */ new Set();
  for (const signalIdx of signalIndices) {
    const startIdx = Math.max(0, signalIdx - turnsBefore);
    for (let i = startIdx; i <= signalIdx; i++) {
      includeSet.add(i);
    }
  }
  const sortedIndices = Array.from(includeSet).sort((a, b) => a - b);
  return sortedIndices.map((idx) => turns[idx]);
}
function filterBySignals(entries) {
  const config = getSignalConfig();
  if (!config.enabled) {
    return entries;
  }
  const turns = groupEntriesIntoTurns(entries);
  if (turns.length === 0) return [];
  const signalIndices = findSignalTurnIndices(turns, config.keywords);
  if (signalIndices.length === 0) return [];
  const turnsToInclude = getTurnsAroundSignals(turns, signalIndices, config.turnsBefore);
  const result = [];
  for (const turn of turnsToInclude) {
    result.push(...turn.allEntries);
  }
  return result;
}

// src/services/capture.ts
function resolveTranscriptPath(transcriptPath, sessionId) {
  if (transcriptPath) return transcriptPath;
  return findTranscriptPath(sessionId);
}
async function captureEntries(caller, client, sessionId, transcriptPath, tags, options = {}) {
  const { requireMinEntries = 0, requireMinTurns = 0 } = options;
  if (!transcriptPath || !(0, import_node_fs7.existsSync)(transcriptPath)) {
    log(`${caller}: no transcript to capture from`, { sessionId, transcriptPath });
    return;
  }
  const entries = parseTranscript(transcriptPath);
  if (entries.length === 0) {
    log(`${caller}: transcript empty`, { sessionId });
    return;
  }
  const lastIndex = getLastCapturedIndex(sessionId);
  const newEntries = getEntriesSince(entries, lastIndex);
  if (requireMinEntries > 0 && newEntries.length < requireMinEntries) {
    log(`${caller}: not enough new entries to capture`, {
      sessionId,
      newCount: newEntries.length,
      required: requireMinEntries,
      lastIndex
    });
    return;
  }
  if (newEntries.length === 0) {
    log(`${caller}: no new entries to capture`, { sessionId });
    return;
  }
  if (requireMinTurns > 0) {
    const turns = groupEntriesIntoTurns(newEntries);
    const effectiveTurnCount = turns.length + 1;
    if (effectiveTurnCount < requireMinTurns) {
      log(`${caller}: waiting for more turns before capture`, {
        sessionId,
        turnCount: effectiveTurnCount,
        requiredTurns: requireMinTurns,
        lastIndex
      });
      return;
    }
  }
  const signalEntries = filterBySignals(newEntries);
  if (signalEntries.length === 0) {
    log(`${caller}: no signal entries to capture`, {
      sessionId,
      totalNew: newEntries.length,
      lastIndex
    });
    const lastEntry = newEntries[newEntries.length - 1];
    setLastCapturedIndex(sessionId, lastEntry.index);
    return;
  }
  log(`${caller}: capturing signal entries`, {
    sessionId,
    signalCount: signalEntries.length,
    totalNew: newEntries.length,
    lastIndex
  });
  const transcript = formatTranscript(signalEntries);
  const content = `[Session ${sessionId}]
${transcript}`;
  const metadata = {
    type: "conversation",
    sessionId,
    entryCount: newEntries.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sm_source: "omp-windows",
    source: "omp-windows"
  };
  try {
    await Promise.all([
      client.addMemory(content, tags.project, metadata, { customId: `${sessionId}_project` }),
      client.addMemory(content, tags.user, metadata, { customId: `${sessionId}_user` })
    ]);
    const lastEntry = newEntries[newEntries.length - 1];
    setLastCapturedIndex(sessionId, lastEntry.index);
    log(`${caller}: captured entries`, {
      sessionId,
      count: newEntries.length,
      lastIndex: lastEntry.index
    });
  } catch (error) {
    log(`${caller}: capture error`, { error: String(error) });
  }
}

// src/hooks/recall.ts
var AUTH_ATTEMPTED_FILE = (0, import_node_path7.join)((0, import_node_os8.homedir)(), ".omp", "supermemory", ".auth-attempted");
function exitWithContext(additionalContext) {
  if (additionalContext) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext
        }
      })
    );
  }
  process.exit(0);
}
async function main() {
  let rawInput = "";
  try {
    rawInput = (0, import_node_fs8.readFileSync)(0, "utf-8");
  } catch {
    process.exit(0);
  }
  if (!isConfigured()) {
    const alreadyAttempted = (0, import_node_fs8.existsSync)(AUTH_ATTEMPTED_FILE);
    if (!alreadyAttempted) {
      try {
        (0, import_node_fs8.mkdirSync)((0, import_node_path7.dirname)(AUTH_ATTEMPTED_FILE), { recursive: true });
        (0, import_node_fs8.writeFileSync)(AUTH_ATTEMPTED_FILE, (/* @__PURE__ */ new Date()).toISOString());
      } catch {
      }
      try {
        log("recall: no API key, starting browser auth flow");
        await startAuthFlow();
        reloadApiKey();
        try {
          (0, import_node_fs8.unlinkSync)(AUTH_ATTEMPTED_FILE);
        } catch {
        }
        log("recall: auth flow completed");
      } catch (authErr) {
        const isTimeout = authErr instanceof Error && authErr.message === "AUTH_TIMEOUT";
        exitWithContext(
          "[SUPERMEMORY] Memory is installed but NOT active \u2014 missing API key.\n" + (isTimeout ? "Authentication timed out. Please complete login in the browser.\n" : "Authentication failed.\n") + `If the browser did not open, visit: ${AUTH_BASE_URL}
Run /supermemory-login to try again, or set SUPERMEMORY_CODEX_API_KEY manually.`
        );
      }
    } else {
      exitWithContext(
        "[SUPERMEMORY] Memory is installed but NOT active \u2014 missing API key.\nRun /supermemory-login to authenticate, or set SUPERMEMORY_CODEX_API_KEY in your shell profile."
      );
    }
  }
  let payload = {};
  try {
    payload = JSON.parse(rawInput);
  } catch {
    exitWithContext("");
  }
  const query = payload.prompt || payload.input || "";
  if (!query.trim()) {
    exitWithContext("");
  }
  const sessionId = payload.session_id || `codex_${Date.now()}`;
  const cwd = payload.cwd || process.cwd();
  const tags = getTags(cwd);
  log("recall: start", { query: query.slice(0, 100), tags, sessionId });
  ensureTrackerDir();
  const transcriptPath = resolveTranscriptPath(payload.transcript_path, sessionId);
  if (transcriptPath) {
    log("recall: found transcript", { sessionId, transcriptPath });
  }
  const client = new SupermemoryClient();
  await captureEntries("recall", client, sessionId, transcriptPath, tags, {
    requireMinEntries: 2,
    requireMinTurns: CONFIG.autoSaveEveryTurns
  });
  try {
    const [profileResult, projectSearchResult] = await Promise.all([
      client.getProfileWithSearch(tags.user, query),
      client.searchMemories(query, tags.project)
    ]);
    const seen = getSeenFacts(sessionId);
    const { text, newFacts } = formatCombinedContext(
      profileResult,
      CONFIG.maxMemories,
      CONFIG.maxProfileItems,
      projectSearchResult,
      seen
    );
    log("recall: done", {
      contextLength: text.length,
      newFactCount: newFacts.length,
      seenCount: seen.size
    });
    if (newFacts.length > 0) {
      addSeenFacts(sessionId, newFacts);
      let ctx = `[SUPERMEMORY CONTEXT]\n${text}\n[END SUPERMEMORY CONTEXT]`;
      if (query && CONFIG.KEYWORD_PATTERN && CONFIG.KEYWORD_PATTERN.test(query)) {
        ctx = "[MEMORY TRIGGER DETECTED]\nThe user wants to remember something. Use supermemory-save skill.\n\n" + ctx;
      }
      exitWithContext(ctx);
    } else {
      if (query && CONFIG.KEYWORD_PATTERN && CONFIG.KEYWORD_PATTERN.test(query)) {
        exitWithContext("[MEMORY TRIGGER DETECTED]\nThe user wants to remember something. Use supermemory-save skill.");
      }
      exitWithContext("");
    }
  } catch (error) {
    log("recall: error", { error: String(error) });
    exitWithContext("");
  }
}
main().catch(() => {
  exitWithContext("");
});
