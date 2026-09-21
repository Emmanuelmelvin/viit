import { readIndex } from "../core/index.js";
import { writeCommit } from "../core/commits.js";
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

  const commitId = await writeCommit(treeId, parentId, message);
  await writeRef(refName, commitId);
  console.log(commitId);
}
