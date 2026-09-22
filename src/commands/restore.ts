import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCommitTree } from "../core/commits.js";
import { readIndex, writeIndex } from "../core/index.js";
import { readObject } from "../core/objects.js";
import { readHead } from "../core/refs.js";
import { readTree } from "../core/trees.js";

function toIndexPath(fileName: string): string {
  const indexPath = path.relative(process.cwd(), path.resolve(fileName)).replaceAll("\\", "/");

  if (!indexPath || indexPath === ".." || indexPath.startsWith("../")) {
    throw new Error(`'${fileName}' is outside the repository`);
  }

  return indexPath;
}

async function readHeadTree(): Promise<Record<string, string>> {
  return readTree(await readCommitTree(await readHead()));
}

async function restoreFile(filePath: string, objectId: string | undefined): Promise<void> {
  const absolutePath = path.resolve(filePath);

  if (!objectId) {
    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    return;
  }

  const object = await readObject(objectId);

  if (object.type !== "blob") {
    throw new Error(`${objectId} is not a blob object`);
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, object.content);
}

export async function restoreCommand(
  fileNames: string[],
  staged = false,
): Promise<void> {
  const index = await readIndex();
  const paths = fileNames.map(toIndexPath);
  const headTree = staged || paths.some((filePath) => !index[filePath])
    ? await readHeadTree()
    : {};

  for (const filePath of paths) {
    const isTracked = Boolean(index[filePath] || headTree[filePath]);

    if (!isTracked) {
      throw new Error(`pathspec '${filePath}' did not match any tracked files`);
    }
  }

  for (const filePath of paths) {
    if (staged) {
      if (headTree[filePath]) {
        index[filePath] = headTree[filePath];
      } else {
        delete index[filePath];
      }
      console.log(`unstaged ${filePath}`);
    } else {
      await restoreFile(filePath, index[filePath]);
      console.log(`restored ${filePath}`);
    }
  }

  if (staged) {
    await writeIndex(index);
  }
}
