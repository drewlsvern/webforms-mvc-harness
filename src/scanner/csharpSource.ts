/**
 * Strips line comments, block comments, and plain string-literal contents
 * from C# source via a single left-to-right scan (not regex chaining) -
 * regex passes applied in sequence would misfire on a string containing
 * "//" (e.g. a URL in `Response.Redirect("http://...")`) being mistaken for
 * a line comment. Not a real C# parser: verbatim (`@"..."`) and interpolated
 * (`$"..."`) strings aren't specially handled (see design.md Risks in the
 * presenter-model-scan-accuracy change) - an accepted gap, not an oversight.
 */
export function stripCommentsAndStrings(source: string): string {
  let result = "";
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === '"') {
      i++;
      while (i < n && source[i] !== '"') {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      result += '""';
      continue;
    }

    // A char literal (e.g. '"' or '\'') can contain a double-quote - without
    // this, that quote would be mistaken for the start of a string literal
    // and the scanner would run off looking for an unrelated closing quote.
    if (ch === "'") {
      i++;
      if (source[i] === "\\") i++;
      i++;
      if (source[i] === "'") i++;
      result += "''";
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}
