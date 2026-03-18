export * from "./src/main.js";

import { runCli } from "./src/main.js";

const exitCode = await runCli(process.argv.slice(2));

process.exitCode = exitCode;
