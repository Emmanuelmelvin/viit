import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { REF_PATTERN } from "./config.js";
import { appendReflog, EMPTY_OBJECT_ID } from "./reflog.js";
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

async function readRefOrEmpty(refPath: string): Promise<string> {
  try {
    return (await readFile(refPath, "utf8")).trim() || EMPTY_OBJECT_ID;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_OBJECT_ID;
    }

    throw error;
  }
}

export async function writeRef(
  refName: string,
  objectId: string,
  action = "update",
): Promise<void> {
  const refPath = getRefPath(refName);
  const oldId = await readRefOrEmpty(refPath);
  await mkdir(path.dirname(refPath), { recursive: true });
  await writeFile(refPath, `${objectId}\n`);

  if (refName.startsWith("refs/heads/")) {
    await appendReflog(refName, oldId, objectId, action);

    try {
      if (await readHeadRef() === refName) {
        await appendReflog("HEAD", oldId, objectId, action);
      }
    } catch (error) {
      if ((error as Error).message !== "HEAD does not exist") {
        throw error;
      }
    }
  }
}

export async function writeHeadRef(refName: string, action = "checkout"): Promise<void> {
  getRefPath(refName);
  const oldId = await readHead().catch(() => EMPTY_OBJECT_ID);
  const newId = await readRefOrEmpty(getRefPath(refName));
  await writeRepositoryFile("head", `ref: ${refName}\n`);

  if (oldId !== EMPTY_OBJECT_ID || newId !== EMPTY_OBJECT_ID) {
    await appendReflog("HEAD", oldId, newId, action);
  }
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
