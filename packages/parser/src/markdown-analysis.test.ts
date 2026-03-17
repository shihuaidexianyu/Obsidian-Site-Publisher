import { describe, expect, it } from "vitest";

import { analyzeMarkdownContent } from "./markdown-analysis";

describe("analyzeMarkdownContent", () => {
  it("extracts headings, block ids, links, embeds, and assets", () => {
    const result = analyzeMarkdownContent(`---
publish: true
---

# Hello World

Paragraph with block.^block-id

- [[Second Note]]
- [[Source#Heading Ref]]
- [[Source#^block-ref]]
- ![[Embedded]]
- ![[assets/diagram.png]]
- [Markdown Link](Second%20Note.md)
- [Section](#local-heading)
- [External](https://example.com)
- ![Inline Image](images/pic.png)

\`\`\`md
# Not A Heading
[[Ignored]]
\`\`\`
`);

    expect(result.headings).toEqual([
      {
        text: "Hello World",
        slug: "hello-world",
        depth: 1
      }
    ]);
    expect(result.blockIds).toEqual(["block-id"]);
    expect(result.links.map((link) => ({ kind: link.kind, target: link.target }))).toEqual([
      { kind: "wikilink", target: "Second Note" },
      { kind: "heading", target: "Source#Heading Ref" },
      { kind: "block", target: "Source#^block-ref" },
      { kind: "markdown", target: "Second Note.md" },
      { kind: "heading", target: "#local-heading" },
      { kind: "external", target: "https://example.com" }
    ]);
    expect(result.embeds.map((embed) => ({ kind: embed.kind, target: embed.target }))).toEqual([
      { kind: "note", target: "Embedded" },
      { kind: "asset", target: "assets/diagram.png" },
      { kind: "asset", target: "images/pic.png" }
    ]);
    expect(result.assets).toEqual([
      { path: "assets/diagram.png", kind: "image" },
      { path: "images/pic.png", kind: "image" }
    ]);
  });

  it("generates unicode-friendly slugs for headings", () => {
    const result = analyzeMarkdownContent("# 强化学习 导论");

    expect(result.headings).toEqual([
      {
        text: "强化学习 导论",
        slug: "强化学习-导论",
        depth: 1
      }
    ]);
  });
});
