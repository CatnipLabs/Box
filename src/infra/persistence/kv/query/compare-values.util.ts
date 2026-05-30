import type { SortDirection } from "./sort-direction.type.ts";
import { comparePrimitive } from "./compare-primitive.util.ts";

export function compareValues(
  left: unknown,
  right: unknown,
  direction: SortDirection,
): number {
  const result = comparePrimitive(left, right);
  return direction === "asc" ? result : -result;
}
