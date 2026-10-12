/**
 * Finds where a JSON Pointer (e.g. "/sections/1/nodes/0/style/display") points inside JSON text, so an issue
 * can jump to that spot in the editor. Returns the character range of the value (or of the key when the
 * value is missing), or null if the text isn't valid JSON or the path doesn't exist.
 */
export function locatePointer(text: string, pointer: string): { start: number; end: number } | null {
  const segments = pointer === "" ? [] : pointer.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
  let pos = 0;

  const ws = () => {
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  };

  // Skips one JSON value starting at pos; returns false on malformed input
  const skipValue = (): boolean => {
    ws();
    const c = text[pos];
    if (c === '"') return skipString();
    if (c === "{" || c === "[") {
      const close = c === "{" ? "}" : "]";
      pos++;
      ws();
      if (text[pos] === close) {
        pos++;
        return true;
      }
      for (;;) {
        if (c === "{") {
          ws();
          if (!skipString()) return false;
          ws();
          if (text[pos] !== ":") return false;
          pos++;
        }
        if (!skipValue()) return false;
        ws();
        if (text[pos] === ",") {
          pos++;
          continue;
        }
        if (text[pos] === close) {
          pos++;
          return true;
        }
        return false;
      }
    }
    const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(pos, pos + 40));
    if (!literal) return false;
    pos += literal[0].length;
    return true;
  };

  const skipString = (): boolean => {
    if (text[pos] !== '"') return false;
    pos++;
    while (pos < text.length && text[pos] !== '"') pos += text[pos] === "\\" ? 2 : 1;
    if (pos >= text.length) return false;
    pos++;
    return true;
  };

  const readString = (): string | null => {
    const start = pos;
    if (!skipString()) return null;
    try {
      return JSON.parse(text.slice(start, pos)) as string;
    } catch {
      return null;
    }
  };

  let lastKey: { start: number; end: number } | null = null;
  for (const segment of segments) {
    ws();
    const c = text[pos];
    if (c === "{") {
      pos++;
      let found = false;
      for (;;) {
        ws();
        if (text[pos] === "}") break;
        const keyStart = pos;
        const key = readString();
        if (key === null) return null;
        lastKey = { start: keyStart, end: pos };
        ws();
        if (text[pos] !== ":") return null;
        pos++;
        if (key === segment) {
          found = true;
          break;
        }
        if (!skipValue()) return null;
        ws();
        if (text[pos] === ",") pos++;
      }
      if (!found) return null;
    } else if (c === "[") {
      pos++;
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) return null;
      for (let i = 0; i < index; i++) {
        if (!skipValue()) return null;
        ws();
        if (text[pos] !== ",") return null;
        pos++;
      }
      ws();
      if (text[pos] === "]") return null;
    } else {
      return null;
    }
  }
  ws();
  const start = pos;
  if (!skipValue()) return lastKey;
  return { start, end: pos };
}
