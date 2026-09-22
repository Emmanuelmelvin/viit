import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readIndex, writeIndex } from "../core/index.js";
import { readObject } from "../core/objects.js";
import { readHeadRef, writeRef } from "../core/refs.js";
import { readCommitTree } from "../core/commits.js";
import { readTree } from "../core/trees.js";
import { assertCleanWorktree } from "../core/worktree.js";
import { HASH_PATTERN } from "../core/config.js";
import { resolveRevision } from "../core/revisions.js";

export async function restoreTree(targetIndex: Record<string, string>): Promise<void> {
  const currentIndex = await readIndex();

  for (const [filePath, objectId] of Object.entries(targetIndex)) {
    const object = await readObject(objectId);

    if (object.type !== "blob") {
      throw new Error(`${objectId} is not a blob object`);
    }

    const absolutePath = path.resolve(process.cwd(), filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, object.content);
  }

  for (const filePath of Object.keys(currentIndex)) {
    if (targetIndex[filePath]) {
      continue;
    }

    try {
      await unlink(path.resolve(process.cwd(), filePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  await writeIndex(targetIndex);
}

export async function restoreCommit(commitId: string): Promise<void> {
  if (!HASH_PATTERN.test(commitId)) {
    throw new Error("Commit ID must be a 40-character SHA-1 hash");
  }

  const treeId = await readCommitTree(commitId);
  await restoreTree(await readTree(treeId));
}

export async function checkoutCommand(revision: string): Promise<void> {
  await assertCleanWorktree("checkout");
  const commitId = await resolveRevision(revision);
  await restoreCommit(commitId);
  await writeRef(await readHeadRef(), commitId, `checkout: ${revision}`);
  console.log(`Checked out ${revision} (${commitId})`);
}
