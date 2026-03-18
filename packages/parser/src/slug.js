export function slugify(value) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return normalized === "" ? "note" : normalized;
}
//# sourceMappingURL=slug.js.map