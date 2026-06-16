const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const CONFIG_PATH = path.join(HOME, '.omp', 'supermemory.json');
const CREDS_PATH = path.join(HOME, '.omp', 'supermemory', 'credentials.json');

// ── Default keyword patterns ────────────────────────────────────────────────
const DEFAULT_KEYWORD_PATTERNS = [
  'remember',
  'save this',
  'note this',
  'keep in mind',
  "don't forget",
  'learn this',
  'store this',
  'make a note',
  'take note',
  'jot down',
  'commit to memory',
  'remember that',
  'never forget'
];

// ── Inline credential loader (auth module pattern) ──────────────────────────
function loadCredentials() {
  let apiKey = process.env.SUPERMEMORY_API_KEY || null;

  if (!apiKey) {
    try {
      if (fs.existsSync(CREDS_PATH)) {
        const raw = fs.readFileSync(CREDS_PATH, 'utf-8');
        const creds = JSON.parse(raw);
        if (creds && creds.apiKey && typeof creds.apiKey === 'string') {
          apiKey = creds.apiKey.trim() || null;
        }
      }
    } catch (_) {
      // credentials file unreadable or malformed — remain null
    }
  }

  return { apiKey };
}

// ── Config loader ───────────────────────────────────────────────────────────
function loadUserConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (_) {
    // config file missing or malformed — fall through to defaults
  }
  return {};
}

// ── Assemble resolved CONFIG ────────────────────────────────────────────────
const userConfig = loadUserConfig();
const creds = loadCredentials();

const keywordPatterns = Array.isArray(userConfig.keywordPatterns)
  ? userConfig.keywordPatterns
  : DEFAULT_KEYWORD_PATTERNS;

function buildKeywordRegex(patterns) {
  const escaped = patterns
    .filter(p => typeof p === 'string' && p.trim().length > 0)
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) {
    // never-match sentinel so the regex is always valid
    return /(?!)/;
  }
  return new RegExp('(' + escaped.join('|') + ')', 'i');
}

const CONFIG = Object.freeze({
  similarityThreshold:
    typeof userConfig.similarityThreshold === 'number'
      ? userConfig.similarityThreshold
      : 0.6,

  maxMemories:
    typeof userConfig.maxMemories === 'number'
      ? userConfig.maxMemories
      : 5,

  maxProjectMemories:
    typeof userConfig.maxProjectMemories === 'number'
      ? userConfig.maxProjectMemories
      : 10,

  maxProfileItems:
    typeof userConfig.maxProfileItems === 'number'
      ? userConfig.maxProfileItems
      : 5,

  containerTagPrefix:
    typeof userConfig.containerTagPrefix === 'string' && userConfig.containerTagPrefix.length > 0
      ? userConfig.containerTagPrefix
      : 'omp',

  userContainerTag:
    typeof userConfig.userContainerTag === 'string' && userConfig.userContainerTag.length > 0
      ? userConfig.userContainerTag
      : null,

  projectContainerTag:
    typeof userConfig.projectContainerTag === 'string' && userConfig.projectContainerTag.length > 0
      ? userConfig.projectContainerTag
      : null,

  compactionThreshold:
    typeof userConfig.compactionThreshold === 'number'
      ? userConfig.compactionThreshold
      : 0.80,

  autoRecallEveryPrompt:
    typeof userConfig.autoRecallEveryPrompt === 'boolean'
      ? userConfig.autoRecallEveryPrompt
      : true,

  captureEveryNTurns:
    typeof userConfig.captureEveryNTurns === 'number'
      ? userConfig.captureEveryNTurns
      : 3,

  keywordPatterns: Object.freeze(keywordPatterns.slice()),

  KEYWORD_PATTERN: buildKeywordRegex(keywordPatterns),

  filterPrompt:
    typeof userConfig.filterPrompt === 'string' && userConfig.filterPrompt.length > 0
      ? userConfig.filterPrompt
      : 'You are a stateful coding agent. Remember all the information.',

  apiKey: creds.apiKey,

  isConfigured: function () {
    return !!this.apiKey;
  },

  getApiKeyValue: function () {
    return this.apiKey;
  }
});

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  CONFIG,
  DEFAULT_KEYWORD_PATTERNS,
};
