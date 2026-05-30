import { Service } from "./application/services/index.ts";
import { Entity, Repository } from "./domain/index.ts";
import { Logger } from "./infra/logger/index.ts";
import { Levels } from "./infra/logger/levels.enum.ts";
import { KvRepository } from "./infra/persistence/kv/index.ts";
import { requestLogger } from "./presentation/http/logging/index.ts";
import { Controller } from "./presentation/controllers/index.ts";
import { App } from "./presentation/http/app.ts";
import { readJson, readText } from "./presentation/http/body.ts";
import { badRequest, HttpError, notFound } from "./presentation/http/errors.ts";
import { empty, json, redirect, text } from "./presentation/http/response.ts";
import { cors, secureHeaders } from "./presentation/http/security.ts";

export * from "./presentation/core/index.ts";
export * from "./presentation/http/index.ts";
export * from "./presentation/logger/index.ts";
export * from "./infra/persistence/kv/index.ts";

const Log = {
  Logger,
  Levels,
};

export const Box = {
  App,
  Controller,
  Entity,
  HttpError,
  KvRepository,
  Log,
  Repository,
  Service,
  badRequest,
  cors,
  empty,
  json,
  notFound,
  readJson,
  readText,
  redirect,
  requestLogger,
  secureHeaders,
  text,
};
