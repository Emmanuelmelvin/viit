import { readObject, writeObject } from "./objects.js";
import { HASH_PATTERN } from "./config.js";
import { getIdentity } from "./identity.js";

export type TagObject = {
  objectId: string;
  objectType: string;
  name: string;
  tagger: string;
  message: string;
};

export async function writeAnnotatedTag(
  objectId: string,
  name: string,
  message: string,
): Promise<string> {
  if (!HASH_PATTERN.test(objectId)) {
    throw new Error("Tag target must be a 40-character SHA-1 hash");
  }

  const target = await readObject(objectId);

  if (target.type !== "commit") {
    throw new Error("Only commits can be tagged");
  }

  const content = Buffer.from(
    `object ${objectId}\ntype commit\ntag ${name}\ntagger ${await getIdentity()}\n\n${message}\n`,
  );
  return writeObject("tag", content);
}

export async function readTag(tagId: string): Promise<TagObject> {
  const object = await readObject(tagId);

  if (object.type !== "tag") {
    throw new Error(`${tagId} is not a tag object`);
  }

  const content = object.content.toString();
  const separator = content.indexOf("\n\n");
  const headers = (separator === -1 ? content : content.slice(0, separator))
    .split("\n");
  const values = new Map(
    headers.map((line) => {
      const space = line.indexOf(" ");
      return [line.slice(0, space), line.slice(space + 1)];
    }),
  );

  return {
    objectId: values.get("object") ?? "",
    objectType: values.get("type") ?? "",
    name: values.get("tag") ?? "",
    tagger: values.get("tagger") ?? "",
    message: separator === -1 ? "" : content.slice(separator + 2).replace(/\n$/, ""),
  };
}
