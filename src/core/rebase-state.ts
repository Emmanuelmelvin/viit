import {
  readRepositoryFile,
  removeRepositoryFile,
  writeRepositoryFile,
} from "./repository-files.js";

export type RebaseState = {
  branchRef: string;
  originalHead: string;
  onto: string;
  currentParent: string;
  commits: string[];
  nextIndex: number;
  conflicts: string[];
};

export async function readRebaseState(): Promise<RebaseState | undefined> {
  const state = await readRepositoryFile("rebaseState");
  return state ? JSON.parse(state) as RebaseState : undefined;
}

export async function writeRebaseState(state: RebaseState): Promise<void> {
  await writeRepositoryFile("rebaseState", `${JSON.stringify(state, null, 2)}\n`);
}

export async function markRebaseConflictsResolved(filePaths: string[]): Promise<void> {
  const state = await readRebaseState();

  if (!state) {
    return;
  }

  state.conflicts = state.conflicts.filter((filePath) => !filePaths.includes(filePath));
  await writeRebaseState(state);
}

export async function clearRebaseState(): Promise<void> {
  await removeRepositoryFile("rebaseState");
}
