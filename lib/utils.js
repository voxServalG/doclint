import fs from "fs";
import path from "path";

const COMMENT_SYNTAX_BY_EXT = new Map([
  ...withExts([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".java", ".c", ".h", ".cpp", ".cc", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".cs", ".go", ".rs", ".swift", ".kt", ".kts", ".scala", ".sc", ".dart", ".m", ".mm", ".groovy", ".gradle", ".sol", ".proto", ".thrift", ".glsl", ".vert", ".frag", ".geom", ".tesc", ".tese", ".comp", ".wgsl", ".cu", ".cuh", ".cl", ".d", ".vala", ".v", ".vh", ".sv", ".svh", ".metal", ".processing", ".pde", ".ino"], {
    line: ["//"],
    block: [["/*", "*/"]],
  }),
  ...withExts([".zig"], { line: ["//"] }),
  ...withExts([".css", ".pcss", ".postcss"], { block: [["/*", "*/"]] }),
  ...withExts([".scss", ".sass", ".less"], { line: ["//"], block: [["/*", "*/"]] }),
  ...withExts([".html", ".htm", ".xhtml", ".xml", ".svg", ".vue", ".svelte", ".rss", ".atom", ".plist", ".xaml", ".csproj", ".vbproj", ".fsproj", ".props", ".targets"], { block: [["<!--", "-->"]] }),
  ...withExts([".py", ".pyw", ".pyi", ".bzl", ".bazel", ".star", ".scons", ".rpy"], { line: ["#"], block: [["'''", "'''"], ["\"\"\"", "\"\"\""]] }),
  ...withExts([".sh", ".bash", ".zsh", ".fish", ".ksh", ".csh", ".tcsh", ".rb", ".rake", ".gemspec", ".pl", ".pm", ".t", ".r", ".nim", ".cr", ".ex", ".exs", ".coffee", ".feature", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".mk", ".mak", ".dockerfile", ".cmake"], { line: ["#"] }),
  ...withExts([".ps1", ".psm1", ".psd1"], { line: ["#"], block: [["<#", "#>"]] }),
  ...withExts([".jl"], { line: ["#"], block: [["#=", "=#"]] }),
  ...withExts([".php"], { line: ["//", "#"], block: [["/*", "*/"]] }),
  ...withExts([".sql", ".psql", ".mysql", ".pgsql"], { line: ["--"], block: [["/*", "*/"]] }),
  ...withExts([".lua"], { line: ["--"], block: [["--[[", "]]"]] }),
  ...withExts([".hs", ".lhs"], { line: ["--"], block: [["{-", "-}"]] }),
  ...withExts([".erl", ".hrl"], { line: ["%"] }),
  ...withExts([".clj", ".cljs", ".cljc", ".edn", ".lisp", ".lsp", ".el", ".scm", ".ss", ".rkt"], { line: [";"] }),
  ...withExts([".tf", ".tfvars", ".hcl"], { line: ["#", "//"], block: [["/*", "*/"]] }),
  ...withExts([".nix"], { line: ["#"], block: [["/*", "*/"]] }),
  ...withExts([".bat", ".cmd"], { line: ["rem ", "REM ", "::"] }),
  ...withExts([".fs", ".fsi", ".fsx", ".ml", ".mli"], { block: [["(*", "*)"]] }),
  ...withExts([".elm"], { line: ["--"], block: [["{-", "-}"]] }),
  ...withExts([".ada", ".adb", ".ads"], { line: ["--"] }),
  ...withExts([".f", ".for", ".f90", ".f95", ".f03", ".f08"], { line: ["!"] }),
  ...withExts([".tex", ".sty", ".cls"], { line: ["%"] }),
  ...withExts([".vb", ".vbs"], { line: ["'"] }),
  ...withExts([".vim", ".vimrc"], { line: ["\""] }),
  ...withExts([".dockerignore", ".gitignore", ".npmrc", ".env"], { line: ["#"] }),
  ...withExts([".md", ".markdown"], { block: [["<!--", "-->"]] }),
]);

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
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const syntax = COMMENT_SYNTAX_BY_EXT.get(path.extname(filePath).toLowerCase());
  if (!syntax) return lines.length;

  return lines.filter((line, index) => isCountedLine(line, lines, index, syntax)).length;
}

function withExts(exts, syntax) {
  return exts.map((ext) => [ext, { line: syntax.line ?? [], block: syntax.block ?? [] }]);
}

function isCountedLine(line, lines, index, syntax) {
  const previousState = getBlockState(lines, index, syntax);
  let block = previousState;
  let hasCode = false;
  let i = 0;

  while (i < line.length) {
    if (block) {
      const end = line.indexOf(block.end, i);
      if (end === -1) return hasCode;
      i = end + block.end.length;
      block = null;
      continue;
    }

    if (/\s/.test(line[i])) {
      i += 1;
      continue;
    }

    const blockComment = syntax.block.find(([start]) => line.startsWith(start, i));
    if (blockComment) {
      const [start, endMarker] = blockComment;
      const end = line.indexOf(endMarker, i + start.length);
      if (end === -1) return hasCode;
      i = end + endMarker.length;
      continue;
    }

    const lineComment = syntax.line.find((marker) => line.startsWith(marker, i));
    if (lineComment) return hasCode;

    hasCode = true;
    i += 1;
  }

  return hasCode || line.trim().length === 0;
}

function getBlockState(lines, targetIndex, syntax) {
  let block = null;

  for (let lineIndex = 0; lineIndex < targetIndex; lineIndex += 1) {
    const line = lines[lineIndex];
    let i = 0;
    while (i < line.length) {
      if (block) {
        const end = line.indexOf(block.end, i);
        if (end === -1) break;
        i = end + block.end.length;
        block = null;
        continue;
      }

      if (/\s/.test(line[i])) {
        i += 1;
        continue;
      }

      const blockComment = syntax.block.find(([start]) => line.startsWith(start, i));
      if (blockComment) {
        const [start, endMarker] = blockComment;
        const end = line.indexOf(endMarker, i + start.length);
        if (end === -1) {
          block = { end: endMarker };
          break;
        }
        i = end + endMarker.length;
        continue;
      }

      if (syntax.line.some((marker) => line.startsWith(marker, i))) break;

      i += 1;
    }
  }

  return block;
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
