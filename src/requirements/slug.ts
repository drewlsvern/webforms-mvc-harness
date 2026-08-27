export function slug(id: string): string {
  return id.replace(/\.[a-zA-Z]+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
