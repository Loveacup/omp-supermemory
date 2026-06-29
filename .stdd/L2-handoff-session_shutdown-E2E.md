# Supermemory v2.0.1 STDD 交接简报

## 本次会话完成

### 修复 1: `supermemory_forget` scope 参数
- `src/index.js`：新增 `scope: "user"|"project"|"both"`，默认 `"both"`
- 对齐 `search`/`save` 接口
- 51 tests green（T1-T3 新 scope 测试）

### 修复 2: `session_shutdown` 1.8s deadline
- `src/index.js:194-202`：`Promise.race(captureNew(ctx), timeout(1800ms))`
- 防止 host 2s 硬杀导致 transcript 静默丢失
- 51 tests green（T5 超时兜底，T6 正常写入）

### 交付
- GitHub: 4 commits pushed to `master` (`Loveacup/omp-supermemory`)
- README + Obsidian 更新

## 待新 session 验证

### P0: session_shutdown E2E
```
1. 重启 OMP（加载新扩展）
2. 对话几轮 → /exit 正常退出
3. grep "Extension handler timed out.*session_shutdown" ~/.omp/logs/omp.YYYY-MM-DD.log
```
预期：无新 warning。本次 `-p` / `--mode rpc` 通道未观测到 `session_shutdown` 事件，建议交互式 session 退出后核查。

### P1: auto-recall 重复注入检测
多轮对话观察 `## Relevant memory` 是否重复。

### P2: forget 404
`deleteMemory` 走 V4 API，未验证返回码。注意 V3 search ↔ V4 delete 索引一致性。

## 关键路径
- 仓库: `C:/Users/anyis/projects/omp-supermemory/`
- 扩展: `~/.omp/agent/extensions/supermemory-hooks.js` → import 源码
- 测试: `node --test tests/*.test.js`
- Obsidian: `OMP-Supermemory-插件v2.md`
