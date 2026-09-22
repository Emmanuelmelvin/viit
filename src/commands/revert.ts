import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readCommitMessage,
  readCommitParents,
  readCommitTree,
  writeCommit,
} from "../core/commits.js";
import { readIndex } from "../core/index.js";
import { readMergeHead } from "../core/merge-state.js";
import { readObject } from "../core/objects.js";
import {
  clearRevertState,
  readRevertState,
  type RevertState,
  writeRevertState,
} from "../core/revert-state.js";
import { readHeadRef, readRef, writeRef } from "../core/refs.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readTree, writeTree } from "../core/trees.js";
import { assertCleanWorktree } from "../core/worktree.js";
import { restoreCommit, restoreTree } from "./checkout.js";
import { resolveRevision } from "../core/revisions.js";

type Tree = Record<string, string>;

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
  revertedId: string | undefined,
  commitId: string,
): Promise<void> {
  const ours = await readBlob(oursId);
  const reverted = await readBlob(revertedId);
  const oursText = ours.endsWith("\n") ? ours : `${ours}\n`;
  const revertedText = reverted.endsWith("\n") ? reverted : `${reverted}\n`;
  const content = `<<<<<<< HEAD\n${oursText}=======\n${revertedText}>>>>>>> parent of ${commitId}\n`;
  const absolutePath = path.resolve(process.cwd(), filePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

async function reversePatch(
  targetTree: Tree,
  currentTree: Tree,
  parentTree: Tree,
  commitId: string,
): Promise<{ tree: Tree; conflicts: string[] }> {
  const nextTree = { ...currentTree };
  const conflicts: string[] = [];
  const filePaths = new Set([
    ...Object.keys(targetTree),
    ...Object.keys(parentTree),
    ...Object.keys(currentTree),
  ]);

  for (const filePath of [...filePaths].sort()) {
    const base = targetTree[filePath];
    const ours = currentTree[filePath];
    const reverted = parentTree[filePath];

    if (ours === reverted) {
      continue;
    }

    if (ours === base) {
      if (reverted) {
        nextTree[filePath] = reverted;
      } else {
        delete nextTree[filePath];
      }
      continue;
    }

    if (reverted === base) {
      continue;
    }

    conflicts.push(filePath);
    delete nextTree[filePath];
  }

  return { tree: nextTree, conflicts };
}

async function continueRevert(): Promise<void> {
  const state = await readRevertState();

  if (!state) {
    throw new Error("There is no revert in progress");
  }

  if (state.conflicts.length > 0) {
    throw new Error(`Resolve revert conflicts first: ${state.conflicts.join(", ")}`);
  }

  const treeId = await writeTree(await readIndex());
  const commitId = await writeCommit(
    treeId,
    state.originalHead,
    `Revert "${await readCommitMessage(state.commitId)}"`,
  );

  await writeRef(state.branchRef, commitId);
  await clearRevertState();
  console.log(`Revert complete at ${commitId}`);
}

async function abortRevert(): Promise<void> {
  const state = await readRevertState();

  if (!state) {
    throw new Error("There is no revert in progress");
  }

  await restoreCommit(state.originalHead);
  await writeRef(state.branchRef, state.originalHead);
  await clearRevertState();
  console.log("Revert aborted");
}

export async function revertCommand(target: string): Promise<void> {
  if (target === "--continue") {
    await continueRevert();
    return;
  }

  if (target === "--abort") {
    await abortRevert();
    return;
  }

  if (target.startsWith("--")) {
    throw new Error(`Unknown revert option '${target}'`);
  }

  if (await readRevertState()) {
    throw new Error("A revert is already in progress; use --continue or --abort");
  }

  if (await readMergeHead() || await readRebaseState()) {
    throw new Error("Cannot revert while a merge or rebase is in progress");
  }

  await assertCleanWorktree("revert");
  const targetId = await resolveRevision(target);
  const targetParents = await readCommitParents(targetId);

  if (targetParents.length > 1) {
    throw new Error("Reverting merge commits is not implemented yet");
  }

  const currentRef = await readHeadRef();
  const currentId = await readRef(currentRef);
  const targetTree = await readTree(await readCommitTree(targetId));
  const currentTree = await readTree(await readCommitTree(currentId));
  const parentTree = targetParents.length === 0
    ? {}
    : await readTree(await readCommitTree(targetParents[0]));
  const result = await reversePatch(targetTree, currentTree, parentTree, targetId);

  await restoreTree(result.tree);

  if (result.conflicts.length > 0) {
    for (const filePath of result.conflicts) {
      await writeConflict(filePath, currentTree[filePath], parentTree[filePath], targetId);
    }

    const state: RevertState = {
      branchRef: currentRef,
      originalHead: currentId,
      commitId: targetId,
      conflicts: result.conflicts,
    };

    await writeRevertState(state);
    console.error(`Revert stopped while reverting ${targetId}`);
    console.error("Resolve the conflicts, run 'viit add <file>', then run 'viit revert --continue'.");
    return;
  }

  const treeId = await writeTree(result.tree);
  const commitId = await writeCommit(
    treeId,
    currentId,
    `Revert "${await readCommitMessage(targetId)}"`,
  );

  await writeRef(currentRef, commitId);
  console.log(`Reverted ${targetId} in commit ${commitId}`);
}
