import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getViitDirectory } from "../core/repository.js";
import { getRepositoryPath, writeRepositoryFile } from "../core/repository-files.js";

export async function initCommand(): Promise<void> {
  const viitDirectory = getViitDirectory();

  // The object database will store blobs, trees, and commits.
  await mkdir(getRepositoryPath("objects"), { recursive: true });
  await mkdir(path.join(getRepositoryPath("refs"), "heads"), { recursive: true });

  // HEAD records the branch currently checked out.
  await writeRepositoryFile("head", "ref: refs/heads/main\n");

  console.log(`Initialized empty Viit repository in ${viitDirectory}`);
}
