import { writeIndex } from "../core/index.js";
import { readMergeHead } from "../core/merge-state.js";
import { readCommitTree } from "../core/commits.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readHead, readHeadRef, readRef, writeRef } from "../core/refs.js";
import { readTree } from "../core/trees.js";
import { restoreCommit } from "./checkout.js";

const HASH_PATTERN = /^[0-9a-f]{40}$/;

async function resolveTarget(target: string): Promise<string> {
  if (target === "HEAD") {
    return readHead();
  }

  if (HASH_PATTERN.test(target)) {
    return target;
  }

  if (/^[A-Za-z0-9._-]+$/.test(target)) {
    return readRef(`refs/heads/${target}`);
  }

  throw new Error(`'${target}' is not a valid commit ID or branch name`);
}

export async function resetCommand(
  target: string,
  mode: "soft" | "mixed" | "hard" = "mixed",
): Promise<void> {
  if (await readMergeHead() || await readRebaseState()) {
    throw new Error("Cannot reset while a merge or rebase is in progress");
  }

  const targetId = await resolveTarget(target);
  const targetTreeId = await readCommitTree(targetId);
  const targetTree = await readTree(targetTreeId);
  const currentRef = await readHeadRef();

  if (mode === "soft") {
    await writeRef(currentRef, targetId);
  } else if (mode === "mixed") {
    await writeIndex(targetTree);
    await writeRef(currentRef, targetId);
  } else {
    await restoreCommit(targetId);
    await writeRef(currentRef, targetId);
  }

  console.log(`Reset ${currentRef.slice("refs/heads/".length)} to ${targetId} (${mode})`);
}
