import http from "node:http";
import net from "node:net";
import path from "node:path";
import { access, readFile } from "node:fs/promises";

import type { BuildLogEntry } from "@osp/shared";

export async function startStaticPreviewServer(outputDir: string, port: number): Promise<http.Server> {
  const server = http.createServer(async (request, response) => {
    try {
      const resolvedPath = await resolvePreviewRequestPath(outputDir, request.url ?? "/");
      const body = await readFile(resolvedPath);

      response.writeHead(200, {
        "Content-Type": getContentType(resolvedPath)
      });
      response.end(body);
    } catch {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("Not Found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });

  return server;
}

export async function waitForPortReady(input: {
  exitPromise: Promise<number>;
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<void> {
  const deadline = Date.now() + input.timeoutMs;

  while (Date.now() < deadline) {
    const exitState = await Promise.race([
      input.exitPromise.then((code) => ({ kind: "exit" as const, code })),
      delay(250).then(() => ({ kind: "wait" as const }))
    ]);

    if (exitState.kind === "exit") {
      throw new Error(`Quartz preview exited before becoming ready with code ${exitState.code}.`);
    }

    if (await canConnect(input.host, input.port)) {
      return;
    }
  }

  throw new Error(`Quartz preview did not open http://localhost:${input.port} within ${input.timeoutMs}ms.`);
}

export function createPreviewFailureMessage(error: unknown, logs: BuildLogEntry[]): string {
  const lastLog = logs.at(-1)?.message;
  const baseMessage = error instanceof Error ? error.message : "Quartz preview failed to start.";

  if (lastLog === undefined) {
    return baseMessage;
  }

  return `${baseMessage} Last Quartz log: ${lastLog}`;
}

export function createPreviewBuildFailureMessage(logs: BuildLogEntry[]): string {
  const lastErrorLog = [...logs].reverse().find((log) => log.level === "error")?.message;

  if (lastErrorLog === undefined) {
    return "Quartz preview build failed before the static preview server could start.";
  }

  return `Quartz preview build failed before the static preview server could start. Last Quartz log: ${lastErrorLog}`;
}

export function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

async function resolvePreviewRequestPath(outputDir: string, requestUrl: string): Promise<string> {
  const requestedPath = decodeURIComponent((requestUrl.split("?")[0] ?? "/").replace(/\\/g, "/"));
  const normalizedPath = requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`;
  const candidatePaths = normalizedPath.endsWith("/")
    ? [path.join(outputDir, normalizedPath, "index.html"), path.join(outputDir, `${normalizedPath.slice(0, -1)}.html`)]
    : [
        path.join(outputDir, normalizedPath),
        path.join(outputDir, `${normalizedPath}.html`),
        path.join(outputDir, normalizedPath, "index.html")
      ];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      // Try the next preview path candidate.
    }
  }

  throw new Error(`Preview path not found for ${requestUrl}.`);
}

function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
