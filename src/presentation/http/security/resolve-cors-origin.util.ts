import type { CorsOrigin } from "./cors-origin.type.ts";

export function resolveCorsOrigin(
  originOption: CorsOrigin,
  requestOrigin: string | null,
): string | null {
  if (typeof originOption === "function") {
    const result = originOption(requestOrigin);
    if (result === true) return requestOrigin ?? "*";
    if (typeof result === "string") return result;
    return null;
  }

  if (originOption === "*") {
    return "*";
  }

  if (typeof originOption === "string") {
    return originOption === requestOrigin ? originOption : null;
  }

  if (requestOrigin && originOption.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}
