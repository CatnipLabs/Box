import type { CompilePathResult } from "./compile-path-result.interface.ts";
import { escapeRegex } from "./escape-regex.util.ts";
import { PATH_PARAM_PATTERN } from "./path-param-pattern.constant.ts";

export function compilePath(path: string): CompilePathResult {
  const paramNames: string[] = [];
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { pattern: /^\/$/, paramNames };
  }

  const pattern = segments.map((segment) => {
    const paramMatch = PATH_PARAM_PATTERN.exec(segment);

    if (paramMatch) {
      paramNames.push(paramMatch[1]);
      return "([^/]+)";
    }

    return escapeRegex(segment);
  }).join("/");

  return { pattern: new RegExp(`^/${pattern}$`), paramNames };
}
