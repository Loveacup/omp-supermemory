---
name: supermemory-forget
description: Remove outdated or incorrect information from Supermemory.
---

# Supermemory Forget

Remove outdated or incorrect information from Supermemory.

## When to Use

- User says "forget that" or "delete that memory"
- Information is no longer accurate
- User wants to remove a specific memory

## How to Use

Call the `supermemory_forget` tool with a description of what to forget. The tool searches both project and user containers for matching memories and deletes them, reporting the count of deleted items.