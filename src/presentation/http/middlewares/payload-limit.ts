import { payloadTooLarge } from "../errors.ts";
import { json } from "../response.ts";
import { errorResponse } from "../responses/index.ts";
import type { Middleware } from "../types.ts";
import type { PayloadLimitOptions } from "./payload-limit-options.interface.ts";
import { RequestSizeLimit } from "./request-size-limit.enum.ts";

const DEFAULT_LIMITED_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;
const DEFAULT_UPLOAD_CONTENT_TYPES = [
  "multipart/form-data",
  "application/octet-stream",
] as const;

export function payloadLimit(options: PayloadLimitOptions = {}): Middleware {
  const jsonMaxBytes = normalizeLimit(
    options.jsonMaxBytes ?? RequestSizeLimit.MB1,
    "jsonMaxBytes",
  );
  const uploadMaxBytes = normalizeLimit(
    options.uploadMaxBytes ?? RequestSizeLimit.MB10,
    "uploadMaxBytes",
  );
  const defaultMaxBytes = normalizeLimit(
    options.defaultMaxBytes ?? RequestSizeLimit.MB1,
    "defaultMaxBytes",
  );
  const limitedMethods = new Set(
    (options.methods ?? DEFAULT_LIMITED_METHODS).map((method) =>
      method.toUpperCase()
    ),
  );
  const uploadContentTypes =
    (options.uploadContentTypes ?? DEFAULT_UPLOAD_CONTENT_TYPES)
      .map(normalizeContentType);

  return async (ctx, next) => {
    if (!limitedMethods.has(ctx.request.method.toUpperCase())) {
      return await next();
    }

    const maxBytes = limitForContentType(
      ctx.request.headers.get("content-type"),
      { jsonMaxBytes, uploadMaxBytes, defaultMaxBytes, uploadContentTypes },
    );

    if (contentLengthExceedsLimit(ctx.request, maxBytes)) {
      const error = payloadTooLarge();
      return json(errorResponse(error, ctx.request), { status: error.status });
    }

    if (ctx.request.body) {
      ctx.request = withLimitedBody(ctx.request, maxBytes);
    }

    return await next();
  };
}

function normalizeLimit(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number.`);
  }
  return Math.floor(value);
}

function contentLengthExceedsLimit(
  request: Request,
  maxBytes: number,
): boolean {
  const contentLength = request.headers.get("content-length");
  if (contentLength === null) return false;

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > maxBytes;
}

function limitForContentType(
  rawContentType: string | null,
  options: {
    readonly jsonMaxBytes: number;
    readonly uploadMaxBytes: number;
    readonly defaultMaxBytes: number;
    readonly uploadContentTypes: readonly string[];
  },
): number {
  const contentType = normalizeContentType(rawContentType ?? "");

  if (isJsonContentType(contentType)) return options.jsonMaxBytes;
  if (options.uploadContentTypes.includes(contentType)) {
    return options.uploadMaxBytes;
  }

  return options.defaultMaxBytes;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";", 1)[0].trim().toLowerCase();
}

function isJsonContentType(contentType: string): boolean {
  return contentType === "application/json" || contentType.endsWith("+json");
}

function withLimitedBody(request: Request, maxBytes: number): Request {
  const body = request.body;
  if (!body) return request;

  const limitedBody = limitStream(body, maxBytes);
  return new Request(
    request,
    {
      body: limitedBody,
      duplex: "half",
    } as RequestInit & { duplex: "half" },
  );
}

function limitStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let bytes = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          controller.error(payloadTooLarge());
          return;
        }

        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}
