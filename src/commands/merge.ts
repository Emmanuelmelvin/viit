import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCommitParents, readCommitTree, writeCommit } from "../core/commits.js";
import { writeIndex } from "../core/index.js";
import {
  clearMergeState,
  readMergeHead,
  readMergeOriginalHead,
  writeMergeState,
} from "../core/merge-state.js";
import { readObject } from "../core/objects.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { readTree, writeTree } from "../core/trees.js";
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

async function findMergeBase(firstId: string, secondId: string): Promise<string> {
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

async function readBlob(objectId: string | undefined): Promise<string> {
  if (!objectId) {
    return "";
  }

  const object = await readObject(objectId);

  if (object.type !== "blob") {
    throw new Error(`${objectId} is not a blob object`);
  }

  return object.content.toString();
}

async function writeConflict(
  filePath: string,
  oursId: string | undefined,
  theirsId: string | undefined,
  targetBranch: string,
): Promise<void> {
  const ours = await readBlob(oursId);
  const theirs = await readBlob(theirsId);
  const oursText = ours.endsWith("\n") ? ours : `${ours}\n`;
  const theirsText = theirs.endsWith("\n") ? theirs : `${theirs}\n`;
  const content = `<<<<<<< HEAD\n${oursText}=======\n${theirsText}>>>>>>> ${targetBranch}\n`;
  const absolutePath = path.resolve(process.cwd(), filePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function mergeTrees(
  baseTree: Record<string, string>,
  oursTree: Record<string, string>,
  theirsTree: Record<string, string>,
  targetBranch: string,
): Promise<{ index: Record<string, string>; conflicts: string[] }> {
  const merged: Record<string, string> = {};
  const conflicts: string[] = [];
  const filePaths = new Set([
    ...Object.keys(baseTree),
    ...Object.keys(oursTree),
    ...Object.keys(theirsTree),
  ]);

  for (const filePath of [...filePaths].sort()) {
    const base = baseTree[filePath];
    const ours = oursTree[filePath];
    const theirs = theirsTree[filePath];
    let result: string | undefined;

    if (ours === theirs) {
      result = ours;
    } else if (ours === base) {
      result = theirs;
    } else if (theirs === base) {
      result = ours;
    } else {
      conflicts.push(filePath);
      await writeConflict(filePath, ours, theirs, targetBranch);
    }

    if (result) {
      merged[filePath] = result;
    }
  }

  return { index: merged, conflicts };
}

export async function mergeCommand(targetBranch: string): Promise<void> {
  if (targetBranch === "--abort") {
    await abortMerge();
    return;
  }

  if (await readMergeHead()) {
    throw new Error("A merge is already in progress");
  }

  const currentRef = await readHeadRef();
  const targetRef = branchRef(targetBranch);
  const currentId = await readRef(currentRef);
  const targetId = await readRef(targetRef);

  if (currentId === targetId || await isAncestor(targetId, currentId)) {
    console.log(`Already up to date with ${targetBranch}`);
    return;
  }

  if (await isAncestor(currentId, targetId)) {
    await restoreCommit(targetId);
    await writeRef(currentRef, targetId);
    console.log(`Fast-forwarded ${currentRef.slice("refs/heads/".length)} to ${targetId}`);
    return;
  }

  const baseId = await findMergeBase(currentId, targetId);
  const baseTree = await readTree(await readCommitTree(baseId));
  const oursTree = await readTree(await readCommitTree(currentId));
  const theirsTree = await readTree(await readCommitTree(targetId));
  const result = await mergeTrees(baseTree, oursTree, theirsTree, targetBranch);

  if (result.conflicts.length > 0) {
    await writeMergeState(currentId, targetId, result.conflicts);
    console.error("Merge conflicts:");
    for (const filePath of result.conflicts) {
      console.error(`  ${filePath}`);
    }
    return;
  }

  await writeIndex(result.index);
  const treeId = await writeTree(result.index);
  const mergeCommitId = await writeCommit(
    treeId,
    [currentId, targetId],
    `Merge branch '${targetBranch}'`,
  );

  await restoreCommit(mergeCommitId);
  await writeRef(currentRef, mergeCommitId);
  console.log(`Merged ${targetBranch} in commit ${mergeCommitId}`);
}

async function abortMerge(): Promise<void> {
  const originalHead = await readMergeOriginalHead();

  if (!originalHead) {
    throw new Error("There is no merge to abort");
  }

  const currentRef = await readHeadRef();
  await restoreCommit(originalHead);
  await writeRef(currentRef, originalHead);
  await clearMergeState();
  console.log("Merge aborted");
}
