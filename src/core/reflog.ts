import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { HASH_PATTERN, REF_PATTERN } from "./config.js";
import { getIdentity } from "./identity.js";
import { getViitDirectory } from "./repository.js";

const ZERO_OBJECT_ID = "0".repeat(40);

export type ReflogEntry = {
  oldId: string;
  newId: string;
  identity: string;
  action: string;
};

function getReflogPath(refName: string): string {
  if (refName !== "HEAD" && (!REF_PATTERN.test(refName) || refName.includes(".."))) {
    throw new Error("Reflogs require HEAD or a local branch/tag ref");
  }

  return path.join(getViitDirectory(), "logs", refName);
}

//basically tracks
export async function appendReflog(
  refName: string,
  oldId: string,
  newId: string,
  action: string,
): Promise<void> {
  if (!HASH_PATTERN.test(oldId) || !HASH_PATTERN.test(newId)) {
    throw new Error("Reflog entries require 40-character SHA-1 object IDs");
  }

  const reflogPath = getReflogPath(refName);
  await mkdir(path.dirname(reflogPath), { recursive: true });
  await appendFile(reflogPath, `${oldId} ${newId} ${await getIdentity()}\t${action}\n`);
}

export async function readReflog(refName: string): Promise<ReflogEntry[]> {
  const reflogPath = getReflogPath(refName);
  let content: string;

  try {
    content = await readFile(reflogPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return content
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("\t");
      const metadata = separator === -1 ? line : line.slice(0, separator);
      const action = separator === -1 ? "" : line.slice(separator + 1);
      const [oldId, newId, ...identityParts] = metadata.split(" ");

      return {
        oldId,
        newId,
        identity: identityParts.join(" "),
        action,
      };
    })
    .reverse();
}

export const EMPTY_OBJECT_ID = ZERO_OBJECT_ID;
