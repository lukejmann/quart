//
import {
  Block as BlockObject,
  Space as SpaceObject,
  User as UserObject,
} from "sync-core/src/state/objects";
import { validate } from "./utils";
import { InternalSocket } from "./types";
import type { Bindings } from "./types";
import {
  ModelToPoolApplyTXResponse,
  ModelToPoolPullResponse,
  PoolToModelApplyTXMessage,
  PoolToModelMessage,
} from "./pool";
import {
  getRelation,
  isKeyAProperty,
  Model,
  rIdK,
} from "sync-core/src/state/model";
import { ModelToClientApplyTxRequest, TX } from "sync-core/src/state/types";

export function DurableModel<T extends { new (...args: any[]): Model }>(
  type: string
) {
  console.log("type", type);
  return function DurableModel<T extends { new (...args: any[]): any }>(
    target: T
  ) {
    return class extends target {
      connectedPools: Map<string, InternalSocket>;
      state: any;
      uid: string;
      parent: DurableObjectNamespace;

      constructor(...args: any[]) {
        const startTime = Date.now();
        super(...args);

        const state = args[0];
        // this.id = args.id;
        this.uid = state.id.toString();
        const env = args[1] as Bindings;
        this.parent = env.POOL;
        this.state = state;
        this.type = type;
        this.connectedPools = new Map() as Map<string, InternalSocket>;
      }

      async getPersistedState() {
        const state = this.state.storage.get("state");
        state["id"] = state["uuid"];
        return state;
      }
      async persistState() {
        const extraKeysToPersist = ["uuid", "type"];
        const stateDup: Record<string, any> = {};
        for (const key of Object.keys(this)) {
          const isRelationId = key.startsWith("id__");
          const isProperty = isKeyAProperty(this, key);
          if (isRelationId || isProperty || extraKeysToPersist.includes(key)) {
            stateDup[key] = this[key];
          }
        }
        stateDup["id"] = stateDup["uuid"];
        return this.state.storage.put("state", stateDup);
      }

      async persistKeys(keys: string[]) {
        const extraKeysToPersist = ["uuid", "type"];
        const stateDup = await this.state.storage.get("state");

        for (const key of keys) {
          const isRelationId = key.startsWith("id__");
          const isProperty = isKeyAProperty(this, key);
          if (isRelationId || isProperty || extraKeysToPersist.includes(key)) {
            stateDup[key] = this[key];
          }
          // stateDup[key] = this[key];
        }
        return this.state.storage.put("state", stateDup);
      }

      async initialize(id: string) {
        // this.id = id;
        // console.log("[OBJECT][INIT] this.state", this.state);
        this.uuid = id;
        const stored = (await this.getPersistedState()) as any;
        if (stored) {
          for (const key of Object.keys(stored)) {
            this[key] = stored[key];
          }
        } else {
          // console.log("[OBJECT][INIT] this", this);
          for (const key of Object.keys(this)) {
            const relation = getRelation(this, key);
            if (relation) {
              const idKey = rIdK(key);
              this[idKey] = relation.relationship === "OneToMany" ? [] : "";
            }
          }
          this.persistState();
        }
      }

      async receiveTX(tx: TX) {
        const stored = await this.getPersistedState();
        this.applyTX(tx);
      }

      async onOpenPoolConnection(socket: InternalSocket) {
        this.connectedPools.set(socket.pid, socket);
      }

      async emitTXToConnectedPools(tx: TX) {
        for (const [poolId, socket] of this.connectedPools) {
          // generalize to send to related objects
          const message: ModelToClientApplyTxRequest = {
            rid: crypto.randomUUID(),
            type: "req:client-apply-tx",
            payload: JSON.stringify(tx),
          };
          socket.send(JSON.stringify(message));
        }
      }

      async handleApplyTXMessage(
        socket: InternalSocket,
        message: PoolToModelApplyTXMessage
      ) {
        try {
          this.receiveTX(message.tx);
        } catch (e) {
          const response: ModelToPoolApplyTXResponse = {
            rid: message.rid,
            type: "res:apply-tx",
            success: false,
            error: e,
          };
          socket.send(JSON.stringify(response));
        }
        const response: ModelToPoolApplyTXResponse = {
          rid: message.rid,
          type: "res:apply-tx",
          success: true,
        };
        socket.send(JSON.stringify(response));
        this.emitTXToConnectedPools(message.tx);
      }

      async handlePullMessage(
        socket: InternalSocket,
        message: PoolToModelMessage
      ) {
        try {
          const stored = await this.getPersistedState();
          const response: ModelToPoolPullResponse = {
            rid: message.rid,
            type: "res:pull",
            success: true,
            state: JSON.stringify(stored),
          };
          socket.send(JSON.stringify(response));
        } catch (e) {
          const response: ModelToPoolPullResponse = {
            rid: message.rid,
            type: "res:pull",
            success: false,
            error: e,
            state: "",
          };
          socket.send(JSON.stringify(response));
        }
      }

      onMessageFromPool(socket: InternalSocket, message: string) {
        const msg = JSON.parse(message) as PoolToModelMessage;
        switch (msg.type) {
          case "req:pull":
            this.handlePullMessage(socket, msg);
            break;
          case "req:apply-tx":
            this.handleApplyTXMessage(socket, msg);
            break;
          default:
            throw new Error("Unknown message type");
        }
      }

      async onCloseFromPool(socket: InternalSocket) {
        this.connectedPools.delete(socket.pid);
      }

      async onErrorFromPool(socket: InternalSocket) {}

      async connect(req: Request): Promise<Response> {
        if (req.method !== "GET") throw new Error("Method not allowed");
        let value = req.headers.get("upgrade");
        if (value !== "websocket") throw new Error("Upgrade required");
        var { oid, pid } = validate(req, this.id);
        let { 0: pool, 1: object } = new WebSocketPair();
        object.accept();
        let socket: InternalSocket = {
          pid: pid,
          oid: oid,
          send: object.send.bind(object),
          close: object.close.bind(object),
        };
        let closer = async (evt: Event) => {
          try {
            if (evt.type === "error") await this.onErrorFromPool(socket);
            else {
              await this.onCloseFromPool(socket);
            }
          } finally {
            this.connectedPools.delete(pid);
            try {
              object.close();
            } catch (e) {
              // already closed
            }
          }
        };
        object.addEventListener("close", closer);
        object.addEventListener("error", closer);
        object.addEventListener("message", (evt) => {
          this.onMessageFromPool(socket, evt.data);
        });

        await this.onOpenPoolConnection(socket);
        console.log(`[OBJECT][CONNECT] connected to pool ${pid}`);
        return new Response(null, {
          status: 101,
          statusText: "Switching Protocols",
          webSocket: pool,
        });
      }

      async fetch(req: Request) {
        let url = new URL(req.url);

        if (!this.initializePromise) {
          const id = url.pathname.split("/")[2];
          this.initializePromise = this.initialize(id).catch((err: any) => {
            this.initializePromise = undefined;
            throw err;
          });
        }

        let { pathname, searchParams } = new URL(req.url);

        await this.initializePromise;
        if (url.pathname.split("/")[1] === "ws") {
          return this.connect(req);
        }
        const endTime = Date.now();

        return new Response("response");
      }
    };
  };
}

@DurableModel("Space")
export class Space extends SpaceObject {
  //
}

@DurableModel("Block")
export class Block extends BlockObject {
  //
}

@DurableModel("User")
export class User extends UserObject {
  //
}
