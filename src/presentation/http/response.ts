import { safeStringify } from "../../core/serialization/index.ts";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(safeStringify(data), { ...init, headers });
}

export function text(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }

  return new Response(body, { ...init, headers });
}

export function empty(status = 204, init: ResponseInit = {}): Response {
  return new Response(null, { ...init, status });
}

export function redirect(url: string | URL, status = 302): Response {
  return Response.redirect(url, status);
}

export function toResponse(value: unknown, init: ResponseInit = {}): Response {
  if (value instanceof Response) return value;

  if (value === undefined) {
    return empty(init.status ?? 204, init);
  }

  return json(value, init);
}
