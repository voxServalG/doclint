export function lintResult(summary) {
  const errorCount = countIssues(summary, "error");
  const warningCount = countIssues(summary, "warning");
  const ok = errorCount === 0;

  return {
    ok,
    data: {
      summary,
      counts: {
        files: summary.total,
        failed: summary.failed,
        errors: errorCount,
        warnings: warningCount,
      },
    },
    display: {
      title: ok ? "Docs lint passed" : "Docs lint failed",
      body: `Files: ${summary.total}, failed: ${summary.failed}, errors: ${errorCount}, warnings: ${warningCount}`,
    },
    hint: ok
      ? "No doclint errors were found. It is safe to continue to the next workflow step."
      : "doclint found errors. Show display.body to the user, inspect data.summary.results, fix the issues, then rerun doclint lint --json.",
    requires_user: false,
    stop_here: !ok,
    next: ok
      ? { allowed: ["continue"], blocked: [] }
      : { allowed: ["fix", "doclint lint --json"], blocked: ["commit", "merge"] },
    recovery: ok
      ? undefined
      : {
          command: "doclint lint --json",
          reason: "Rerun after fixing reported documentation errors.",
        },
  };
}

export function gardenResult(result) {
  const ok = result.dryRun || result.total === 0;
  const needsConfirmation = result.dryRun && result.total > 0;
  const action = result.dryRun ? "previewed" : "fixed";

  return {
    ok,
    data: {
      result,
      counts: {
        fixes: result.total,
      },
    },
    display: {
      title: result.dryRun ? "Doc gardening preview" : "Doc gardening complete",
      body: result.total === 0 ? "No issues found that can be auto-fixed." : `${action} ${result.total} issue(s).`,
    },
    hint: needsConfirmation
      ? "Show display.body and data.result.fixes to the user. Do not modify files unless the user explicitly confirms, then rerun with doclint garden --yes."
      : "Doc gardening completed without requiring further action.",
    requires_user: needsConfirmation,
    stop_here: needsConfirmation,
    next: needsConfirmation
      ? { allowed: ["doclint garden --yes", "doclint garden --dry-run --json"], blocked: ["commit"] }
      : { allowed: ["doclint lint --json", "continue"], blocked: [] },
    recovery: needsConfirmation
      ? {
          command: "doclint garden --yes",
          reason: "Apply the previewed fixes after explicit user confirmation.",
        }
      : undefined,
  };
}

function countIssues(summary, severity) {
  return summary.results.reduce((count, result) => {
    return count + result.issues.filter((issue) => issue.severity === severity).length;
  }, 0);
}
