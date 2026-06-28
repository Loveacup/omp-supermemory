---
name: supermemory-login
description: Log in to Supermemory. Use when the user needs to authenticate, set up their API key, or when memory features report a missing key.
---

# Supermemory Login

Log in to Supermemory to enable persistent memory across sessions.

## When to Use

- First-time setup
- User says "log in to supermemory" or "set up supermemory"
- Memory tools report "not configured"

## How to Use

Run the login script:

```
node <plugin-dir>/src/login.js
```

This opens a browser window to authenticate with Supermemory. If the browser does not open, the URL is printed in the terminal.

Alternatively, set the API key manually:

```
set SUPERMEMORY_API_KEY="sm_..."
```

Get your key at: https://console.supermemory.ai/keys