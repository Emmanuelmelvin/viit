import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "./repository.js";

export const REPOSITORY_PATHS = {
  objects: "objects",
  refs: "refs",
  head: "HEAD",
  index: "index",
  mergeHead: "MERGE_HEAD",
  mergeOriginalHead: "MERGE_ORIG_HEAD",
  mergeConflicts: "MERGE_CONFLICTS",
  rebaseState: "REBASE_STATE",
  revertState: "REVERT_STATE",
} as const;

export type RepositoryPathName = keyof typeof REPOSITORY_PATHS;

export function getRepositoryPath(name: RepositoryPathName): string {
  return path.join(getViitDirectory(), REPOSITORY_PATHS[name]);
}

export async function readRepositoryFile(
  name: RepositoryPathName,
): Promise<string | undefined> {
  try {
    return await readFile(getRepositoryPath(name), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function writeRepositoryFile(
  name: RepositoryPathName,
  content: string,
): Promise<void> {
  const filePath = getRepositoryPath(name);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

export async function removeRepositoryFile(name: RepositoryPathName): Promise<void> {
  try {
    await unlink(getRepositoryPath(name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
