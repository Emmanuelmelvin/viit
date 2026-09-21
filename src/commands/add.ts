import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { readIndex, writeIndex } from "../core/index.js";
import { markConflictsResolved } from "../core/merge-state.js";
import { markRebaseConflictsResolved } from "../core/rebase-state.js";
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

  for (const fileName of fileNames) {
    for (const file of await expandPath(fileName)) {
      files.add(file);
    }
  }

  const stagedPaths: string[] = [];

  for (const fileName of files) {
    const objectId = await writeBlob(fileName);
    const indexPath = toIndexPath(fileName);
    index[indexPath] = objectId;
    stagedPaths.push(indexPath);
    console.log(`added ${indexPath}`);
  }

  await writeIndex(index);
  await markConflictsResolved(stagedPaths);
  await markRebaseConflictsResolved(stagedPaths);
}
