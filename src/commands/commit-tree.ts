import { writeCommit } from "../core/commits.js";

//creates a commit from a tree and parent commits.
export async function commitTreeCommand(
  treeId: string,
  parentId: string | undefined,
  message: string,
): Promise<void> {
  console.log(await writeCommit(treeId, parentId, message));
}
