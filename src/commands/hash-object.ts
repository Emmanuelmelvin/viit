import { hashBlob, writeBlob } from "../core/objects.js";

export async function hashObjectCommand(
  fileName: string,
  shouldWrite: boolean,
): Promise<void> {
  const objectId = shouldWrite
    ? await writeBlob(fileName)
    : await hashBlob(fileName);

  console.log(objectId);
}
