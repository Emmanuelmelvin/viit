import { readObject } from "../core/objects.js";
import { readHead } from "../core/refs.js";

type Commit = {
  author: string;
  message: string;
  parent?: string;
};

function parseCommit(content: Buffer): Commit {
  const text = content.toString();
  const [headerText, message = ""] = text.split("\n\n");
  const headers = new Map(
    headerText.split("\n").map((line) => {
      const separator = line.indexOf(" ");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );

  return {
    author: headers.get("author") ?? "unknown",
    message: message.trim(),
    parent: headers.get("parent"),
  };
}

export async function logCommand(): Promise<void> {
  let commitId = await readHead();

  while (commitId) {
    const object = await readObject(commitId);

    if (object.type !== "commit") {
      throw new Error(`${commitId} is not a commit object`);
    }

    const commit = parseCommit(object.content);
    console.log(`commit ${commitId}`);
    console.log(`Author: ${commit.author}`);
    console.log(`\n    ${commit.message}\n`);
    commitId = commit.parent ?? "";
  }
}
