import { writeObject } from "./objects.js";
import { readObject } from "./objects.js";

type TreeNode = {
  files: Map<string, string>;
  directories: Map<string, TreeNode>;
};

function createTreeNode(): TreeNode {
  return {
    files: new Map(),
    directories: new Map(),
  };
}

function buildTree(index: Record<string, string>): TreeNode {
  const root = createTreeNode();

  for (const [filePath, objectId] of Object.entries(index)) {
    const parts = filePath.split("/");
    let node = root;

    for (const directory of parts.slice(0, -1)) {
      if (!node.directories.has(directory)) {
        node.directories.set(directory, createTreeNode());
      }

      node = node.directories.get(directory)!;
    }

    node.files.set(parts.at(-1)!, objectId);
  }

  return root;
}

async function writeTreeNode(node: TreeNode): Promise<string> {
  const entries: Buffer[] = [];

  for (const [name, objectId] of [...node.files].sort()) {
    entries.push(Buffer.from(`100644 ${name}\0`));
    entries.push(Buffer.from(objectId, "hex"));
  }

  for (const [name, childNode] of [...node.directories].sort()) {
    const childObjectId = await writeTreeNode(childNode);
    entries.push(Buffer.from(`40000 ${name}\0`));
    entries.push(Buffer.from(childObjectId, "hex"));
  }

  return writeObject("tree", Buffer.concat(entries));
}

export async function writeTree(index: Record<string, string>): Promise<string> {
  return writeTreeNode(buildTree(index));
}

export async function readTree(
  treeId: string,
  prefix = "",
): Promise<Record<string, string>> {
  const object = await readObject(treeId);

  if (object.type !== "tree") {
    throw new Error(`${treeId} is not a tree object`);
  }

  const entries: Record<string, string> = {};
  let offset = 0;

  while (offset < object.content.length) {
    const space = object.content.indexOf(32, offset);
    const nullByte = object.content.indexOf(0, space);
    const mode = object.content.subarray(offset, space).toString();
    const name = object.content.subarray(space + 1, nullByte).toString();
    const objectId = object.content
      .subarray(nullByte + 1, nullByte + 21)
      .toString("hex");
    const entryPath = prefix ? `${prefix}/${name}` : name;

    if (mode.startsWith("4")) {
      Object.assign(entries, await readTree(objectId, entryPath));
    } else {
      entries[entryPath] = objectId;
    }

    offset = nullByte + 21;
  }

  return entries;
}
