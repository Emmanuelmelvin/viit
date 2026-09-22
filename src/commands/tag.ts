import { readdir } from "node:fs/promises";
import path from "node:path";
import { readHead, readRef, removeRef, writeRef } from "../core/refs.js";
import { getViitDirectory } from "../core/repository.js";
import { writeAnnotatedTag } from "../core/tags.js";
import { NAME_PATTERN } from "../core/config.js";

function tagRef(name: string): string {
  if (!NAME_PATTERN.test(name)) {
    throw new Error("Tag names may contain letters, numbers, dots, underscores, and hyphens");
  }

  return `refs/tags/${name}`;
}

async function ensureTagDoesNotExist(name: string): Promise<string> {
  const refName = tagRef(name);

  try {
    await readRef(refName);
    throw new Error(`Tag '${name}' already exists`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return refName;
}

async function listTags(): Promise<void> {
  const tagsPath = path.join(getViitDirectory(), "refs", "tags");
  let tags: string[];

  try {
    tags = (await readdir(tagsPath)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const tag of tags) {
    console.log(tag);
  }
}

export async function tagCommand(args: string[]): Promise<void> {
  if (args.length === 0) {
    await listTags();
    return;
  }

  if (args[0] === "-d") {
    if (args.length !== 2) {
      throw new Error("tag deletion requires exactly one tag name");
    }

    const name = args[1];
    const refName = tagRef(name);
    await readRef(refName);
    await removeRef(refName);
    console.log(`Deleted tag ${name}`);
    return;
  }

  if (args[0] === "-a") {
    const name = args[1];
    const messageIndex = args.indexOf("-m");
    const message = messageIndex === -1 ? undefined : args[messageIndex + 1];

    if (!name || !message || args.length !== 4 || messageIndex !== 2) {
      throw new Error("annotated tags require: -a <name> -m <message>");
    }

    const refName = await ensureTagDoesNotExist(name);
    const tagObjectId = await writeAnnotatedTag(await readHead(), name, message);
    await writeRef(refName, tagObjectId);
    console.log(`Created annotated tag ${name}`);
    return;
  }

  if (args.length !== 1) {
    throw new Error("tag creation requires exactly one tag name");
  }

  const name = args[0];
  const refName = await ensureTagDoesNotExist(name);
  await writeRef(refName, await readHead());
  console.log(`Created tag ${name}`);
}
