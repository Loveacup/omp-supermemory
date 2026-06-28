// tests/config.test.js — TDD for src/config.js
// Uses temp directories via env var overrides (SUPERMEMORY_CONFIG_PATH, SUPERMEMORY_CREDS_PATH).
// NEVER touches the user's real config.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omp-sm-test-"));
}

describe("src/config.js", () => {
  let testHome;
  let origEnvApiKey, origConfigPath, origCredsPath;

  before(() => {
    testHome = tmpDir();
    origEnvApiKey = process.env.SUPERMEMORY_API_KEY;
    origConfigPath = process.env.SUPERMEMORY_CONFIG_PATH;
    origCredsPath = process.env.SUPERMEMORY_CREDS_PATH;
  });

  after(() => {
    fs.rmSync(testHome, { recursive: true, force: true });
    restoreEnv("SUPERMEMORY_API_KEY", origEnvApiKey);
    restoreEnv("SUPERMEMORY_CONFIG_PATH", origConfigPath);
    restoreEnv("SUPERMEMORY_CREDS_PATH", origCredsPath);
  });

  function restoreEnv(key, val) {
    if (val === undefined || val === null) delete process.env[key];
    else process.env[key] = val;
  }

  function configPath() { return path.join(testHome, ".omp", "supermemory.json"); }
  function credsDir() { return path.join(testHome, ".omp", "supermemory"); }
  function credsPath() { return path.join(credsDir(), "credentials.json"); }

  function writeJson(p, obj) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj));
  }

  function resetFiles() {
    try { fs.rmSync(path.join(testHome, ".omp"), { recursive: true, force: true }); } catch {}
  }

  function setTestEnv() {
    delete process.env.SUPERMEMORY_API_KEY; // start clean
    process.env.SUPERMEMORY_CONFIG_PATH = configPath();
    process.env.SUPERMEMORY_CREDS_PATH = credsPath();
  }

  async function loadConfig() {
    // Cache-busting import
    const key = Date.now() + "_" + Math.random().toString(36).slice(2);
    const mod = await import("../src/config.js?k=" + key);
    return mod.CONFIG;
  }

  it("returns default values when no config or credentials exist", async () => {
    resetFiles();
    setTestEnv();
    const CONFIG = await loadConfig();

    assert.strictEqual(CONFIG.containerTagPrefix, "omp");
    assert.strictEqual(CONFIG.userContainerTag, null);
    assert.strictEqual(CONFIG.projectContainerTag, null);
    assert.strictEqual(CONFIG.maxMemories, 5);
    assert.strictEqual(CONFIG.maxProjectMemories, 10);
    assert.strictEqual(CONFIG.maxProfileItems, 5);
    assert.strictEqual(CONFIG.similarityThreshold, 0.6);
    assert.strictEqual(CONFIG.injectProfile, true);
    assert.strictEqual(CONFIG.captureEveryNTurns, 3);
    assert.strictEqual(CONFIG.autoRecallEveryPrompt, true);
    assert.strictEqual(CONFIG.recallDedupMs, 30000);
    assert.strictEqual(CONFIG.recallBudgetMs, 8000);
    assert.strictEqual(CONFIG.isConfigured(), false);
    assert.strictEqual(CONFIG.getApiKeyValue(), null);
  });

  it("resolves API key from SUPERMEMORY_API_KEY env var (highest priority)", async () => {
    resetFiles();
    setTestEnv();
    process.env.SUPERMEMORY_API_KEY = "sm_env_test_key";
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), true);
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_env_test_key");
  });

  it("resolves API key from supermemory.json apiKey field (second priority)", async () => {
    resetFiles();
    setTestEnv();
    delete process.env.SUPERMEMORY_API_KEY;
    writeJson(configPath(), { apiKey: "sm_config_test_key" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), true);
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_config_test_key");
  });

  it("resolves API key from credentials.json (third priority)", async () => {
    resetFiles();
    setTestEnv();
    delete process.env.SUPERMEMORY_API_KEY;
    writeJson(credsPath(), { apiKey: "sm_creds_test_key" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), true);
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_creds_test_key");
  });

  it("env var wins over config file which wins over credentials", async () => {
    resetFiles();
    setTestEnv();
    process.env.SUPERMEMORY_API_KEY = "sm_env_wins";
    writeJson(configPath(), { apiKey: "sm_config_loses" });
    writeJson(credsPath(), { apiKey: "sm_creds_loses" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), true);
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_env_wins");
  });

  it("config file apiKey wins over credentials when no env", async () => {
    resetFiles();
    setTestEnv();
    delete process.env.SUPERMEMORY_API_KEY;
    writeJson(configPath(), { apiKey: "sm_config_wins" });
    writeJson(credsPath(), { apiKey: "sm_creds_loses" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), true);
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_config_wins");
  });

  it("overrides defaults from supermemory.json", async () => {
    resetFiles();
    setTestEnv();
    writeJson(configPath(), {
      maxMemories: 20,
      captureEveryNTurns: 10,
      autoRecallEveryPrompt: false,
      recallBudgetMs: 5000,
    });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.maxMemories, 20);
    assert.strictEqual(CONFIG.captureEveryNTurns, 10);
    assert.strictEqual(CONFIG.autoRecallEveryPrompt, false);
    assert.strictEqual(CONFIG.recallBudgetMs, 5000);
    assert.strictEqual(CONFIG.maxProjectMemories, 10);
  });

  it("CONFIG is frozen (immutable)", async () => {
    resetFiles();
    setTestEnv();
    const CONFIG = await loadConfig();
    assert.throws(() => { CONFIG.maxMemories = 999; }, TypeError);
  });

  it("handles malformed config JSON gracefully", async () => {
    resetFiles();
    setTestEnv();
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), "{not json}");
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.maxMemories, 5);
  });

  it("handles malformed credentials JSON gracefully", async () => {
    resetFiles();
    setTestEnv();
    fs.mkdirSync(path.dirname(credsPath()), { recursive: true });
    fs.writeFileSync(credsPath(), "{bad json");
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), false);
  });

  it("containerTagPrefix from config overrides default", async () => {
    resetFiles();
    setTestEnv();
    writeJson(configPath(), { containerTagPrefix: "myprefix" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.containerTagPrefix, "myprefix");
  });

  it("userContainerTag and projectContainerTag from config", async () => {
    resetFiles();
    setTestEnv();
    writeJson(configPath(), {
      userContainerTag: "my_user_tag",
      projectContainerTag: "my_project_tag",
    });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.userContainerTag, "my_user_tag");
    assert.strictEqual(CONFIG.projectContainerTag, "my_project_tag");
  });

  it("non-apiKey fields in credentials.json are ignored", async () => {
    resetFiles();
    setTestEnv();
    writeJson(credsPath(), { apiKey: "sm_creds", savedAt: "2024-01-01", other: "stuff" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.getApiKeyValue(), "sm_creds");
  });

  it("empty string apiKey is treated as unconfigured", async () => {
    resetFiles();
    setTestEnv();
    writeJson(credsPath(), { apiKey: "" });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), false);
  });

  it("whitespace-only apiKey is treated as unconfigured", async () => {
    resetFiles();
    setTestEnv();
    writeJson(credsPath(), { apiKey: "   " });
    const CONFIG = await loadConfig();
    assert.strictEqual(CONFIG.isConfigured(), false);
  });
});
