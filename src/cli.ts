#!/usr/bin/env node

import { catFileCommand } from "./commands/cat-file.js";
import { addCommand } from "./commands/add.js";
import { commitTreeCommand } from "./commands/commit-tree.js";
import { hashObjectCommand } from "./commands/hash-object.js";
import { initCommand } from "./commands/init.js";
import { writeTreeCommand } from "./commands/write-tree.js";
import { updateRefCommand } from "./commands/update-ref.js";

// Ignore Node's executable and script path.
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "init":
    await initCommand();
    break;

  case "hash-object": {
    const shouldWrite = args[1] === "-w";
    const fileName = shouldWrite ? args[2] : args[1];

    if (!fileName) {
      console.error("Usage: viit hash-object [-w] <file>");
      process.exitCode = 1;
      break;
    }

    await hashObjectCommand(fileName, shouldWrite);
    break;
  }

  case "add": {
    const fileNames = args.slice(1);

    if (fileNames.length === 0) {
      console.error("Usage: viit add <file> [...files]");
      process.exitCode = 1;
      break;
    }

    await addCommand(fileNames);
    break;
  }

  case "write-tree":
    await writeTreeCommand();
    break;

  case "commit-tree": {
    const treeId = args[1];
    let parentId: string | undefined;
    let message: string | undefined;

    for (let index = 2; index < args.length; index += 1) {
      if (args[index] === "-p") {
        parentId = args[index + 1];
        index += 1;
      } else if (args[index] === "-m") {
        message = args[index + 1];
        index += 1;
      }
    }

    if (!treeId || !message) {
      console.error("Usage: viit commit-tree <tree-id> [-p <parent-id>] -m <message>");
      process.exitCode = 1;
      break;
    }

    await commitTreeCommand(treeId, parentId, message);
    break;
  }

  case "update-ref": {
    const refName = args[1];
    const objectId = args[2];

    if (!refName || !objectId) {
      console.error("Usage: viit update-ref <ref> <object-id>");
      process.exitCode = 1;
      break;
    }

    await updateRefCommand(refName, objectId);
    break;
  }

  case "cat-file": {
    const option = args[1];
    const objectId = args[2];

    if (option !== "-p" || !objectId) {
      console.error("Usage: viit cat-file -p <object-id>");
      process.exitCode = 1;
      break;
    }

    await catFileCommand(objectId);
    break;
  }

  default:
    console.error("Usage: viit <init|add|write-tree|commit-tree|update-ref|hash-object|cat-file>");
    process.exitCode = 1;
}
