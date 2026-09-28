import { readRepositoryFile, writeRepositoryFile } from "./repository-files.js";

export type Index = Record<string, string>;

// reads the index
export async function readIndex(): Promise<Index> {
  const index = await readRepositoryFile("index");
  return index ? JSON.parse(index) as Index : {};
}

// writes the index
export async function writeIndex(index: Index): Promise<void> {
  await writeRepositoryFile("index", `${JSON.stringify(index, null, 2)}\n`);
}
