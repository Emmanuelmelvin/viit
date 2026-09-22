import { readHead, readRef } from "./refs.js";
import { readTag } from "./tags.js";
import { readObject } from "./objects.js";
import { HASH_PATTERN, MAX_TAG_DEPTH } from "./config.js";

async function readBranchOrTag(name: string): Promise<string> {
  try {
    return await readRef(`refs/heads/${name}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return readRef(`refs/tags/${name}`);
}

export async function resolveRevision(revision: string): Promise<string> {
  let objectId = revision === "HEAD"
    ? await readHead()
    : HASH_PATTERN.test(revision)
      ? revision
      : await readBranchOrTag(revision);

  for (let depth = 0; depth < MAX_TAG_DEPTH; depth += 1) {
    const object = await readObject(objectId);

    if (object.type === "commit") {
      return objectId;
    }

    if (object.type !== "tag") {
      throw new Error(`${revision} does not resolve to a commit`);
    }

    objectId = (await readTag(objectId)).objectId;
  }

  throw new Error("Tag nesting is too deep");
}
