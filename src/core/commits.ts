import { readObject, writeObject } from "./objects.js";

const HASH_PATTERN = /^[0-9a-f]{40}$/;

function getTimezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0");
  const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");

  return `${sign}${hours}${minutes}`;
}

export async function writeCommit(
  treeId: string,
  parentId: string | undefined,
  message: string,
): Promise<string> {
  if (!HASH_PATTERN.test(treeId)) {
    throw new Error("Tree ID must be a 40-character SHA-1 hash");
  }

  if (parentId && !HASH_PATTERN.test(parentId)) {
    throw new Error("Parent ID must be a 40-character SHA-1 hash");
  }

  const name = process.env.VIIT_AUTHOR_NAME ?? "Viit User";
  const email = process.env.VIIT_AUTHOR_EMAIL ?? "viit@example.com";
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const timezone = getTimezoneOffset(now);
  const identity = `${name} <${email}> ${timestamp} ${timezone}`;
  const headers = [`tree ${treeId}`];

  if (parentId) {
    headers.push(`parent ${parentId}`);
  }

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
