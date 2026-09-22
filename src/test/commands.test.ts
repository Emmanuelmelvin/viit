import { readFile, unlink } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { addCommand } from "../commands/add.js";
import { branchCommand } from "../commands/branch.js";
import { checkoutCommand } from "../commands/checkout.js";
import { commitCommand } from "../commands/commit.js";
import { mergeCommand } from "../commands/merge.js";
import { rebaseCommand } from "../commands/rebase.js";
import { rmCommand } from "../commands/rm.js";
import { switchCommand } from "../commands/switch.js";
import { readCommitParents } from "../core/commits.js";
import { readMergeHead } from "../core/merge-state.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readHead, readRef } from "../core/refs.js";
import { commitFile, createConflictingBranches, quiet, setFile, withRepository } from "./helpers.js";

test("switch refuses to overwrite dirty files", async () => {
  await withRepository(async () => {
    await setFile("note.txt", "clean\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => commitCommand("initial"));
    await quiet(() => branchCommand("feature"));
    await setFile("note.txt", "dirty\n");

    await assert.rejects(
      switchCommand("feature"),
      /Cannot switch branches: 'note.txt' has unstaged changes/,
    );
  });
});

test("merge creates a conflict that can be resolved and committed", async () => {
  await withRepository(async () => {
    await createConflictingBranches();
    await quiet(() => switchCommand("main"));
    const originalMain = await readRef("refs/heads/main");

    await quiet(() => mergeCommand("feature"));

    assert.equal(await readRef("refs/heads/main"), originalMain);
    assert.equal(await readMergeHead() !== undefined, true);
    assert.match(await readFile("note.txt", "utf8"), /<<<<<<< HEAD/);

    await setFile("note.txt", "resolved\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => commitCommand("resolve merge"));

    const mergeCommit = await readHead();
    assert.equal((await readCommitParents(mergeCommit)).length, 2);
    assert.equal(await readMergeHead(), undefined);
  });
});

test("rebase can continue after a conflict", async () => {
  await withRepository(async () => {
    await createConflictingBranches();
    const mainCommit = await readRef("refs/heads/main");

    await quiet(() => rebaseCommand("main"));

    assert.equal((await readRebaseState())?.conflicts.length, 1);
    assert.match(await readFile("note.txt", "utf8"), /<<<<<<< HEAD/);

    await setFile("note.txt", "resolved\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => rebaseCommand("--continue"));

    const rebasedCommit = await readHead();
    assert.equal((await readCommitParents(rebasedCommit))[0], mainCommit);
    assert.equal(await readRebaseState(), undefined);
  });
});

test("rebase can resolve a modify/delete conflict by staging deletion", async () => {
  await withRepository(async () => {
    await setFile("note.txt", "base\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => commitCommand("base"));
    await quiet(() => branchCommand("feature"));
    await quiet(() => switchCommand("feature"));
    await unlink("note.txt");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => commitCommand("delete note"));
    await quiet(() => switchCommand("main"));
    await setFile("note.txt", "main change\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => commitCommand("modify note"));
    await quiet(() => switchCommand("feature"));

    await quiet(() => rebaseCommand("main"));
    await unlink("note.txt");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => rebaseCommand("--continue"));

    await assert.rejects(readFile("note.txt"));
    assert.equal(await readRebaseState(), undefined);
  });
});

test("rebase abort restores the original branch", async () => {
  await withRepository(async () => {
    await createConflictingBranches();
    const originalFeature = await readRef("refs/heads/feature");

    await quiet(() => rebaseCommand("main"));
    await quiet(() => rebaseCommand("--abort"));

    assert.equal(await readRef("refs/heads/feature"), originalFeature);
    assert.equal(await readRebaseState(), undefined);
    assert.equal(await readFile("note.txt", "utf8"), "feature\n");
  });
});

test("rebase skip omits the conflicting commit", async () => {
  await withRepository(async () => {
    await createConflictingBranches();
    const mainCommit = await readRef("refs/heads/main");

    await quiet(() => rebaseCommand("main"));
    await quiet(() => rebaseCommand("--skip"));

    assert.equal(await readRef("refs/heads/feature"), mainCommit);
    assert.equal(await readRebaseState(), undefined);
    assert.equal(await readFile("note.txt", "utf8"), "main\n");
  });
});

test("merge abort restores the original branch", async () => {
  await withRepository(async () => {
    await createConflictingBranches();
    await quiet(() => switchCommand("main"));
    const originalMain = await readRef("refs/heads/main");

    await quiet(() => mergeCommand("feature"));
    await quiet(() => mergeCommand("--abort"));

    assert.equal(await readRef("refs/heads/main"), originalMain);
    assert.equal(await readMergeHead(), undefined);
    assert.equal(await readFile("note.txt", "utf8"), "main\n");
  });
});

test("rebase flattens merge commits", async () => {
  await withRepository(async () => {
    await commitFile("base.txt", "base\n", "base");
    await quiet(() => branchCommand("side"));
    await quiet(() => branchCommand("onto"));
    await quiet(() => switchCommand("side"));
    await commitFile("side.txt", "side\n", "side");
    await quiet(() => switchCommand("main"));
    await commitFile("main.txt", "main\n", "main");
    await quiet(() => mergeCommand("side"));
    await quiet(() => switchCommand("onto"));
    await commitFile("onto.txt", "onto\n", "onto");
    await quiet(() => switchCommand("main"));

    await quiet(() => rebaseCommand("onto"));

    const rebasedCommit = await readHead();
    assert.equal((await readCommitParents(rebasedCommit)).length, 1);
    assert.equal(await readFile("side.txt", "utf8"), "side\n");
    assert.equal(await readFile("main.txt", "utf8"), "main\n");
    assert.equal(await readFile("onto.txt", "utf8"), "onto\n");
  });
});

test("checkout refuses to overwrite dirty files", async () => {
  await withRepository(async () => {
    await setFile("note.txt", "clean\n");
    await quiet(() => addCommand(["note.txt"]));
    const firstCommit = await quiet(async () => {
      await commitCommand("initial");
      return readHead();
    });
    await setFile("note.txt", "dirty\n");

    await assert.rejects(
      checkoutCommand(firstCommit),
      /Cannot checkout: 'note.txt' has unstaged changes/,
    );
  });
});

test("rm removes a tracked file from disk and the index", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "content\n", "initial");

    await quiet(() => rmCommand(["note.txt"]));

    await assert.rejects(readFile("note.txt"));
    const { readIndex } = await import("../core/index.js");
    assert.deepEqual(await readIndex(), {});
  });
});

test("rm --cached keeps the file on disk", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "content\n", "initial");

    await quiet(() => rmCommand(["note.txt"], true));

    assert.equal(await readFile("note.txt", "utf8"), "content\n");
    const { readIndex } = await import("../core/index.js");
    assert.deepEqual(await readIndex(), {});
  });
});

test("rm refuses untracked and modified files", async () => {
  await withRepository(async () => {
    await assert.rejects(
      rmCommand(["missing.txt"]),
      /did not match any tracked files/,
    );

    await commitFile("note.txt", "content\n", "initial");
    await setFile("note.txt", "changed\n");

    await assert.rejects(
      rmCommand(["note.txt"]),
      /has changes/,
    );
  });
});
