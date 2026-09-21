import { readObject } from "../core/objects.js";

export async function catFileCommand(objectId: string): Promise<void> {
  if (!/^[0-9a-f]{40}$/.test(objectId)) {
    throw new Error("Object ID must be a 40-character SHA-1 hash");
  }

  const object = await readObject(objectId);
  process.stdout.write(object.content);
}
