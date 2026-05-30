import { Box, type Param, z } from "../../src/mod.ts";

const HelloParams = z.object({
  name: z.string().min(1),
});

type HelloParams = z.infer<typeof HelloParams>;

@Box.Controller()
class HealthController {
  @Box.Get("/health")
  public health(): { ok: true } {
    return { ok: true };
  }
}

@Box.Controller("/hello")
class HelloController {
  @Box.Get(":name", {
    request: {
      params: HelloParams,
    },
  })
  public hello(input: Param<HelloParams>): { hello: string } {
    return { hello: input.params.name };
  }
}

const app = Box.createApp({
  controllers: [HealthController, HelloController],
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
