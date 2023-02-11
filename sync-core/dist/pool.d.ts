import { Model, ObjectManager, TX } from "sync-core/src/state/index";
export declare class ObjectPool implements ObjectManager {
    objects: Model[];
    private ws?;
    private connecting?;
    private recentFailures;
    private readonly beforeUnload;
    private readonly tryConnectId;
    private readonly resetFailuresId;
    private requestedPulls;
    private knownTXs;
    apply(tx: TX): void;
    websocketOperationWithRetry<T>(operation: () => Promise<T>, retries?: number): Promise<T>;
    get(id: string, classType: string): Model<unknown> | undefined;
    push(object: Model): void;
    requestPullIfNeeded(classType: string, classId: string): void;
    constructor();
    dispose(): void;
    private tryConnect;
    awaitObject<T extends Model>(classType: string, classId: string): Promise<T | undefined>;
    private handleMessage;
}
export declare const clientPool: ObjectPool;
