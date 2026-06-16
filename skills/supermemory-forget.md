# Supermemory Forget

Remove outdated or incorrect information from Supermemory.

## When to Use

- User says "forget that" or "delete that memory"
- Information is no longer accurate
- User wants to remove a specific memory

## How to Forget

Run:
```
node ~/.omp/supermemory/forget-memory.js "<query>" --scope <scope>
```

- `--scope user` — personal memories
- `--scope project` — project-specific (default)

The script will search for matching memories and delete them.
