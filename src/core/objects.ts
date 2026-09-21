import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { getObjectPath } from "./repository.js";

function createBlob(content: Buffer): { object: Buffer; objectId: string } {
  const header = Buffer.from(`blob ${content.length}\0`);
  const object = Buffer.concat([header, content]);
  const objectId = createHash("sha1").update(object).digest("hex");

  return { object, objectId };
}

export async function hashBlob(fileName: string): Promise<string> {
  const content = await readFile(fileName);
  return createBlob(content).objectId;
}

export async function writeBlob(fileName: string): Promise<string> {
  const content = await readFile(fileName);
  const { object, objectId } = createBlob(content);
  const objectPath = getObjectPath(objectId);

  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, deflateSync(object));

  return objectId;
}
