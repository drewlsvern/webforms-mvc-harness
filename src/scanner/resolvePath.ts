import path from "node:path";

/**
 * Resolves a raw href/PostBackUrl/Redirect target to a root-relative page id.
 * "~/" and a leading "/" are app-root-relative in WebForms; anything else
 * resolves relative to the referencing page's own directory.
 */
export function resolveAppRelative(pageDirFromRoot: string, raw: string): string {
  let value = raw.trim();
  if (value.startsWith("~/")) {
    value = value.slice(2);
    return path.posix.normalize(value);
  }
  if (value.startsWith("/")) {
    value = value.slice(1);
    return path.posix.normalize(value);
  }
  return path.posix.normalize(path.posix.join(pageDirFromRoot, value));
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}
