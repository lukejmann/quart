import "reflect-metadata";

import {
  Instruction,
  Mutation,
  Op,
  PropertyMutation,
  RelationMutation,
  TX,
} from "./types";

const relationMetadataKey = Symbol("relation");
export function ManyToOne<T extends Model>(property: string, type: string) {
  // TODO: remove need for type
  return function ManyToOne<T extends Model>(target: any, propertyKey: string) {
    console.log("target", target);

    const relation: Relation = {
      // capitalize first letter of class name
      type: type,
      property,
      relationship: "ManyToOne",
    };
    console.log("target relation", relation);
    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}

export function OneToMany<T extends Model>(property: string, type: string) {
  return function OneToMany<T extends Model>(target: any, propertyKey: string) {
    console.log("target", target);
    const relation: Relation = {
      // capitalize first letter of class name
      type: type,
      property,
      relationship: "OneToMany",
    };
    console.log("target relation", relation);
    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}

export function ManyToMany<T extends any>(property: string, type: string) {
  return function ManyToMany<T extends any>(target: any, propertyKey: string) {
    console.log("mtm propertyKey", propertyKey);
    const relation: Relation = {
      // capitalize first letter of class name
      type: type,
      property,
      relationship: "ManyToMany",
    };
    console.log("mtm relation", relation);

    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}

export function OneToOne<T extends Model>(property: string, type: string) {
  return function OneToOne<T extends Model>(target: any, propertyKey: string) {
    console.log("target", target);
    const relation: Relation = {
      // capitalize first letter of class name
      type: type,
      property,
      relationship: "OneToOne",
    };
    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}

const remoteCallInstructionMetadatakey = Symbol("remoteCallInstruction");

type RemoteCallInstruction = {
  toManyProperty: string;
  onClass: string;
  functionToCall: string;
};

// TODO: finish backend implementation (for state-based actions)
export function OnUpdateExecInstruction<T extends Model>(
  toManyProperty: string,
  onClass: string,
  functionToCall: string
) {
  return function OnUpdateExecInstruction<T extends Model>(
    target: any,
    propertyKey: string
  ) {
    console.log("target", target);
    const remoteCallInstruction = {
      toManyProperty,
      onClass,
      functionToCall,
    };
    Reflect.defineMetadata(
      remoteCallInstructionMetadatakey,
      remoteCallInstruction,
      target,
      propertyKey
    );
  };
}
export function getRemoteCallInstruction(
  target: any,
  propertyKey: string
): RemoteCallInstruction {
  return Reflect.getMetadata(
    remoteCallInstructionMetadatakey,
    target,
    propertyKey
  );
}

const remoteFunctionMetadata = Symbol("remoteFunction");
export function Remote<T extends Model>(target: any, propertyKey: string) {
  Reflect.defineMetadata(remoteFunctionMetadata, true, target, propertyKey);
}
export function isRemoteFunction(target: any, propertyKey: string): Relation {
  return (
    Reflect.getMetadata(remoteFunctionMetadata, target, propertyKey) ?? false
  );
}

// not actually a relationship
const propertyMetadatakey = Symbol("property");
export function property<T extends Model>(target: any, propertyKey: string) {
  Reflect.defineMetadata(propertyMetadatakey, true, target, propertyKey);
}

type Relation = {
  type: string;
  property: string;
  relationship: "ManyToOne" | "OneToMany" | "OneToOne" | "ManyToMany";
};

export function getRelation(target: any, propertyKey: string): Relation {
  const r = Reflect.getMetadata(relationMetadataKey, target, propertyKey);
  return Reflect.getMetadata(relationMetadataKey, target, propertyKey);
}

export function isKeyAProperty(target: any, propertyKey: string): boolean {
  return Reflect.getMetadata(propertyMetadatakey, target, propertyKey) ?? false;
}

export const rIdK = (key: string) => {
  return `id__${key}`;
};

export class Model<T = unknown> {
  public id: string;
  public type: string = "";
  public txs: string[] = [];
  public objectManager: any;

  save() {
    const { forwards, backwards } = this.parseMutations();
    const { forwards: instructionsForwards } = this.parseInstructions();

    const tx: TX = {
      id: crypto.randomUUID(),
      forwards,
      backwards,
      instructions: instructionsForwards,
    };
    this.objectManager.apply(tx);
    this.persistState();
  }

  applyTX(tx: TX) {
    if (this.txs.includes(tx.id)) {
      return;
    }
    this.txs.push(tx.id);
    // TODO: separate relation and property mutations
    const diffedKeys: string[] = [];
    for (const mutation of tx.forwards.filter(
      (m) => m.onClass === this.type && m.onClassId === this.id
    )) {
      if (mutation.mutationType === "property") {
        const {
          onPropertyKey: key,
          withValue: value,
          operation: op,
        } = mutation;
        if (op === Op.UPDATE) {
          (this as any)[key] = value;
        }
        if (op === Op.DELETE) {
          (this as any)[key] = Array.isArray((this as any)[key])
            ? ((this as any)[key] as string[]).filter(
                (id: string) => id !== value
              )
            : "";
        }
        if (op === Op.INSERT) {
          ((this as any)[key] as string[]).push(value);
          console.log(`inserted ${value} into ${property}`);
        }
        diffedKeys.push(key);
      }
      if (mutation.mutationType === "relation") {
        const {
          onRelationKey: key,
          withIdValue: value,
          operation: op,
        } = mutation;
        if (op === Op.UPDATE) {
          (this as any)[rIdK(key)] = value;
        }
        if (op === Op.DELETE) {
          console.log(`deleting ${rIdK(key)}`, (this as any)[rIdK(key)]);
          (this as any)[rIdK(key)] = Array.isArray((this as any)[rIdK(key)])
            ? ((this as any)[rIdK(key)] as string[]).filter(
                (id: string) => id !== value
              )
            : "";
          console.log(`deleted ${value} from ${property}`);
        }
        if (op === Op.INSERT) {
          try {
            console.log(`inserting ${rIdK(key)}`, (this as any)[rIdK(key)]);
            ((this as any)[rIdK(key)] as string[]).push(value as string);
            console.log(
              `DB16 inserted ${value} into ${rIdK(key)} this`,
              JSON.stringify((this as any).id__inputBlocks),
              mutation
            );
          } catch (e) {
            const cast = this as any;
            console.log(`cast`, cast);
            console.log(`cast rkid`, rIdK(key));
            throw new Error(
              `could not insert ${value} into ${rIdK(key)} this ${this}`
            );
          }
        }
        const relation = getRelation(this, key);
        this.syncClassesToRelationIds(
          rIdK(key),
          key,
          (this as any)[rIdK(key)],
          relation.type
        );
        diffedKeys.push(key);
        diffedKeys.push(rIdK(key));
      }
    }
    // ISSUE: if another related object has been updated but not saved and the .save() is called, by this object, the changes to the related object will be lost since there is no diff to apply when persistState is called
    // this.persistState();
    this.persistKeys(diffedKeys);
  }

  getPersistedState() {
    //
  }

  persistState() {
    //
  }
  getRawState() {
    //
  }

  persistKeys(keys: string[]) {
    //
  }

  syncClassesToRelationIds(
    idKey: string,
    key: string,
    valueId: any,
    valueType: string
  ) {
    //
  }

  private parseMutationsForRelation(
    relationKey: string,
    relation: Relation,
    oldValue: any,
    newValue: any
  ): { forwards: RelationMutation[]; backwards: RelationMutation[] } {
    const forwards: RelationMutation[] = [];
    const backwards: RelationMutation[] = [];
    if (oldValue == newValue) {
      return { forwards, backwards };
    }
    console.log(
      `relation ${relationKey} changed from ${oldValue} to ${newValue}`
    );

    // update this model
    if (Array.isArray(oldValue)) {
      const oldModels = oldValue as Model[];
      const newModels = newValue as Model[];
      console.log(`relation ${relationKey} found on ${this.type} ${this.id}`);
      // console.log(`oldModels`, oldModels);
      console.log(`oldModels`, oldModels);
      console.log(`newModels`, newModels);
      const newValuesCast = newValue
        .filter((v: any) => v)
        .map((v: any) => (v as Model).id);
      const oldValuesCast = oldValue
        .filter((v: any) => v)
        .map((v: any) => (v as Model).id);
      forwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: newValuesCast,
      });
      backwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: oldValuesCast,
      });
    } else {
      const oldValueCast = (oldValue as Model)?.id ?? null;
      const newValueCast = (newValue as Model)?.id ?? null;
      forwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: newValueCast ? newValueCast : "",
      });
      backwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: oldValueCast ? oldValueCast : "",
      });
    }
    // update related model
    if (relation.relationship === "ManyToOne") {
      console.log(`relation ${relationKey} is ManyToOne`);
      const oldValueCast = (oldValue as Model)?.id ?? null;
      const newValueCast = (newValue as Model)?.id ?? null;

      if (newValue == null) {
        // op: DELETE
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
      if (oldValue == null) {
        console.log(`oldValue is null`);
        // op: INSERT
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
    }
    if (relation.relationship === "OneToMany") {
      if (!Array.isArray(newValue)) {
        throw new Error(
          `property ${property} is a OneToMany relation, but value is not an array`
        );
      }
      if (!Array.isArray(oldValue)) {
        throw new Error(
          `property ${property} is a OneToMany relation, but value is not an array`
        );
      }
      const newValuesCast = newValue.map((v: any) => (v as Model).id);
      const oldValuesCast = oldValue.map((v: any) => (v as Model).id);
      const addedModels = newValuesCast.filter(
        (m) => !oldValuesCast.includes(m)
      );
      const removedModels = oldValuesCast.filter(
        (m) => !newValuesCast.includes(m)
      );

      for (const added of addedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: added,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
      for (const removed of removedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: "",
        });
      }
    }

    if (relation.relationship === "ManyToMany") {
      if (!Array.isArray(newValue)) {
        throw new Error(
          `property ${property} is a ManyToMany relation, but value is not an array`
        );
      }
      if (!Array.isArray(oldValue)) {
        throw new Error(
          `property ${property} is a ManyToMany relation, but value is not an array`
        );
      }
      const newValuesCast = newValue.map((v: any) => (v as Model).id);
      const oldValuesCast = oldValue.map((v: any) => (v as Model).id);
      const addedModels = newValuesCast.filter(
        (m) => !oldValuesCast.includes(m)
      );
      const removedModels = oldValuesCast.filter(
        (m) => !newValuesCast.includes(m)
      );

      for (const added of addedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: added,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: added,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
      for (const removed of removedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        console.log(`pushed DELETE forwards`);
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
    }

    if (relation.relationship === "OneToOne") {
      const oldValueCast = oldValue as Model;
      const newValueCast = newValue as Model;
      if (newValue == null) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: "",
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
      }
      if (oldValue == null) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id,
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: "",
        });
      }
    }

    return { forwards, backwards };
  }

  private parseMutationsForProperty(
    propertyKey: string,
    oldValue: any,
    newValue: any
  ): { forwards: PropertyMutation[]; backwards: PropertyMutation[] } {
    const forwards: PropertyMutation[] = [];
    const backwards: PropertyMutation[] = [];
    if (JSON.stringify(oldValue) == JSON.stringify(newValue)) {
      return { forwards, backwards };
    }

    forwards.push({
      mutationType: "property",
      onClass: this.type,
      onClassId: this.id,
      operation: Op.UPDATE,
      onPropertyKey: propertyKey,
      withValue: newValue,
    });
    backwards.push({
      mutationType: "property",
      onClass: this.type,
      onClassId: this.id,
      operation: Op.UPDATE,
      onPropertyKey: propertyKey,
      withValue: oldValue,
    });
    return { forwards, backwards };
  }

  private parseMutations(): { forwards: Mutation[]; backwards: Mutation[] } {
    const old = this.getPersistedState() as any;

    let forwards: Mutation[] = [];
    let backwards: Mutation[] = [];

    const rawState = this.getRawState() as any;

    for (const [key, value] of Object.entries(rawState)) {
      const relation = getRelation(this, key);
      const isProperty = isKeyAProperty(this, key);
      if (!relation && !isProperty) {
        continue;
      }
      if (relation) {
        const { forwards: forwardsRel, backwards: backwardsRel } =
          this.parseMutationsForRelation(key, relation, old[key], value);
        forwards.push(...forwardsRel);
        backwards.push(...backwardsRel);
      }
      if (isProperty) {
        const { forwards: forwardsProp, backwards: backwardsProp } =
          this.parseMutationsForProperty(key, old[key], value);
        forwards.push(...forwardsProp);
        backwards.push(...backwardsProp);
      }
    }
    console.log("forwards", forwards);
    return { forwards, backwards };
  }

  private parseInstructions(): {
    forwards: Instruction[];
    backwards: undefined;
  } {
    const old = this.getPersistedState() as any;

    let forwards: Instruction[] = [];
    let backwards = undefined;
    for (const [key, value] of Object.entries(this)) {
      const instruction = getRemoteCallInstruction(this, key);
      if (!instruction) {
        continue;
      }
      const ids = (this as any)[rIdK(instruction.toManyProperty)] as string[];
      for (const id of ids) {
        forwards.push({
          onClass: instruction.onClass,
          onClassId: id,
          functionToCall: instruction.functionToCall,
        });
      }
    }
    return { forwards, backwards };
  }

  recieve() {
    //
  }

  constructor(id: string) {
    this.id = id;
  }

  static fromJSON(json: any) {
    const model = new this(json.id);
    for (const [key, value] of Object.entries(json)) {
      (model as any)[key] = value;
    }
    return model;
  }

  public getRelation(key: string) {
    return getRelation(this, key);
  }
}
