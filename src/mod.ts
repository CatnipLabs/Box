import { Service } from "./application/services/index.ts";
import { Entity, Repository } from "./domain/index.ts";
import { Logger } from "./infra/logger/index.ts";
import { Levels } from "./infra/logger/levels.enum.ts";
import { KvRepository } from "./infra/persistence/kv/index.ts";
import { requestLogger } from "./presentation/http/logging/index.ts";
import {
  Controller,
  Delete,
  Get,
  Head,
  Options,
  Patch,
  Post,
  Put,
  Route,
} from "./presentation/controllers/index.ts";
import { App } from "./presentation/http/app.ts";
import { createApp } from "./presentation/http/create-app.ts";
import { readJson, readText } from "./presentation/http/body.ts";
import { createOpenApiDocument } from "./presentation/http/docs/index.ts";
import { badRequest, HttpError, notFound } from "./presentation/http/errors.ts";
import { empty, json, redirect, text } from "./presentation/http/response.ts";
import { cors, secureHeaders } from "./presentation/http/security.ts";
import { z } from "zod";

export * from "./core/index.ts";
export * from "./presentation/controllers/index.ts";
export * from "./presentation/http/index.ts";
export * from "./logger/index.ts";
export * from "./infra/persistence/kv/index.ts";
export { z } from "zod";

const Log = {
  Logger,
  Levels,
};

export const Box = {
  App,
  Controller,
  Delete,
  Entity,
  Get,
  Head,
  HttpError,
  KvRepository,
  Log,
  Options,
  Patch,
  Post,
  Put,
  Repository,
  Route,
  Service,
  badRequest,
  cors,
  createApp,
  createOpenApiDocument,
  empty,
  json,
  notFound,
  readJson,
  readText,
  redirect,
  requestLogger,
  secureHeaders,
  text,
  z,
};
