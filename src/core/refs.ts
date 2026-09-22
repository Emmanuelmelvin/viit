import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { REF_PATTERN } from "./config.js";
import { getViitDirectory } from "./repository.js";
import {
  readRepositoryFile,
  writeRepositoryFile,
} from "./repository-files.js";

export function getRefPath(refName: string): string {
  if (!REF_PATTERN.test(refName) || refName.includes("..")) {
    throw new Error("Only local branch and tag refs are supported");
  }

  return path.join(getViitDirectory(), refName);
}

export async function writeRef(refName: string, objectId: string): Promise<void> {
  const refPath = getRefPath(refName);
  await mkdir(path.dirname(refPath), { recursive: true });
  await writeFile(refPath, `${objectId}\n`);
}

export async function writeHeadRef(refName: string): Promise<void> {
  getRefPath(refName);
  await writeRepositoryFile("head", `ref: ${refName}\n`);
}

export async function readRef(refName: string): Promise<string> {
  return (await readFile(getRefPath(refName), "utf8")).trim();
}

export async function removeRef(refName: string): Promise<void> {
  try {
    await unlink(getRefPath(refName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function readHead(): Promise<string> {
  const refName = await readHeadRef();
  return readRef(refName);
}

export async function readHeadRef(): Promise<string> {
  const head = (await readRepositoryFile("head"))?.trim();

  if (!head) {
    throw new Error("HEAD does not exist");
  }

  if (head.startsWith("ref: ")) {
    return head.slice("ref: ".length);
  }

  throw new Error("Detached HEAD is not supported");
}
