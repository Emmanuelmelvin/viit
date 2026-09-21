import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "./repository.js";

export function getRefPath(refName: string): string {
  if (!/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(refName) || refName.includes("..")) {
    throw new Error("Only local branch refs are supported");
  }

  return path.join(getViitDirectory(), refName);
}

export async function writeRef(refName: string, objectId: string): Promise<void> {
  const refPath = getRefPath(refName);
  await mkdir(path.dirname(refPath), { recursive: true });
  await writeFile(refPath, `${objectId}\n`);
}
