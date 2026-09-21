import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCommitTree } from "../core/commits.js";
import { readIndex } from "../core/index.js";
import { readObject } from "../core/objects.js";
import { readHead } from "../core/refs.js";
import { readTree } from "../core/trees.js";

function lines(content: Buffer): string[] {
  const result = content.toString().split(/\r?\n/);
  return result.at(-1) === "" ? result.slice(0, -1) : result;
}

function compareLines(oldLines: string[], newLines: string[]): string[] {
  const lengths = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lengths[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
    }
  }

  const output: string[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      output.push(` ${oldLines[oldIndex]}`);
      oldIndex += 1;
      newIndex += 1;
    } else if (
      oldIndex < oldLines.length &&
      (newIndex === newLines.length ||
        lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1])
    ) {
      output.push(`-${oldLines[oldIndex]}`);
      oldIndex += 1;
    } else {
      output.push(`+${newLines[newIndex]}`);
      newIndex += 1;
    }
  }

  return output;
}

async function readBlob(objectId: string): Promise<Buffer> {
  const object = await readObject(objectId);

  if (object.type !== "blob") {
    throw new Error(`${objectId} is not a blob object`);
  }

  return object.content;
}

async function readHeadTree(): Promise<Record<string, string>> {
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

async function printFileDiff(
  filePath: string,
  oldObjectId: string | undefined,
  newObjectId: string | undefined,
  newFileContent?: Buffer,
): Promise<void> {
  const oldContent = oldObjectId ? await readBlob(oldObjectId) : Buffer.alloc(0);
  const newContent = newFileContent ?? (
    newObjectId ? await readBlob(newObjectId) : Buffer.alloc(0)
  );

  if (oldContent.equals(newContent)) {
    return;
  }

  console.log(`diff --viit a/${filePath} b/${filePath}`);
  console.log(`--- a/${filePath}`);
  console.log(`+++ b/${filePath}`);
  console.log("@@");

  for (const line of compareLines(lines(oldContent), lines(newContent))) {
    console.log(line);
  }
}

export async function diffCommand(cached: boolean): Promise<void> {
  const index = await readIndex();

  if (cached) {
    const headTree = await readHeadTree();
    const filePaths = new Set([...Object.keys(headTree), ...Object.keys(index)]);

    for (const filePath of [...filePaths].sort()) {
      await printFileDiff(filePath, headTree[filePath], index[filePath]);
    }

    return;
  }

  for (const [filePath, objectId] of Object.entries(index).sort()) {
    let currentContent: Buffer;

    try {
      currentContent = await readFile(path.resolve(process.cwd(), filePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        currentContent = Buffer.alloc(0);
      } else {
        throw error;
      }
    }

    await printFileDiff(filePath, objectId, undefined, currentContent);
  }
}
