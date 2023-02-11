import { Gossip, Replica, Socket } from "dog";
import type { Bindings } from "./types";
import * as HEADERS from "./headers";
import * as ROUTES from "./routes";
import { Model } from "sync-core/src/state/model";
import { load, load2 } from "./utils";
import {
  ModelToClientApplyTxRequest,
  Mutation,
  TX,
  WebsocketMessage,
  WebsocketPullRequestMessage,
  WebsocketPullResponseMessage,
  WebsocketTXMessage,
} from "sync-core/src/state/types";

type Output = {
  type: string;
  from?: string;
  time: number;
};

type Note = Gossip.Message & {
  type: "intra:user:list";
};

type ModelIdentifier = {
  type: string;
  id: string;
};

// TODO: organize this better
export type PoolToModelApplyTXMessage = {
  rid: string;
  type: "req:apply-tx";
  tx: TX;
};

export type ModelToPoolApplyTXResponse = {
  rid: string;
  type: "res:apply-tx";
  success: boolean;
  error?: string;
};

export type PoolToModelPullMessage = {
  rid: string;
  type: "req:pull";
  // modelId: ModelIdentifier;
};

export type ModelToPoolPullResponse = {
  rid: string;
  type: "res:pull";
  success: boolean;
  error?: string;
  state: any;
};

export type PoolToModelMessage =
  | PoolToModelApplyTXMessage
  | PoolToModelPullMessage;

export type ModelToPoolMessage =
  | ModelToPoolApplyTXResponse
  | ModelToPoolPullResponse;

type ModelSocketState = {
  modelId: ModelIdentifier;
  status: "connected" | "connecting" | "failed";
  socket: WebSocket | null;
};

// TODO: when connection closes close all websockets (should be automatic but want to verify)
export class Pool extends Replica<Bindings> {
  env!: Bindings;

  pushedTXs = new Set<string>();

  connectedModels: Map<ModelIdentifier, ModelSocketState> = new Map() as Map<
    ModelIdentifier,
    ModelSocketState
  >;
  poolToModelMessageQueue: Map<ModelIdentifier, PoolToModelMessage[]> =
    new Map() as Map<ModelIdentifier, PoolToModelMessage[]>;
  poolToModelResponseSocket: Map<string, Socket> = new Map();

  clientKnownTXs: Set<string> = new Set();

  link(env: Bindings) {
    this.env = env;
    return {
      parent: env.LOBBY,
      self: env.POOL,
    };
  }

  async receive(req: Request) {
    let { pathname } = new URL(req.url);

    if (pathname === "/ws") {
      return this.connect(req);
    } else {
      return new Response("NOT FOUND", { status: 404 });
    }
  }

  onopen(socket: Socket) {
    let output: Output = {
      type: "user:join",
      from: socket.uid,
      time: Date.now(),
    };

    socket.broadcast(output, true);
  }

  async onclose(socket: Socket) {
    let output: Output = {
      type: "user:exit",
      from: socket.uid,
      time: Date.now(),
    };

    socket.broadcast(output);
  }

  async ongossip(msg: Note): Promise<Gossip.Payload> {
    if (msg.type === "intra:user:list") {
      return [];
    }

    throw new Error(`Missing: "${msg.type}" ongossip`);
  }

  private objectToEnv(classType: string): DurableObjectNamespace {
    console.log("[POOL] objectToEnv", classType);
    switch (classType) {
      case "Space":
        return this.env.SPACE;
      case "Block":
        return this.env.BLOCK;
      case "User":
        return this.env.USER;

      default:
        throw new Error("Unknown object type");
    }
  }

  async onmessage(socket: Socket, data: string) {
    // raw broadcast channel
    let input = JSON.parse(data) as WebsocketMessage;
    console.log("[POOL] onmessage", input);

    switch (input.type) {
      case "tx":
        return this.handleClientTX(socket, input);
      case "pullRequest":
        return this.handleClientPull(socket, input);
      default:
        return socket.broadcast({ msg: "received" }, true);
    }
  }

  async processPoolToModelMessageQueue(modelId: ModelIdentifier) {
    let queue = this.poolToModelMessageQueue.get(modelId);
    if (queue) {
      for (let msg of queue) {
        const modelState = this.connectedModels.get(modelId);
        if (modelState && modelState.socket) {
          modelState.socket.send(JSON.stringify(msg));
        } else {
          throw new Error("Model not found");
        }
      }
    }
    this.poolToModelMessageQueue.delete(modelId);
  }

  async processPoolToModelMessageQueueIfConnected(modelId: ModelIdentifier) {
    const modelState = this.connectedModels.get(modelId);
    if (modelState && modelState.status === "connected") {
      this.processPoolToModelMessageQueue(modelId);
    }
  }

