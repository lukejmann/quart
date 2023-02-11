import "reflect-metadata";
import { Op, } from "./types";
const relationMetadataKey = Symbol("relation");
export function ManyToOne(property, type) {
    // TODO: remove need for type
    return function ManyToOne(target, propertyKey) {
        console.log("target", target);
        const relation = {
            // capitalize first letter of class name
            type: type,
            property,
            relationship: "ManyToOne",
        };
        console.log("target relation", relation);
        Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
    };
}
export function OneToMany(property, type) {
    return function OneToMany(target, propertyKey) {
        console.log("target", target);
        const relation = {
            // capitalize first letter of class name
            type: type,
            property,
            relationship: "OneToMany",
        };
        console.log("target relation", relation);
        Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
    };
}
export function ManyToMany(property, type) {
    return function ManyToMany(target, propertyKey) {
        console.log("mtm propertyKey", propertyKey);
        const relation = {
            // capitalize first letter of class name
            type: type,
            property,
            relationship: "ManyToMany",
        };
        console.log("mtm relation", relation);
        Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
    };
}
export function OneToOne(property, type) {
    return function OneToOne(target, propertyKey) {
        console.log("target", target);
        const relation = {
            // capitalize first letter of class name
            type: type,
            property,
            relationship: "OneToOne",
        };
        Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
    };
}
const remoteCallInstructionMetadatakey = Symbol("remoteCallInstruction");
// TODO: finish backend implementation (for state-based actions)
export function OnUpdateExecInstruction(toManyProperty, onClass, functionToCall) {
    return function OnUpdateExecInstruction(target, propertyKey) {
        console.log("target", target);
        const remoteCallInstruction = {
            toManyProperty,
            onClass,
            functionToCall,
        };
        Reflect.defineMetadata(remoteCallInstructionMetadatakey, remoteCallInstruction, target, propertyKey);
    };
}
export function getRemoteCallInstruction(target, propertyKey) {
    return Reflect.getMetadata(remoteCallInstructionMetadatakey, target, propertyKey);
}
const remoteFunctionMetadata = Symbol("remoteFunction");
export function Remote(target, propertyKey) {
    Reflect.defineMetadata(remoteFunctionMetadata, true, target, propertyKey);
}
export function isRemoteFunction(target, propertyKey) {
    var _a;
    return ((_a = Reflect.getMetadata(remoteFunctionMetadata, target, propertyKey)) !== null && _a !== void 0 ? _a : false);
}
// not actually a relationship
const propertyMetadatakey = Symbol("property");
export function property(target, propertyKey) {
    Reflect.defineMetadata(propertyMetadatakey, true, target, propertyKey);
}
export function getRelation(target, propertyKey) {
    const r = Reflect.getMetadata(relationMetadataKey, target, propertyKey);
    console.log("getRelation", r);
    return Reflect.getMetadata(relationMetadataKey, target, propertyKey);
}
export function isKeyAProperty(target, propertyKey) {
    var _a;
    return (_a = Reflect.getMetadata(propertyMetadatakey, target, propertyKey)) !== null && _a !== void 0 ? _a : false;
}
export const rIdK = (key) => {
    return `id__${key}`;
};
export class Model {
    save() {
        const { forwards, backwards } = this.parseMutations();
        const { forwards: instructionsForwards } = this.parseInstructions();
        const tx = {
            id: crypto.randomUUID(),
            forwards,
            backwards,
            instructions: instructionsForwards,
        };
        this.objectManager.apply(tx);
        this.persistState();
    }
    applyTX(tx) {
        if (this.txs.includes(tx.id)) {
            return;
        }
        this.txs.push(tx.id);
        // TODO: separate relation and property mutations
        const diffedKeys = [];
        for (const mutation of tx.forwards.filter((m) => m.onClass === this.type && m.onClassId === this.id)) {
            if (mutation.mutationType === "property") {
                const { onPropertyKey: key, withValue: value, operation: op, } = mutation;
                if (op === Op.UPDATE) {
                    this[key] = value;
                }
                if (op === Op.DELETE) {
                    this[key] = Array.isArray(this[key])
                        ? this[key].filter((id) => id !== value)
                        : "";
                }
                if (op === Op.INSERT) {
                    this[key].push(value);
                    console.log(`inserted ${value} into ${property}`);
                }
                diffedKeys.push(key);
            }
            if (mutation.mutationType === "relation") {
                const { onRelationKey: key, withIdValue: value, operation: op, } = mutation;
                if (op === Op.UPDATE) {
                    this[rIdK(key)] = value;
                }
                if (op === Op.DELETE) {
                    console.log(`deleting ${rIdK(key)}`, this[rIdK(key)]);
                    this[rIdK(key)] = Array.isArray(this[rIdK(key)])
                        ? this[rIdK(key)].filter((id) => id !== value)
                        : "";
                    console.log(`deleted ${value} from ${property}`);
                }
                if (op === Op.INSERT) {
                    try {
                        console.log(`inserting ${rIdK(key)}`, this[rIdK(key)]);
                        this[rIdK(key)].push(value);
                        console.log(`DB16 inserted ${value} into ${rIdK(key)} this`, JSON.stringify(this.id__inputBlocks), mutation);
                    }
                    catch (e) {
                        const cast = this;
                        console.log(`cast`, cast);
                        console.log(`cast rkid`, rIdK(key));
                        throw new Error(`could not insert ${value} into ${rIdK(key)} this ${this}`);
                    }
                }
                const relation = getRelation(this, key);
                this.syncClassesToRelationIds(rIdK(key), key, this[rIdK(key)], relation.type);
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
    persistKeys(keys) {
        //
    }
    syncClassesToRelationIds(idKey, key, valueId, valueType) {
        //
    }
    parseMutationsForRelation(relationKey, relation, oldValue, newValue) {
        var _a, _b, _c, _d;
        const forwards = [];
        const backwards = [];
        if (oldValue == newValue) {
            return { forwards, backwards };
        }
        console.log(`relation ${relationKey} changed from ${oldValue} to ${newValue}`);
        // update this model
        if (Array.isArray(oldValue)) {
            const oldModels = oldValue;
            const newModels = newValue;
            console.log(`relation ${relationKey} found on ${this.type} ${this.id}`);
            // console.log(`oldModels`, oldModels);
            console.log(`oldModels`, oldModels);
            console.log(`newModels`, newModels);
            const newValuesCast = newValue
                .filter((v) => v)
                .map((v) => v.id);
            const oldValuesCast = oldValue
                .filter((v) => v)
                .map((v) => v.id);
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
        }
        else {
            const oldValueCast = (_a = oldValue === null || oldValue === void 0 ? void 0 : oldValue.id) !== null && _a !== void 0 ? _a : null;
            const newValueCast = (_b = newValue === null || newValue === void 0 ? void 0 : newValue.id) !== null && _b !== void 0 ? _b : null;
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
            const oldValueCast = (_c = oldValue === null || oldValue === void 0 ? void 0 : oldValue.id) !== null && _c !== void 0 ? _c : null;
            const newValueCast = (_d = newValue === null || newValue === void 0 ? void 0 : newValue.id) !== null && _d !== void 0 ? _d : null;
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
                throw new Error(`property ${property} is a OneToMany relation, but value is not an array`);
            }
            if (!Array.isArray(oldValue)) {
                throw new Error(`property ${property} is a OneToMany relation, but value is not an array`);
            }
            const newValuesCast = newValue.map((v) => v.id);
            const oldValuesCast = oldValue.map((v) => v.id);
            const addedModels = newValuesCast.filter((m) => !oldValuesCast.includes(m));
            const removedModels = oldValuesCast.filter((m) => !newValuesCast.includes(m));
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
                throw new Error(`property ${property} is a ManyToMany relation, but value is not an array`);
            }
            if (!Array.isArray(oldValue)) {
                throw new Error(`property ${property} is a ManyToMany relation, but value is not an array`);
            }
            const newValuesCast = newValue.map((v) => v.id);
            const oldValuesCast = oldValue.map((v) => v.id);
            const addedModels = newValuesCast.filter((m) => !oldValuesCast.includes(m));
            const removedModels = oldValuesCast.filter((m) => !newValuesCast.includes(m));
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
            const oldValueCast = oldValue;
            const newValueCast = newValue;
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
    parseMutationsForProperty(propertyKey, oldValue, newValue) {
        const forwards = [];
        const backwards = [];
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
    parseMutations() {
        const old = this.getPersistedState();
        let forwards = [];
        let backwards = [];
        const rawState = this.getRawState();
        for (const [key, value] of Object.entries(rawState)) {
            const relation = getRelation(this, key);
            const isProperty = isKeyAProperty(this, key);
            if (!relation && !isProperty) {
                continue;
            }
            if (relation) {
                const { forwards: forwardsRel, backwards: backwardsRel } = this.parseMutationsForRelation(key, relation, old[key], value);
                forwards.push(...forwardsRel);
                backwards.push(...backwardsRel);
            }
            if (isProperty) {
                const { forwards: forwardsProp, backwards: backwardsProp } = this.parseMutationsForProperty(key, old[key], value);
                forwards.push(...forwardsProp);
                backwards.push(...backwardsProp);
            }
        }
        console.log("forwards", forwards);
        return { forwards, backwards };
    }
    parseInstructions() {
        const old = this.getPersistedState();
        let forwards = [];
        let backwards = undefined;
        for (const [key, value] of Object.entries(this)) {
            const instruction = getRemoteCallInstruction(this, key);
            if (!instruction) {
                continue;
            }
            const ids = this[rIdK(instruction.toManyProperty)];
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
    constructor(id) {
        this.type = "";
        this.txs = [];
        this.id = id;
    }
    static fromJSON(json) {
        const model = new this(json.id);
        for (const [key, value] of Object.entries(json)) {
            model[key] = value;
        }
        return model;
    }
    getRelation(key) {
        return getRelation(this, key);
    }
}
