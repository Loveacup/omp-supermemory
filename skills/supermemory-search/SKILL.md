---
name: supermemory-search
description: Search your Supermemory knowledge base for past coding sessions, saved knowledge, decisions, and preferences.
---

# Supermemory Search

Search your Supermemory knowledge base for past coding sessions, saved knowledge, decisions, and preferences.

## When to Use

- User asks about past decisions, discussions, or code
- User says "remember when..." or "what did we decide about..."
- You need context from previous sessions

## How to Use

Call the `supermemory_search` tool with a query and optional scope:

- `scope: "both"` — searches both project and user containers (default)
- `scope: "project"` — project-specific only
- `scope: "user"` — personal/cross-project only

The tool returns matching memories with content and relevance. Profile information is included by default.