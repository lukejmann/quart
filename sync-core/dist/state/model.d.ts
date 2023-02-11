import "reflect-metadata";
import { TX } from "./types";
export declare function ManyToOne<T extends Model>(property: string, type: string): <T_1 extends Model<unknown>>(target: any, propertyKey: string) => void;
export declare function OneToMany<T extends Model>(property: string, type: string): <T_1 extends Model<unknown>>(target: any, propertyKey: string) => void;
export declare function ManyToMany<T extends any>(property: string, type: string): <T_1 extends unknown>(target: any, propertyKey: string) => void;
export declare function OneToOne<T extends Model>(property: string, type: string): <T_1 extends Model<unknown>>(target: any, propertyKey: string) => void;
type RemoteCallInstruction = {
    toManyProperty: string;
    onClass: string;
    functionToCall: string;
};
export declare function OnUpdateExecInstruction<T extends Model>(toManyProperty: string, onClass: string, functionToCall: string): <T_1 extends Model<unknown>>(target: any, propertyKey: string) => void;
export declare function getRemoteCallInstruction(target: any, propertyKey: string): RemoteCallInstruction;
export declare function Remote<T extends Model>(target: any, propertyKey: string): void;
export declare function isRemoteFunction(target: any, propertyKey: string): Relation;
export declare function property<T extends Model>(target: any, propertyKey: string): void;
type Relation = {
    type: string;
    property: string;
    relationship: "ManyToOne" | "OneToMany" | "OneToOne" | "ManyToMany";
};
export declare function getRelation(target: any, propertyKey: string): Relation;
export declare function isKeyAProperty(target: any, propertyKey: string): boolean;
export declare const rIdK: (key: string) => string;
export declare class Model<T = unknown> {
    id: string;
    type: string;
    txs: string[];
    objectManager: any;
    save(): void;
    applyTX(tx: TX): void;
    getPersistedState(): void;
    persistState(): void;
    getRawState(): void;
    persistKeys(keys: string[]): void;
    syncClassesToRelationIds(idKey: string, key: string, valueId: any, valueType: string): void;
    private parseMutationsForRelation;
    private parseMutationsForProperty;
    private parseMutations;
    private parseInstructions;
    recieve(): void;
    constructor(id: string);
    static fromJSON(json: any): Model<unknown>;
    getRelation(key: string): Relation;
}
export {};
