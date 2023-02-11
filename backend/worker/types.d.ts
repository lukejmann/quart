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

export interface Socket {
  /**
   * The request identifier.
   * @see {Group.identify}
   */
  uid: string;
  /**
   * Send the WebSocket client a string-serializable message.
   */
  send: WebSocket["send"];
  /**
   * Close the WebSocket connection.
   */
  close: WebSocket["close"];
}
