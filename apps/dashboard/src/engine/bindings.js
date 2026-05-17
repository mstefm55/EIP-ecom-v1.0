const TOKEN_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;

export function getPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

export function setPath(obj, path, value) {
  if (!path) return obj;
  const keys = path.split(".");
  let cursor = obj;
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      cursor[key] = value;
    } else {
      if (!cursor[key] || typeof cursor[key] !== "object") {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
  });
  return obj;
}

export function translateData(rawData, dictionary = {}) {
  if (!dictionary || typeof dictionary !== "object") return {};
  const translated = {};

  Object.entries(dictionary).forEach(([sourcePath, spec]) => {
    if (!sourcePath) return;
    const value = getPath(rawData, sourcePath);
    if (typeof spec === "string") {
      setPath(translated, spec, value);
      return;
    }
    if (spec && typeof spec === "object") {
      const key = spec.key || spec.target || spec.name;
      if (key) setPath(translated, key, value ?? spec.default ?? null);
    }
  });

  return translated;
}

export function resolveBindings(value, dataContext) {
  if (value == null) return value;
  if (typeof value === "string") {
    const matches = [...value.matchAll(TOKEN_REGEX)];
    if (!matches.length) return value;
    if (matches.length === 1 && matches[0][0].trim() === value.trim()) {
      const token = matches[0][1]?.trim();
      const resolved = getPath(dataContext, token);
      return resolved ?? "";
    }
    return value.replace(TOKEN_REGEX, (_, token) => {
      const resolved = getPath(dataContext, token.trim());
      return resolved == null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => resolveBindings(entry, dataContext));
  }
  if (typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
      output[key] = resolveBindings(entry, dataContext);
    });
    return output;
  }
  return value;
}
