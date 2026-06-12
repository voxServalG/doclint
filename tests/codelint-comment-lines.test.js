import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { lint } from "../lib/linter.js";
import { countLines } from "../lib/utils.js";

test("countLines excludes whole-line comments and comment blocks by extension", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doclint-comments-"));
  const cases = buildExtensionCases();

  for (const [fileName, lines, expected] of cases) {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, lines.join("\n"));
    assert.equal(countLines(filePath), expected, fileName);
  }
});

function buildExtensionCases() {
  const cases = [];

  addCases(cases, [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".java", ".c", ".h", ".cpp", ".cc", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".cs", ".go", ".rs", ".swift", ".kt", ".kts", ".scala", ".sc", ".dart", ".m", ".mm", ".groovy", ".gradle", ".sol", ".proto", ".thrift", ".glsl", ".vert", ".frag", ".geom", ".tesc", ".tese", ".comp", ".wgsl", ".cu", ".cuh", ".cl", ".d", ".vala", ".v", ".vh", ".sv", ".svh", ".metal", ".processing", ".pde", ".ino"], ["// comment", "code(); // inline", "/*", "block", "*/", "code();"], 2);
  addCases(cases, [".zig"], ["// comment", "code(); // inline", "code();"], 2);
  addCases(cases, [".css", ".pcss", ".postcss"], ["/*", "block", "*/", ".root { color: red; }"], 1);
  addCases(cases, [".scss", ".sass", ".less"], ["// comment", "/*", "block", "*/", ".root { color: red; }"], 1);
  addCases(cases, [".html", ".htm", ".xhtml", ".xml", ".svg", ".vue", ".svelte", ".rss", ".atom", ".plist", ".xaml", ".csproj", ".vbproj", ".fsproj", ".props", ".targets"], ["<!--", "block", "-->", "<main></main>"], 1);
  addCases(cases, [".py", ".pyw", ".pyi", ".bzl", ".bazel", ".star", ".scons", ".rpy"], ["# comment", "\"\"\"", "block", "\"\"\"", "print('ok')", "print('ok') # inline"], 2);
  addCases(cases, [".sh", ".bash", ".zsh", ".fish", ".ksh", ".csh", ".tcsh", ".rb", ".rake", ".gemspec", ".pl", ".pm", ".t", ".r", ".nim", ".cr", ".ex", ".exs", ".coffee", ".feature", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".mk", ".mak", ".dockerfile", ".cmake"], ["# comment", "code", "code # inline"], 2);
  addCases(cases, [".ps1", ".psm1", ".psd1"], ["# comment", "<#", "block", "#>", "Write-Output ok"], 1);
  addCases(cases, [".jl"], ["# comment", "#=", "block", "=#", "println(1)"], 1);
  addCases(cases, [".php"], ["// comment", "# comment", "/*", "block", "*/", "code();"], 1);
  addCases(cases, [".sql", ".psql", ".mysql", ".pgsql"], ["-- comment", "/*", "block", "*/", "select 1;"], 1);
  addCases(cases, [".lua"], ["-- comment", "--[[", "block", "]]", "print('ok')"], 1);
  addCases(cases, [".hs", ".lhs", ".elm"], ["-- comment", "{-", "block", "-}", "main = value"], 1);
  addCases(cases, [".erl", ".hrl", ".tex", ".sty", ".cls"], ["% comment", "code"], 1);
  addCases(cases, [".clj", ".cljs", ".cljc", ".edn", ".lisp", ".lsp", ".el", ".scm", ".ss", ".rkt"], ["; comment", "code"], 1);
  addCases(cases, [".tf", ".tfvars", ".hcl"], ["# comment", "// comment", "/*", "block", "*/", "value = 1"], 1);
  addCases(cases, [".nix"], ["# comment", "/*", "block", "*/", "value = 1"], 1);
  addCases(cases, [".bat", ".cmd"], ["rem comment", "REM comment", ":: comment", "@echo off"], 1);
  addCases(cases, [".fs", ".fsi", ".fsx", ".ml", ".mli"], ["(*", "block", "*)", "let value = 1"], 1);
  addCases(cases, [".ada", ".adb", ".ads"], ["-- comment", "procedure Main is"], 1);
  addCases(cases, [".f", ".for", ".f90", ".f95", ".f03", ".f08"], ["! comment", "program main"], 1);
  addCases(cases, [".vb", ".vbs"], ["' comment", "Dim value"], 1);
  addCases(cases, [".vim", ".vimrc"], ["\" comment", "set number"], 1);
  addCases(cases, [".dockerignore", ".gitignore", ".npmrc", ".env"], ["# comment", "value"], 1);
  addCases(cases, [".md", ".markdown"], ["<!--", "block", "-->", "# Title"], 1);

  return cases;
}

function addCases(cases, exts, lines, expected) {
  for (const ext of exts) {
    cases.push([`sample${ext}`, lines, expected]);
  }
}

test("countLines keeps old behavior for unknown extensions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doclint-comments-"));
  const filePath = path.join(dir, "sample.unknown");
  fs.writeFileSync(filePath, ["# comment", "code"].join("\n"));

  assert.equal(countLines(filePath), 2);
});

test("lint line-limit uses comment-aware line counts", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "doclint-project-"));
  const docsDir = path.join(projectRoot, "docs");
  fs.mkdirSync(docsDir);
  fs.writeFileSync(path.join(docsDir, "index.md"), ["<!--", "comment", "-->", "# Title"].join("\n"));

  const summary = lint(projectRoot, {
    docsDir: "docs",
    codeDirs: ["src"],
    codeExt: ".js",
    maxLines: 1,
    staleDays: 365,
  });

  assert.equal(summary.results[0].lineCount, 1);
  assert.equal(summary.results[0].issues.some((issue) => issue.rule === "line-limit"), false);
});
