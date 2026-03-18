import { parseDocument } from "yaml";
export function parseFrontmatterFields(markdownSource) {
    const frontmatterBlock = extractFrontmatterBlock(markdownSource);
    if (frontmatterBlock === undefined) {
        return {
            properties: {},
            publish: false,
            aliases: []
        };
    }
    const parsedProperties = parseFrontmatterObject(frontmatterBlock);
    const fields = {
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
function extractFrontmatterBlock(markdownSource) {
    const match = markdownSource.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);
    return match?.[1];
}
export function stripLeadingFrontmatter(markdownSource) {
    return markdownSource.replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/, "");
}
function parseFrontmatterObject(frontmatterBlock) {
    try {
        const document = parseDocument(frontmatterBlock);
        const frontmatterValue = document.toJS();
        if (isRecord(frontmatterValue)) {
            return frontmatterValue;
        }
    }
    catch {
        return {};
    }
    return {};
}
function readAliases(aliasesValue) {
    if (typeof aliasesValue === "string") {
        return [aliasesValue];
    }
    if (Array.isArray(aliasesValue)) {
        return aliasesValue.filter((value) => typeof value === "string");
    }
    return [];
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=frontmatter.js.map