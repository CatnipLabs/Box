export class Service {
  public get serviceName(): string {
    return this.constructor.name;
  }
}
