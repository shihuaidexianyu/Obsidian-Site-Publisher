export type FrontmatterFields = {
    properties: Record<string, unknown>;
    publish: boolean;
    aliases: string[];
    permalink?: string;
    description?: string;
};
export declare function parseFrontmatterFields(markdownSource: string): FrontmatterFields;
export declare function stripLeadingFrontmatter(markdownSource: string): string;
