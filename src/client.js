// src/client.js — Single Supermemory SDK wrapper for OMP plugin.
// Creates a singleton client, wraps all SDK calls with fail-open error handling.
// Exposes SupermemoryClient class for test injection.
import Supermemory from "supermemory";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFIG } from "./config.js";

const DEFAULT_TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}

function detectSourceTag() {
  if (process.env.SUPERMEMORY_SOURCE) return process.env.SUPERMEMORY_SOURCE;
  if (process.env.OMP_SOURCE) return process.env.OMP_SOURCE;
  const isOMP = !!process.env.OMP_HOME || fs.existsSync(path.join(os.homedir(), ".omp", "agent"));
  const runtime = isOMP ? "omp" : "codex";
  const machine = process.env.OMP_MACHINE_NAME
    || process.env.SUPERMEMORY_MACHINE
    || { darwin: "macbook", win32: "windows", linux: "linux" }[os.platform()]
    || os.hostname().split(".")[0].toLowerCase();
  return `${runtime}-${machine}`;
}

const SOURCE_TAG = detectSourceTag();

class SupermemoryClient {
  #client = null;

  constructor(sdk) {
    if (sdk) {
      this.#client = sdk;
    }
  }

  get sourceTag() {
    return SOURCE_TAG;
  }

  getClient() {
    if (!this.#client) {
      if (!CONFIG.isConfigured()) {
        throw new Error("SUPERMEMORY_API_KEY not configured");
      }
      this.#client = new Supermemory({
        apiKey: CONFIG.getApiKeyValue(),
        defaultHeaders: { "x-sm-source": SOURCE_TAG },
      });
    }
    return this.#client;
  }

  // ── V3: cross-pool compatible ──────────────────────────────────────────

  async searchMemories(query, containerTag, opts = {}) {
    try {
      const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
      const result = await withTimeout(
        this.getClient().search.documents({
          q: query,
          containerTags: [containerTag],
          limit: CONFIG.maxMemories,
        }),
        timeoutMs
      );
      const flatResults = (result.results || []).flatMap((r) =>
        (r.chunks || []).map((chunk) => ({
          id: r.documentId,
          memory: chunk.content || "",
          similarity: chunk.score || r.score || 0,
        }))
      );
      return {
        success: true,
        results: flatResults,
        total: flatResults.length,
        timing: result.timing || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
        results: [],
        total: 0,
        timing: 0,
      };
    }
  }

  async addMemory(content, containerTag, metadata) {
    try {
      const result = await withTimeout(
        this.getClient().add({
          content,
          containerTag,
          metadata: {
            sm_source: SOURCE_TAG,
            sm_capture_mode: "tool",
            ...(metadata || {}),
          },
        }),
        DEFAULT_TIMEOUT_MS
      );
      return { success: true, id: result.id };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  // ── V4: V3 has no equivalent ──────────────────────────────────────────

  async getProfile(containerTag, query, opts = {}) {
    try {
      const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
      const result = await withTimeout(
        this.getClient().profile({ containerTag, q: query || undefined }),
        timeoutMs
      );
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
        profile: null,
      };
    }
  }

  async deleteMemory(memoryId) {
    try {
      await withTimeout(
        this.getClient().documents.delete(memoryId),
        DEFAULT_TIMEOUT_MS
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  async listMemories(containerTag, limit) {
    try {
      const result = await withTimeout(
        this.getClient().documents.list({
          containerTags: [containerTag],
          limit: limit || CONFIG.maxProjectMemories,
          order: "desc",
          sort: "createdAt",
          includeContent: true,
        }),
        DEFAULT_TIMEOUT_MS
      );
      return {
        success: true,
        memories: result.memories || [],
        pagination: result.pagination || {},
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
        memories: [],
        pagination: { currentPage: 1, totalItems: 0, totalPages: 0 },
      };
    }
  }
}

const supermemoryClient = new SupermemoryClient();

export { SupermemoryClient, supermemoryClient };
