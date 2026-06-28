// tests/login.test.js — TDD for src/login.js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "omp-sm-test-")); }

describe("src/login.js", () => {
  let testHome;

  before(() => {
    testHome = tmpDir();
  });

  after(() => {
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  function runLogin(env = {}) {
    const script = path.resolve("src/login.js");
    try {
      const r = execSync(`"${process.execPath}" "${script}"`, {
        encoding: "utf-8", timeout: 5000,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { stdout: r, exitCode: 0 };
    } catch (e) {
      return { stdout: e.stdout || "", stderr: e.stderr || "", exitCode: e.status || 1 };
    }
  }

  it("login script reports already authenticated when key is set", async () => {
    const r = runLogin({ SUPERMEMORY_API_KEY: "sm_fake_key_test" });
    assert.ok(
      r.stdout.includes("Already authenticated") || r.stdout.includes("Memory is active"),
      `Expected auth message, got: "${r.stdout}"`
    );
  });

  it("login script file exists and has expected functions", () => {
    const content = fs.readFileSync("src/login.js", "utf-8");
    assert.ok(content.includes("startAuthFlow"), "should have startAuthFlow");
    assert.ok(content.includes("saveCredentials"), "should have saveCredentials");
    assert.ok(content.includes("loadCredentials"), "should have loadCredentials");
    assert.ok(content.includes("openBrowser"), "should have openBrowser");
    assert.ok(content.includes("AUTH_SUCCESS_HTML"), "should have success page");
    assert.ok(content.includes("AUTH_ERROR_HTML"), "should have error page");
    assert.ok(content.includes("SUPERMEMORY_AUTH_URL"), "should respect auth URL env");
    assert.ok(content.includes("SUPERMEMORY_AUTH_TIMEOUT"), "should respect timeout env");
  });

  it("uses omp client identifier (not codex)", () => {
    const content = fs.readFileSync("src/login.js", "utf-8");
    assert.ok(content.includes('client: "omp"'), "should identify as omp");
  });
});
