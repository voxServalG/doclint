import fs from "fs";
import path from "path";

export function getAllMdFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMdFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function countLines(filePath) {
  return fs.readFileSync(filePath, "utf-8").split("\n").length;
}

export function getLastModified(filePath) {
  return fs.statSync(filePath).mtime.toISOString().split("T")[0];
}

export function extractLinks(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const links = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    links.push({
      text: m[1],
      target: m[2],
      line: content.substring(0, m.index).split("\n").length,
    });
  }
  return links;
}

export function resolveLink(fromFile, linkTarget) {
  if (linkTarget.startsWith("http://") || linkTarget.startsWith("https://") || linkTarget.startsWith("#")) {
    return null;
  }
  return path.resolve(path.dirname(fromFile), linkTarget);
}

export function extractHeadings(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      headings.push({
        line: i + 1,
        text: line,
        level: line.match(/^#+/)[0].length,
      });
    }
  }
  return headings;
}

export function buildCodeRefRegex(codeDirs, codeExt) {
  const dirs = codeDirs.map((d) => d.replace(/\/$/, "")).join("|");
  const ext = codeExt.replace(".", "\\.");
  return new RegExp(`(?:${dirs})/[^\\s\`)]+\\${ext}`, "g");
}

export function findAllMdFiles(projectRoot, config) {
  const docsDir = path.join(projectRoot, config.docsDir);
  const docsFiles = getAllMdFiles(docsDir);

  const rootFiles = [
    path.join(projectRoot, "AGENTS.md"),
    path.join(projectRoot, "README.md"),
  ].filter((f) => fs.existsSync(f));

  return [...docsFiles, ...rootFiles];
}

export function isSubFile(fileName) {
  return fileName.includes("-");
}

export function findMainFile(filePath) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".md").split("-")[0];
  const mainPath = path.join(dir, `${baseName}.md`);
  if (fs.existsSync(mainPath)) {
    return mainPath;
  }
  return null;
}
