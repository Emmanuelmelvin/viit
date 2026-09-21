import { writeCommit } from "../core/commits.js";

export async function commitTreeCommand(
  treeId: string,
  parentId: string | undefined,
  message: string,
): Promise<void> {
  console.log(await writeCommit(treeId, parentId, message));
}
