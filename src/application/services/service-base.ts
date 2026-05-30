export class ServiceBase {
  public get serviceName(): string {
    return this.constructor.name;
  }
}
