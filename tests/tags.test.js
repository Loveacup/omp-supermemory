// tests/tags.test.js — TDD for src/tags.js
// Uses child_process with tests/run-tags.js helper for config isolation.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omp-sm-test-"));
}

function runTags(env, ...args) {
  const script = path.resolve("tests/run-tags.js");
  const cmd = `"${process.execPath}" "${script}" ${args.map(a => JSON.stringify(a)).join(" ")}`;
  const result = execSync(cmd, {
    encoding: "utf-8",
    timeout: 15000,
    env: { ...process.env, ...env },
  });
  return JSON.parse(result.trim());
}

describe("src/tags.js", () => {
  let testHome;

  before(() => { testHome = tmpDir(); });
  after(() => { fs.rmSync(testHome, { recursive: true, force: true }); });

  function configPath() { return path.join(testHome, ".omp", "supermemory.json"); }
  function credsPath() { return path.join(testHome, ".omp", "supermemory", "credentials.json"); }

  function writeJson(p, obj) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj));
  }

  function baseEnv() {
    return { SUPERMEMORY_CONFIG_PATH: configPath(), SUPERMEMORY_CREDS_PATH: credsPath() };
  }

  it("getUserTag uses git email when available", () => {
    let gitEmail;
    try {
      gitEmail = execSync("git config user.email", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { gitEmail = null; }
    if (!gitEmail) return; // skip

    const result = runTags(baseEnv(), "getUserTag");
    assert.ok(result.tag.startsWith("omp_user_"));
    assert.ok(result.tag.length > 20);
  });

  it("getUserTag falls back to OS username when no git", () => {
    const badHome = path.join(testHome, "no-git");
    fs.mkdirSync(badHome, { recursive: true });

    const result = runTags({ ...baseEnv(), HOME: badHome }, "getUserTag");
    assert.ok(result.tag.includes("user_"));
    assert.ok(result.tag.length > 20);
  });

  it("getUserTag uses userContainerTag from config when set", () => {
    writeJson(configPath(), { userContainerTag: "custom_user_tag" });
    const result = runTags(baseEnv(), "getUserTag");
    assert.strictEqual(result.tag, "custom_user_tag");
  });

  it("getProjectTag returns hash-based tag by default", () => {
    const result = runTags(baseEnv(), "getProjectTag", "C:/some/test/project");
    assert.ok(result.tag.startsWith("omp_project_"));
  });

  it("getProjectTag uses projectContainerTag from config when set", () => {
    writeJson(configPath(), { projectContainerTag: "my_project" });
    const result = runTags(baseEnv(), "getProjectTag", "C:/any/path");
    assert.strictEqual(result.tag, "my_project");
  });

  it("getTags returns both user and project", () => {
    writeJson(configPath(), { userContainerTag: "user_x", projectContainerTag: "project_y" });
    const result = runTags(baseEnv(), "getTags", "C:/some/dir");
    assert.strictEqual(result.user, "user_x");
    assert.strictEqual(result.project, "project_y");
  });

  it("getUserTag uses containerTagPrefix from config", () => {
    writeJson(configPath(), { containerTagPrefix: "testpfx" });
    const result = runTags(baseEnv(), "getUserTag");
    assert.ok(result.tag.startsWith("testpfx_user_"), `got: ${result.tag}`);
  });

  it("getProjectTag uses containerTagPrefix from config", () => {
    writeJson(configPath(), { containerTagPrefix: "pfx2" });
    const result = runTags(baseEnv(), "getProjectTag", "C:/some/dir");
    assert.ok(result.tag.startsWith("pfx2_project_"), `got: ${result.tag}`);
  });

  it("getProjectTag is deterministic for same dir", () => {
    const result = runTags(baseEnv(), "multi", "C:/fixed/test/path", "C:/fixed/test/path");
    assert.strictEqual(result.same, true);
  });

  it("getProjectTag differs for different dirs", () => {
    const result = runTags(baseEnv(), "multi", "C:/project/a", "C:/project/b");
    assert.strictEqual(result.diff, true);
  });
});
