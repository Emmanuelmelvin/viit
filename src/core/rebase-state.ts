import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "./repository.js";

export type RebaseState = {
  branchRef: string;
  originalHead: string;
  onto: string;
  currentParent: string;
  commits: string[];
  nextIndex: number;
  conflicts: string[];
};

function statePath(): string {
  return path.join(getViitDirectory(), "REBASE_STATE");
}

export async function readRebaseState(): Promise<RebaseState | undefined> {
  try {
    return JSON.parse(await readFile(statePath(), "utf8")) as RebaseState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function writeRebaseState(state: RebaseState): Promise<void> {
  await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`);
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
  try {
    await unlink(statePath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
