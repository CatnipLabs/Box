import { App } from "./http/app.ts";
import { readJson, readText } from "./http/body.ts";
import { badRequest, HttpError, notFound } from "./http/errors.ts";
import { empty, json, redirect, text } from "./http/response.ts";
import { Logger } from "./logger/index.ts";
import { Levels } from "./logger/levels.enum.ts";

export * from "./http/index.ts";

const Log = {
  Logger,
  Levels,
};

export const Box = {
  App,
  HttpError,
  Log,
  badRequest,
  empty,
  json,
  notFound,
  readJson,
  readText,
  redirect,
  text,
};
