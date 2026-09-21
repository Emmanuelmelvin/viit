#!/usr/bin/env node

import { catFileCommand } from "./commands/cat-file.js";
import { addCommand } from "./commands/add.js";
import { hashObjectCommand } from "./commands/hash-object.js";
import { initCommand } from "./commands/init.js";

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
    console.error("Usage: viit <init|add|hash-object|cat-file>");
    process.exitCode = 1;
}
