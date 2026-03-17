import { parseDocument } from "yaml";

export type FrontmatterFields = {
  properties: Record<string, unknown>;
  publish: boolean;
  aliases: string[];
  permalink?: string;
  description?: string;
};

export function parseFrontmatterFields(markdownSource: string): FrontmatterFields {
  const frontmatterBlock = extractFrontmatterBlock(markdownSource);

  if (frontmatterBlock === undefined) {
    return {
      properties: {},
      publish: false,
      aliases: []
    };
  }

  const parsedProperties = parseFrontmatterObject(frontmatterBlock);
  const fields: FrontmatterFields = {
    properties: parsedProperties,
    publish: parsedProperties.publish === true,
    aliases: readAliases(parsedProperties.aliases)
  };

  if (typeof parsedProperties.permalink === "string") {
    fields.permalink = parsedProperties.permalink;
  }

  if (typeof parsedProperties.description === "string") {
    fields.description = parsedProperties.description;
  }

  return fields;
}

function extractFrontmatterBlock(markdownSource: string): string | undefined {
  const match = markdownSource.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);

  return match?.[1];
}

export function stripLeadingFrontmatter(markdownSource: string): string {
  return markdownSource.replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/, "");
}

function parseFrontmatterObject(frontmatterBlock: string): Record<string, unknown> {
  try {
    const document = parseDocument(frontmatterBlock);
    const frontmatterValue = document.toJS();

    if (isRecord(frontmatterValue)) {
      return frontmatterValue;
    }
  } catch {
    return {};
  }

  return {};
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
