import { runCli } from "./main.js";

void (async () => {
  process.exitCode = await runCli(process.argv.slice(2));
})();
