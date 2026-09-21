import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCommitMessage, readCommitParents, readCommitTree, writeCommit } from "../core/commits.js";
import { readIndex, writeIndex } from "../core/index.js";
import { findMergeBase } from "../core/history.js";
import {
  clearRebaseState,
  readRebaseState,
  type RebaseState,
  writeRebaseState,
} from "../core/rebase-state.js";
import { readObject } from "../core/objects.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { readTree, writeTree } from "../core/trees.js";
import { restoreCommit, restoreTree } from "./checkout.js";

type Tree = Record<string, string>;

function branchRef(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
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
  commitId: string,
): Promise<void> {
  const ours = await readBlob(oursId);
  const theirs = await readBlob(theirsId);
  const oursText = ours.endsWith("\n") ? ours : `${ours}\n`;
  const theirsText = theirs.endsWith("\n") ? theirs : `${theirs}\n`;
  const content = `<<<<<<< HEAD\n${oursText}=======\n${theirsText}>>>>>>> ${commitId}\n`;
  const absolutePath = path.resolve(process.cwd(), filePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function applyCommitPatch(
  parentTree: Tree,
  commitTree: Tree,
  currentTree: Tree,
  commitId: string,
): Promise<{ tree: Tree; conflicts: string[] }> {
  const nextTree = { ...currentTree };
  const conflicts: string[] = [];
  const filePaths = new Set([
    ...Object.keys(parentTree),
    ...Object.keys(commitTree),
  ]);

  for (const filePath of [...filePaths].sort()) {
    const base = parentTree[filePath];
    const ours = currentTree[filePath];
    const theirs = commitTree[filePath];

    if (ours === theirs) {
      continue;
    }

    if (ours === base) {
      if (theirs) {
        nextTree[filePath] = theirs;
      } else {
        delete nextTree[filePath];
      }
      continue;
    }

    if (theirs === base) {
      continue;
    }

    conflicts.push(filePath);
    delete nextTree[filePath];
  }

  return { tree: nextTree, conflicts };
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

async function replayNext(state: RebaseState): Promise<void> {
  if (state.nextIndex >= state.commits.length) {
    await restoreCommit(state.currentParent);
    await writeRef(state.branchRef, state.currentParent);
    await clearRebaseState();
    console.log(`Rebase complete at ${state.currentParent}`);
    return;
  }

  const commitId = state.commits[state.nextIndex];
  const parents = await readCommitParents(commitId);
  const parentId = parents[0];

  if (!parentId) {
    throw new Error(`Commit ${commitId} has no parent to replay`);
  }

  const parentTree = await readTree(await readCommitTree(parentId));
  const currentTree = await readTree(await readCommitTree(state.currentParent));
  const commitTree = await readTree(await readCommitTree(commitId));
  const result = await applyCommitPatch(parentTree, commitTree, currentTree, commitId);

  await restoreTree(result.tree);

  if (result.conflicts.length > 0) {
    for (const filePath of result.conflicts) {
      await writeConflict(filePath, currentTree[filePath], commitTree[filePath], commitId);
    }

    state.conflicts = result.conflicts;
    await writeIndex(result.tree);
    await writeRebaseState(state);
    console.error(`Rebase stopped while replaying ${commitId}`);
    console.error("Resolve the conflicts, run 'viit add <file>', then run 'viit rebase --continue'.");
    return;
  }

  const treeId = await writeTree(result.tree);
  state.currentParent = await writeCommit(
    treeId,
    state.currentParent,
    await readCommitMessage(commitId),
  );
  state.nextIndex += 1;
  await writeRebaseState(state);
  await replayNext(state);
}

async function continueRebase(): Promise<void> {
  const state = await readRebaseState();

  if (!state) {
    throw new Error("There is no rebase in progress");
  }

  if (state.conflicts.length > 0) {
    throw new Error(`Resolve rebase conflicts first: ${state.conflicts.join(", ")}`);
  }

  const commitId = state.commits[state.nextIndex];
  const treeId = await writeTree(await readIndex());
  state.currentParent = await writeCommit(
    treeId,
    state.currentParent,
    await readCommitMessage(commitId),
  );
  state.nextIndex += 1;
  await writeRebaseState(state);
  await replayNext(state);
}

async function skipRebase(): Promise<void> {
  const state = await readRebaseState();

  if (!state) {
    throw new Error("There is no rebase in progress");
  }

  await restoreCommit(state.currentParent);
  state.conflicts = [];
  state.nextIndex += 1;
  await writeRebaseState(state);
  await replayNext(state);
}

async function abortRebase(): Promise<void> {
  const state = await readRebaseState();

  if (!state) {
    throw new Error("There is no rebase in progress");
  }

  await restoreCommit(state.originalHead);
  await writeRef(state.branchRef, state.originalHead);
  await clearRebaseState();
  console.log("Rebase aborted");
}

export async function rebaseCommand(target: string): Promise<void> {
  if (target === "--continue") {
    await continueRebase();
    return;
  }

  if (target === "--abort") {
    await abortRebase();
    return;
  }

  if (target === "--skip") {
    await skipRebase();
    return;
  }

  if (target.startsWith("--")) {
    throw new Error(`Unknown rebase option '${target}'`);
  }

  if (await readRebaseState()) {
    throw new Error("A rebase is already in progress; use --continue, --skip, or --abort");
  }

  const currentRef = await readHeadRef();
  const targetRef = branchRef(target);

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

  const state: RebaseState = {
    branchRef: currentRef,
    originalHead: currentId,
    onto: targetId,
    currentParent: targetId,
    commits: await collectCommits(currentId, baseId),
    nextIndex: 0,
    conflicts: [],
  };

  await restoreCommit(targetId);
  await writeRebaseState(state);
  await replayNext(state);
}
