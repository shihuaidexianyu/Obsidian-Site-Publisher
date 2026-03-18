import { describe, expect, it } from "vitest";

import { resolveAssetCandidates } from "./asset-resolution";

describe("resolveAssetCandidates", () => {
  it("resolves bare asset names through a note-relative attachment folder", () => {
    expect(
      resolveAssetCandidates("Topic/Guide.md", "diagram.png", {
        attachmentFolderPath: "./assets"
      })
    ).toEqual(["Topic/diagram.png", "Topic/assets/diagram.png", "Topic/Guide.assets/diagram.png"]);
  });

  it("falls back to a sibling .assets folder for legacy markdown exports", () => {
    expect(resolveAssetCandidates("Legacy/Guide.md", "image.png")).toEqual([
      "Legacy/image.png",
      "Legacy/Guide.assets/image.png"
    ]);
  });
});
