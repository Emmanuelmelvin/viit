import {
  readRepositoryFile,
  removeRepositoryFile,
  writeRepositoryFile,
} from "./repository-files.js";

async function readState(name: "mergeHead" | "mergeOriginalHead" | "mergeConflicts"):
  Promise<string | undefined> {
  return (await readRepositoryFile(name))?.trim();
}

// writes the merge state
export async function writeMergeState(
  originalHead: string,
  mergeHead: string,
  conflicts: string[],
): Promise<void> {
  await writeRepositoryFile("mergeOriginalHead", `${originalHead}\n`);
  await writeRepositoryFile("mergeHead", `${mergeHead}\n`);
  await writeRepositoryFile("mergeConflicts", `${JSON.stringify(conflicts)}\n`);
}

// reads the merge head
export async function readMergeHead(): Promise<string | undefined> {
  return readState("mergeHead");
}

// reads the merge original head
export async function readMergeOriginalHead(): Promise<string | undefined> {
  return readState("mergeOriginalHead");
}

// reads the merge conflicts
export async function readMergeConflicts(): Promise<string[]> {
  const conflicts = await readState("mergeConflicts");
  return conflicts ? JSON.parse(conflicts) as string[] : [];
}

// marks conflicts as resolved
export async function markConflictsResolved(filePaths: string[]): Promise<void> {
  const conflicts = await readMergeConflicts();
  const remaining = conflicts.filter((filePath) => !filePaths.includes(filePath));

  if (remaining.length > 0) {
    await writeRepositoryFile("mergeConflicts", `${JSON.stringify(remaining)}\n`);
    return;
  }

  await removeRepositoryFile("mergeConflicts");
}

//cancels all merges.
export async function clearMergeState(): Promise<void> {
  await Promise.all([
    removeRepositoryFile("mergeHead"),
    removeRepositoryFile("mergeOriginalHead"),
    removeRepositoryFile("mergeConflicts"),
  ]);
}
