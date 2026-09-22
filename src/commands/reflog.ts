import { NAME_PATTERN } from "../core/config.js";
import { readReflog } from "../core/reflog.js";

function resolveReflogRef(value?: string): string {
  if (!value || value === "HEAD") {
    return "HEAD";
  }

  if (value.startsWith("refs/heads/") || value.startsWith("refs/tags/")) {
    return value;
  }

  if (NAME_PATTERN.test(value)) {
    return `refs/heads/${value}`;
  }

  throw new Error("Reflog name must be HEAD, a branch name, or a local ref");
}

export async function reflogCommand(value?: string): Promise<void> {
  const refName = resolveReflogRef(value);
  const entries = await readReflog(refName);
  const displayName = refName === "HEAD" ? "HEAD" : refName.slice("refs/heads/".length);

  entries.forEach((entry, index) => {
    console.log(`${entry.newId} ${displayName}@{${index}}: ${entry.action}`);
  });
}
