import { makeObservable, observable } from "mobx";
import * as React from "react";
import {
  ManyToMany,
  ManyToOne,
  Model,
  OneToMany,
  OneToOne,
  OnUpdateExecInstruction,
  property,
  Remote,
} from "./model";

// NOTE: don't init relationships in constructor. Or won't sync to other object (value equality)

export class Space extends Model {
  @property
  title: string = "Untitled Space";

  @property
  background: string = "black";

  @OneToMany<Block>("space", "Block")
  blocks: Block[] = [];

  @ManyToOne<User>("spaces", "User")
  user?: User;

  @property
  selectedBlocks: Block[] = [];
}

export class Block extends Model {
  @property
  actionId?: string;

  @property
  background: string = "white";

  @property
  position: { x: number; y: number } = { x: 0, y: 0 };

  @property
  size: { width: number; height: number } = { width: 2, height: 1 };

  @property
  selected = false;

  @ManyToOne<Space>("blocks", "Space")
  space?: Space;

  autorun = false;

  inputsUpdated() {
    console.log("inputs updated");
  }
}

export class User extends Model {
  @OneToMany<Space>("user", "Space")
  spaces: Space[] = [];

  @property
  username: string = "Anonymous";
}
