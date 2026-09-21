import { writeRef } from "../core/refs.js";

export async function updateRefCommand(
  refName: string,
  objectId: string,
): Promise<void> {
  if (!/^[0-9a-f]{40}$/.test(objectId)) {
    throw new Error("Object ID must be a 40-character SHA-1 hash");
  }

  await writeRef(refName, objectId);
}
