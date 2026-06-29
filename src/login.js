// src/login.js — Standalone auth flow for Supermemory.
// Run: node src/login.js
// Opens browser to Supermemory console, captures sm_* API key via localhost callback.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import crypto from "node:crypto";

const SUPERMEMORY_DIR = path.join(os.homedir(), ".omp", "supermemory");
const CREDENTIALS_FILE = path.join(SUPERMEMORY_DIR, "credentials.json");
const AUTH_BASE_URL = process.env.SUPERMEMORY_AUTH_URL || "https://console.supermemory.ai/auth/agent-connect";
const AUTH_TIMEOUT = Number(process.env.SUPERMEMORY_AUTH_TIMEOUT) || 60000;

const AUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Connected - Supermemory</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;background:#faf9f6}
.dot{width:10px;height:10px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:8px}
h1{font-size:32px;font-weight:500;color:#1a1a1a;margin:16px 0}
p{color:#666;font-size:16px}
</style></head><body>
<div><span class="dot"></span><span style="color:#22c55e;font-size:14px">Connected</span></div>
<h1>Supermemory is ready</h1>
<p>You can close this tab and return to OMP.</p>
</body></html>`;

const AUTH_ERROR_HTML = `<!DOCTYPE html>
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
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const creds = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
      return creds.apiKey || null;
    }
  } catch {}
  return null;
}

function saveCredentials(apiKey) {
  fs.mkdirSync(SUPERMEMORY_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ apiKey, savedAt: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
}

function openBrowser(url) {
  const onError = () => {};
  if (process.platform === "win32") {
    execFile("explorer.exe", [url], onError);
  } else if (process.platform === "darwin") {
    execFile("open", [url], onError);
  } else {
    execFile("xdg-open", [url], onError);
  }
}

function startAuthFlow() {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const stateToken = crypto.randomBytes(16).toString("hex");
    const server = http.createServer((req, res) => {
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
        client: "omp",
        hostname: `omp - ${os.hostname()}`,
        os: `${os.platform()}-${os.arch()}`,
        cwd: process.cwd(),
        cli_version: "2.0.0",
      });
      const authUrl = `${AUTH_BASE_URL}?${params.toString()}`;
      openBrowser(authUrl);
    });
    server.on("error", (err) => {
      if (!resolved) { clearTimeout(timer); reject(new Error(`Failed to start auth server: ${err.message}`)); }
    });
    const timer = setTimeout(() => {
      if (!resolved) { server.close(); reject(new Error("AUTH_TIMEOUT")); }
    }, AUTH_TIMEOUT);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Check env var first — highest priority, matching config.js resolution order
  const envKey = process.env.SUPERMEMORY_API_KEY?.trim();
  if (envKey) {
    console.log("Already authenticated with Supermemory (using SUPERMEMORY_API_KEY). Memory is active.");
    console.log(`To switch accounts, unset SUPERMEMORY_API_KEY and run this again.`);
    return;
  }

  const existingKey = loadCredentials();
  if (existingKey) {
    console.log("Already authenticated with Supermemory. Memory is active.");
    console.log(`To re-authenticate, remove ${CREDENTIALS_FILE} and run this again.`);
    return;
  }

  console.log("Opening browser to authenticate with Supermemory...");
  console.log(`If the browser does not open, visit: ${AUTH_BASE_URL}`);

  try {
    await startAuthFlow();
    console.log("\nAuthenticated successfully! Supermemory is now active.");
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "AUTH_TIMEOUT";
    if (isTimeout) {
      console.error("\nAuthentication timed out. Please try again.");
    } else {
      console.error("\nAuthentication failed:", err instanceof Error ? err.message : err);
    }
    console.error("\nAlternatively, set the API key manually:");
    console.error('  set SUPERMEMORY_API_KEY="sm_..."');
    console.error("  Get your key at: https://console.supermemory.ai/keys");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
