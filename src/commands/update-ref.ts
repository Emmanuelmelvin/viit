import { writeRef } from "../core/refs.js";
import { HASH_PATTERN } from "../core/config.js";

export async function updateRefCommand(
  refName: string,
  objectId: string,
): Promise<void> {
  if (!HASH_PATTERN.test(objectId)) {
    throw new Error("Object ID must be a 40-character SHA-1 hash");
  }

  await writeRef(refName, objectId);
}
