import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { readIndex, writeIndex } from "../core/index.js";
import { hashBlob } from "../core/objects.js";

function toIndexPath(fileName: string): string {
  const indexPath = path.relative(process.cwd(), path.resolve(fileName)).replaceAll("\\", "/");

  if (!indexPath || indexPath === ".." || indexPath.startsWith("../")) {
    throw new Error(`'${fileName}' is outside the repository`);
  }

  return indexPath;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function mvCommand(source: string, destination: string): Promise<void> {
  const index = await readIndex();
  const sourcePath = toIndexPath(source);
  const destinationPath = toIndexPath(destination);
  const sourceObjectId = index[sourcePath];

  if (!sourceObjectId) {
    throw new Error(`pathspec '${sourcePath}' did not match any tracked files`);
  }

  if (sourcePath === destinationPath) {
    throw new Error("Source and destination are the same file");
  }

  if (index[destinationPath]) {
    throw new Error(`destination '${destinationPath}' is already tracked`);
  }

  const sourceAbsolutePath = path.resolve(sourcePath);
  const destinationAbsolutePath = path.resolve(destinationPath);

  if (!(await pathExists(sourceAbsolutePath))) {
    throw new Error(`source '${sourcePath}' does not exist`);
  }

  if (!(await stat(sourceAbsolutePath)).isFile()) {
    throw new Error(`source '${sourcePath}' is not a file`);
  }

  if (await pathExists(destinationAbsolutePath)) {
    throw new Error(`destination '${destinationPath}' already exists`);
  }

  if (await hashBlob(sourceAbsolutePath) !== sourceObjectId) {
    throw new Error(`'${sourcePath}' has changes; add or commit it before moving`);
  }

  await mkdir(path.dirname(destinationAbsolutePath), { recursive: true });
  await rename(sourceAbsolutePath, destinationAbsolutePath);
  delete index[sourcePath];
  index[destinationPath] = sourceObjectId;
  await writeIndex(index);
  console.log(`renamed ${sourcePath} -> ${destinationPath}`);
}
