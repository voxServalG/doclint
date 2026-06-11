#!/usr/bin/env node

import path from "path";
import fs from "fs";

const command = process.argv[2];
const projectRoot = process.cwd();
const jsonOutput = process.argv.includes("--json");

async function main() {
  switch (command) {
    case "deploy":
    case "init": {
      const { run } = await import("./deploy/ui.js");
      await run(projectRoot);
      break;
    }
    case "lint": {
      const { load } = await import("./lib/config.js");
      const { lint } = await import("./lib/linter.js");
      const { lintResult } = await import("./lib/result.js");

      checkConfigExists(projectRoot);

      const config = load(projectRoot);
      const summary = lint(projectRoot, config);

      if (jsonOutput) {
        console.log(JSON.stringify(lintResult(summary), null, 2));
      } else {
        console.log("\n# Docs Lint Report\n");
        console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}\n`);

        for (const result of summary.results) {
          if (result.issues.length === 0) continue;
          console.log(`## ${result.file}`);
          console.log(`Lines: ${result.lineCount} | Last modified: ${result.lastModified}\n`);
          for (const issue of result.issues) {
            const icon = issue.severity === "error" ? "❌" : "⚠️";
            console.log(`  ${icon} [${issue.rule}] ${issue.message}`);
          }
          console.log("");
        }
      }

      const hasErrors = summary.results.some((r) => r.issues.some((i) => i.severity === "error"));
      if (hasErrors) process.exit(1);
      break;
    }
    case "garden": {
      const { load } = await import("./lib/config.js");
      const { garden } = await import("./lib/gardener.js");
      const { gardenResult } = await import("./lib/result.js");

      checkConfigExists(projectRoot);

      const confirmed = process.argv.includes("--yes");
      let dryRun = process.argv.includes("--dry-run") || !confirmed;
      let isGit = false;
      try {
        const { execSync } = await import("child_process");
        execSync("git rev-parse --is-inside-work-tree", { cwd: projectRoot, stdio: "ignore" });
        isGit = true;
      } catch {
        // not a git repo or git diff failed
      }

      if (!isGit) {
        if (!jsonOutput) console.log("\n  ℹ 当前目录不是 git 仓库，仅展示预览：\n");
        dryRun = true;
      }

      const config = load(projectRoot);
      const result = garden(projectRoot, config, dryRun);

      if (jsonOutput) {
        console.log(JSON.stringify(gardenResult(result), null, 2));
      } else if (dryRun) {
        console.log("\n# Doc Gardening Preview\n");
        if (result.total === 0) {
          console.log("No issues found that can be auto-fixed");
        } else {
          console.log(`Found ${result.total} issues:\n`);
          for (const fix of result.fixes) {
            console.log(`- ${fix.file}: ${fix.description}`);
          }
        }
        if (!isGit) {
          console.log("\n以上为预览，不会修改文件。");
        } else if (!confirmed) {
          console.log("\n预览完成，不会修改文件。确认后运行 doclint garden --yes 应用修复。");
        }
      } else {
        console.log(`\n# Doc Gardening\n\nFixed ${result.total} issues:\n`);
        for (const fix of result.fixes) {
          console.log(`- ${fix.file}: ${fix.description}`);
        }
      }
      break;
    }
    default: {
      console.log("doclint · 文档质量 CI 检查工具\n");
      console.log("用法:");
      console.log("  doclint deploy    部署配置（交互式）");
      console.log("  doclint lint      检查文档质量");
      console.log("  doclint garden    自动修复常见问题");
      break;
    }
  }
}

function checkConfigExists(projectRoot) {
  const configPath = path.join(projectRoot, "doclint.json");
  if (!fs.existsSync(configPath)) {
    console.log("  ⚠ 未找到 doclint.json");
    console.log("  请先运行 doclint deploy 生成配置文件\n");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
