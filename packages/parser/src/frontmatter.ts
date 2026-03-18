import { parseDocument } from "yaml";

export type FrontmatterFields = {
  properties: Record<string, unknown>;
  publish: boolean;
  aliases: string[];
  frontmatterError?: string;
  slug?: string;
  permalink?: string;
  description?: string;
};

export function parseFrontmatterFields(markdownSource: string): FrontmatterFields {
  const frontmatterSection = parseLeadingFrontmatterSection(markdownSource);

  if (frontmatterSection === undefined) {
    return {
      properties: {},
      publish: false,
      aliases: []
    };
  }

  const parsedFrontmatter = parseFrontmatterObject(frontmatterSection.block);
  const fields: FrontmatterFields = {
    properties: parsedFrontmatter.properties,
    publish: parsedFrontmatter.properties.publish === true,
    aliases: readAliases(parsedFrontmatter.properties.aliases)
  };

  if (parsedFrontmatter.error !== undefined) {
    fields.frontmatterError = parsedFrontmatter.error;
  }

  if (typeof parsedFrontmatter.properties.permalink === "string") {
    fields.permalink = parsedFrontmatter.properties.permalink;
  }

  if (typeof parsedFrontmatter.properties.slug === "string") {
    fields.slug = parsedFrontmatter.properties.slug;
  }

  if (typeof parsedFrontmatter.properties.description === "string") {
    fields.description = parsedFrontmatter.properties.description;
  }

  return fields;
}

export function stripLeadingFrontmatter(markdownSource: string): string {
  return parseLeadingFrontmatterSection(markdownSource)?.rest ?? markdownSource;
}

function parseFrontmatterObject(frontmatterBlock: string): {
  properties: Record<string, unknown>;
  error?: string;
} {
  try {
    const document = parseDocument(frontmatterBlock);

    if (document.errors.length > 0) {
      return {
        properties: {},
        error: "Frontmatter could not be parsed as YAML."
      };
    }

    const frontmatterValue = document.toJS();

    if (isRecord(frontmatterValue)) {
      return {
        properties: frontmatterValue
      };
    }

    return {
      properties: {},
      error: "Frontmatter must be a YAML object."
    };
  } catch {
    return {
      properties: {},
      error: "Frontmatter could not be parsed as YAML."
    };
  }
}

function readAliases(aliasesValue: unknown): string[] {
  if (typeof aliasesValue === "string") {
    return [aliasesValue];
  }

  if (Array.isArray(aliasesValue)) {
    return aliasesValue.filter((value): value is string => typeof value === "string");
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLeadingFrontmatterSection(
  markdownSource: string
): { block: string; rest: string } | undefined {
  const normalizedSource = markdownSource.replace(/\r\n/g, "\n");

  if (!normalizedSource.startsWith("---\n")) {
    return undefined;
  }

  const lines = normalizedSource.split("\n");

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    if (lines[lineIndex] !== "---" && lines[lineIndex] !== "...") {
      continue;
    }

    return {
      block: lines.slice(1, lineIndex).join("\n"),
      rest: lines.slice(lineIndex + 1).join("\n")
    };
  }

  return undefined;
}
