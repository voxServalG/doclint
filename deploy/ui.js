import fs from "fs";
import path from "path";
import readline from "readline";
import { detect } from "./detect.js";
import { validate } from "../lib/config.js";

const existing = {};

function rl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
  return new Promise((resolve) => {
    const iface = rl();
    iface.question(question, (answer) => {
      iface.close();
      resolve(answer.trim());
    });
  });
}

export async function run(projectRoot) {
  console.log("\n  doclint · 文档质量 CI 检查工具");
  console.log("  " + "═".repeat(30) + "\n");

  const configPath = path.join(projectRoot, "doclint.json");
  const hasExisting = fs.existsSync(configPath);
  if (hasExisting) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      Object.assign(existing, raw);
      console.log("  检测到已有配置文件 doclint.json，将以现有值作为默认值\n");
    } catch {
      console.log("  检测到已有配置文件但无法读取，将重新配置\n");
    }
  }

  const detected = detect(projectRoot);

  const cfg = {
    docsDir: existing.docsDir || (detected.docsDir ? detected.docsDir.path : "docs"),
    codeDirs: existing.codeDirs || (detected.codeDirs.length > 0 ? detected.codeDirs.map((d) => d.name) : ["src"]),
    codeExt: existing.codeExt || (detected.codeExt ? detected.codeExt.primary : ".py"),
    baseBranch: existing.baseBranch || detected.baseBranch || "main",
    maxLines: existing.maxLines ?? 200,
    staleDays: existing.staleDays ?? 30,
  };

  const detectedInfo = { ...detected };
  const existingInfo = { ...existing };

  while (true) {
    printChecklist(cfg, detectedInfo, existingInfo);
    const choice = await ask("  输入编号修改，输入 0 完成\n  > ");

    if (choice === "0") break;

    switch (choice) {
      case "1":
        await editDocsDir(cfg, detectedInfo);
        break;
      case "2":
        await editCodeDirs(cfg, detectedInfo);
        break;
      case "3":
        await editCodeExt(cfg, detectedInfo);
        break;
      case "4":
        await editBaseBranch(cfg, detectedInfo);
        break;
      case "5":
        await editMaxLines(cfg);
        break;
      case "6":
        await editStaleDays(cfg);
        break;
      default:
        console.log("  无效选择，请输入 1-6 或 0");
    }
    console.log("");
  }

  const errors = validate(cfg);
  if (errors.length > 0) {
    console.log("  ✗ 配置校验失败:");
    for (const err of errors) {
      console.log(`    - ${err}`);
    }
    return;
  }

  const workflowPath = path.join(projectRoot, ".github", "workflows", "docs-check.yml");
  const workflowExists = fs.existsSync(workflowPath);

  console.log("\n  即将写入以下文件：\n");
  console.log(`  • doclint.json`);
  console.log(`  • .github/workflows/docs-check.yml`);
  if (workflowExists) {
    console.log(`    ⚠ 该文件已存在，将覆盖`);
  }

  const confirm = await ask("\n  确认写入？[Y/n] ");
  if (confirm && confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
    console.log("\n  已取消，未写入任何文件\n");
    return;
  }

  const configModule = await import("../lib/config.js");

  if (workflowExists) {
    const overwriteChoice = await ask(
      `\n  ⚠ .github/workflows/docs-check.yml 已存在。\n  覆盖/跳过/查看完整内容？[o/s/v] `
    );
    if (overwriteChoice === "s") {
      console.log("  跳过 workflow，仅写入 doclint.json");
    } else if (overwriteChoice === "v") {
      console.log("\n  " + "-".repeat(50));
      console.log(fs.readFileSync(workflowPath, "utf-8"));
      console.log("  " + "-".repeat(50));
      const tryAgain = await ask("\n  覆盖/跳过？[o/s] ");
      if (tryAgain === "s") {
        console.log("  跳过 workflow");
      } else {
        writeWorkflow(projectRoot);
        console.log("  ✓  .github/workflows/docs-check.yml  已写入");
      }
    } else {
      writeWorkflow(projectRoot);
      console.log("  ✓  .github/workflows/docs-check.yml  已写入");
    }
  } else {
    writeWorkflow(projectRoot);
    console.log("  ✓  .github/workflows/docs-check.yml  已写入");
  }

  configModule.save(projectRoot, cfg);
  console.log("  ✓  doclint.json  已写入");

  console.log("\n  下一步：");
  console.log("    git add doclint.json .github/workflows/docs-check.yml");
  console.log("    doclint lint    立即运行检查\n");
}

