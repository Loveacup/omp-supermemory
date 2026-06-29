# omp-supermemory v2.0.0

Persistent memory for OMP — auto-recall, auto-save, and search/save/forget tools backed by [Supermemory](https://supermemory.ai).

## Features

| Feature | Mechanism | Status |
|---|---|---|
| **Auto-recall** | `pi.on("context")` — injects `## Relevant memory (Supermemory)` before every LLM turn | ✅ Verified (2026-06-29) |
| **Auto-save** | `pi.on("turn_end")` every N turns + `session_shutdown` flush | 单元测试 ✅ / 运行时待验证 |
| **Search** | `supermemory_search` — project, user, both scopes; optional profile injection | ✅ |
| **Save** | `supermemory_save` — save to project or user container with type classification | ✅ |
| **Forget** | `supermemory_forget` — search + delete matching memories across both pools | ✅ |

## Quick Install

```bash
cd omp-supermemory
npm install
omp plugin link .
omp plugin list          # verify
```

Requires OMP ≥ 16.1.x. The extension auto-loads via `package.json` → `omp.extensions: ["./src/index.js"]`.

## Login

Browser OAuth (recommended):

```bash
node src/login.js
```

Opens `https://console.supermemory.ai/auth/agent-connect`, captures the `sm_*` API key via localhost callback, and saves it to `~/.omp/supermemory/credentials.json`.

Or set the key manually:

```bash
set SUPERMEMORY_API_KEY=sm_...
```

Get your key at [console.supermemory.ai/keys](https://console.supermemory.ai/keys).

## Configuration

All settings live at `~/.omp/supermemory.json`.

| Key | Type | Default | Description |
|---|---|---|---|
| `autoRecallEveryPrompt` | `boolean` | `true` | Inject relevant memories before every LLM turn |
| `captureEveryNTurns` | `number` | `3` | Auto-save transcript every N user-assistant turn pairs |
| `maxMemories` | `number` | `5` | Max user-scope memories injected per recall |
| `maxProjectMemories` | `number` | `10` | Max project-scope memories injected per recall |
| `maxProfileItems` | `number` | `5` | Max profile items injected per recall |
| `injectProfile` | `boolean` | `true` | Include Supermemory profile in recall context |
| `similarityThreshold` | `number` | `0.6` | Minimum similarity score for search matches |
| `recallDedupMs` | `number` | `30000` | Suppress duplicate queries within this window |
| `recallBudgetMs` | `number` | `8000` | Per-search timeout in milliseconds |
| `containerTagPrefix` | `string` | `"omp"` | Prefix for Supermemory container tags |
| `projectContainerTag` | `string` | `null` | Override auto-derived project tag (SHA16 hash) |
| `userContainerTag` | `string` | `null` | Override auto-derived user tag (SHA16 hash) |

Minimal config:

```json
{
  "autoRecallEveryPrompt": true,
  "captureEveryNTurns": 3,
  "maxProjectMemories": 10,
  "containerTagPrefix": "omp"
}
```

### Config precedence

`SUPERMEMORY_API_KEY` env → `supermemory.json` `apiKey` → `credentials.json` `apiKey`

> **Security:** Prefer `SUPERMEMORY_API_KEY` env var or `~/.omp/supermemory/credentials.json`. The `supermemory.json` `apiKey` path exists for compatibility but risks accidental exposure if the config file is copied or shared.

## Tools Reference

### `supermemory_search`

Search memories across project, user, or both scopes.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `string` | *(required)* | Natural language search query |
| `scope` | `"user"` \| `"project"` \| `"both"` | `"both"` | Container scope |
| `includeProfile` | `boolean` | `true` | Include Supermemory profile in results |

### `supermemory_save`

Save content to a container.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | *(required)* | Text content to store |
| `scope` | `"user"` \| `"project"` | `"project"` | Target container |
| `type` | `string` | `"note"` | Classification: `note`, `architecture`, `error-solution`, `preference`, `learned-pattern`, `conversation` |

### `supermemory_forget`

Search and delete matching memories from both containers.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `description` | `string` | *(required)* | Search query to find memories to delete |

> **Note:** `forget` searches both project and user pools simultaneously and deletes all matches. There is no `scope` parameter — consider this before using.

## Architecture

```
src/
├── index.js         # Extension factory: pi.on("context"/"turn_end"/"session_shutdown") + tool registration
├── config.js        # Frozen CONFIG object; reads ~/.omp/supermemory.json
├── tags.js          # Container tag derivation (SHA16 hash of machine + path)
├── client.js        # SupermemoryClient: search, add, delete, getProfile
├── internals.js     # getClient() / setClient() — enables test injection
└── login.js         # Standalone OAuth login (localhost HTTP callback)
skills/
├── supermemory-search/SKILL.md
├── supermemory-save/SKILL.md
├── supermemory-forget/SKILL.md
└── supermemory-login/SKILL.md
tests/               # 46 tests, all passing
```

### Design decisions

- **Single extension** — one `src/index.js` factory replacing dual codex + omp hook systems
- **Test injection** — `internals.js` `setClient()` allows mock client injection without touching the real SDK
- **Fail-open** — all handlers and SDK calls are wrapped in try/catch; never block conversation
- **Auto-derived tags** — container tags are SHA16 hashes of machine identity + working directory, overridable via config
- **30s dedup** — auto-recall suppresses identical queries within the dedup window

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SUPERMEMORY_API_KEY` | — | API key (highest priority) |
| `SUPERMEMORY_AUTH_URL` | `https://console.supermemory.ai/auth/agent-connect` | OAuth redirect base |
| `SUPERMEMORY_AUTH_TIMEOUT` | `60000` | OAuth callback timeout (ms) |
| `SUPERMEMORY_RECALL_NO_GATE` | — | Set to `1` to disable recall storm guard |
| `SUPERMEMORY_RECALL_GATE_MS` | `12000` | Recall storm guard window (ms) |

## Development

```bash
npm test                # 46 tests
node --test tests/index.test.js   # extension factory tests only
node --test tests/client.test.js  # client tests only
```

### Running tests in isolation

Some tests (`login.test.js`, `tags.test.js`) depend on `process.cwd()` for relative path resolution. Always run from the project root.

## Known Limitations

1. **`supermemory_forget` has no `scope` parameter** — deletes matches from both project and user pools simultaneously. May be too aggressive.
2. **Tests require project-root cwd** — path-dependent tests need to be run from the repo root.
3. **OMP restart required after source changes** — the extension module is loaded at session start; edits to `src/index.js` take effect on next OMP launch.

## License

MIT
