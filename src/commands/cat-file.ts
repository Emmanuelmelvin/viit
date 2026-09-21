import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { getObjectPath } from "../core/repository.js";

export async function catFileCommand(objectId: string): Promise<void> {
  if (!/^[0-9a-f]{40}$/.test(objectId)) {
    throw new Error("Object ID must be a 40-character SHA-1 hash");
  }

  const compressedObject = await readFile(getObjectPath(objectId));
  const object = inflateSync(compressedObject);

  // The null byte separates Git's object header from its content.
  const headerEnd = object.indexOf(0);
  if (headerEnd === -1) {
    throw new Error("Stored object is missing its header");
  }

  process.stdout.write(object.subarray(headerEnd + 1));
}
