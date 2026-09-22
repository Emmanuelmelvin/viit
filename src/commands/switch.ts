import { restoreCommit } from "./checkout.js";
import { readRef, writeHeadRef } from "../core/refs.js";
import { assertCleanWorktree } from "../core/worktree.js";
import { NAME_PATTERN } from "../core/config.js";

function branchRef(name: string): string {
  if (!NAME_PATTERN.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
}

export async function switchCommand(name: string): Promise<void> {
  const refName = branchRef(name);
  const commitId = await readRef(refName);

  await assertCleanWorktree("switch branches");
  await restoreCommit(commitId);
  await writeHeadRef(refName, `checkout: moving to ${name}`);
  console.log(`Switched to branch ${name}`);
}
