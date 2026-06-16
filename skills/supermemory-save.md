# Supermemory Save

Save important project knowledge to Supermemory for persistence across sessions.

## When to Use

- User explicitly asks to save or remember something
- Architecture decisions, bug fixes, user preferences, design patterns
- Important implementation details for future reference

## How to Save

Run:
```
node ~/.omp/supermemory/save-memory.js "<content>"
```

Optional flags:
- `--scope user` — cross-project personal knowledge (preferences, habits)
- `--scope project` — project-specific knowledge (default)
- `--type <type>` — memory classification

## Memory Types

- `project-config` — build tools, environment setup, dependencies
- `architecture` — system design, component structure, data flow
- `error-solution` — bug fixes, error messages, troubleshooting
- `preference` — user preferences, coding style, conventions
- `learned-pattern` — reusable patterns, idioms, best practices
- `conversation` — session summaries, discussion outcomes
