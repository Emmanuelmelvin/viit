import path from "node:path";
import { readIndex, writeIndex } from "../core/index.js";
import { writeBlob } from "../core/objects.js";

function toIndexPath(fileName: string): string {
  return path.relative(process.cwd(), path.resolve(fileName)).replaceAll("\\", "/");
}

export async function addCommand(fileNames: string[]): Promise<void> {
  const index = await readIndex();

  for (const fileName of fileNames) {
    const objectId = await writeBlob(fileName);
    const indexPath = toIndexPath(fileName);
    index[indexPath] = objectId;
    console.log(`added ${indexPath}`);
  }

  await writeIndex(index);
}
