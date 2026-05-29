import fs from "fs";
import path from "path";
import {
  getAllMdFiles,
  countLines,
  getLastModified,
  extractLinks,
  resolveLink,
  extractHeadings,
  buildCodeRefRegex,
  findAllMdFiles,
  isSubFile,
  findMainFile,
} from "./utils.js";

export function lint(projectRoot, config) {
  const docsDir = path.join(projectRoot, config.docsDir);
  const allFiles = findAllMdFiles(projectRoot, config);
  const docsFiles = getAllMdFiles(docsDir);
  const docsSet = new Set(docsFiles.map((f) => path.resolve(f)));
  const codeRefRegex = buildCodeRefRegex(config.codeDirs, config.codeExt);

  const results = docsFiles.map((filePath) => {
    const issues = [
      ...checkLineLimit(filePath, config.maxLines),
      ...checkHasReference(filePath, allFiles, docsSet),
      ...checkLinkValid(filePath),
      ...checkBackLink(filePath),
      ...checkIndexComplete(filePath),
      ...checkStaleTime(filePath, config.staleDays),
      ...checkDeadReference(filePath, projectRoot, codeRefRegex),
      ...checkStructureConsistent(filePath),
    ];

    return {
      file: path.relative(projectRoot, filePath),
      lineCount: countLines(filePath),
      lastModified: getLastModified(filePath),
      issues,
    };
  });

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.issues.length === 0).length,
    failed: results.filter((r) => r.issues.length > 0).length,
    results,
  };

  return summary;
}

function checkLineLimit(filePath, maxLines) {
  const lines = countLines(filePath);
  if (lines > maxLines) {
    return [
      {
        rule: "line-limit",
        severity: "error",
        message: `超过 ${maxLines} 行限制（当前 ${lines} 行，超出 ${lines - maxLines} 行）`,
      },
    ];
  }
  return [];
}

function checkHasReference(filePath, allFiles, docsSet) {
  if (!docsSet.has(path.resolve(filePath))) return [];

  const fileName = path.basename(filePath);

  for (const otherFile of allFiles) {
    if (path.resolve(otherFile) === path.resolve(filePath)) continue;
    const content = fs.readFileSync(otherFile, "utf-8");
    if (content.includes(fileName)) {
      return [];
    }
  }

  return [
    {
      rule: "has-reference",
      severity: "error",
      message: "未被任何其他 md 文件引用",
    },
  ];
}

function checkLinkValid(filePath) {
  const links = extractLinks(filePath);
  const issues = [];

  for (const link of links) {
    const resolved = resolveLink(filePath, link.target);
    if (resolved === null) continue;
    if (!fs.existsSync(resolved)) {
      issues.push({
        rule: "link-valid",
        severity: "error",
        message: `第 ${link.line} 行链接无效: [${link.text}](${link.target})`,
      });
    }
  }

  return issues;
}

function checkBackLink(filePath) {
  if (!isSubFile(path.basename(filePath))) return [];

  const mainFile = findMainFile(filePath);
  if (!mainFile) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const mainFileName = path.basename(mainFile);

  if (!content.includes(mainFileName)) {
    return [
      {
        rule: "back-link",
        severity: "warning",
        message: `子文件缺少回链到主文件 ${mainFileName}`,
      },
    ];
  }

  return [];
}

function checkIndexComplete(filePath) {
  if (!path.basename(filePath).startsWith("index")) return [];

  const dir = path.dirname(filePath);
  const indexContent = fs.readFileSync(filePath, "utf-8");
  const issues = [];

  const siblingFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== path.basename(filePath) && !f.startsWith("index"));

  for (const file of siblingFiles) {
    if (!indexContent.includes(file)) {
      issues.push({
        rule: "index-complete",
        severity: "warning",
        message: `索引文件缺少对 ${file} 的引用`,
      });
    }
  }

  return issues;
}

function checkStaleTime(filePath, staleDays) {
  const lastModified = getLastModified(filePath);
  const daysSinceModified = (new Date() - new Date(lastModified)) / (1000 * 60 * 60 * 24);

  if (daysSinceModified > staleDays) {
    return [
      {
        rule: "stale-time",
        severity: "warning",
        message: `超过 ${staleDays} 天未更新（最后修改: ${lastModified}）`,
      },
    ];
  }
  return [];
}

function checkDeadReference(filePath, projectRoot, codeRefRegex) {
  const content = fs.readFileSync(filePath, "utf-8");
  const issues = [];
  const seen = new Set();

  let m;
  while ((m = codeRefRegex.exec(content)) !== null) {
    const codePath = m[0];
    if (seen.has(codePath)) continue;
    seen.add(codePath);

    if (!fs.existsSync(path.join(projectRoot, codePath))) {
      issues.push({
        rule: "dead-reference",
        severity: "error",
        message: `引用的代码文件不存在: ${codePath}`,
      });
    }
  }

  return issues;
}

function checkStructureConsistent(filePath) {
  const headings = extractHeadings(filePath);
  const issues = [];

  if (headings.length === 0) {
    issues.push({
      rule: "structure-consistent",
      severity: "warning",
      message: "文件缺少标题",
    });
    return issues;
  }

  if (headings[0].level !== 1) {
    issues.push({
      rule: "structure-consistent",
      severity: "warning",
      message: "文件应以一级标题（#）开头",
    });
  }

  return issues;
}
