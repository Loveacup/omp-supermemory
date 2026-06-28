// tests/index.test.js — TDD for src/index.js extension factory
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "omp-sm-test-")); }

function makeMockPi() {
  const handlers = {}, tools = {}, entries_ = [];
  let label = "";
  const pi = {
    handlers, tools,
    get label() { return label; },
    get entries() { return entries_; },
    zod: { z: new Proxy({}, { get(_, prop) {
      const b = (a) => { const base = prop === "object" ? { type: "object", shape: a } : prop === "enum" ? { type: "enum", values: a } : { type: prop }; return new Proxy(base, { get(_, cp) { if (cp === "describe") return () => base; if (cp === "default") return v => ({ ...base, defaultValue: v }); if (cp === "shape") return base.shape; return undefined; } }); };
      if (["string","number","boolean","object","enum"].includes(prop)) return b; return undefined;
    }})},
    on(e, h) { (handlers[e] = handlers[e] || []).push(h); },
    registerTool(d) { tools[d.name] = d; },
    setLabel(t) { label = t; },
    appendEntry(ct, d) { entries_.push({ customType: ct, data: d, at: Date.now() }); },
    logger: { info() {}, debug() {}, warn() {}, error() {} },
  };
  return pi;
}

function makeMockCtx(o = {}) {
  return {
    cwd: o.cwd || process.cwd(),
    sessionManager: { getBranch: () => o.branch || [], getSessionFile: () => o.sessionFile || "test-session.jsonl" },
    hasUI: false, ui: { notify() {} },
    models: { list: () => [], current: () => null, resolve: () => undefined, family: () => 0 },
    ...o,
  };
}

function makeMockClient(results = {}) {
  const d = { search: { success: true, results: [], total: 0, timing: 0 }, add: { success: true, id: "mock-id" }, profile: { success: true, profile: [] }, delete: { success: true }, list: { success: true, memories: [], pagination: {} }, ...results };
  const calls = [];
  return { calls, client: {
    sourceTag: "test-windows",
    searchMemories: async (q, t, o) => { calls.push(["search", q, t, o]); return d.search; },
    addMemory: async (c, t, m) => { calls.push(["add", c, t, m]); return d.add; },
    getProfile: async (t, q, o) => { calls.push(["profile", t, q, o]); return d.profile; },
    deleteMemory: async (id) => { calls.push(["delete", id]); return d.delete; },
    listMemories: async (t, l) => { calls.push(["list", t, l]); return d.list; },
  }};
}

