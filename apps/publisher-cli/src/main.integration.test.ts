import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "./main";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("runCli integration", () => {
  it(
    "scans a real publishable vault through the default runtime",
    async () => {
      const scenario = await createIntegrationScenario("osp-cli-scan-");
      const output = createCapturedOutput();

      const exitCode = await runCli(["scan", "--config", scenario.configPath, "--json"], {
        cwd: scenario.rootDir,
        output
      });

      expect(exitCode).toBe(0);

      const payload = JSON.parse(output.logs.at(-1) ?? "{}") as {
        command?: string;
        success?: boolean;
        manifest?: { notes?: Array<{ sourcePath?: string }> };
        issues?: Array<{ code?: string }>;
      };

      expect(payload.command).toBe("scan");
      expect(payload.success).toBe(true);
      expect(payload.manifest?.notes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourcePath: "index.md"
          })
        ])
      );
      expect(payload.issues).toEqual([]);
    },
    90_000
  );

  it(
    "builds a real site through the CLI default runtime",
    async () => {
      const scenario = await createIntegrationScenario("osp-cli-build-");
      const output = createCapturedOutput();

      const exitCode = await runCli(["build", "--config", scenario.configPath, "--json"], {
        cwd: scenario.rootDir,
        output
      });

      expect(exitCode).toBe(0);

      const payload = JSON.parse(output.logs.at(-1) ?? "{}") as {
        command?: string;
        success?: boolean;
        result?: { outputDir?: string; logs?: Array<{ message?: string }> };
      };

      expect(payload.command).toBe("build");
      expect(payload.success).toBe(true);
      await expect(access(path.join(payload.result?.outputDir ?? "", "index.html"))).resolves.toBeUndefined();

      const indexHtml = await readFile(path.join(payload.result?.outputDir ?? "", "index.html"), "utf8");

      expect(indexHtml).toContain("CLI Integration Home");
      expect(payload.result?.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("Using Quartz")
          })
        ])
      );
    },
    120_000
  );

  it(
    "starts a preview server through the CLI default runtime",
    async () => {
      const scenario = await createIntegrationScenario("osp-cli-preview-");
      const output = createCapturedOutput();
      const previewPort = await getAvailablePort();
      let resolveShutdown: (() => void) | undefined;
      const shutdownPromise = new Promise<void>((resolve) => {
        resolveShutdown = resolve;
      });

      const cliPromise = runCli(
        ["preview", "--config", scenario.configPath, "--preview-port", `${previewPort}`, "--static-preview", "--json"],
        {
          cwd: scenario.rootDir,
          output,
          waitForPreviewShutdown: async () => shutdownPromise
        }
      );

      try {
        await waitForHttpReady(`http://localhost:${previewPort}`);

        const response = await fetch(`http://localhost:${previewPort}`);
        const html = await response.text();

        expect(response.ok).toBe(true);
        expect(html).toContain("CLI Integration Home");
      } finally {
        resolveShutdown?.();
      }

      const exitCode = await cliPromise;

      expect(exitCode).toBe(0);

      const payload = JSON.parse(output.logs.at(-1) ?? "{}") as {
        command?: string;
        success?: boolean;
        session?: { url?: string };
      };

      expect(payload.command).toBe("preview");
      expect(payload.success).toBe(true);
      expect(payload.session?.url).toBe(`http://localhost:${previewPort}`);
    },
    120_000
  );

  it(
    "builds and deploys to a real local export target through the CLI default runtime",
    async () => {
      const scenario = await createIntegrationScenario("osp-cli-deploy-");
      const output = createCapturedOutput();

      const exitCode = await runCli(["deploy", "--config", scenario.configPath, "--json"], {
        cwd: scenario.rootDir,
        output
      });

      expect(exitCode).toBe(0);

      const payload = JSON.parse(output.logs.at(-1) ?? "{}") as {
        command?: string;
        success?: boolean;
        deploy?: { destination?: string; success?: boolean };
      };

      expect(payload.command).toBe("deploy");
      expect(payload.success).toBe(true);
      expect(payload.deploy?.success).toBe(true);
      await expect(access(path.join(payload.deploy?.destination ?? "", "index.html"))).resolves.toBeUndefined();
    },
    120_000
  );
});

async function createIntegrationScenario(prefix: string): Promise<{
  configPath: string;
  rootDir: string;
}> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const vaultRoot = path.join(rootDir, "vault");
  const deployOutputDir = path.join(rootDir, "published-site");
  const configPath = path.join(rootDir, "publisher.config.json");

  temporaryDirectories.push(rootDir);

  await mkdir(vaultRoot, { recursive: true });
  await writeFile(
    path.join(vaultRoot, "index.md"),
    [
      "---",
      "title: CLI Integration Home",
      "publish: true",
      "---",
      "",
      "# CLI Integration Home",
      "",
      "This page is built by the real CLI integration test."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    configPath,
    JSON.stringify(
      {
        vaultRoot,
        publishMode: "frontmatter",
        outputDir: path.join(vaultRoot, ".osp", "dist"),
        builder: "quartz",
        deployTarget: "local-export",
        deployOutputDir,
        enableSearch: true,
        enableBacklinks: true,
        enableGraph: true,
        strictMode: false
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    configPath,
    rootDir
  };
}

function createCapturedOutput() {
  return {
    logs: [] as string[],
    errors: [] as string[],
    log(message: string) {
      this.logs.push(message);
    },
    error(message: string) {
      this.errors.push(message);
    }
  };
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a TCP port for CLI preview integration test.")));
        return;
      }

      server.close((closeError) => {
        if (closeError !== undefined) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForHttpReady(url: string): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the preview server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for CLI preview server at ${url}.`);
}
