import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { readIndex, writeIndex } from "../core/index.js";
import { markConflictsResolved, readMergeConflicts } from "../core/merge-state.js";
import { markRebaseConflictsResolved, readRebaseState } from "../core/rebase-state.js";
import { markRevertConflictsResolved, readRevertState } from "../core/revert-state.js";
import { writeBlob } from "../core/objects.js";

const IGNORED_DIRECTORIES = new Set([".git", ".viit", "dist", "node_modules"]);

function toIndexPath(fileName: string): string {
  return path.relative(process.cwd(), path.resolve(fileName)).replaceAll("\\", "/");
}

async function expandPath(fileName: string): Promise<string[]> {
  const absolutePath = path.resolve(fileName);
  const fileInfo = await stat(absolutePath);

  if (fileInfo.isFile()) {
    return [absolutePath];
  }

  if (!fileInfo.isDirectory()) {
    return [];
  }

  const files: string[] = [];

  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    files.push(...await expandPath(path.join(absolutePath, entry.name)));
  }

  return files;
}

export async function addCommand(fileNames: string[]): Promise<void> {
  const index = await readIndex();
  const files = new Set<string>();
  const mergeConflicts = await readMergeConflicts();
  const rebaseState = await readRebaseState();
  const revertState = await readRevertState();
  const conflictPaths = new Set([
    ...mergeConflicts,
    ...(rebaseState?.conflicts ?? []),
    ...(revertState?.conflicts ?? []),
  ]);

  for (const fileName of fileNames) {
    try {
      for (const file of await expandPath(fileName)) {
        files.add(file);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      files.add(path.resolve(fileName));
    }
  }

  const stagedPaths: string[] = [];

  for (const fileName of files) {
    const indexPath = toIndexPath(fileName);

    try {
      index[indexPath] = await writeBlob(fileName);
      console.log(`added ${indexPath}`);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT"
        || (!index[indexPath] && !conflictPaths.has(indexPath))
      ) {
        throw error;
      }

      delete index[indexPath];
      console.log(`removed ${indexPath}`);
    }

    stagedPaths.push(indexPath);
  }

  await writeIndex(index);
  await markConflictsResolved(stagedPaths);
  await markRebaseConflictsResolved(stagedPaths);
  await markRevertConflictsResolved(stagedPaths);
}
