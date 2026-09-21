import { readCommitParents } from "./commits.js";

export async function isAncestor(
  ancestorId: string,
  commitId: string,
): Promise<boolean> {
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

export async function findMergeBase(
  firstId: string,
  secondId: string,
): Promise<string> {
  const firstAncestors = new Set<string>();
  const firstPending = [firstId];

  while (firstPending.length > 0) {
    const currentId = firstPending.pop()!;

    if (firstAncestors.has(currentId)) {
      continue;
    }

    firstAncestors.add(currentId);
    firstPending.push(...await readCommitParents(currentId));
  }

  const secondPending = [secondId];
  const visited = new Set<string>();

  while (secondPending.length > 0) {
    const currentId = secondPending.shift()!;

    if (firstAncestors.has(currentId)) {
      return currentId;
    }

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    secondPending.push(...await readCommitParents(currentId));
  }

  throw new Error("Branches do not have a common ancestor");
}
