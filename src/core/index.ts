import { readRepositoryFile, writeRepositoryFile } from "./repository-files.js";

export type Index = Record<string, string>;

export async function readIndex(): Promise<Index> {
  const index = await readRepositoryFile("index");
  return index ? JSON.parse(index) as Index : {};
}

export async function writeIndex(index: Index): Promise<void> {
  await writeRepositoryFile("index", `${JSON.stringify(index, null, 2)}\n`);
}
