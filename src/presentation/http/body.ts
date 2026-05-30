import { badRequest, payloadTooLarge } from "./errors.ts";
import type { BodyReadOptions } from "./types.ts";

const DEFAULT_MAX_BYTES = 1_048_576;

export async function readText(
  request: Request,
  options: BodyReadOptions = {},
): Promise<string> {
  const maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_MAX_BYTES);
  rejectIfContentLengthExceedsLimit(request, maxBytes);

  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge();
      }

      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  body += decoder.decode();
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

function rejectIfContentLengthExceedsLimit(
  request: Request,
  maxBytes: number,
): void {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return;

  const bytes = Number(contentLength);
  if (Number.isFinite(bytes) && bytes > maxBytes) {
    throw payloadTooLarge();
  }
}
