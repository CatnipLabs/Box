import type { QueryOperator } from "./query-operator.type.ts";
import { comparePrimitive } from "./compare-primitive.util.ts";
import { containsValue } from "./contains-value.util.ts";

export function matchesFilter(
  actual: unknown,
  operator: QueryOperator,
  expected: unknown,
): boolean {
  switch (operator) {
    case "eq":
      return Object.is(actual, expected);
    case "ne":
      return !Object.is(actual, expected);
    case "gt":
      return comparePrimitive(actual, expected) > 0;
    case "gte":
      return comparePrimitive(actual, expected) >= 0;
    case "lt":
      return comparePrimitive(actual, expected) < 0;
    case "lte":
      return comparePrimitive(actual, expected) <= 0;
    case "contains":
      return containsValue(actual, expected);
  }
}
