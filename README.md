# OMP Supermemory

OpenCode 插件架构对齐的 OMP Supermemory 集成。纯 Hook + Skill + Standalone Script，**无 MCP**。

## 架构

```
OpenCode 插件                    OMP Supermemory
─────────────────────────────────────────────────
tool: supermemory (单 tool)  →  Skills (4 md) + Standalone Scripts
chat.message handler         →  recall.js (UserPromptSubmit hook)
compaction hook              →  flush.js (Stop hook)
supermemory.jsonc            →  config.js 模块
```

## 文件说明

```
supermemory/           → 安装到 ~/.omp/supermemory/
├── config.js          配置模块（OpenCode 兼容 + jsonc 支持）
├── tags.js            双容器标签生成（user + project）
├── supermemory-client.js  共享 V3/V4 客户端
├── recall.js          Hook: 上下文注入 + keyword nudge
├── flush.js           Hook: 自动保存 + compaction
├── search-memory.js   独立搜索脚本
├── save-memory.js     独立保存脚本（支持 --type --scope）
└── forget-memory.js   独立删除脚本

skills/                → 安装到 ~/.omp/agent/skills/
├── supermemory-search.md
├── supermemory-save.md
├── supermemory-list.md
└── supermemory-forget.md

hooks/                 → 安装到 ~/.omp/agent/hooks/
├── pre/recall.json    UserPromptSubmit hook
└── post/flush.json    Stop hook
```

## API 策略

| 操作 | API | 版本 | 原因 |
|------|-----|------|------|
| 搜索 | `search.documents()` | V3 | 跨池兼容（搜到 V3+V4） |
| 保存 | `client.add()` | V3 | sm_source 进 filter 索引 |
| Profile | `client.profile()` | V4 | V3 无等价 |
| 删除 | `memories.delete()` | V4 | V3 无等价 |

## 安装

### 前置条件

1. Node.js ≥ 18
2. OMP (Oh My Pi) 已安装
3. Supermemory API key（运行 `node supermemory/auth-login.js` 获取）

### Windows

```cmd
install.bat
```

### Mac/Linux

```bash
bash install.sh
```

### 手动安装

1. 复制 `supermemory/` 所有文件到 `~/.omp/supermemory/`
2. 复制 `skills/*.md` 到 `~/.omp/agent/skills/`
3. 复制 `hooks/pre/recall.json` 到 `~/.omp/agent/hooks/pre/`
4. 复制 `hooks/post/flush.json` 到 `~/.omp/agent/hooks/post/`
5. 创建 SDK symlink:
   ```bash
   mkdir -p ~/.omp/supermemory/node_modules
   ln -s ~/.codex/supermemory/node_modules/supermemory ~/.omp/supermemory/node_modules/supermemory
   ```
   或用 npm: `cd ~/.omp/supermemory && npm install supermemory`
6. 编辑 `~/.omp/supermemory.json` 设置容器标签

### 配置示例 (`~/.omp/supermemory.json`)

```json
{
  "containerTagPrefix": "omp",
  "projectContainerTag": "sm_project_cli",
  "compactionThreshold": 0.80,
  "autoRecallEveryPrompt": true,
  "captureEveryNTurns": 3,
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "maxProfileItems": 5,
  "similarityThreshold": 0.6,
  "keywordPatterns": ["remember", "save this", "note this", "keep in mind"]
}
```

## 使用

### Agent 自动

- 每次用户输入，recall.js 自动注入上下文
- 关键词检测到"remember"等触发 nudge 提示
- 每次 Stop，flush.js 自动保存记忆

### 手动搜索

```
node C:/Users/<user>/.omp/supermemory/search-memory.js "查询内容"
```

### 手动保存

```
node C:/Users/<user>/.omp/supermemory/save-memory.js "内容" --type=architecture --scope=project
```

类型：project-config, architecture, error-solution, preference, learned-pattern, conversation

## 对比 OpenCode 官方插件

| 功能 | OpenCode | OMP |
|------|----------|-----|
| 单 tool 模式 | ✅ tool | ✅ Skills + Scripts |
| 上下文注入 | ✅ chat.message | ✅ recall hook |
| Compaction | ✅ | ✅ flush hook |
| 双容器 | ✅ | ✅ tags.js |
| 记忆类型 | ✅ | ✅ --type 参数 |
| Keyword nudge | ✅ | ✅ recall |
| 设备来源标签 | ❌ 固定 | ✅ 自动检测 |
| V3 跨池 | ❌ | ✅ |
| V4 搜索 | ✅ | ❌（跨池不兼容） |
