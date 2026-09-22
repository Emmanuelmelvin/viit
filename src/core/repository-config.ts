import { readRepositoryFile, writeRepositoryFile } from "./repository-files.js";

export type RepositoryConfig = Record<string, string>;

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9-]*\.[A-Za-z][A-Za-z0-9-]*$/;

export function validateConfigKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error("Config keys must look like section.name");
  }
}

export function parseConfig(content: string): RepositoryConfig {
  const values: RepositoryConfig = {};
  let section = "";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);

    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1 || !section) {
      continue;
    }

    const key = `${section}.${line.slice(0, separator).trim()}`;
    validateConfigKey(key);
    values[key] = line.slice(separator + 1).trim();
  }

  return values;
}

export function serializeConfig(values: RepositoryConfig): string {
  const sections = new Map<string, Array<[string, string]>>();

  for (const [key, value] of Object.entries(values).sort(([first], [second]) => first.localeCompare(second))) {
    validateConfigKey(key);
    const separator = key.indexOf(".");
    const section = key.slice(0, separator);
    const name = key.slice(separator + 1);
    const entries = sections.get(section) ?? [];
    entries.push([name, value]);
    sections.set(section, entries);
  }

  return [...sections.entries()]
    .map(([section, entries]) => [
      `[${section}]`,
      ...entries.map(([key, value]) => `\t${key} = ${value}`),
      "",
    ].join("\n"))
    .join("\n");
}

export async function readConfig(): Promise<RepositoryConfig> {
  return parseConfig(await readRepositoryFile("config") ?? "");
}

export async function writeConfig(values: RepositoryConfig): Promise<void> {
  await writeRepositoryFile("config", serializeConfig(values));
}

export async function readConfigValue(key: string): Promise<string | undefined> {
  validateConfigKey(key);
  return (await readConfig())[key];
}

export async function writeConfigValue(key: string, value: string): Promise<void> {
  validateConfigKey(key);
  const values = await readConfig();
  values[key] = value;
  await writeConfig(values);
}

export async function removeConfigValue(key: string): Promise<void> {
  validateConfigKey(key);
  const values = await readConfig();
  delete values[key];
  await writeConfig(values);
}
