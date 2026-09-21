import { test } from "node:test";
import assert from "node:assert/strict";
import { readCommitMessage, readCommitParents, readCommitTree, writeCommit } from "../core/commits.js";
import { readObject, writeObject } from "../core/objects.js";
import { readTree, writeTree } from "../core/trees.js";
import { withRepository } from "./helpers.js";

test("blob objects are stable and readable", async () => {
  await withRepository(async () => {
    const firstId = await writeObject("blob", Buffer.from("hello\n"));
    const secondId = await writeObject("blob", Buffer.from("hello\n"));
    const object = await readObject(firstId);

    assert.equal(firstId, secondId);
    assert.equal(object.type, "blob");
    assert.equal(object.content.toString(), "hello\n");
  });
});

test("trees preserve nested file paths", async () => {
  await withRepository(async () => {
    const readmeId = await writeObject("blob", Buffer.from("readme"));
    const sourceId = await writeObject("blob", Buffer.from("source"));
    const treeId = await writeTree({
      "README.md": readmeId,
      "src/main.ts": sourceId,
    });

    assert.deepEqual(await readTree(treeId), {
      "README.md": readmeId,
      "src/main.ts": sourceId,
    });
  });
});

test("commits preserve parents, trees, and messages", async () => {
  await withRepository(async () => {
    const blobId = await writeObject("blob", Buffer.from("content"));
    const treeId = await writeTree({ "file.txt": blobId });
    const firstCommit = await writeCommit(treeId, undefined, "first commit");
    const secondCommit = await writeCommit(treeId, firstCommit, "second commit");

    assert.equal(await readCommitTree(secondCommit), treeId);
    assert.deepEqual(await readCommitParents(secondCommit), [firstCommit]);
    assert.equal(await readCommitMessage(secondCommit), "second commit");
  });
});
