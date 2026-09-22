import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCommitTree } from "../core/commits.js";
import { readIndex } from "../core/index.js";
import { readObject } from "../core/objects.js";
import { readHead } from "../core/refs.js";
import { readTree } from "../core/trees.js";

type DiffLine = {
  marker: " " | "+" | "-";
  content: string;
};

function lines(content: Buffer): string[] {
  const result = content.toString().split(/\r?\n/);
  return result.at(-1) === "" ? result.slice(0, -1) : result;
}

function compareLines(oldLines: string[], newLines: string[]): DiffLine[] {
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

  const output: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === newLines[newIndex]
    ) {
      output.push({ marker: " ", content: oldLines[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      oldIndex < oldLines.length &&
      (newIndex === newLines.length ||
        lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1])
    ) {
      output.push({ marker: "-", content: oldLines[oldIndex] });
      oldIndex += 1;
    } else {
      output.push({ marker: "+", content: newLines[newIndex] });
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
    return readTree(await readCommitTree(commitId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function printHunk(oldLines: string[], newLines: string[], diffLines: DiffLine[]): void {
  const oldStart = oldLines.length === 0 ? 0 : 1;
  const newStart = newLines.length === 0 ? 0 : 1;
  console.log(`@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`);

  for (const line of diffLines) {
    console.log(`${line.marker}${line.content}`);
  }
}

async function printFileDiff(
  oldPath: string,
  newPath: string,
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

  console.log(`diff --viit a/${oldPath} b/${newPath}`);

  if (oldContent.includes(0) || newContent.includes(0)) {
    console.log(`Binary files a/${oldPath} and b/${newPath} differ`);
    return;
  }

  console.log(`--- ${oldObjectId ? `a/${oldPath}` : "/dev/null"}`);
  console.log(`+++ ${newObjectId || newFileContent ? `b/${newPath}` : "/dev/null"}`);
  printHunk(lines(oldContent), lines(newContent), compareLines(lines(oldContent), lines(newContent)));
}

function printRename(oldPath: string, newPath: string): void {
  console.log(`diff --viit a/${oldPath} b/${newPath}`);
  console.log("similarity index 100%");
  console.log(`rename from ${oldPath}`);
  console.log(`rename to ${newPath}`);
}

async function printCachedDiff(
  headTree: Record<string, string>,
  index: Record<string, string>,
): Promise<void> {
  const deleted = new Set(Object.keys(headTree).filter((filePath) => !index[filePath]));
  const added = new Set(Object.keys(index).filter((filePath) => !headTree[filePath]));
  const renamed = new Set<string>();

  for (const oldPath of [...deleted].sort()) {
    const newPath = [...added].find((filePath) => index[filePath] === headTree[oldPath]);

    if (!newPath) {
      continue;
    }

    deleted.delete(oldPath);
    added.delete(newPath);
    renamed.add(oldPath);
    renamed.add(newPath);
    printRename(oldPath, newPath);
  }

  const filePaths = new Set([
    ...Object.keys(headTree),
    ...Object.keys(index),
  ]);

  for (const filePath of [...filePaths].sort()) {
    if (renamed.has(filePath)) {
      continue;
    }

    if (!deleted.has(filePath) && !added.has(filePath) && !headTree[filePath] && !index[filePath]) {
      continue;
    }

    await printFileDiff(filePath, filePath, headTree[filePath], index[filePath]);
  }
}

export async function diffCommand(cached: boolean): Promise<void> {
  const index = await readIndex();

  if (cached) {
    await printCachedDiff(await readHeadTree(), index);
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

    await printFileDiff(filePath, filePath, objectId, undefined, currentContent);
  }
}
