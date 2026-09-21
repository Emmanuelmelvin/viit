import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { getObjectPath } from "../core/repository.js";

export async function hashObjectCommand(
  fileName: string,
  shouldWrite: boolean,
): Promise<void> {
  const content = await readFile(fileName);

  // Git hashes the blob header together with the file content.
  const header = Buffer.from(`blob ${content.length}\0`);
  const object = Buffer.concat([header, content]);
  const objectId = createHash("sha1").update(object).digest("hex");

  if (shouldWrite) {
    const objectPath = getObjectPath(objectId);
    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, deflateSync(object));
  }

  console.log(objectId);
}
