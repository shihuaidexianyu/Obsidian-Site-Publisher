import type { NoteRecord } from "@osp/shared";
type MarkdownAnalysis = Pick<NoteRecord, "assets" | "blockIds" | "embeds" | "headings" | "links">;
export declare function analyzeMarkdownContent(markdownSource: string): MarkdownAnalysis;
export {};
