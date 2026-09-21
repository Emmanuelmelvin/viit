import { readIndex } from "../core/index.js";
import { writeTree } from "../core/trees.js";

export async function writeTreeCommand(): Promise<void> {
  const treeObjectId = await writeTree(await readIndex());
  console.log(treeObjectId);
}
