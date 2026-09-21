import { readdir } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "../core/repository.js";
import { readHead, readHeadRef, readRef, writeRef } from "../core/refs.js";

function branchRef(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Branch names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/heads/${name}`;
}

export async function branchCommand(name?: string): Promise<void> {
  if (name) {
    const refName = branchRef(name);

    try {
      await readRef(refName);
      throw new Error(`Branch '${name}' already exists`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    await writeRef(refName, await readHead());
    console.log(`Created branch ${name}`);
    return;
  }

  const currentRef = await readHeadRef();
  const branchesPath = path.join(getViitDirectory(), "refs", "heads");
  const branches = (await readdir(branchesPath)).sort();

  for (const branch of branches) {
    console.log(`${currentRef === `refs/heads/${branch}` ? "*" : " "} ${branch}`);
  }
}
