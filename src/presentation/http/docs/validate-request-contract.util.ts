import { ZodError } from "zod";
import { readText } from "../body.ts";
import { badRequest, HttpError } from "../errors.ts";
import type { Context, ValidatedRequest } from "../types.ts";
import type { RouteRequestContract } from "./route-request-contract.interface.ts";

export async function validateRequestContract(
  ctx: Context,
  contract: RouteRequestContract | undefined,
): Promise<ValidatedRequest> {
  if (!contract) return {};

  const validated: Record<string, unknown> = {};

  if (contract.params) {
    validated.params = parseWithZod("params", contract.params, ctx.params);
  }

  if (contract.query) {
    validated.query = parseWithZod(
      "query",
      contract.query,
      queryToObject(ctx.query),
    );
  }

  if (contract.headers) {
    validated.headers = parseWithZod(
      "headers",
      contract.headers,
      headersToObject(ctx.request.headers),
    );
  }

  if (contract.body) {
    const body = await readJsonBodyForValidation(
      ctx.request,
      contract.bodyMaxBytes,
    );
    validated.body = parseWithZod("body", contract.body, body);
  }

  return validated;
}

function parseWithZod(
  label: string,
  schema: { parse: (value: unknown) => unknown },
  value: unknown,
): unknown {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest(
        `Invalid request ${label}`,
        error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
          message: issue.message,
        })),
      );
    }

    throw error;
  }
}

async function readJsonBodyForValidation(
  request: Request,
  maxBytes: number | undefined,
): Promise<unknown> {
  const body = await readText(request.clone(), { maxBytes });

  if (body.trim().length === 0) {
    throw invalidRequestBody();
  }

  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalidRequestBody();
  }
}

function invalidRequestBody(): HttpError {
  return badRequest("Invalid request body", [{
    path: "",
    code: "invalid_json",
    message: "Request body must be valid JSON",
  }]);
}

function queryToObject(
  query: URLSearchParams,
): Record<string, string | string[]> {
  const value: Record<string, string | string[]> = {};

  for (const [key, entry] of query.entries()) {
    const current = value[key];
    if (current === undefined) {
      value[key] = entry;
      continue;
    }

    value[key] = Array.isArray(current)
      ? [...current, entry]
      : [current, entry];
  }

  return value;
}

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}
