import { readFile, unlink } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { addCommand } from "../commands/add.js";
import { branchCommand } from "../commands/branch.js";
import { checkoutCommand } from "../commands/checkout.js";
import { commitCommand } from "../commands/commit.js";
import { configCommand } from "../commands/config.js";
import { descriptionCommand } from "../commands/description.js";
import { mergeCommand } from "../commands/merge.js";
import { diffCommand } from "../commands/diff.js";
import { mvCommand } from "../commands/mv.js";
import { revertCommand } from "../commands/revert.js";
import { rebaseCommand } from "../commands/rebase.js";
import { reflogCommand } from "../commands/reflog.js";
import { rmCommand } from "../commands/rm.js";
import { resetCommand } from "../commands/reset.js";
import { restoreCommand } from "../commands/restore.js";
import { switchCommand } from "../commands/switch.js";
import { tagCommand } from "../commands/tag.js";
import { readCommitMessage, readCommitParents } from "../core/commits.js";
import { readMergeHead } from "../core/merge-state.js";
import { readRebaseState } from "../core/rebase-state.js";
import { readRevertState } from "../core/revert-state.js";
import { readReflog } from "../core/reflog.js";
import { readRepositoryFile } from "../core/repository-files.js";
import { resolveRevision } from "../core/revisions.js";
import { readHead, readRef } from "../core/refs.js";
import { readTag } from "../core/tags.js";
import { readIndex } from "../core/index.js";
import { captureOutput, commitFile, createConflictingBranches, quiet, setFile, withRepository } from "./helpers.js";

//tests switch refuses to overwrite dirty files
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

//tests merge creates a conflict that can be resolved and committed
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

//tests rebase can continue after a conflict
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

//tests rebase can resolve a modify/delete conflict by staging deletion
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

//tests rebase abort restores the original branch
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

//tests rebase skip omits the conflicting commit
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

//tests merge abort restores the original branch
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

//tests rebase flattens merge commits
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

//tests checkout refuses to overwrite dirty files
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

//tests lightweight tags point to commits and can be listed or deleted
test("lightweight tags point to commits and can be listed or deleted", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "content\n", "initial");
    const commitId = await readHead();

    await quiet(() => tagCommand(["v1.0"]));

    assert.equal(await readRef("refs/tags/v1.0"), commitId);
    assert.equal(await resolveRevision("v1.0"), commitId);
    assert.match(await captureOutput(() => tagCommand([])), /v1\.0/);

    await quiet(() => tagCommand(["-d", "v1.0"]));
    await assert.rejects(readRef("refs/tags/v1.0"), { code: "ENOENT" });
  });
});

//tests annotated tags point to tag objects and resolve to commits
test("annotated tags point to tag objects and resolve to commits", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "content\n", "initial");
    const commitId = await readHead();

    await quiet(() => tagCommand(["-a", "v2.0", "-m", "release"]));

    const tagObjectId = await readRef("refs/tags/v2.0");
    const tag = await readTag(tagObjectId);
    assert.equal(tag.objectId, commitId);
    assert.equal(tag.objectType, "commit");
    assert.equal(tag.name, "v2.0");
    assert.equal(tag.message, "release");
    assert.equal(await resolveRevision("v2.0"), commitId);
  });
});

//tests commit revisions can be resolved through tags by reset
test("commit revisions can be resolved through tags by reset", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "first\n", "first");
    await quiet(() => tagCommand(["stable"]));
    const taggedCommit = await readHead();
    await commitFile("note.txt", "second\n", "second");

    await quiet(() => resetCommand("stable", "hard"));

    assert.equal(await readHead(), taggedCommit);
    assert.equal(await readFile("note.txt", "utf8"), "first\n");
  });
});

test("reflog records branch and HEAD movements", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "first\n", "first");
    const firstCommit = await readHead();
    let entries = await readReflog("HEAD");

    assert.equal(entries.length, 1);
    assert.equal(entries[0].oldId, "0".repeat(40));
    assert.equal(entries[0].newId, firstCommit);
    assert.equal(entries[0].action, "commit: first");

    await commitFile("note.txt", "second\n", "second");
    entries = await readReflog("HEAD");
    assert.equal(entries.length, 2);
    assert.equal(entries[0].action, "commit: second");
    assert.equal(entries[0].oldId, firstCommit);
    assert.match(await captureOutput(() => reflogCommand()), /HEAD@\{0\}/);
  });
});

test("config and description are stored in repository metadata", async () => {
  await withRepository(async () => {
    await quiet(() => configCommand(["user.name", "Ada Lovelace"]));
    await quiet(() => configCommand(["user.email", "ada@example.com"]));

    assert.equal(await captureOutput(() => configCommand(["--get", "user.name"])), "Ada Lovelace");
    assert.match(await readRepositoryFile("config") ?? "", /\[user\]/);

    await quiet(() => descriptionCommand("A repository for learning Git internals"));
    assert.equal(
      await readRepositoryFile("description"),
      "A repository for learning Git internals\n",
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

test("reset --soft moves only the branch", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "first\n", "first");
    const firstCommit = await readHead();
    await commitFile("note.txt", "second\n", "second");
    const secondIndex = await readIndex();

    await quiet(() => resetCommand(firstCommit, "soft"));

    assert.equal(await readHead(), firstCommit);
    assert.deepEqual(await readIndex(), secondIndex);
    assert.equal(await readFile("note.txt", "utf8"), "second\n");
  });
});

test("reset --mixed resets the index but keeps files", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "first\n", "first");
    const firstCommit = await readHead();
    const firstIndex = await readIndex();
    await commitFile("note.txt", "second\n", "second");

    await quiet(() => resetCommand(firstCommit));

    assert.equal(await readHead(), firstCommit);
    assert.equal(await readFile("note.txt", "utf8"), "second\n");
    assert.deepEqual(await readIndex(), firstIndex);
  });
});

