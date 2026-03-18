import type { z } from "zod";

export function tryParseCliPayload<TSchema extends z.ZodTypeAny>(stdout: string, schema: TSchema): z.output<TSchema> | undefined {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index];

    if (candidate === undefined) {
      continue;
    }

    try {
      return schema.parse(JSON.parse(candidate)) as z.output<TSchema>;
    } catch {
      // Keep scanning older lines until we find the JSON payload.
    }
  }

  return undefined;
}
