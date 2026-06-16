#!/usr/bin/env node
"use strict";

const { supermemoryClient } = require("./supermemory-client.js");
const { getTags } = require("./tags.js");

async function main() {
  const content = process.argv.slice(2).join(" ");
  if (!content.trim()) {
    console.log('No content provided. Usage: node forget-memory.js "content to forget"');
    process.exit(0);
  }

  const tags = getTags(process.cwd());

  try {
    // Search project memories first, find matching IDs, then delete
    const projectSearch = await supermemoryClient.searchMemories(content, tags.project);
    const userSearch = await supermemoryClient.searchMemories(content, tags.user);

    const projectIds = (projectSearch.results || []).map(r => r.id);
    const userIds = (userSearch.results || []).map(r => r.id);

    const results = [];

    for (const id of projectIds) {
      const r = await supermemoryClient.deleteMemory(id);
      results.push({ container: "project", id, success: r.success });
    }
    for (const id of userIds) {
      const r = await supermemoryClient.deleteMemory(id);
      results.push({ container: "user", id, success: r.success });
    }

    const deleted = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (deleted.length > 0) {
      console.log(`Deleted ${deleted.length} memories: ${deleted.map(d => d.id.slice(0,10) + '... (' + d.container + ')').join(', ')}`);
    }
    if (failed.length > 0) {
      console.log(`Failed to delete ${failed.length} memories`);
    }
    if (deleted.length === 0 && failed.length === 0) {
      console.log("No matching memories found to delete.");
    }
  } catch (error) {
    console.log(`Failed to forget memory: ${error.message || String(error)}`);
  }
}

main().catch((error) => {
  console.log(`Failed to forget memory: ${error.message || String(error)}`);
});
