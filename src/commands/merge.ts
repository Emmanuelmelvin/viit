import { readCommitParents } from "../core/commits.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { restoreCommit } from "./checkout.js";

function branchRef(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
}

async function isAncestor(ancestorId: string, commitId: string): Promise<boolean> {
  const pending = [commitId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const currentId = pending.pop()!;

    if (currentId === ancestorId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    pending.push(...await readCommitParents(currentId));
  }

  return false;
}

export async function mergeCommand(targetBranch: string): Promise<void> {
  const currentRef = await readHeadRef();
  const targetRef = branchRef(targetBranch);
  const currentId = await readRef(currentRef);
  const targetId = await readRef(targetRef);

  if (currentId === targetId || await isAncestor(targetId, currentId)) {
    console.log(`Already up to date with ${targetBranch}`);
    return;
  }

  if (!await isAncestor(currentId, targetId)) {
    throw new Error("Non-fast-forward merge is not implemented yet");
  }

  await restoreCommit(targetId);
  await writeRef(currentRef, targetId);
  console.log(`Fast-forwarded ${currentRef.slice("refs/heads/".length)} to ${targetId}`);
}
