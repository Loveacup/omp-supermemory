// src/wizard.js — Post-install config wizard for omp-supermemory.
// Usage: node src/wizard.js [--status|--auto]
//   (no arg)  Interactive guided setup
//   --status   Print current config and exit
//   --auto     Non-interactive auto-config with defaults

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CONFIG } from "./config.js";
import { getTags } from "./tags.js";
import { supermemoryClient } from "./client.js";

const CONFIG_PATH = path.join(os.homedir(), ".omp", "supermemory.json");
const RECOMMENDED_POOL = "sm_project_cli";

// ── Helpers ──────────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function testConnection() {
  try {
    const r = await supermemoryClient.searchMemories("connection_test", "sm_project_cli");
    return r.success;
  } catch {
    return false;
  }
}

async function poolExists(tag) {
  try {
    const r = await supermemoryClient.searchMemories("", tag);
    return r.success;
  } catch {
    return false;
  }
}

// ── Status mode ──────────────────────────────────────────────────────

async function showStatus() {
  const configured = CONFIG.isConfigured();
  const tags = getTags(process.cwd());

  console.log(`configured:    ${configured}`);
  console.log(`key source:    ${CONFIG.getApiKeyValue() ? "yes" : "no"}`);
  console.log(`user tag:      ${CONFIG.userContainerTag || tags.user + " (auto)"}`);
  console.log(`project tag:   ${CONFIG.projectContainerTag || tags.project + " (auto)"}`);
  console.log(`source tag:    ${supermemoryClient.sourceTag}`);
  console.log(`config file:   ${CONFIG_PATH}${fs.existsSync(CONFIG_PATH) ? "" : " (not found)"}`);

  if (configured) {
    const connected = await testConnection();
    console.log(`API reachable: ${connected ? "yes" : "no"}`);
  }
}

// ── Auto mode ────────────────────────────────────────────────────────

async function autoConfig() {
  if (!CONFIG.isConfigured()) {
    console.log("No API key configured. Set SUPERMEMORY_API_KEY or run: node src/login.js");
    return;
  }

  console.log("Testing Supermemory connection...");
  const connected = await testConnection();
  if (!connected) {
    console.log("Cannot reach Supermemory API. Check your key and network.");
    return;
  }
  console.log("Connection OK.");

  const tags = getTags(process.cwd());
  const recommendedTag = RECOMMENDED_POOL;

  console.log(`\nUsing project pool: ${recommendedTag}`);
  console.log(`User pool (auto):   ${tags.user}`);
  console.log(`Source tag:         ${supermemoryClient.sourceTag}`);

  const config = { projectContainerTag: recommendedTag };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  console.log(`\nWrote ${CONFIG_PATH}`);
  console.log("Restart OMP for changes to take effect.");
}

// ── Interactive mode ─────────────────────────────────────────────────

async function interactiveConfig() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("╔══════════════════════════════════════╗");
  console.log("║   omp-supermemory Config Wizard      ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Step 1: Check if already configured
  if (CONFIG.isConfigured() && fs.existsSync(CONFIG_PATH)) {
    const ans = await ask(rl, "Already configured. Reconfigure? [y/N] ");
    if (ans.toLowerCase() !== "y") {
      console.log("Keeping existing config. Done.");
      rl.close();
      return;
    }
  }

  // Step 2: Key check
  if (!CONFIG.isConfigured()) {
    console.log("\n⚠ No API key found.");
    console.log("  Set SUPERMEMORY_API_KEY env var, or run: node src/login.js");
    console.log("  Get a key at: https://console.supermemory.ai/keys\n");
    const skip = await ask(rl, "Continue without key? (tools will report 'not configured') [y/N] ");
    if (skip.toLowerCase() !== "y") {
      rl.close();
      return;
    }
  }

  // Step 3: Test connection
  if (CONFIG.isConfigured()) {
    console.log("\nTesting Supermemory connection...");
    const connected = await testConnection();
    if (!connected) {
      console.log("⚠ Cannot reach Supermemory API. Check your key and network.");
    } else {
      console.log("✅ Connection OK.");
    }
  }

  // Step 4: Show computed tags
  const tags = getTags(process.cwd());
  const recommendedTag = CONFIG.projectContainerTag || RECOMMENDED_POOL;

  console.log("\n── Computed Tags ──");
  console.log(`  User pool:      ${CONFIG.userContainerTag || tags.user + " (auto)"}`);
  console.log(`  Source tag:     ${supermemoryClient.sourceTag}`);
  console.log(`  Container prefix: ${CONFIG.containerTagPrefix}`);

  // Step 5: Project pool selection
  console.log("\n── Project Pool ──");
  console.log(`  Auto-derived:   ${tags.project}`);
  console.log(`  Recommended:    ${recommendedTag}`);

  const projectInput = await ask(rl, `\nProject container tag [${recommendedTag}]: `);
  const projectTag = projectInput || recommendedTag;

  // Step 6: Confirm
  const config = { projectContainerTag: projectTag };
  console.log("\n── Will write ──");
  console.log(JSON.stringify(config, null, 2));
  console.log(`to: ${CONFIG_PATH}\n`);

  const confirm = await ask(rl, "Write config? [Y/n] ");
  if (confirm.toLowerCase() === "n") {
    console.log("Aborted. No changes made.");
    rl.close();
    return;
  }

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n✅ Wrote ${CONFIG_PATH}`);

  // Step 7: Verify
  // Re-import to pick up new config
  const { CONFIG: newConfig } = await import("./config.js?t=" + Date.now());
  console.log(`✅ Config loaded: projectContainerTag = ${newConfig.projectContainerTag}`);
  console.log("\nRestart OMP for changes to take effect.");

  rl.close();
}

// ── Main ─────────────────────────────────────────────────────────────

const mode = process.argv[2];

if (mode === "--status") {
  showStatus().catch((e) => { console.error(e.message); process.exit(1); });
} else if (mode === "--auto") {
  autoConfig().catch((e) => { console.error(e.message); process.exit(1); });
} else {
  interactiveConfig().catch((e) => { console.error(e.message); process.exit(1); });
}
