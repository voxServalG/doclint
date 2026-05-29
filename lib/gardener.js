import fs from "fs";
import path from "path";
import { getAllMdFiles, isSubFile, findMainFile } from "./utils.js";

export function garden(projectRoot, config, dryRun = false) {
  const docsDir = path.join(projectRoot, config.docsDir);
  const allFiles = getAllMdFiles(docsDir);
  const fixes = [];

  const allMdFilesSet = new Set();
  function collectAllMdFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectAllMdFiles(fullPath);
      } else if (entry.name.endsWith(".md")) {
        allMdFilesSet.add(fullPath);
      }
    }
  }
  collectAllMdFiles(docsDir);

  for (const file of allFiles) {
    const relativePath = path.relative(projectRoot, file);

    if (fixBackLink(file, dryRun)) {
      fixes.push({ file: relativePath, fix: "back-link", description: "添加回链到主文件" });
    }

    if (fixIndexComplete(file, dryRun)) {
      fixes.push({ file: relativePath, fix: "index-complete", description: "更新索引文件" });
    }

    if (fixLinkValid(file, allMdFilesSet, docsDir, dryRun)) {
      fixes.push({ file: relativePath, fix: "link-valid", description: "修复无效链接" });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    dryRun,
    fixes,
    total: fixes.length,
  };
}

function fixBackLink(filePath, dryRun) {
  if (!isSubFile(path.basename(filePath))) return false;

  const mainFile = findMainFile(filePath);
  if (!mainFile) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  const mainFileName = path.basename(mainFile);
  if (content.includes(mainFileName)) return false;

  const backLink = `\n---\n\n返回 [${mainFileName}](${mainFileName})`;
  const newContent = content.trimEnd() + backLink + "\n";

  if (!dryRun) fs.writeFileSync(filePath, newContent);
  return true;
}

function fixIndexComplete(filePath, dryRun) {
  if (!path.basename(filePath).startsWith("index")) return false;

  const dir = path.dirname(filePath);
  const content = fs.readFileSync(filePath, "utf-8");

  const siblingFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== path.basename(filePath) && !f.startsWith("index"));

  let newContent = content;
  let fixed = false;

  for (const file of siblingFiles) {
    if (!content.includes(file)) {
      const entry = `- [${file}](${file})\n`;
      newContent = newContent.trimEnd() + "\n" + entry;
      fixed = true;
    }
  }

  if (fixed && !dryRun) {
    fs.writeFileSync(filePath, newContent);
  }
  return fixed;
}

function fixLinkValid(filePath, allMdFilesSet, docsDir, dryRun) {
  const content = fs.readFileSync(filePath, "utf-8");
  const fromDir = path.dirname(filePath);

  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let newContent = content;
  let fixed = false;

  let m;
  while ((m = linkRegex.exec(content)) !== null) {
    const linkTarget = m[2];
    if (linkTarget.startsWith("http") || linkTarget.startsWith("#")) continue;

    const resolved = path.resolve(fromDir, linkTarget);
    if (fs.existsSync(resolved)) continue;

    const fileName = path.basename(linkTarget);
    const correctPath = [...allMdFilesSet].find((f) => path.basename(f) === fileName);
    if (correctPath) {
      const relativeCorrect = path.relative(fromDir, correctPath);
      newContent = newContent.replace(m[0], `[${m[1]}](${relativeCorrect})`);
      fixed = true;
    }
  }

  if (fixed && !dryRun) {
    fs.writeFileSync(filePath, newContent);
  }
  return fixed;
}
