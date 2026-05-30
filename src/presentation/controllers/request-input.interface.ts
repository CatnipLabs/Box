export interface RequestInput<
  TBody = unknown,
  TQuery = Record<string, string | string[]>,
  TParams = Record<string, string>,
  THeaders = Record<string, string>,
> {
  readonly body: TBody;
  readonly query: TQuery;
  readonly params: TParams;
  readonly headers: THeaders;
}
