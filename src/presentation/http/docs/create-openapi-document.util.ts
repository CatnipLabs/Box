import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import type { OpenApiDocument } from "./openapi-document.type.ts";
import type { RegisteredRouteDocumentation } from "./registered-route-documentation.interface.ts";
import type { ResolvedDocsOptions } from "./resolved-docs-options.interface.ts";
import type { RouteOptions } from "./route-options.interface.ts";
import type { RouteRequestContract } from "./route-request-contract.interface.ts";
import type { RouteResponseContract } from "./route-response-contract.interface.ts";

export function createOpenApiDocument(
  routes: readonly RegisteredRouteDocumentation[],
  options: ResolvedDocsOptions,
): OpenApiDocument {
  const document: OpenApiDocument = {
    openapi: "3.1.0",
    info: withoutUndefined({
      title: options.title,
      version: options.version,
      description: options.description,
    }),
    paths: {},
  };

  if (options.servers.length > 0) {
    document.servers = options.servers;
  }

  const paths = document.paths as Record<string, Record<string, unknown>>;

  for (const route of routes) {
    if (route.options.docs === false) continue;

    const openApiPath = toOpenApiPath(route.path);
    const pathItem = paths[openApiPath] ?? {};
    pathItem[route.method.toLowerCase()] = createOperation(
      route.options,
      route,
    );
    paths[openApiPath] = pathItem;
  }

  return document;
}

function createOperation(
  options: RouteOptions,
  route: RegisteredRouteDocumentation,
): Record<string, unknown> {
  return withoutUndefined({
    summary: options.summary,
    description: options.description,
    operationId: options.operationId,
    tags: options.tags,
    deprecated: options.deprecated === true ? true : undefined,
    parameters: createParameters(options.request, route.path),
    requestBody: createRequestBody(options.request?.body),
    responses: createResponses(options.responses),
  });
}

function createParameters(
  request: RouteRequestContract | undefined,
  routePath: string,
): unknown[] | undefined {
  const parameters: unknown[] = [];
  const documentedPathParams = new Set<string>();

  if (request?.params) {
    parameters.push(
      ...parametersFromObjectSchema(request.params, "path", true),
    );
    for (const parameter of parameters as Array<{ name?: string }>) {
      if (typeof parameter.name === "string") {
        documentedPathParams.add(parameter.name);
      }
    }
  }

  for (const name of extractPathParams(routePath)) {
    if (documentedPathParams.has(name)) continue;
    parameters.push({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }

  if (request?.query) {
    parameters.push(
      ...parametersFromObjectSchema(request.query, "query", false),
    );
  }

  if (request?.headers) {
    parameters.push(
      ...parametersFromObjectSchema(request.headers, "header", false),
    );
  }

  return parameters.length > 0 ? parameters : undefined;
}

function parametersFromObjectSchema(
  schema: ZodTypeAny,
  location: "path" | "query" | "header",
  forceRequired: boolean,
): unknown[] {
  const jsonSchema = schemaToJsonSchema(schema);
  const properties = asRecord(jsonSchema.properties);
  const required = new Set(
    Array.isArray(jsonSchema.required) ? jsonSchema.required.map(String) : [],
  );

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: forceRequired || required.has(name),
    schema: propertySchema,
  }));
}

function createRequestBody(
  schema: ZodTypeAny | undefined,
): unknown | undefined {
  if (!schema) return undefined;

  return {
    required: true,
    content: {
      "application/json": {
        schema: schemaToJsonSchema(schema),
      },
    },
  };
}

function createResponses(
  responses: RouteOptions["responses"],
): Record<string, unknown> {
  if (!responses || Object.keys(responses).length === 0) {
    return {
      200: { description: "Successful response" },
    };
  }

  return Object.fromEntries(
    Object.entries(responses).map(([status, response]) => [
      status,
      createResponse(response),
    ]),
  );
}

function createResponse(
  response: RouteResponseContract,
): Record<string, unknown> {
  const contentType = response.contentType ?? "application/json";

  if (!response.body) {
    return { description: response.description ?? "Response" };
  }

  return {
    description: response.description ?? "Response",
    content: {
      [contentType]: {
        schema: schemaToJsonSchema(response.body),
      },
    },
  };
}

function schemaToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: "openApi3" }) as Record<
    string,
    unknown
  >;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function toOpenApiPath(path: string): string {
  return path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function extractPathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}
