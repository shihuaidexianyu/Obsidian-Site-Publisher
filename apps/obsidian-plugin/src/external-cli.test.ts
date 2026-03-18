import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveCliCommand, resolveCliLogDirectory } from "./external-cli.js";

describe("external CLI helpers", () => {
  it("uses the configured CLI executable path when provided", () => {
    expect(
      resolveCliCommand("/vault", {
        executablePath: "./tools/publisher-cli.cmd"
      })
    ).toBe(path.resolve("/vault", "./tools/publisher-cli.cmd"));
  });

  it("falls back to the default publisher-cli command when no path is configured", () => {
    expect(resolveCliCommand("/vault", {})).toBe(process.platform === "win32" ? "publisher-cli.cmd" : "publisher-cli");
  });

  it("resolves the configured CLI log directory against the vault root", () => {
    expect(
      resolveCliLogDirectory("/vault", {
        logDirectory: ".osp/logs"
      })
    ).toBe(path.resolve("/vault", ".osp/logs"));
  });

  it("returns undefined when the CLI log directory is not configured", () => {
    expect(resolveCliLogDirectory("/vault", {})).toBeUndefined();
  });
});
