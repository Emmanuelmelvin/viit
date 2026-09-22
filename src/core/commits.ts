import { readObject, writeObject } from "./objects.js";
import { HASH_PATTERN } from "./config.js";
import { getIdentity } from "./identity.js";

export async function writeCommit(
  treeId: string,
  parentIds: string | string[] | undefined,
  message: string,
): Promise<string> {
  if (!HASH_PATTERN.test(treeId)) {
    throw new Error("Tree ID must be a 40-character SHA-1 hash");
  }

  const parents = parentIds === undefined
    ? []
    : Array.isArray(parentIds)
      ? parentIds
      : [parentIds];

  if (parents.some((parentId) => !HASH_PATTERN.test(parentId))) {
    throw new Error("Parent IDs must be 40-character SHA-1 hashes");
  }

  const identity = await getIdentity();
  const headers = [`tree ${treeId}`];

  headers.push(...parents.map((parentId) => `parent ${parentId}`));

  headers.push(`author ${identity}`, `committer ${identity}`);

  const content = Buffer.from(`${headers.join("\n")}\n\n${message}\n`);
  return writeObject("commit", content);
}

export async function readCommitTree(commitId: string): Promise<string> {
  const object = await readObject(commitId);

  if (object.type !== "commit") {
    throw new Error(`${commitId} is not a commit object`);
  }

  const treeHeader = object.content
    .toString()
    .split("\n")
    .find((line) => line.startsWith("tree "));

  if (!treeHeader) {
    throw new Error(`${commitId} is missing its tree`);
  }

  return treeHeader.slice("tree ".length);
}

export async function readCommitParents(commitId: string): Promise<string[]> {
  const object = await readObject(commitId);

  if (object.type !== "commit") {
    throw new Error(`${commitId} is not a commit object`);
  }

  return object.content
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice("parent ".length));
}

export async function readCommitMessage(commitId: string): Promise<string> {
  const object = await readObject(commitId);

  if (object.type !== "commit") {
    throw new Error(`${commitId} is not a commit object`);
  }

  const content = object.content.toString();
  const separator = content.indexOf("\n\n");

  if (separator === -1) {
    return "";
  }

  return content.slice(separator + 2).replace(/\n$/, "");
}