  async onOpenModelConnection(modelId: ModelIdentifier, ws: WebSocket) {
    if (this.connectedModels.has(modelId)) {
      this.connectedModels.set(modelId, {
        modelId,
        status: "connected",
        socket: ws,
      });
    } else throw new Error("Model not found");
    this.processPoolToModelMessageQueue(modelId);
  }

  async onRequestFromModel(modelId: ModelIdentifier, data: string) {
    //
    // console.log("[POOL] onRequestFromModel );
    const msg = JSON.parse(data) as ModelToClientApplyTxRequest;
    const asTX = JSON.parse(msg.payload) as TX;
    if (this.clientKnownTXs.has(asTX.id)) {
      return;
    }
    this.broadcast(msg);
    this.clientKnownTXs.add(asTX.id);
  }

  async onResponseFromModel(modelId: ModelIdentifier, data: string) {
    const msg = JSON.parse(data) as ModelToPoolMessage;
    if (msg.success === false) {
      throw new Error("ModelToPoolMessage failed");
      return;
    }
    const socket = this.poolToModelResponseSocket.get(msg.rid);
    if (!socket) {
      throw new Error("Socket not found");
      return;
    }
    switch (msg.type) {
      case "res:pull":
        const response: WebsocketPullResponseMessage = {
          type: "pullResponse",
          classType: modelId.type,
          classId: modelId.id,
          object: msg.state,
        };
        socket.broadcast(response, true);
        break;
      case "res:apply-tx":
        console.log("[POOL] res:apply-tx success", msg.success);
        break;
      default:
        throw new Error("Unknown message type");
    }
  }

  async onCloseFromModel(modelId: ModelIdentifier) {}

  async onErrorFromModel(modelId: ModelIdentifier) {}

  async connectToModel(modelId: ModelIdentifier) {
    const headers = new Headers();
    headers.set(HEADERS.POOLID, this.uid);
    headers.set(HEADERS.MODELID, modelId.id);
    headers.set("upgrade", "websocket");
    // TODO: fix id. probably change to uuid
    const url = new URL(`http://quaternions/ws/${modelId.id}`);
    const model = load2(this.objectToEnv(modelId.type), modelId.id);
    const resp = await model.fetch(url.href, { headers });
    const ws = (resp as any).webSocket as WebSocket;
    ws.accept();
    ws.addEventListener("message", (e) => {
      const parsed = JSON.parse(e.data);
      if (parsed.type.includes("res"))
        this.onResponseFromModel(modelId, e.data);
      else if (parsed.type.includes("req"))
        this.onRequestFromModel(modelId, e.data);
      else throw new Error("Unknown message type");
    });
    ws.addEventListener("close", () => {
      this.onCloseFromModel(modelId);
    });
    ws.addEventListener("error", () => {
      this.onErrorFromModel(modelId);
    });
    await this.onOpenModelConnection(modelId, ws);
  }

  submitMessageToModel(
    modelId: ModelIdentifier,
    msg: PoolToModelMessage,
    responseSocket: Socket
  ) {
    // if model is not connecting, begin connecting
    // eitherway, queue the message
    if (!this.connectedModels.has(modelId)) {
      this.connectedModels.set(modelId, {
        modelId,
        status: "connecting",
        socket: null,
      });
      this.connectToModel(modelId);
    }
    if (this.poolToModelMessageQueue.has(modelId)) {
      this.poolToModelMessageQueue.get(modelId)!.push(msg);
    } else {
      this.poolToModelMessageQueue.set(modelId, [msg]);
    }
    this.poolToModelResponseSocket.set(msg.rid, responseSocket);
  }

  async handleClientTX(socket: Socket, msg: WebsocketTXMessage) {
    // TODO: make single promise
    const tx = msg.tx as TX;
    this.clientKnownTXs.add(tx.id);
    // group tx.forwards by model
    const models = new Set<ModelIdentifier>();
    for (const mutation of tx.forwards) {
      const mut = mutation as Mutation;
      const modelId = {
        type: mut.onClass,
        id: mut.onClassId,
      };
      models.add(modelId);
    }
    // send tx to each model
    for (const modelId of models) {
      this.submitMessageToModel(
        modelId,
        {
          rid: crypto.randomUUID(),
          type: "req:apply-tx",
          tx,
        },
        socket
      );
      this.processPoolToModelMessageQueueIfConnected(modelId);
    }
  }

  async handleClientPull(socket: Socket, msg: WebsocketPullRequestMessage) {
    const modelId: ModelIdentifier = {
      type: msg.classType,
      id: msg.classId,
    };
    this.submitMessageToModel(
      modelId,
      {
        rid: crypto.randomUUID(),
        type: "req:pull",
      },
      socket
    );
    this.processPoolToModelMessageQueueIfConnected(modelId);
  }
}
