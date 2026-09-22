import {
  readRepositoryFile,
  removeRepositoryFile,
  writeRepositoryFile,
} from "./repository-files.js";

export type RevertState = {
  branchRef: string;
  originalHead: string;
  commitId: string;
  conflicts: string[];
};

export async function readRevertState(): Promise<RevertState | undefined> {
  const state = await readRepositoryFile("revertState");
  return state ? JSON.parse(state) as RevertState : undefined;
}

export async function writeRevertState(state: RevertState): Promise<void> {
  await writeRepositoryFile("revertState", `${JSON.stringify(state, null, 2)}\n`);
}

export async function markRevertConflictsResolved(filePaths: string[]): Promise<void> {
  const state = await readRevertState();

  if (!state) {
    return;
  }

  state.conflicts = state.conflicts.filter((filePath) => !filePaths.includes(filePath));
  await writeRevertState(state);
}

export async function clearRevertState(): Promise<void> {
  await removeRepositoryFile("revertState");
}
