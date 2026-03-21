import http from "node:http";
import path from "node:path";
import { access, readFile } from "node:fs/promises";

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
