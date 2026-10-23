import { getLibraryUnchecked } from "../src/lib/content/loader";
import { buildGraph } from "../src/lib/content/validator";

/**
 * Standalone content validator.
 *
 *   npx tsx scripts/validate-content.ts        # human-readable report
 *   npx tsx scripts/validate-content.ts --json # machine-readable report
 *
 * Exits non-zero if the library does not validate. The same checks run during
 * `next build`: `src/lib/content/loader.ts` throws when the report contains
 * errors, so an invalid proof cannot be published by a green build.
 */
function main(): number {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const { library, report } = getLibraryUnchecked();
  const graph = buildGraph(library);

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          passed: report.passed,
          counts: report.counts,
          errors: report.errors,
          warnings: report.warnings,
          cycles: report.cycles,
          proofs: report.proofs,
          graph: { nodes: graph.nodes.length, edges: graph.edges.length },
          files: library.files,
        },
        null,
        2,
      )}\n`,
    );
    return report.passed ? 0 : 1;
  }

  const line = "─".repeat(72);
  process.stdout.write(`\nUnfold content validation\n${line}\n`);
  process.stdout.write(
    `content hash   ${library.contentHash}\n` +
      `files          ${library.files.length}\n` +
      `axioms         ${report.counts.axioms}\n` +
      `definitions    ${report.counts.definitions}\n` +
      `lemmas         ${report.counts.lemmas}\n` +
      `rules          ${report.counts.rules}\n` +
      `proofs         ${report.counts.proofs}\n` +
      `paths          ${report.counts.paths}\n` +
      `steps          ${report.counts.steps}\n` +
      `graph nodes    ${graph.nodes.length}\n` +
      `graph edges    ${graph.edges.length}\n` +
      `cycles         ${report.cycles.length}\n`,
  );
  process.stdout.write(`${line}\n`);

  for (const entry of report.proofs) {
    const flag = entry.passed ? "ok  " : "FAIL";
    process.stdout.write(
      `${flag} ${entry.proofId.padEnd(28)} depth ${entry.stats.maxDepth}  steps ${String(entry.stats.total).padStart(3)}` +
        `  leaves ${String(entry.stats.groundedLeaves).padStart(3)}/${String(entry.stats.leaves).padEnd(3)}` +
        `  checkpoints ${entry.stats.checkpoints}  widgets ${entry.stats.widgets}\n`,
    );
    const grounds = Object.entries(entry.grounds)
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => `${n} ${kind}`)
      .join(", ");
    process.stdout.write(`       leaf grounds: ${grounds || "none"}\n`);
    for (const issue of entry.errors) {
      process.stdout.write(`       ERROR [${issue.code}] ${issue.where}: ${issue.message}\n`);
    }
    for (const issue of entry.warnings) {
      process.stdout.write(`       warn  [${issue.code}] ${issue.where}: ${issue.message}\n`);
    }
  }

  process.stdout.write(`${line}\n`);
  if (report.errors.length) {
    process.stdout.write(`${report.errors.length} error(s), ${report.warnings.length} warning(s)\n`);
    for (const issue of report.errors) {
      process.stdout.write(`  ERROR [${issue.code}] ${issue.where}: ${issue.message}\n`);
    }
  } else {
    process.stdout.write(
      `no errors · ${report.warnings.length} warning(s)\n` +
        "every reference resolves · the dependency graph is acyclic · every leaf step is grounded\n",
    );
  }
  process.stdout.write(`${line}\n\n`);

  return report.passed ? 0 : 1;
}

process.exit(main());
