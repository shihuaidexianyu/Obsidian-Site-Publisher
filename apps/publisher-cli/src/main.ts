const supportedCommands = ["scan", "build", "preview", "deploy"] as const;

export type CliCommand = (typeof supportedCommands)[number];

export function runCli(argv: string[]): number {
  const command = argv[0];

  if (command === undefined || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }

  if (!supportedCommands.includes(command as CliCommand)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  console.log(
    `Scaffolded CLI command "${command}" is registered. Connect it to @osp/core as implementation lands.`
  );
  return 0;
}

function printHelp(): void {
  console.log("publisher-cli <scan|build|preview|deploy>");
}
