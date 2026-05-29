import { badRequest, payloadTooLarge } from "./errors.ts";
import type { BodyReadOptions } from "./types.ts";

const DEFAULT_MAX_BYTES = 1_048_576;

export async function readText(
  request: Request,
  options: BodyReadOptions = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const body = await request.text();
  const bytes = new TextEncoder().encode(body).byteLength;

  if (bytes > maxBytes) {
    throw payloadTooLarge();
  }

  return body;
}

export async function readJson<T = unknown>(
  request: Request,
  options: BodyReadOptions = {},
): Promise<T> {
  const body = await readText(request, options);

  if (body.trim().length === 0) {
    throw badRequest("Request body is empty");
  }

  try {
    return JSON.parse(body) as T;
  } catch (_error) {
    throw badRequest("Invalid JSON body");
  }
}
