#!/usr/bin/env node

import { addCommand } from "./commands/add.js";
import { branchCommand } from "./commands/branch.js";
import { catFileCommand } from "./commands/cat-file.js";
import { checkoutCommand } from "./commands/checkout.js";
import { commitCommand } from "./commands/commit.js";
import { commitTreeCommand } from "./commands/commit-tree.js";
import { diffCommand } from "./commands/diff.js";
import { hashObjectCommand } from "./commands/hash-object.js";
import { initCommand } from "./commands/init.js";
import { logCommand } from "./commands/log.js";
import { mergeCommand } from "./commands/merge.js";
import { rebaseCommand } from "./commands/rebase.js";
import { rmCommand } from "./commands/rm.js";
import { resetCommand } from "./commands/reset.js";
import { statusCommand } from "./commands/status.js";
import { switchCommand } from "./commands/switch.js";
import { updateRefCommand } from "./commands/update-ref.js";
import { writeTreeCommand } from "./commands/write-tree.js";
import { COMMANDS, fail, printHelp, suggestCommand } from "./cli/help.js";

const args = process.argv.slice(2);
const command = args[0];
const helpRequested = args[1] === "--help" || args[1] === "-h";

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exitCode = command ? 0 : 1;
} else if (command === "help") {
  printHelp(args[1]);
} else if (helpRequested) {
  printHelp(command);
} else if (!COMMANDS.includes(command as typeof COMMANDS[number])) {
  const suggestion = suggestCommand(command);
  console.error(`error: '${command}' is not a Viit command.`);

  if (suggestion) {
    console.error(`Did you mean '${suggestion}'?`);
  }

  console.error("Run 'viit --help' for available commands.");
  process.exitCode = 1;
} else {
  try {
    switch (command) {
      case "init":
        await initCommand();
        break;

      case "hash-object": {
        const shouldWrite = args[1] === "-w";
        const fileName = shouldWrite ? args[2] : args[1];

        if (!fileName) {
          fail(command, "a file path is required");
          break;
        }

        await hashObjectCommand(fileName, shouldWrite);
        break;
      }

      case "add": {
        const fileNames = args.slice(1);

        if (fileNames.length === 0) {
          fail(command, "at least one file path is required");
          break;
        }

        await addCommand(fileNames);
        break;
      }

      case "rm": {
        const cached = args[1] === "--cached";
        const fileNames = cached ? args.slice(2) : args.slice(1);

        if (fileNames.length === 0) {
          fail(command, "at least one file path is required");
          break;
        }

        await rmCommand(fileNames, cached);
        break;
      }

      case "reset": {
        const modeArgument = args[1];
        const mode = modeArgument === "--soft"
          ? "soft"
          : modeArgument === "--hard"
            ? "hard"
            : modeArgument === "--mixed"
              ? "mixed"
              : "mixed";
        const target = modeArgument?.startsWith("--") ? args[2] : args[1];

        if (!target) {
          fail(command, "a commit ID, branch name, or HEAD is required");
          break;
        }

        if (modeArgument?.startsWith("--") && !["--soft", "--mixed", "--hard"].includes(modeArgument)) {
          fail(command, `unknown reset option '${modeArgument}'`);
          break;
        }

        await resetCommand(target, mode);
        break;
      }

      case "branch":
        await branchCommand(args[1]);
        break;

      case "switch": {
        const branchName = args[1];

        if (!branchName) {
          fail(command, "a branch name is required");
          break;
        }

        await switchCommand(branchName);
        break;
      }

      case "merge": {
        const targetBranch = args[1];

        if (!targetBranch) {
          fail(command, "a branch name or --abort is required");
          break;
        }

        await mergeCommand(targetBranch);
        break;
      }

      case "rebase": {
        const targetBranch = args[1];

        if (!targetBranch) {
          fail(command, "a target branch is required");
          break;
        }

        await rebaseCommand(targetBranch);
        break;
      }

      case "write-tree":
        await writeTreeCommand();
        break;

      case "commit": {
        const messageIndex = args.indexOf("-m");
        const message = messageIndex === -1 ? undefined : args[messageIndex + 1];

        if (!message) {
          fail(command, "a commit message is required with -m");
          break;
        }

        await commitCommand(message);
        break;
      }

      case "checkout": {
        const commitId = args[1];

        if (!commitId) {
          fail(command, "a commit ID is required");
          break;
        }

        await checkoutCommand(commitId);
        break;
      }

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
          fail(command, "a tree ID and commit message are required");
          break;
        }

        await commitTreeCommand(treeId, parentId, message);
        break;
      }

      case "update-ref": {
        const refName = args[1];
        const objectId = args[2];

        if (!refName || !objectId) {
          fail(command, "a ref name and object ID are required");
          break;
        }

        await updateRefCommand(refName, objectId);
        break;
      }

      case "log":
        await logCommand();
        break;

      case "status":
        await statusCommand();
        break;

      case "diff":
        await diffCommand(args[1] === "--cached");
        break;

      case "cat-file": {
        if (args[1] !== "-p" || !args[2]) {
          fail(command, "-p and an object ID are required");
          break;
        }

        await catFileCommand(args[2]);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`fatal: ${message}`);
    process.exitCode = 1;
  }
}
