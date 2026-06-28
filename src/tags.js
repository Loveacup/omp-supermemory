// src/tags.js — Single tag scheme for OMP Supermemory plugin.
// Derives container tags from user identity and project directory.
// Respects CONFIG.userContainerTag / CONFIG.projectContainerTag pins.
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import os from "node:os";
import { CONFIG } from "./config.js";

function sha16(input) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function getUserTag() {
  let email;
  try {
    email = execSync("git config user.email", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // git not available or not in a repo
  }
  if (!email) {
    email = os.userInfo().username;
  }
  const hash = sha16(email);
  return CONFIG.userContainerTag || `${CONFIG.containerTagPrefix}_user_${hash}`;
}

function getProjectTag(directory) {
  if (CONFIG.projectContainerTag) return CONFIG.projectContainerTag;
  const hash = sha16(directory);
  return `${CONFIG.containerTagPrefix}_project_${hash}`;
}

function getTags(directory) {
  return {
    user: getUserTag(),
    project: getProjectTag(directory),
  };
}

export { getUserTag, getProjectTag, getTags };
