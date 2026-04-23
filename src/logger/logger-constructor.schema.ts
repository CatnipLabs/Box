import { z } from "zod";
import { Levels } from "./levels.enum.ts";

export const LoggerConstructorSchema = z.object({
    name: z.string().optional(),
    level: z.enum(Levels).optional().default(Levels.INFO)
});

export type LoggerConstructorOptions = z.infer<typeof LoggerConstructorSchema>;