import { type AuthStrategyContract, Box, type Context } from "../../src/mod.ts";

@Box.Service()
class ApiKeyService {
  public isValid(apiKey: string | null): boolean {
    return apiKey === "demo-api-key";
  }
}

@Box.AuthStrategy({ name: "api-key", deps: [ApiKeyService] })
class ApiKeyAuthStrategy implements AuthStrategyContract {
  public constructor(private readonly apiKeys: ApiKeyService) {}

  public validate(ctx: Context): boolean {
    if (!this.apiKeys.isValid(ctx.request.headers.get("x-api-key"))) {
      return false;
    }

    ctx.state.authenticatedBy = "api-key";
    return true;
  }
}

@Box.Controller("/reports")
@Box.Auth("api-key")
class ReportsController {
  @Box.Get("/")
  public list(): { reports: string[] } {
    return { reports: ["daily-sales", "stock-alerts"] };
  }
}

const app = Box.createApp({
  authStrategies: [ApiKeyAuthStrategy],
  controllers: [ReportsController],
  services: [ApiKeyService],
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
