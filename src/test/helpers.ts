import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { addCommand } from "../commands/add.js";
import { branchCommand } from "../commands/branch.js";
import { commitCommand } from "../commands/commit.js";
import { initCommand } from "../commands/init.js";
import { switchCommand } from "../commands/switch.js";

export async function quiet<T>(action: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => undefined;
  console.error = () => undefined;

  try {
    return await action();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function captureOutput(action: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const output: string[] = [];
  console.log = (...values: unknown[]) => output.push(values.join(" "));

  try {
    await action();
    return output.join("\n");
  } finally {
    console.log = originalLog;
  }
}

export async function withRepository(
  action: (directory: string) => Promise<void>,
): Promise<void> {
  const previousDirectory = process.cwd();
  const directory = await mkdtemp(path.join(os.tmpdir(), "viit-test-"));

  process.chdir(directory);

  try {
    await quiet(() => initCommand());
    await action(directory);
  } finally {
    process.chdir(previousDirectory);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function setFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

export async function commitFile(filePath: string, content: string, message: string): Promise<void> {
  await setFile(filePath, content);
  await quiet(() => addCommand([filePath]));
  await quiet(() => commitCommand(message));
}

export async function createConflictingBranches(): Promise<void> {
  await commitFile("note.txt", "base\n", "base");
  await quiet(() => branchCommand("feature"));
  await quiet(() => switchCommand("feature"));
  await commitFile("note.txt", "feature\n", "feature");
  await quiet(() => switchCommand("main"));
  await commitFile("note.txt", "main\n", "main");
  await quiet(() => switchCommand("feature"));
}
