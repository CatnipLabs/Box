import { assertEquals } from "@std/assert";

import { joinPaths } from "../../../src/presentation/http/utils/join-paths.util.ts";

Deno.test("joinPaths normalizes leading and trailing slashes", () => {
  assertEquals(joinPaths("/api/", "/users/"), "/api/users");
  assertEquals(joinPaths("api", "users"), "api/users");
  assertEquals(joinPaths("/", "/users"), "/users");
  assertEquals(joinPaths("/api", "/"), "/api");
  assertEquals(joinPaths("/", "/"), "/");
});

Deno.test("joinPaths handles long slash sequences without regular expressions", () => {
  const slashRun = "/".repeat(10_000);

  assertEquals(
    joinPaths(`/api${slashRun}`, `${slashRun}users${slashRun}`),
    "/api/users",
  );
});
