import type { Group, Replica } from "dog";

// TODO: Remove the intersection types?
export interface Bindings extends ModuleWorker.Bindings {
  LOBBY: DurableObjectNamespace & Group<Bindings>;
  POOL: DurableObjectNamespace & Replica<Bindings>;
  SPACE: DurableObjectNamespace;
  BLOCK: DurableObjectNamespace;
  USER: DurableObjectNamespace;
}

declare namespace JSON {
  type Value = Date | RegExp | string | number | boolean | null | JSON.Object;
  type Object = JSON.Value[] | { [key: string]: JSON.Value };
}

// Socket Messages
// @todo support arraybuffer types
export type Message = JSON.Object | string;

export type RequestID = string;
export type GroupID = string;
export type ReplicaID = string;

export namespace Gossip {
  type Message = {
    [key: string]: JSON.Value;
  };
  type Payload = JSON.Object | JSON.Value;
}

export interface State {
  group: string;
  socket: Set<WebSocket>;
}

export interface InternalSocket {
  /**
   * The request identifier.
   * @see {Group.identify}
   */
  // uid: string;

  oid: string;

  pid: string;
  /**
   * Send the WebSocket client a string-serializable message.
   */
  send: WebSocket["send"];
  /**
   * Close the WebSocket connection.
   */
  close: WebSocket["close"];
}
