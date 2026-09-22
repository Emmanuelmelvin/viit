import { readObject } from "../core/objects.js";
import { HASH_PATTERN } from "../core/config.js";

export async function catFileCommand(objectId: string): Promise<void> {
  if (!HASH_PATTERN.test(objectId)) {
    throw new Error("Object ID must be a 40-character SHA-1 hash");
  }

  const object = await readObject(objectId);
  process.stdout.write(object.content);
}
