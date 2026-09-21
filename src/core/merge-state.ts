import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "./repository.js";

function statePath(name: string): string {
  return path.join(getViitDirectory(), name);
}

async function readState(name: string): Promise<string | undefined> {
  try {
    return (await readFile(statePath(name), "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function writeMergeState(
  originalHead: string,
  mergeHead: string,
  conflicts: string[],
): Promise<void> {
  await writeFile(statePath("MERGE_ORIG_HEAD"), `${originalHead}\n`);
  await writeFile(statePath("MERGE_HEAD"), `${mergeHead}\n`);
  await writeFile(statePath("MERGE_CONFLICTS"), `${JSON.stringify(conflicts)}\n`);
}

export async function readMergeHead(): Promise<string | undefined> {
  return readState("MERGE_HEAD");
}

export async function readMergeOriginalHead(): Promise<string | undefined> {
  return readState("MERGE_ORIG_HEAD");
}

export async function readMergeConflicts(): Promise<string[]> {
  const conflicts = await readState("MERGE_CONFLICTS");
  return conflicts ? JSON.parse(conflicts) as string[] : [];
}

export async function markConflictsResolved(filePaths: string[]): Promise<void> {
  const conflicts = await readMergeConflicts();
  const remaining = conflicts.filter((filePath) => !filePaths.includes(filePath));

  if (remaining.length > 0) {
    await writeFile(statePath("MERGE_CONFLICTS"), `${JSON.stringify(remaining)}\n`);
    return;
  }

  try {
    await unlink(statePath("MERGE_CONFLICTS"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function clearMergeState(): Promise<void> {
  for (const name of ["MERGE_HEAD", "MERGE_ORIG_HEAD", "MERGE_CONFLICTS"]) {
    try {
      await unlink(statePath(name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
