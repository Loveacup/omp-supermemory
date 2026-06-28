# omp-supermemory v2.0.0

Persistent Supermemory for OMP — auto-recall, auto-save, and search/save/forget tools.

## Install

```bash
# Clone or navigate to the repo
cd omp-supermemory

# Install dependencies
npm install

# Link as OMP plugin
omp plugin link .

# Verify
omp plugin list
```

## Configure

Settings live at `~/.omp/supermemory.json`:

```json
{
  "captureEveryNTurns": 3,
  "autoRecallEveryPrompt": true,
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "containerTagPrefix": "omp",
  "projectContainerTag": "sm_project_cli"
}
```

API key stored at `~/.omp/supermemory/credentials.json` (or set `SUPERMEMORY_API_KEY` env var).

## Login

```bash
node src/login.js
```

Or run the `supermemory-login` skill from within OMP.

## Tools

| Tool | Description |
|------|-------------|
| `supermemory_search` | Search memories by query, scope, include profile |
| `supermemory_save` | Save content to project or user container |
| `supermemory_forget` | Delete memories matching a description |

## Auto-features

- **Auto-recall**: Relevant memories injected before each LLM turn
- **Auto-save**: Transcript captured every N turns + on session shutdown

## Development

```bash
npm test
```
