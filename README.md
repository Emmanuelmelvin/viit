# Viit

Viit is a small Git-like version control system built from scratch in TypeScript.

The project exists to explain how Git works internally by implementing its core ideas one step at a time:

- blobs for storing file contents
- trees for representing directories
- commits for storing project snapshots
- branches and `HEAD` references
- a staging index
- history traversal
- working tree comparisons

Viit uses `.viit/` for its repository metadata so it does not interfere with a normal `.git/` directory.

## Current commands

```bash
viit init
viit add <file> [...files]
viit add .
viit status
viit diff
viit diff --cached
viit commit -m "Commit message"
viit log
viit checkout <commit-id>
viit branch [name]
viit switch <branch>
viit merge <branch|--abort>
viit rebase <branch|--continue|--abort|--skip>
```

Checkout, branch switching, merge, and rebase refuse to overwrite staged,
unstaged, or untracked files. Commit the changes first before changing the
working tree.

When rebase encounters a conflict, resolve the file and stage it:

```bash
viit add <file>
viit rebase --continue
```

Use `viit rebase --abort` to restore the original branch, or
`viit rebase --skip` to omit the conflicting commit. Rebase merge commits are
flattened by replaying their first-parent changes.

Lower-level commands are also available for learning:

```bash
viit hash-object [-w] <file>
viit cat-file -p <object-id>
viit write-tree
viit commit-tree <tree-id> [-p <parent-id>] -m "Commit message"
viit update-ref <ref> <object-id>
```

## Development setup

Install dependencies and build the project:

```bash
npm install
npm run build
```

To make `viit` available as a local command:

```bash
npm link
```

After changing the TypeScript source, rebuild it:

```bash
npm run build
```

## Basic workflow

```bash
viit init
viit add .
viit status
viit diff --cached
viit commit -m "Initial snapshot"
viit log
```

## Project structure

```text
src/
├── cli.ts                 # Command-line dispatcher
├── commands/              # User-facing command implementations
└── core/                  # Objects, trees, refs, and index logic
```

Viit is intentionally simpler than Git. Its index is stored as JSON, and its checkout implementation is designed for learning rather than production safety. The project is being expanded incrementally to make each Git concept understandable.
