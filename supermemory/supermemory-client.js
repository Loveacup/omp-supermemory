"use strict";

const Supermemory = require("supermemory");
const { CONFIG } = require("./config.js");

const TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}

class SupermemoryClient {
  #client = null;

  getClient() {
    if (!this.#client) {
      if (!CONFIG.isConfigured()) {
        throw new Error("SUPERMEMORY_API_KEY not configured");
      }
      this.#client = new Supermemory({
        apiKey: CONFIG.getApiKeyValue(),
        defaultHeaders: { "x-sm-source": "omp" },
      });
    }
    return this.#client;
  }

  // ── V3: cross-pool compatible ──────────────────────────

  async searchMemories(query, containerTag) {
    try {
      const result = await withTimeout(
        this.getClient().search.documents({
          q: query,
          containerTags: [containerTag],
          limit: CONFIG.maxMemories,
        }),
        TIMEOUT_MS
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
            sm_source: "omp",
            sm_capture_mode: "tool",
            ...(metadata || {}),
          },
        }),
        TIMEOUT_MS
      );
      return { success: true, id: result.id };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  // ── V4: V3 has no equivalent ────────────────────────────

  async getProfile(containerTag, query) {
    try {
      const result = await withTimeout(
        this.getClient().profile({ containerTag, q: query || undefined }),
        TIMEOUT_MS
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
        TIMEOUT_MS
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
        TIMEOUT_MS
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

module.exports = {
  SupermemoryClient,
  supermemoryClient: new SupermemoryClient(),
};
