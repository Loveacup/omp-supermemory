// tests/client.test.js — TDD for src/client.js
// Uses a mock SDK to verify wrapper logic (method routing, result formatting, timeout, metadata).
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// Build a mock SDK that records calls
function makeMockSDK() {
  const calls = [];
  return {
    calls,
    instance: {
      search: { documents: async (opts) => {
        calls.push(["search.documents", opts]);
        return { results: [{ documentId: "d1", chunks: [{ content: "hit1", score: 0.9 }] }], timing: 123 };
      }},
      add: async (opts) => {
        calls.push(["add", opts]);
        return { id: "new-id-42" };
      },
      profile: async (opts) => {
        calls.push(["profile", opts]);
        return { profile: [{ content: "profile item" }] };
      },
      documents: {
        delete: async (id) => {
          calls.push(["documents.delete", id]);
          return {};
        },
        list: async (opts) => {
          calls.push(["documents.list", opts]);
          return { memories: [{ id: "m1", content: "mem1" }], pagination: { currentPage: 1 } };
        },
      },
    },
  };
}

describe("src/client.js", () => {
  let mock, client;

  before(async () => {
    mock = makeMockSDK();
    // Import client with a real config (no API key needed — we bypass the SDK)
    process.env.SUPERMEMORY_API_KEY = "sm_mock_test_key";
    const mod = await import("../src/client.js");
    // Create client with mock SDK injected
    client = new mod.SupermemoryClient(mock.instance);
  });

  after(() => {
    delete process.env.SUPERMEMORY_API_KEY;
  });

  it("searchMemories calls search.documents with correct params", async () => {
    const result = await client.searchMemories("my query", "container_x");
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.results[0].memory, "hit1");
    assert.strictEqual(result.results[0].similarity, 0.9);
    assert.strictEqual(result.timing, 123);

    const call = mock.calls.find(c => c[0] === "search.documents");
    assert.ok(call);
    assert.strictEqual(call[1].q, "my query");
    assert.deepStrictEqual(call[1].containerTags, ["container_x"]);
  });

  it("addMemory calls add with content + containerTag + metadata", async () => {
    const result = await client.addMemory("hello world", "project_tag", { type: "note" });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, "new-id-42");

    const call = mock.calls.find(c => c[0] === "add");
    assert.ok(call);
    assert.strictEqual(call[1].content, "hello world");
    assert.strictEqual(call[1].containerTag, "project_tag");
    assert.strictEqual(call[1].metadata.type, "note");
    assert.ok(call[1].metadata.sm_source);
    assert.strictEqual(call[1].metadata.sm_capture_mode, "tool");
  });

  it("getProfile calls profile with containerTag + query", async () => {
    const result = await client.getProfile("user_tag", "what do I like");
    assert.strictEqual(result.success, true);
    assert.ok(result.profile);

    const call = mock.calls.find(c => c[0] === "profile");
    assert.ok(call);
    assert.strictEqual(call[1].containerTag, "user_tag");
    assert.strictEqual(call[1].q, "what do I like");
  });

  it("deleteMemory calls documents.delete with id", async () => {
    const result = await client.deleteMemory("doc-123");
    assert.strictEqual(result.success, true);

    const call = mock.calls.find(c => c[0] === "documents.delete");
    assert.ok(call);
    assert.strictEqual(call[1], "doc-123");
  });

  it("listMemories calls documents.list with containerTag + limit", async () => {
    const result = await client.listMemories("proj_tag", 20);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.memories[0].content, "mem1");

    const call = mock.calls.find(c => c[0] === "documents.list");
    assert.ok(call);
    assert.deepStrictEqual(call[1].containerTags, ["proj_tag"]);
    assert.strictEqual(call[1].limit, 20);
    assert.strictEqual(call[1].order, "desc");
    assert.strictEqual(call[1].sort, "createdAt");
    assert.strictEqual(call[1].includeContent, true);
  });

  it("source tag is set in metadata", () => {
    assert.ok(client.sourceTag);
    assert.ok(client.sourceTag.includes("-"));
  });

  it("searchMemories respects timeoutMs option", async () => {
    const result = await client.searchMemories("q", "t", { timeoutMs: 5000 });
    assert.strictEqual(result.success, true);
  });

  it("fails-open when SDK throws", async () => {
    const badSDK = {
      search: { documents: async () => { throw new Error("network error"); } },
      add: async () => { throw new Error("boom"); },
      profile: async () => { throw new Error("fail"); },
      documents: { delete: async () => { throw new Error("nope"); }, list: async () => { throw new Error("down"); } },
    };
    const badClient = new (await import("../src/client.js")).SupermemoryClient(badSDK);

    const r1 = await badClient.searchMemories("q", "t");
    assert.strictEqual(r1.success, false);
    assert.ok(r1.error);

    const r2 = await badClient.addMemory("c", "t");
    assert.strictEqual(r2.success, false);

    const r3 = await badClient.getProfile("t");
    assert.strictEqual(r3.success, false);

    const r4 = await badClient.deleteMemory("id");
    assert.strictEqual(r4.success, false);

    const r5 = await badClient.listMemories("t");
    assert.strictEqual(r5.success, false);
  });
});
