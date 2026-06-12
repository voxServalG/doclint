# doclint

文档质量 CI 检查工具。在 GitHub Actions 中自动检查文档的格式、链接、陈旧度等问题。

## 安装

```bash
npm install -g github:voxServalG/doclint
```

需要 Node.js >= 18。零外部依赖。

## 快速开始

```bash
doclint deploy     # 自动探测项目配置并部署
doclint lint       # 检查文档质量
doclint garden     # 预览常见问题修复
```

### deploy

交互式配置向导。自动探测项目的文档目录、代码目录、代码后缀、当前 git 分支，展示检测结果，逐项让用户确认或修改。完成后写入两个文件：

- `doclint.json` — 项目配置
- `.github/workflows/docs-check.yml` — CI 工作流

### lint

对 `doclint.json` 中配置的文档目录下所有 `.md` 文件运行 8 条机械规则检查。支持 `--json` 输出机器可读的 JSON 报告。

### garden

自动修复三类常见问题：子文件缺失回链、索引文件缺失条目、无效的内部链接。默认仅预览不修改；确认后使用 `--yes` 应用修复，仍可使用 `--dry-run` 显式预览。

## Agent 调用协议

`lint --json` 和 `garden --json` 会输出面向 agent 的 envelope，而不是只输出人类文案：

```json
{
  "ok": true,
  "data": {},
  "display": {
    "title": "Docs lint passed",
    "body": "Files: 0, failed: 0, errors: 0, warnings: 0"
  },
  "hint": "No doclint errors were found. It is safe to continue to the next workflow step.",
  "requires_user": false,
  "stop_here": false,
  "next": {
    "allowed": ["continue"],
    "blocked": []
  }
}
```

字段约定：

| 字段 | 说明 |
|------|------|
| `ok` | 当前命令是否达到可继续状态 |
| `data` | 给 agent 读取的完整机器数据，`lint` 的原始报告保留在 `data.summary` |
| `display` | 给用户展示的标题和摘要 |
| `hint` | 给 agent 的下一步行为提示 |
| `requires_user` | 是否需要用户确认或介入 |
| `stop_here` | agent 本轮是否应停止继续自动执行 |
| `next` | 当前建议允许或阻止的后续动作 |
| `recovery` | 需要恢复时应运行的命令和原因 |

`garden --json` 默认只预览修复并在存在可修复项时返回 `requires_user: true` 与 `stop_here: true`。agent 必须把 `display` 和 `data.result.fixes` 展示给用户；只有用户明确确认后，才应运行：

```bash
doclint garden --yes
```

## 检查规则

| 规则 | 级别 | 说明 |
|------|------|------|
| `line-limit` | error | 文件超过配置的最大行数；整行注释和纯注释块不计入行数 |
| `has-reference` | error | 文件未被任何其他 md 文件引用 |
| `link-valid` | error | 内部链接目标文件不存在 |
| `back-link` | warning | 子文件缺少回链到主文件 |
| `index-complete` | warning | 索引文件缺少对同级文件的引用 |
| `stale-time` | warning | 文件超过配置天数未更新 |
| `dead-reference` | error | 引用的代码文件路径不存在 |
| `structure-consistent` | warning | 文件缺少标题或标题层级不对 |

## 配置

`doclint.json` 示例：

```json
{
  "docsDir": "docs",
  "codeDirs": ["src", "tests"],
  "codeExt": ".py",
  "baseBranch": "main",
  "maxLines": 200,
  "staleDays": 30
}
```

| 字段 | 说明 | 默认 |
|------|------|------|
| `docsDir` | 文档目录 | `docs` |
| `codeDirs` | 代码目录列表 | `["src"]` |
| `codeExt` | 代码文件后缀 | `.py` |
| `baseBranch` | PR 目标分支 | `main` |
| `maxLines` | 单文件最大行数（10–10000） | `200` |
| `staleDays` | 陈旧天数阈值（1–365） | `30` |

`maxLines` 按文件扩展名选择注释语法。已覆盖 JavaScript/TypeScript、C/C++/C#、Java、Go、Rust、Swift、Kotlin、Scala、Dart、Objective-C、Groovy、Solidity、Protocol Buffers、shader、CUDA/OpenCL、CSS/SCSS/Less、HTML/XML/Vue/Svelte、Python、Shell、Ruby、Perl、R、Nim、Crystal、Elixir、YAML/TOML/INI、PowerShell、Julia、PHP、SQL、Lua、Haskell/Elm、Erlang、Lisp/Clojure/Scheme/Racket、Terraform/HCL、Nix、Batch、F#/OCaml、Ada、Fortran、TeX、VB/VBScript、Vim、ignore/env 文件、Markdown 等常见扩展名。整行都是注释或处于纯注释块中的行不计入触发 `warning` 或 `error` 的代码行数。带有代码的行内注释仍计为代码行。未知扩展名保持原始物理行数统计。
