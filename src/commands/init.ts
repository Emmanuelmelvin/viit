import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "../core/repository.js";

export async function initCommand(): Promise<void> {
  const viitDirectory = getViitDirectory();

  // The object database will store blobs, trees, and commits.
  await mkdir(path.join(viitDirectory, "objects"), { recursive: true });
  await mkdir(path.join(viitDirectory, "refs", "heads"), { recursive: true });

  // HEAD records the branch currently checked out.
  await writeFile(path.join(viitDirectory, "HEAD"), "ref: refs/heads/main\n");

  console.log(`Initialized empty Viit repository in ${viitDirectory}`);
}
