import { Levels } from "../levels.enum.ts";

export function isLevel(value: unknown): value is Levels {
  return Object.values(Levels).includes(value as Levels);
}
