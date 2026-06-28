---
name: supermemory-save
description: Save important project knowledge to Supermemory for persistence across sessions.
---

# Supermemory Save

Save important project knowledge to Supermemory for persistence across sessions.

## When to Use

- User explicitly asks to save or remember something
- Architecture decisions, bug fixes, user preferences, design patterns
- Important implementation details for future reference

## How to Use

Call the `supermemory_save` tool with the content and optional params:

- `content` — the content to save
- `scope: "project"` (default) or `"user"` for cross-project personal knowledge
- `type` — memory classification: `"note"` (default), `"architecture"`, `"error-solution"`, `"preference"`, `"learned-pattern"`, `"conversation"`

The tool returns the saved memory ID on success.