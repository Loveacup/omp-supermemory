// src/config.js — Single config + key loader for OMP Supermemory plugin.
// Reads ~/.omp/supermemory.json for settings.
// API key resolution order: SUPERMEMORY_API_KEY env → config apiKey → credentials.json apiKey.
// Test isolation: SUPERMEMORY_CONFIG_PATH / SUPERMEMORY_CREDS_PATH env vars override paths.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const CONFIG_PATH = process.env.SUPERMEMORY_CONFIG_PATH
  || path.join(HOME, ".omp", "supermemory.json");
const CREDS_PATH = process.env.SUPERMEMORY_CREDS_PATH
  || path.join(HOME, ".omp", "supermemory", "credentials.json");

// ── Load credentials ──────────────────────────────────────────────────────────
function loadCredentials() {
  let apiKey = null;

  if (process.env.SUPERMEMORY_API_KEY?.trim()) {
    apiKey = process.env.SUPERMEMORY_API_KEY.trim();
    return { apiKey };
  }

  const userConfig = loadUserConfig();
  if (userConfig.apiKey?.trim()) {
    apiKey = userConfig.apiKey.trim();
    return { apiKey };
  }

  try {
    if (fs.existsSync(CREDS_PATH)) {
      const raw = fs.readFileSync(CREDS_PATH, "utf-8");
      const creds = JSON.parse(raw);
      if (creds?.apiKey && typeof creds.apiKey === "string" && creds.apiKey.trim()) {
        apiKey = creds.apiKey.trim();
      }
    }
  } catch {}

  return { apiKey };
}

// ── Load user config ──────────────────────────────────────────────────────────
function loadUserConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

// ── Assemble frozen CONFIG ────────────────────────────────────────────────────
const userConfig = loadUserConfig();
const creds = loadCredentials();

const CONFIG = Object.freeze({
  containerTagPrefix:
    typeof userConfig.containerTagPrefix === "string" && userConfig.containerTagPrefix.length > 0
      ? userConfig.containerTagPrefix
      : "omp",

  userContainerTag:
    typeof userConfig.userContainerTag === "string" && userConfig.userContainerTag.length > 0
      ? userConfig.userContainerTag
      : null,

  projectContainerTag:
    typeof userConfig.projectContainerTag === "string" && userConfig.projectContainerTag.length > 0
      ? userConfig.projectContainerTag
      : null,

  maxMemories:
    typeof userConfig.maxMemories === "number" ? userConfig.maxMemories : 5,

  maxProjectMemories:
    typeof userConfig.maxProjectMemories === "number" ? userConfig.maxProjectMemories : 10,

  maxProfileItems:
    typeof userConfig.maxProfileItems === "number" ? userConfig.maxProfileItems : 5,

  similarityThreshold:
    typeof userConfig.similarityThreshold === "number" ? userConfig.similarityThreshold : 0.6,

  injectProfile:
    typeof userConfig.injectProfile === "boolean" ? userConfig.injectProfile : true,

  captureEveryNTurns:
    typeof userConfig.captureEveryNTurns === "number" ? userConfig.captureEveryNTurns : 3,

  autoRecallEveryPrompt:
    typeof userConfig.autoRecallEveryPrompt === "boolean" ? userConfig.autoRecallEveryPrompt : true,

  recallDedupMs:
    typeof userConfig.recallDedupMs === "number" ? userConfig.recallDedupMs : 30000,

  recallBudgetMs:
    typeof userConfig.recallBudgetMs === "number" ? userConfig.recallBudgetMs : 8000,

  apiKey: creds.apiKey,

  isConfigured() { return !!this.apiKey; },
  getApiKeyValue() { return this.apiKey; },
});

export { CONFIG };
