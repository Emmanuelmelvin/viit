import {
  readConfig,
  readConfigValue,
  removeConfigValue,
  writeConfigValue,
} from "../core/repository-config.js";

export async function configCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "--list") {
    if (args.length > 1) {
      throw new Error("config --list does not accept additional arguments");
    }

    const values = await readConfig();

    for (const [key, value] of Object.entries(values).sort(([first], [second]) => first.localeCompare(second))) {
      console.log(`${key}=${value}`);
    }

    return;
  }

  if (args[0] === "--get") {
    if (args.length !== 2) {
      throw new Error("config --get requires a key");
    }

    const value = await readConfigValue(args[1]);

    if (value === undefined) {
      throw new Error(`Config key '${args[1]}' is not set`);
    }

    console.log(value);
    return;
  }

  if (args[0] === "--unset") {
    if (args.length !== 2) {
      throw new Error("config --unset requires a key");
    }

    await removeConfigValue(args[1]);
    return;
  }

  if (args.length === 1) {
    const value = await readConfigValue(args[0]);

    if (value === undefined) {
      throw new Error(`Config key '${args[0]}' is not set`);
    }

    console.log(value);
    return;
  }

  if (args.length === 2) {
    await writeConfigValue(args[0], args[1]);
    return;
  }

  throw new Error("config accepts a key, a key and value, --get, --unset, or --list");
}
