import { restoreCommit } from "./checkout.js";
import { readRef, writeHeadRef } from "../core/refs.js";
import { assertCleanWorktree } from "../core/worktree.js";

function branchRef(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
}

export async function switchCommand(name: string): Promise<void> {
  const refName = branchRef(name);
  const commitId = await readRef(refName);

  await assertCleanWorktree("switch branches");
  await restoreCommit(commitId);
  await writeHeadRef(refName);
  console.log(`Switched to branch ${name}`);
}
