export interface MigrationOptions {
  dryRun: boolean;
  baselineThrough?: string;
  applyFromStart: boolean;
}

export function parseMigrationOptions(args: string[]): MigrationOptions {
  const options: MigrationOptions = { dryRun: false, applyFromStart: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--apply-from-start") {
      options.applyFromStart = true;
    } else if (arg === "--baseline-through") {
      const through = args[index + 1];
      if (!through) throw new Error("--baseline-through requires a migration number.");
      options.baselineThrough = through;
      index += 1;
    } else {
      throw new Error(`Unknown migration option: ${arg}`);
    }
  }

  if (options.baselineThrough && options.baselineThrough !== "0071") {
    throw new Error("Only --baseline-through 0071 is supported for the existing live database.");
  }
  if (options.baselineThrough && options.applyFromStart) {
    throw new Error("--baseline-through and --apply-from-start cannot be combined.");
  }
  if (options.dryRun && (options.baselineThrough || options.applyFromStart)) {
    throw new Error("--dry-run cannot be combined with baseline or apply-from-start options.");
  }
  return options;
}

function migrationNumber(filename: string): number {
  const match = /^(\d{4})_.+\.sql$/.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return Number(match[1]);
}

export function getBaselineFiles(files: string[], through: string): string[] {
  if (through !== "0071") {
    throw new Error("Only baseline through 0071 is supported.");
  }
  const ordered = [...files].sort((a, b) => migrationNumber(a) - migrationNumber(b));
  if (!ordered.some((filename) => filename.startsWith(`${through}_`))) {
    throw new Error(`Cannot baseline through ${through}: that migration file is missing.`);
  }
  const baseline = ordered.filter((filename) => migrationNumber(filename) <= Number(through));
  if (baseline.length === 0) throw new Error("No migration files are available to baseline.");
  return baseline;
}

export function validateAppliedFiles(files: string[], applied: string[]): void {
  const ordered = [...files].sort();
  if (new Set(applied).size !== applied.length) {
    throw new Error("Migration history contains duplicate filenames. Refusing to continue.");
  }
  for (let index = 0; index < applied.length; index += 1) {
    if (ordered[index] !== applied[index]) {
      const found = applied[index] ?? "<none>";
      const expected = ordered[index] ?? "<end of migration list>";
      throw new Error(
        `Migration history is unexpected: entry ${found} is not the next filename ${expected}. ` +
          "History must be a contiguous prefix of the repository migrations. Refusing to continue.",
      );
    }
  }
}

export function getPendingFiles(files: string[], applied: string[]): string[] {
  validateAppliedFiles(files, applied);
  return [...files].sort().slice(applied.length);
}
