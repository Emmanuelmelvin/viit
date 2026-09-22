import { readdir } from "node:fs/promises";
import path from "node:path";
import { readCommitTree } from "../core/commits.js";
import { readIndex } from "../core/index.js";
import { readMergeConflicts } from "../core/merge-state.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readRevertState } from "../core/revert-state.js";
import { hashBlob } from "../core/objects.js";
import { readHead, readHeadRef } from "../core/refs.js";
import { readTree } from "../core/trees.js";

const IGNORED_DIRECTORIES = new Set([".git", ".viit", "dist", "node_modules"]);

async function listWorkingFiles(
  directory: string,
  prefix = "",
): Promise<string[]> {
  const files: string[] = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listWorkingFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function getHeadTree(): Promise<Record<string, string>> {
  try {
    const commitId = await readHead();
    const treeId = await readCommitTree(commitId);
    return readTree(treeId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function printSection(title: string, entries: string[]): void {
  if (entries.length === 0) {
    return;
  }

  console.log(`${title}:`);
  for (const entry of entries.sort()) {
    console.log(`  ${entry}`);
  }
  console.log();
}

export async function statusCommand(): Promise<void> {
  const index = await readIndex();
  const headTree = await getHeadTree();
  const workingFiles = await listWorkingFiles(process.cwd());
  const workingSet = new Set(workingFiles);
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  const rebaseState = await readRebaseState();
  const revertState = await readRevertState();
  const conflicts = rebaseState?.conflicts ?? revertState?.conflicts ?? await readMergeConflicts();

  for (const [filePath, objectId] of Object.entries(index)) {
    if (!headTree[filePath]) {
      staged.push(`new file: ${filePath}`);
    } else if (headTree[filePath] !== objectId) {
      staged.push(`modified: ${filePath}`);
    }

    if (!workingSet.has(filePath)) {
      unstaged.push(`deleted: ${filePath}`);
    } else if (await hashBlob(filePath) !== objectId) {
      unstaged.push(`modified: ${filePath}`);
    }
  }

  for (const filePath of Object.keys(headTree)) {
    if (!index[filePath]) {
      staged.push(`deleted: ${filePath}`);
    }
  }

  for (const filePath of workingFiles) {
    if (!index[filePath]) {
      untracked.push(filePath);
    }
  }

  const refName = await readHeadRef();
  console.log(`On branch ${refName.split("/").at(-1)}`);
  console.log();

  if (rebaseState) {
    console.log(`Rebase in progress: replaying commit ${rebaseState.commits[rebaseState.nextIndex]}`);
    console.log();
  }

  if (revertState) {
    console.log(`Revert in progress: reverting commit ${revertState.commitId}`);
    console.log();
  }

  printSection("Unmerged paths", conflicts);
  printSection("Changes to be committed", staged);
  printSection("Changes not staged for commit", unstaged);
  printSection("Untracked files", untracked);
}
