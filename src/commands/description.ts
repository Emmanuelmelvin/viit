import { readRepositoryFile, writeRepositoryFile } from "../core/repository-files.js";

export async function descriptionCommand(value?: string): Promise<void> {
  if (value === undefined) {
    console.log((await readRepositoryFile("description") ?? "").trimEnd());
    return;
  }

  await writeRepositoryFile("description", `${value}\n`);
}
