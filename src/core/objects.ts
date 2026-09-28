import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { getObjectPath } from "./repository.js";

// creates an object
function createObject(
  type: string,
  content: Buffer,
): { object: Buffer; objectId: string } {
  const header = Buffer.from(`${type} ${content.length}\0`);
  const object = Buffer.concat([header, content]);
  const objectId = createHash("sha1").update(object).digest("hex");

  return { object, objectId };
}


// hashes a blob
export async function hashBlob(fileName: string): Promise<string> {
  const content = await readFile(fileName);
  return createObject("blob", content).objectId;
}

// writes a blob
export async function writeBlob(fileName: string): Promise<string> {
  const content = await readFile(fileName);
  return writeObject("blob", content);
}


// writes an object
export async function writeObject(type: string, content: Buffer): Promise<string> {
  const { object, objectId } = createObject(type, content);
  const objectPath = getObjectPath(objectId);

  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, deflateSync(object));

  return objectId;
}


// reads an object
export async function readObject(
  objectId: string,
): Promise<{ type: string; content: Buffer }> {
  const compressedObject = await readFile(getObjectPath(objectId));
  const object = inflateSync(compressedObject);
  const headerEnd = object.indexOf(0);

  if (headerEnd === -1) {
    throw new Error("Stored object is missing its header");
  }

  const header = object.subarray(0, headerEnd).toString();
  const type = header.split(" ")[0];

  return {
    type,
    content: object.subarray(headerEnd + 1),
  };
}