test("reset --hard resets the branch, index, and files", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "first\n", "first");
    const firstCommit = await readHead();
    await commitFile("note.txt", "second\n", "second");

    await quiet(() => resetCommand(firstCommit, "hard"));

    assert.equal(await readHead(), firstCommit);
    assert.equal(await readFile("note.txt", "utf8"), "first\n");
    assert.equal(Object.keys(await readIndex()).length, 1);
  });
});

test("restore resets a working file from the index", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "initial\n", "initial");
    await setFile("note.txt", "staged\n");
    await quiet(() => addCommand(["note.txt"]));
    await setFile("note.txt", "unstaged\n");

    await quiet(() => restoreCommand(["note.txt"]));

    assert.equal(await readFile("note.txt", "utf8"), "staged\n");
  });
});

test("restore --staged resets the index from HEAD", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "initial\n", "initial");
    await setFile("note.txt", "changed\n");
    await quiet(() => addCommand(["note.txt"]));

    await quiet(() => restoreCommand(["note.txt"], true));

    assert.equal(await readFile("note.txt", "utf8"), "changed\n");
    assert.equal(Object.keys(await readIndex()).length, 1);
    assert.equal((await readIndex())["note.txt"] !== undefined, true);
  });
});

test("mv moves a tracked file and stages the rename", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "content\n", "initial");

    await quiet(() => mvCommand("note.txt", "renamed.txt"));

    await assert.rejects(readFile("note.txt"));
    assert.equal(await readFile("renamed.txt", "utf8"), "content\n");
    const output = await captureOutput(() => diffCommand(true));
    assert.match(output, /rename from note\.txt/);
    assert.match(output, /rename to renamed\.txt/);
  });
});

test("mv refuses modified, missing, and existing destinations", async () => {
  await withRepository(async () => {
    await assert.rejects(mvCommand("missing.txt", "new.txt"), /did not match/);
    await commitFile("note.txt", "content\n", "initial");
    await setFile("note.txt", "changed\n");

    await assert.rejects(mvCommand("note.txt", "new.txt"), /has changes/);

    await setFile("note.txt", "content\n");
    await setFile("new.txt", "existing\n");
    await assert.rejects(mvCommand("note.txt", "new.txt"), /already exists/);
  });
});

test("diff prints hunk ranges for working-tree changes", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "one\ntwo\n", "initial");
    await setFile("note.txt", "one\nchanged\ntwo\n");

    const output = await captureOutput(() => diffCommand(false));
    assert.match(output, /@@ -1,2 \+1,3 @@/);
    assert.match(output, /\+changed/);
  });
});

test("revert creates a new commit that undoes a commit", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "initial\n", "initial");
    await commitFile("note.txt", "changed\n", "change");
    const changedCommit = await readHead();

    await quiet(() => revertCommand(changedCommit));

    const revertCommit = await readHead();
    assert.notEqual(revertCommit, changedCommit);
    assert.deepEqual(await readCommitParents(revertCommit), [changedCommit]);
    assert.equal(await readCommitMessage(revertCommit), 'Revert "change"');
    assert.equal(await readFile("note.txt", "utf8"), "initial\n");
  });
});

test("revert can continue after a conflict", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "initial\n", "initial");
    await commitFile("note.txt", "target\n", "target");
    const targetCommit = await readHead();
    await commitFile("note.txt", "later\n", "later");
    const originalHead = await readHead();

    await quiet(() => revertCommand(targetCommit));

    assert.equal((await readRevertState())?.conflicts.length, 1);
    assert.match(await readFile("note.txt", "utf8"), /<<<<<<< HEAD/);

    await setFile("note.txt", "resolved\n");
    await quiet(() => addCommand(["note.txt"]));
    await quiet(() => revertCommand("--continue"));

    const revertCommit = await readHead();
    assert.deepEqual(await readCommitParents(revertCommit), [originalHead]);
    assert.equal(await readRevertState(), undefined);
    assert.equal(await readFile("note.txt", "utf8"), "resolved\n");
  });
});

test("revert abort restores the original commit", async () => {
  await withRepository(async () => {
    await commitFile("note.txt", "initial\n", "initial");
    await commitFile("note.txt", "target\n", "target");
    const targetCommit = await readHead();
    await commitFile("note.txt", "later\n", "later");
    const originalHead = await readHead();

    await quiet(() => revertCommand(targetCommit));
    await quiet(() => revertCommand("--abort"));

    assert.equal(await readHead(), originalHead);
    assert.equal(await readRevertState(), undefined);
    assert.equal(await readFile("note.txt", "utf8"), "later\n");
  });
});
