import { readIndex } from "../core/index.js";
import { writeCommit } from "../core/commits.js";
import { clearMergeState, readMergeConflicts, readMergeHead } from "../core/merge-state.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { writeTree } from "../core/trees.js";

export async function commitCommand(message: string): Promise<void> {
  const refName = await readHeadRef();
  const treeId = await writeTree(await readIndex());
  let parentId: string | undefined;

  try {
    parentId = await readRef(refName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const mergeHead = await readMergeHead();
  const conflicts = await readMergeConflicts();

  if (conflicts.length > 0) {
    throw new Error(`Resolve merge conflicts first: ${conflicts.join(", ")}`);
  }

  const parents = mergeHead && parentId ? [parentId, mergeHead] : parentId;
  const commitId = await writeCommit(treeId, parents, message);
  await writeRef(refName, commitId);
  await clearMergeState();
  console.log(commitId);
}
