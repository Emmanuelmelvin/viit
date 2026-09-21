import { readdir } from "node:fs/promises";
import path from "node:path";
import { readCommitTree } from "./commits.js";
import { readIndex } from "./index.js";
import { hashBlob } from "./objects.js";
import { readHead } from "./refs.js";
import { readTree } from "./trees.js";

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
      files.push(...await listWorkingFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function readHeadTree(): Promise<Record<string, string>> {
  try {
    const commitId = await readHead();
    return readTree(await readCommitTree(commitId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function assertCleanWorktree(operation: string): Promise<void> {
  const index = await readIndex();
  const headTree = await readHeadTree();
  const workingFiles = await listWorkingFiles(process.cwd());
  const workingSet = new Set(workingFiles);
  const paths = new Set([...Object.keys(headTree), ...Object.keys(index)]);

  for (const filePath of paths) {
    if (headTree[filePath] !== index[filePath]) {
      throw new Error(`Cannot ${operation}: staged changes are present`);
    }
  }

  for (const [filePath, objectId] of Object.entries(index)) {
    if (!workingSet.has(filePath)) {
      throw new Error(`Cannot ${operation}: '${filePath}' has been deleted but is not committed`);
    }

    if (await hashBlob(filePath) !== objectId) {
      throw new Error(`Cannot ${operation}: '${filePath}' has unstaged changes`);
    }
  }

  for (const filePath of workingFiles) {
    if (!index[filePath]) {
      throw new Error(`Cannot ${operation}: untracked file '${filePath}' would be at risk`);
    }
  }
}
