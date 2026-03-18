import { describe, expect, it } from "vitest";

import { normalizeStagedMarkdown } from "./markdown-normalization.js";

describe("normalizeStagedMarkdown", () => {
  it("converts parenthesized Obsidian display math into inline math", () => {
    const input = ["因为 70 落在刚才得到的 95% 置信区间 ($$", "69.94,78.06", "", "$$", ") 内。", ""].join("\n");

    expect(normalizeStagedMarkdown(input)).toContain("95% 置信区间 $69.94,78.06$ 内。");
  });

  it("normalizes LaTeX bracket delimiters into canonical Quartz-friendly math blocks", () => {
    const input = ["\\[", "", "f(x)=x^2", "", "\\]", ""].join("\n");

    expect(normalizeStagedMarkdown(input)).toBe("$$\nf(x)=x^2\n$$\n");
  });

  it("normalizes inline LaTeX math delimiters outside inline code", () => {
    const input = "令 \\( x + y \\) 为和，示例代码 `\\( keep \\)` 不应被改写。\n";

    expect(normalizeStagedMarkdown(input)).toBe("令 $x + y$ 为和，示例代码 `\\( keep \\)` 不应被改写。\n");
  });

  it("rewrites single-line display math into canonical multi-line blocks", () => {
    const input = ["正文", "$$ d=0.33 $$", "尾注", ""].join("\n");

    expect(normalizeStagedMarkdown(input)).toBe(["正文", "$$", "d=0.33", "$$", "尾注", ""].join("\n"));
  });

  it("leaves fenced code blocks untouched", () => {
    const input = ["```python", "literal = \"\\\\( x + y \\\\)\"", "```", "", "\\( x + y \\)", ""].join("\n");

    expect(normalizeStagedMarkdown(input)).toBe(["```python", "literal = \"\\\\( x + y \\\\)\"", "```", "", "$x + y$", ""].join("\n"));
  });
});
