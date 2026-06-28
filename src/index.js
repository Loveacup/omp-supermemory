// src/index.js — OMP Supermemory plugin extension factory.
// Auto-recall: injects relevant memories before each LLM turn via pi.on("context").
// Auto-save: captures transcript periodically via pi.on("turn_end") + final flush on session_shutdown.
// Tools: supermemory_search, supermemory_save, supermemory_forget.
import { getClient } from "./internals.js";
import { getTags } from "./tags.js";
import { CONFIG } from "./config.js";
let lastCapturedEntryId = null;
let turnsSinceCapture = 0;

// Module-scoped recall dedup state
let lastQuery = "";
let lastQueryTs = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractQuery(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    if (!msg.content) continue;
    if (typeof msg.content === "string") return msg.content.trim();
    if (Array.isArray(msg.content)) {
      const text = msg.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

async function captureNew(ctx) {
  if (!CONFIG.isConfigured()) return;

  const branch = ctx.sessionManager.getBranch();
  if (!branch || branch.length === 0) return;

  // Collect new entries since last capture
  const newEntries = [];
  let foundLast = !lastCapturedEntryId; // if no lastId, collect from start
  for (const entry of branch) {
    if (!foundLast) {
      if (entry.id === lastCapturedEntryId || entry.customType === "supermemory-capture" && entry.data?.lastId === lastCapturedEntryId) {
        foundLast = true;
      }
      continue;
    }
    if (entry.type === "user" || entry.type === "assistant") {
      const text = typeof entry.content === "string"
        ? entry.content
        : Array.isArray(entry.content)
          ? entry.content.filter(c => c.type === "text").map(c => c.text).join(" ")
          : "";
      if (text.trim()) {
        newEntries.push({ role: entry.type, text });
      }
    }
  }

  if (newEntries.length === 0) return;

  const transcript = newEntries
    .map(e => `[${e.role}]: ${e.text}`)
    .join("\n");

  const sessionId = ctx.sessionManager?.getSessionFile
    ? ctx.sessionManager.getSessionFile().split("/").pop()?.replace(/\.jsonl?$/, "") || "unknown"
    : "unknown";

  const tags = getTags(ctx.cwd);
  const content = "`[Session " + sessionId + "]\n" + transcript + "`";

  const result = await getClient().addMemory(content, tags.project, {
    type: "conversation",
    sessionId,
  });

  if (result.success) {
    const lastId = branch[branch.length - 1]?.id || null;
    pi.appendEntry("supermemory-capture", { lastId, at: Date.now() });
    lastCapturedEntryId = lastId;
  }
}

let pi; // captured from factory for use in captureNew

// ── Factory ───────────────────────────────────────────────────────────────────

export default function (piRef) {
  pi = piRef;
  const { z } = pi.zod;

  pi.setLabel("Supermemory");
  // ── Auto-recall: inject context before each LLM turn ────────────────────
  pi.on("context", async (event, ctx) => {
    try {
      if (!CONFIG.isConfigured() || !CONFIG.autoRecallEveryPrompt) return;

      const query = extractQuery(event.messages || []);
      if (!query) return;

      // Dedup
      const now = Date.now();
      if (query === lastQuery && now - lastQueryTs < CONFIG.recallDedupMs) return;
      lastQuery = query;
      lastQueryTs = now;

      const tags = getTags(ctx.cwd);
      const budget = CONFIG.recallBudgetMs;

      // Parallel: search project + user + profile
      const [projectResult, userResult, profileResult] = await Promise.all([
        getClient().searchMemories(query, tags.project, { timeoutMs: budget }),
        getClient().searchMemories(query, tags.user, { timeoutMs: budget }),
        CONFIG.injectProfile
          ? getClient().getProfile(tags.user, query, { timeoutMs: budget })
          : Promise.resolve(null),
      ]);

      // Build context block
      const lines = [];
      lines.push("## Relevant memory (Supermemory)");

      if (projectResult.success && projectResult.results.length > 0) {
        lines.push("**Project memories:**");
        for (const r of projectResult.results.slice(0, CONFIG.maxProjectMemories)) {
          const mem = r.memory.length > 200 ? r.memory.slice(0, 200) + "..." : r.memory;
          lines.push(`- ${mem}`);
        }
      }

      if (userResult.success && userResult.results.length > 0) {
        lines.push("**User memories:**");
        for (const r of userResult.results.slice(0, CONFIG.maxMemories)) {
          const mem = r.memory.length > 200 ? r.memory.slice(0, 200) + "..." : r.memory;
          lines.push(`- ${mem}`);
        }
      }

      if (profileResult?.success && profileResult.profile?.length > 0) {
        const items = profileResult.profile.slice(0, CONFIG.maxProfileItems);
        const profileText = items.map(p => p.content || p.text || "").filter(Boolean).join("; ");
        if (profileText) lines.push(`**Profile:** ${profileText}`);
      }

      if (lines.length === 1) return; // just the header, nothing found

      return {
        messages: [
          { role: "system", content: lines.join("\n") },
          ...event.messages,
        ],
      };
    } catch {
      // Never block context assembly
    }
  });

  // ── Auto-save: session lifecycle ────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    try {
      // Rebuild lastCapturedEntryId from branch entries
      const branch = ctx.sessionManager.getBranch();
      lastCapturedEntryId = null;
      turnsSinceCapture = 0;

      for (let i = branch.length - 1; i >= 0; i--) {
        const entry = branch[i];
        if (entry.type === "custom" && entry.customType === "supermemory-capture") {
          lastCapturedEntryId = entry.data?.lastId || null;
          break;
        }
      }
    } catch {
      // Fail-open
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    try {
      turnsSinceCapture++;
      if (turnsSinceCapture >= CONFIG.captureEveryNTurns) {
        await captureNew(ctx);
        turnsSinceCapture = 0;
      }
    } catch {
      // Fail-open
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    try {
      await captureNew(ctx);
    } catch {
      // Never block shutdown
    }
  });

  // ── Tools ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "supermemory_search",
    label: "Search Supermemory",
    description: "Search your Supermemory knowledge base across project and user containers.",
    parameters: z.object({
      query: z.string().describe("Search query"),
      scope: z.enum(["user", "project", "both"]).default("both"),
      includeProfile: z.boolean().default(true),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!CONFIG.isConfigured()) {
        return {
          content: [{ type: "text", text: "Supermemory not configured — run the supermemory-login skill to authenticate." }],
          details: { query: params.query, configured: false },
        };
      }

      const tags = getTags(ctx.cwd);
      const results = { project: null, user: null, profile: null };

      if (params.scope === "project" || params.scope === "both") {
        results.project = await getClient().searchMemories(params.query, tags.project);
      }
      if (params.scope === "user" || params.scope === "both") {
        results.user = await getClient().searchMemories(params.query, tags.user);
      }
      if (params.includeProfile && (params.scope === "user" || params.scope === "both")) {
        results.profile = await getClient().getProfile(tags.user, params.query);
      }

      const lines = [];
      lines.push(`**Supermemory results for:** "${params.query}"`);

      if (results.project?.success && results.project.results.length > 0) {
        lines.push("\n**Project memories:**");
        for (const r of results.project.results) {
          lines.push(`- ${r.memory}`);
        }
      }
      if (results.user?.success && results.user.results.length > 0) {
        lines.push("\n**User memories:**");
        for (const r of results.user.results) {
          lines.push(`- ${r.memory}`);
        }
      }
      if (results.profile?.success && results.profile.profile?.length > 0) {
        lines.push("\n**Profile:**");
        for (const p of results.profile.profile.slice(0, CONFIG.maxProfileItems)) {
          lines.push(`- ${p.content || p.text || ""}`);
        }
      }

      if (lines.length === 1) {
        lines.push("\nNo memories found.");
      }

      // Check for errors
      const errors = [];
      if (results.project && !results.project.success) errors.push("project search failed: " + results.project.error);
      if (results.user && !results.user.success) errors.push("user search failed: " + results.user.error);
      if (results.profile && !results.profile.success) errors.push("profile failed: " + results.profile.error);
      if (errors.length > 0) {
        lines.push("\n**Errors:** " + errors.join("; "));
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
          query: params.query,
          scope: params.scope,
          projectHits: results.project?.total || 0,
          userHits: results.user?.total || 0,
        },
      };
    },
  });

  pi.registerTool({
    name: "supermemory_save",
    label: "Save to Supermemory",
    description: "Save important project knowledge to Supermemory for persistence across sessions.",
    parameters: z.object({
      content: z.string().describe("Content to save"),
      scope: z.enum(["user", "project"]).default("project"),
      type: z.string().default("note"),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!CONFIG.isConfigured()) {
        return {
          content: [{ type: "text", text: "Supermemory not configured — run the supermemory-login skill to authenticate." }],
          details: { configured: false },
        };
      }

      const tags = getTags(ctx.cwd);
      const containerTag = params.scope === "user" ? tags.user : tags.project;
      const result = await getClient().addMemory(params.content, containerTag, {
        type: params.type,
        sm_capture_mode: "tool",
      });

      if (result.success) {
        return {
          content: [{ type: "text", text: `Saved to Supermemory (${params.scope}): ${result.id}` }],
          details: { id: result.id, scope: params.scope, type: params.type },
        };
      }
      return {
        content: [{ type: "text", text: `Failed to save: ${result.error}` }],
        details: { error: result.error, scope: params.scope },
      };
    },
  });

  pi.registerTool({
    name: "supermemory_forget",
    label: "Forget from Supermemory",
    description: "Remove outdated or incorrect information from Supermemory.",
    parameters: z.object({
      description: z.string().describe("Description of what to forget (used as search query)"),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!CONFIG.isConfigured()) {
        return {
          content: [{ type: "text", text: "Supermemory not configured — run the supermemory-login skill to authenticate." }],
          details: { configured: false },
        };
      }

      const tags = getTags(ctx.cwd);

      // Search both containers
      const [projectSearch, userSearch] = await Promise.all([
        getClient().searchMemories(params.description, tags.project),
        getClient().searchMemories(params.description, tags.user),
      ]);

      const projectIds = (projectSearch.results || []).map(r => r.id);
      const userIds = (userSearch.results || []).map(r => r.id);

      let deletedProject = 0;
      let deletedUser = 0;
      const errors = [];

      for (const id of projectIds) {
        const r = await getClient().deleteMemory(id);
        if (r.success) deletedProject++; else errors.push(r.error);
      }
      for (const id of userIds) {
        const r = await getClient().deleteMemory(id);
        if (r.success) deletedUser++; else errors.push(r.error);
      }

      const total = deletedProject + deletedUser;
      const lines = [];
      if (total > 0) {
        lines.push(`Deleted ${total} memories (${deletedProject} project, ${deletedUser} user).`);
      } else {
        lines.push("No matching memories found to delete.");
      }
      if (errors.length > 0) {
        lines.push(`Errors: ${errors.join("; ")}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { deletedProject, deletedUser, errors },
      };
    },
  });
 }
