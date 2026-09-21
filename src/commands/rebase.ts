import { readCommitMessage, readCommitParents, readCommitTree, writeCommit } from "../core/commits.js";
import { findMergeBase } from "../core/history.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { readTree, writeTree } from "../core/trees.js";
import { restoreCommit } from "./checkout.js";

type Tree = Record<string, string>;

function branchRef(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
}

function applyCommitPatch(
  parentTree: Tree,
  commitTree: Tree,
  rebasedTree: Tree,
  commitId: string,
): Tree {
  const nextTree = { ...rebasedTree };
  const filePaths = new Set([
    ...Object.keys(parentTree),
    ...Object.keys(commitTree),
  ]);

  for (const filePath of filePaths) {
    const parentBlob = parentTree[filePath];
    const commitBlob = commitTree[filePath];
    const currentBlob = rebasedTree[filePath];

    if (commitBlob === parentBlob) {
      continue;
    }

    if (currentBlob !== parentBlob && currentBlob !== commitBlob) {
      throw new Error(`Rebase conflict in '${filePath}' while replaying ${commitId}`);
    }

    if (commitBlob) {
      nextTree[filePath] = commitBlob;
    } else {
      delete nextTree[filePath];
    }
  }

  return nextTree;
}

async function collectCommits(currentId: string, baseId: string): Promise<string[]> {
  const commits: string[] = [];
  let cursor = currentId;

  while (cursor !== baseId) {
    const parents = await readCommitParents(cursor);

    if (parents.length > 1) {
      throw new Error("Rebasing merge commits is not implemented yet");
    }

    commits.push(cursor);

    if (parents.length === 0) {
      throw new Error("The current branch does not descend from the rebase base");
    }

    cursor = parents[0];
  }

  return commits.reverse();
}

export async function rebaseCommand(targetBranch: string): Promise<void> {
  const currentRef = await readHeadRef();
  const targetRef = branchRef(targetBranch);

  if (currentRef === targetRef) {
    throw new Error("Cannot rebase a branch onto itself");
  }

  const currentId = await readRef(currentRef);
  const targetId = await readRef(targetRef);

  if (currentId === targetId) {
    console.log("Current branch is already up to date");
    return;
  }

  const baseId = await findMergeBase(currentId, targetId);

  if (baseId === currentId) {
    await restoreCommit(targetId);
    await writeRef(currentRef, targetId);
    console.log(`Fast-forwarded ${currentRef.slice("refs/heads/".length)} to ${targetId}`);
    return;
  }

  const commits = await collectCommits(currentId, baseId);
  let rebasedTree = await readTree(await readCommitTree(targetId));
  const replayed: Array<{ commitId: string; tree: Tree; message: string }> = [];
  let originalParent = baseId;

  for (const commitId of commits) {
    const originalParents = await readCommitParents(commitId);
    const parentTree = await readTree(await readCommitTree(originalParent));
    const commitTree = await readTree(await readCommitTree(commitId));

    rebasedTree = applyCommitPatch(parentTree, commitTree, rebasedTree, commitId);
    replayed.push({
      commitId,
      tree: rebasedTree,
      message: await readCommitMessage(commitId),
    });
    originalParent = originalParents[0];
  }

  let rebasedParent = targetId;

  for (const replay of replayed) {
    const treeId = await writeTree(replay.tree);
    rebasedParent = await writeCommit(treeId, rebasedParent, replay.message);
  }

  await restoreCommit(rebasedParent);
  await writeRef(currentRef, rebasedParent);
  console.log(`Rebased ${currentRef.slice("refs/heads/".length)} onto ${targetBranch}`);
}
