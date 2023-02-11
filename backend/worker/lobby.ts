import { Group } from "dog";
import type { Bindings } from "./types";

export class Lobby extends Group<Bindings> {
  limit = 1; // max conns per REPLICA stub

  link(env: Bindings) {
    return {
      child: env.POOL,
      self: env.LOBBY,
    };
  }

  // Optional: Only create REPLICAs in the "eu" jurisdiction
  clusterize(req: Request, target: DurableObjectNamespace): DurableObjectId {
    console.log("[ HELLO ][clusterize] req", JSON.stringify(req));
    return target.newUniqueId();
  }
}
