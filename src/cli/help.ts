export const COMMANDS = [
  "init",
  "add",
  "rm",
  "reset",
  "restore",
  "mv",
  "revert",
  "branch",
  "switch",
  "merge",
  "rebase",
  "write-tree",
  "commit",
  "checkout",
  "commit-tree",
  "update-ref",
  "log",
  "status",
  "diff",
  "hash-object",
  "cat-file",
] as const;

const USAGE: Record<string, string> = {
  init: "viit init",
  add: "viit add <file> [...files]",
  rm: "viit rm [--cached] <file> [...files]",
  reset: "viit reset [--soft|--mixed|--hard] <commit|branch|HEAD>",
  restore: "viit restore [--staged] <file> [...files]",
  mv: "viit mv <source> <destination>",
  revert: "viit revert <commit|HEAD|--continue|--abort>",
  branch: "viit branch [name]",
  switch: "viit switch <branch>",
  merge: "viit merge <branch|--abort>",
  rebase: "viit rebase <branch|--continue|--abort|--skip>",
  "write-tree": "viit write-tree",
  commit: "viit commit -m <message>",
  checkout: "viit checkout <commit-id>",
  "commit-tree": "viit commit-tree <tree-id> [-p <parent-id>] -m <message>",
  "update-ref": "viit update-ref <ref> <object-id>",
  log: "viit log",
  status: "viit status",
  diff: "viit diff [--cached]",
  "hash-object": "viit hash-object [-w] <file>",
  "cat-file": "viit cat-file -p <object-id>",
};

const DESCRIPTIONS: Record<string, string> = {
  init: "Create an empty Viit repository.",
  add: "Stage file contents.",
  rm: "Remove files from the working tree and index.",
  reset: "Move the current branch and optionally reset the index and files.",
  restore: "Restore files or unstage changes.",
  mv: "Move a tracked file and update the index.",
  revert: "Create a commit that undoes another commit.",
  branch: "Create or list branches.",
  switch: "Switch to a branch.",
  merge: "Merge a branch into the current branch.",
  rebase: "Replay current-branch commits on top of another branch.",
  "write-tree": "Create a tree object from the index.",
  commit: "Create a commit from the index.",
  checkout: "Restore a commit snapshot.",
  "commit-tree": "Create a commit object directly.",
  "update-ref": "Move a reference to an object.",
  log: "Show commit history.",
  status: "Show working tree and staging changes.",
  diff: "Show content differences.",
  "hash-object": "Hash and optionally store a file blob.",
  "cat-file": "Read a stored object.",
};

export function usage(command: string): string {
  return USAGE[command] ?? "viit <command> [options]";
}

export function printHelp(command?: string): void {
  if (command && USAGE[command]) {
    console.log(`Usage: ${USAGE[command]}`);
    console.log();
    console.log(DESCRIPTIONS[command]);
    return;
  }

  console.log("Usage: viit <command> [options]");
  console.log();
  console.log("Commands:");

  for (const name of COMMANDS) {
    console.log(`  ${name.padEnd(14)} ${DESCRIPTIONS[name]}`);
  }

  console.log();
  console.log("Run 'viit <command> --help' for command-specific help.");
}

export function fail(command: string, message: string): void {
  console.error(`error: ${message}`);
  console.error(`Usage: ${usage(command)}`);
  console.error(`Run 'viit ${command} --help' for more information.`);
  process.exitCode = 1;
}

function distance(first: string, second: string): number {
  const row = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    let previous = row[0];
    row[0] = firstIndex;

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const current = row[secondIndex];
      row[secondIndex] = first[firstIndex - 1] === second[secondIndex - 1]
        ? previous
        : Math.min(previous, row[secondIndex - 1], current) + 1;
      previous = current;
    }
  }

  return row[second.length];
}

export function suggestCommand(input: string): string | undefined {
  let suggestion: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const command of COMMANDS) {
    const currentDistance = distance(input, command);

    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      suggestion = command;
    }
  }

  return bestDistance <= Math.max(2, Math.floor(input.length / 3))
    ? suggestion
    : undefined;
}
