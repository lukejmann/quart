declare namespace ModuleWorker {
  type Bindings = Record<
    string,
    KVNamespace | DurableObjectNamespace | CryptoKey | string
  >;

  type FetchHandler<Environment extends Bindings = Bindings> = (
    request: Request,
    env: Environment,
    ctx: Pick<FetchEvent, "waitUntil" | "passThroughOnException">
  ) => Promise<Response> | Response;

  type CronHandler<Environment extends Bindings = Bindings> = (
    event: Omit<ScheduledEvent, "waitUntil">,
    env: Environment,
    ctx: Pick<ScheduledEvent, "waitUntil">
  ) => Promise<void> | void;
}

interface ModuleWorker<
  Environment extends ModuleWorker.Bindings = ModuleWorker.Bindings
> {
  fetch?: ModuleWorker.FetchHandler<Environment>;
  scheduled?: ModuleWorker.CronHandler<Environment>;
}

declare const WebSocketPair: {
  new (): {
    /** the `client` socket */
    0: WebSocket;
    /** the `server` socket */
    1: WebSocket;
  };
};

interface WebSocket {
  accept(): void;
}

interface ResponseInit {
  webSocket?: WebSocket;
}
