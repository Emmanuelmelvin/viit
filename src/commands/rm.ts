import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { readIndex, writeIndex } from "../core/index.js";
import { markConflictsResolved } from "../core/merge-state.js";
import { markRebaseConflictsResolved } from "../core/rebase-state.js";
import { hashBlob } from "../core/objects.js";

function toIndexPath(fileName: string): string {
  const indexPath = path.relative(process.cwd(), path.resolve(fileName)).replaceAll("\\", "/");

  if (!indexPath || indexPath === ".." || indexPath.startsWith("../")) {
    throw new Error(`'${fileName}' is outside the repository`);
  }

  return indexPath;
}

async function fileHasChanges(fileName: string, expectedObjectId: string): Promise<boolean> {
  try {
    return await hashBlob(fileName) !== expectedObjectId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function rmCommand(fileNames: string[], cached = false): Promise<void> {
  const index = await readIndex();
  const indexPaths = fileNames.map(toIndexPath);

  for (const indexPath of indexPaths) {
    if (!index[indexPath]) {
      throw new Error(`pathspec '${indexPath}' did not match any tracked files`);
    }

    if (!cached && await fileHasChanges(indexPath, index[indexPath])) {
      throw new Error(`'${indexPath}' has changes; use viit add or commit it first`);
    }

    try {
      if ((await stat(path.resolve(indexPath))).isDirectory()) {
        throw new Error(`'${indexPath}' is a directory; recursive removal is not implemented yet`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  for (const indexPath of indexPaths) {
    delete index[indexPath];

    if (!cached) {
      try {
        await unlink(path.resolve(indexPath));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    console.log(`${cached ? "unstaged" : "removed"} ${indexPath}`);
  }

  await writeIndex(index);
  await markConflictsResolved(indexPaths);
  await markRebaseConflictsResolved(indexPaths);
}
