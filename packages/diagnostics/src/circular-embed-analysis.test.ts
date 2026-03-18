import type { NoteRecord, VaultManifest } from "@osp/shared";
import { describe, expect, it } from "vitest";

import { analyzeCircularEmbeds } from "./circular-embed-analysis";

describe("analyzeCircularEmbeds", () => {
  it("reports cycles in note embed graphs", () => {
    const manifest: VaultManifest = {
      generatedAt: new Date().toISOString(),
      vaultRoot: "/vault",
      notes: [
        createNote("A.md", [{ raw: "![[B]]", target: "B", kind: "note" }]),
        createNote("B.md", [{ raw: "![[C]]", target: "C", kind: "note" }]),
        createNote("C.md", [{ raw: "![[A]]", target: "A", kind: "note" }]),
        createNote("Detached.md", [{ raw: "![[Missing]]", target: "Missing", kind: "note" }])
      ],
      assetFiles: [],
      unsupportedObjects: []
    };

    const issues = analyzeCircularEmbeds(manifest);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "CIRCULAR_EMBED",
      severity: "error"
    });
    expect(issues[0]?.message).toContain("A.md -> B.md -> C.md -> A.md");
  });
});

function createNote(path: string, embeds: NoteRecord["embeds"]): NoteRecord {
  return {
    id: path,
    path,
    title: path.replace(/\.md$/, ""),
    slug: path.toLowerCase(),
    aliases: [],
    headings: [],
    blockIds: [],
    properties: {},
    links: [],
    embeds,
    assets: [],
    publish: true
  };
}