function printChecklist(cfg, detected, existing) {
  const hasExisting = Object.keys(existing).length > 0;

  console.log("  ┌──────────────────────────────────────────────────────┐");
  printItem("1", "文档目录", cfg.docsDir, detected.docsDir, `包含 ${detected.docsDir ? detected.docsDir.mdCount + " 个 .md 文件" : "未检测到"}`,
    "扫描此目录下所有 .md 文件", hasExisting);

  const dirsDetail = detected.codeDirs.length > 0
    ? detected.codeDirs.map((d) => `${d.name} (${d.fileCount} 个文件)`).join(", ")
    : "未检测到";
  printItem("2", "代码目录", cfg.codeDirs.join(", "), null, dirsDetail,
    "检查文档引用的代码路径是否存活", hasExisting);

  const extDetail = detected.codeExt
    ? `${detected.codeExt.primary}（占 ${detected.codeExt.primaryRatio}%）`
    : "未检测到";
  printItem("3", "代码后缀", cfg.codeExt, null, extDetail,
    "识别文档中引用的代码文件", hasExisting);

  const branchDetail = detected.baseBranch ? `当前分支: ${detected.baseBranch}` : "未检测到 git 仓库";
  printItem("4", "基础分支", cfg.baseBranch, null, branchDetail,
    "自动修复 PR 合并到哪个分支", hasExisting);

  printItem("5", "最大行数", String(cfg.maxLines), null, "范围 10–10000",
    "超过此行数的文件 CI 报错（error）", hasExisting);

  printItem("6", "陈旧天数", String(cfg.staleDays), null, "范围 1–365（30≈1个月）",
    "超过此天数的文件标记为陈旧（warning）", hasExisting);

  console.log("  └──────────────────────────────────────────────────────┘");
  console.log("");
}

function printItem(num, label, value, _detectedExtra, detail, help, hasExisting) {
  const mark = needMark(num, label, hasExisting);
  console.log(`  │ ${num}. ${label}`.padEnd(30) + `  ${value || "-"}`.padEnd(20) + "│" + (mark ? ` ${mark}` : ""));
  console.log(`  │    ${detail}`.padEnd(60) + "│");
  console.log(`  │    作用：${help}`.padEnd(60) + "│");
  console.log("  │                                                      │");
}

function needMark(num, label, hasExisting) {
  if (!hasExisting) return "";
  return "(已有配置)";
}

async function editDocsDir(cfg, detected) {
  console.log("\n  ── 文档目录 ──");
  console.log("  作用：扫描此目录下所有 .md 文档。");
  if (detected.docsDir) {
    console.log(`  检测到: ${detected.docsDir.path}/  (${detected.docsDir.mdCount} 个 .md 文件)`);
  } else {
    console.log("  ✗ 未检测到文档目录");
  }
  console.log(`  当前: ${cfg.docsDir}`);
  const val = await ask("  输入新路径（留空保持当前）\n  > ");
  if (val) cfg.docsDir = val;
}

async function editCodeDirs(cfg, detected) {
  console.log("\n  ── 代码目录 ──");
  console.log("  作用：检查文档引用的代码路径是否存活。");
  if (detected.codeDirs.length > 0) {
    for (const d of detected.codeDirs) {
      console.log(`  检测到: ${d.name}/  (${d.fileCount} 个文件)`);
    }
  } else {
    console.log("  ✗ 未检测到代码目录");
  }
  console.log(`  当前: ${cfg.codeDirs.join(", ")}`);
  const val = await ask("  输入新路径，逗号分隔（留空保持当前）\n  > ");
  if (val) cfg.codeDirs = val.split(",").map((s) => s.trim()).filter(Boolean);
}

async function editCodeExt(cfg, detected) {
  console.log("\n  ── 代码后缀 ──");
  console.log("  作用：识别文档中引用的代码文件。");
  if (detected.codeExt) {
    console.log(`  检测到: ${detected.codeExt.primary}（占 ${detected.codeExt.primaryRatio}%）`);
    if (detected.codeExt.others.length > 0) {
      const others = detected.codeExt.others
        .map((e) => `${e.ext} (${e.ratio}%)`)
        .join(", ");
      console.log(`  其他: ${others}`);
    }
  }
  console.log(`  当前: ${cfg.codeExt}`);
  const val = await ask("  输入新后缀（以 . 开头，留空保持当前）\n  > ");
  if (val) cfg.codeExt = val;
}

async function editBaseBranch(cfg, detected) {
  console.log("\n  ── 基础分支 ──");
  console.log("  作用：自动修复 PR 合并到哪个分支。");
  if (detected.baseBranch) {
    console.log(`  检测到: ${detected.baseBranch}（当前分支）`);
  } else {
    console.log("  ✗ 未检测到 git 仓库");
  }
  console.log(`  当前: ${cfg.baseBranch}`);
  const val = await ask("  输入分支名（留空保持当前）\n  > ");
  if (val) cfg.baseBranch = val;
}

async function editMaxLines(cfg) {
  console.log("\n  ── 最大行数 ──");
  console.log("  作用：单文件超过此行数则 CI 报错（error）。");
  console.log("  范围：10 – 10000");
  console.log(`  当前: ${cfg.maxLines}`);
  const val = await ask("  > ");
  if (val === "") return;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 10 || n > 10000) {
    console.log("  无效值，保持当前");
    return;
  }
  cfg.maxLines = n;
}

async function editStaleDays(cfg) {
  console.log("\n  ── 陈旧天数 ──");
  console.log("  作用：超过此天数的文件标记为陈旧（warning）。");
  console.log("  范围：1 – 365");
  console.log(`  当前: ${cfg.staleDays}（约 ${Math.round(cfg.staleDays / 30)} 个月）`);
  const val = await ask("  > ");
  if (val === "") return;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1 || n > 365) {
    console.log("  无效值，保持当前");
    return;
  }
  cfg.staleDays = n;
}

function writeWorkflow(projectRoot) {
  const templateDir = path.resolve(import.meta.dirname, "..", "templates");
  const templatePath = path.join(templateDir, "docs-check.yml");
  const content = fs.readFileSync(templatePath, "utf-8");

  const workflowsDir = path.join(projectRoot, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(workflowsDir, "docs-check.yml"), content);
}
