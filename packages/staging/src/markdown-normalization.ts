export function normalizeStagedMarkdown(markdownSource: string): string {
  const normalizedParenthesizedMath = normalizeParenthesizedDisplayMath(markdownSource);

  return trimDisplayMathWhitespace(normalizedParenthesizedMath);
}

function normalizeParenthesizedDisplayMath(markdownSource: string): string {
  return markdownSource.replace(/([（(])\s*\$\$\s*([\s\S]*?)\s*\$\$\s*([)）])/gu, (match, leftParen, body, rightParen) => {
    if (!isMatchingParenPair(leftParen, rightParen)) {
      return match;
    }

    const normalizedBody = collapseInlineMathWhitespace(body);

    if (normalizedBody === "") {
      return match;
    }

    return `$${normalizedBody}$`;
  });
}

function trimDisplayMathWhitespace(markdownSource: string): string {
  return markdownSource.replace(/\$\$\s*\n+([\s\S]*?)\n+\$\$/gu, (_match, body: string) => {
    const trimmedBody = body
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();

    return trimmedBody === "" ? "$$\n$$" : `$$\n${trimmedBody}\n$$`;
  });
}

function collapseInlineMathWhitespace(body: string): string {
  return body.replace(/\s+/gu, " ").trim();
}

function isMatchingParenPair(leftParen: string, rightParen: string): boolean {
  return (leftParen === "(" && rightParen === ")") || (leftParen === "（" && rightParen === "）");
}
