import { writeIndex } from "../core/index.js";
import { readMergeHead } from "../core/merge-state.js";
import { readCommitTree } from "../core/commits.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readHeadRef, writeRef } from "../core/refs.js";
import { readTree } from "../core/trees.js";
import { restoreCommit } from "./checkout.js";
import { resolveRevision } from "../core/revisions.js";

export async function resetCommand(
  target: string,
  mode: "soft" | "mixed" | "hard" = "mixed",
): Promise<void> {
  if (await readMergeHead() || await readRebaseState()) {
    throw new Error("Cannot reset while a merge or rebase is in progress");
  }

  const targetId = await resolveRevision(target);
  const targetTreeId = await readCommitTree(targetId);
  const targetTree = await readTree(targetTreeId);
  const currentRef = await readHeadRef();

  if (mode === "soft") {
    await writeRef(currentRef, targetId, `reset: ${mode}`);
  } else if (mode === "mixed") {
    await writeIndex(targetTree);
    await writeRef(currentRef, targetId, `reset: ${mode}`);
  } else {
    await restoreCommit(targetId);
    await writeRef(currentRef, targetId, `reset: ${mode}`);
  }

  console.log(`Reset ${currentRef.slice("refs/heads/".length)} to ${targetId} (${mode})`);
}
