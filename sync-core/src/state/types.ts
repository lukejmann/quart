import { Model } from "./model";

export enum Op {
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  INSERT = "INSERT",
}

export type PropertyMutation = {
  mutationType: "property";
  onClass: string;
  onClassId: string;
  operation: Op;
  onPropertyKey: string;
  withValue: any;
};

export type RelationMutation = {
  mutationType: "relation";
  onClass: string;
  onClassId: string;
  operation: Op;
  onRelationKey: string;
  withIdValue: string | string[];
};

export type Mutation = PropertyMutation | RelationMutation;

export type Instruction = {
  onClass: string;
  onClassId: string;
  functionToCall: string;
};

export type TX = {
  id: string;
  forwards: Mutation[];
  backwards: Mutation[];
  instructions: Instruction[];
};

export interface ObjectManager {
  get(id: string, classType: string): Model | undefined;
  push(object: Model): void;
  apply(tx: TX): void;
}

export type WebsocketPullRequestMessage = {
  type: "pullRequest";
  classType: string;
  classId: string;
};

export type WebsocketPullResponseMessage = {
  type: "pullResponse";
  classType: string;
  classId: string;
  object: string;
};

export type WebsocketTXMessage = {
  type: "tx";
  from: string;
  tx: TX;
};

export type WebsocketMessage =
  | WebsocketPullRequestMessage
  | WebsocketPullResponseMessage
  | WebsocketTXMessage;

export type ModelToClientApplyTxRequest = {
  rid: string;
  type: "req:client-apply-tx";
  payload: string;
};
