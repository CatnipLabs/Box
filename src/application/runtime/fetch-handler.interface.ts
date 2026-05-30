export interface FetchHandler {
  fetch(request: Request): Promise<Response>;
}
