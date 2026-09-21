import path from "node:path";

const VIIT_DIRECTORY = ".viit";

export function getViitDirectory(): string {
  return path.resolve(process.cwd(), VIIT_DIRECTORY);
}

export function getObjectPath(objectId: string): string {
  // Git uses the first two hash characters as a directory name.
  return path.join(
    getViitDirectory(),
    "objects",
    objectId.slice(0, 2),
    objectId.slice(2),
  );
}