describe("src/index.js", () => {
  let testHome;
  before(() => {
    testHome = tmpDir();
    process.env.SUPERMEMORY_API_KEY = "sm_test_key";
    process.env.SUPERMEMORY_CONFIG_PATH = path.join(testHome, ".omp", "supermemory.json");
    process.env.SUPERMEMORY_CREDS_PATH = path.join(testHome, ".omp", "supermemory", "credentials.json");
    fs.mkdirSync(path.dirname(process.env.SUPERMEMORY_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(process.env.SUPERMEMORY_CONFIG_PATH, JSON.stringify({ captureEveryNTurns: 3, autoRecallEveryPrompt: true, maxMemories: 5, maxProjectMemories: 10, recallDedupMs: 30000, recallBudgetMs: 8000, injectProfile: true }));
  });
  after(() => {
    fs.rmSync(testHome, { recursive: true, force: true });
    delete process.env.SUPERMEMORY_API_KEY; delete process.env.SUPERMEMORY_CONFIG_PATH; delete process.env.SUPERMEMORY_CREDS_PATH;
  });

  const intModPromise = import("../src/internals.js");

  async function wire(client) {
    if (client) (await intModPromise).setClient(client);
    const k = Date.now() + "_" + Math.random().toString(36).slice(2);
    return (await import("../src/index.js?k=" + k)).default;
  }

  it("registers label and three tools", async () => {
    const f = await wire(); const pi = makeMockPi(); f(pi);
    assert.strictEqual(pi.label, "Supermemory");
    assert.ok(pi.tools.supermemory_search); assert.ok(pi.tools.supermemory_save); assert.ok(pi.tools.supermemory_forget);
  });

  it("registers all four event handlers", async () => {
    const f = await wire(); const pi = makeMockPi(); f(pi);
    assert.ok(pi.handlers.context); assert.ok(pi.handlers.session_start); assert.ok(pi.handlers.turn_end); assert.ok(pi.handlers.session_shutdown);
  });

  // ── Context handler ────────────────────────────────────────────────────

  it("context handler injects system message with search results", async () => {
    const { client } = makeMockClient({ search: { success: true, results: [{ id: "d1", memory: "remember this!", similarity: 0.95 }], total: 1, timing: 50 } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const r = await pi.handlers.context[0]({ messages: [{ role: "user", content: "what did I ask?" }] }, makeMockCtx());
    assert.ok(r?.messages);
    assert.strictEqual(r.messages[0].role, "system");
    assert.ok(r.messages[0].content.includes("Relevant memory"));
    assert.ok(r.messages[0].content.includes("remember this!"));
  });

  it("context handler deduplicates identical query", async () => {
    const { client } = makeMockClient({ search: { success: true, results: [{ id: "d1", memory: "hit", similarity: 1 }], total: 1, timing: 0 } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const evt = { messages: [{ role: "user", content: "dedup me" }] }; const ctx = makeMockCtx();
    assert.ok(await pi.handlers.context[0](evt, ctx));
    assert.strictEqual(await pi.handlers.context[0](evt, ctx), undefined);
  });

  it("context handler returns nothing when no results", async () => {
    const { client } = makeMockClient({ search: { success: true, results: [], total: 0 } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const r = await pi.handlers.context[0]({ messages: [{ role: "user", content: "nothing" }] }, makeMockCtx());
    assert.strictEqual(r, undefined);
  });

  // ── Auto-save ──────────────────────────────────────────────────────────

  it("turn_end captures after N turns and calls addMemory with conversation type", async () => {
    const { client, calls } = makeMockClient({ add: { success: true, id: "cap-1" } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const branch = [{ id: "e1", type: "user", content: "turn 1" }, { id: "e2", type: "assistant", content: "response" }];
    const ctx = makeMockCtx({ branch, sessionFile: "sessions/test-123.jsonl" });
    await pi.handlers.session_start[0]({}, ctx);
    await pi.handlers.turn_end[0]({}, ctx);
    await pi.handlers.turn_end[0]({}, ctx);
    await pi.handlers.turn_end[0]({}, ctx);
    const ac = calls.find(c => c[0] === "add");
    assert.ok(ac, "addMemory should be called");
    assert.ok(ac[1].includes("[Session test-123]"));
    assert.strictEqual(ac[3].type, "conversation");
    const ce = pi.entries.filter(e => e.customType === "supermemory-capture");
    assert.ok(ce.length >= 1, "should have capture entry");
  });

  it("session_shutdown flushes remaining turns", async () => {
    const { client, calls } = makeMockClient({ add: { success: true, id: "final" } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const ctx = makeMockCtx({ branch: [{ id: "e1", type: "user", content: "final msg" }], sessionFile: "sessions/final.jsonl" });
    await pi.handlers.session_start[0]({}, ctx);
    await pi.handlers.session_shutdown[0]({}, ctx);
    const ac = calls.find(c => c[0] === "add");
    assert.ok(ac, "addMemory should be called on shutdown");
    assert.ok(ac[1].includes("[Session final]"));
    assert.strictEqual(ac[3].type, "conversation");
  });

  // ── Tools ──────────────────────────────────────────────────────────────

  it("supermemory_search returns formatted results", async () => {
    const { client } = makeMockClient({ search: { success: true, results: [{ id: "d1", memory: "found it", similarity: 0.9 }], total: 1, timing: 100 } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const r = await pi.tools.supermemory_search.execute("tc1", { query: "test", scope: "both", includeProfile: true }, null, null, makeMockCtx());
    assert.ok(r.content[0].text.includes("found it"));
    assert.strictEqual(r.details.query, "test");
  });

  it("supermemory_save calls addMemory and returns id", async () => {
    const { client, calls } = makeMockClient({ add: { success: true, id: "saved-42" } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const r = await pi.tools.supermemory_save.execute("tc2", { content: "save this", scope: "project", type: "note" }, null, null, makeMockCtx());
    assert.ok(r.content[0].text.includes("saved-42"));
    assert.strictEqual(r.details.id, "saved-42");
    assert.strictEqual(calls.find(c => c[0] === "add")[3].type, "note");
  });

  it("supermemory_forget deletes matching memories", async () => {
    const { client, calls } = makeMockClient({ search: { success: true, results: [{ id: "d1", memory: "x", similarity: 0.9 }, { id: "d2", memory: "y", similarity: 0.8 }], total: 2 }, delete: { success: true } });
    const f = await wire(client); const pi = makeMockPi(); f(pi);
    const r = await pi.tools.supermemory_forget.execute("tc3", { description: "x" }, null, null, makeMockCtx());
    assert.ok(r.content[0].text.includes("Deleted"));
    assert.ok(r.details.deletedProject + r.details.deletedUser >= 2);
    assert.ok(calls.filter(c => c[0] === "delete").length >= 2);
  });
});
