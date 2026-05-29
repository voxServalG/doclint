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
doclint garden     # 自动修复常见问题
```

### deploy

交互式配置向导。自动探测项目的文档目录、代码目录、代码后缀、当前 git 分支，展示检测结果，逐项让用户确认或修改。完成后写入两个文件：

- `doclint.json` — 项目配置
- `.github/workflows/docs-check.yml` — CI 工作流

### lint

对 `doclint.json` 中配置的文档目录下所有 `.md` 文件运行 8 条机械规则检查。支持 `--json` 输出机器可读的 JSON 报告。

### garden

自动修复三类常见问题：子文件缺失回链、索引文件缺失条目、无效的内部链接。支持 `--dry-run` 仅预览不修改。

## 检查规则

| 规则 | 级别 | 说明 |
|------|------|------|
| `line-limit` | error | 文件超过配置的最大行数 |
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
