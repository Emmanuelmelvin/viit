import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "./repository.js";

export type Index = Record<string, string>;

function getIndexPath(): string {
  return path.join(getViitDirectory(), "index");
}

export async function readIndex(): Promise<Index> {
  try {
    const index = await readFile(getIndexPath(), "utf8");
    return JSON.parse(index) as Index;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function writeIndex(index: Index): Promise<void> {
  await writeFile(getIndexPath(), `${JSON.stringify(index, null, 2)}\n`);
}
