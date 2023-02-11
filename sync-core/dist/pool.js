var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { makeAutoObservable, observable } from "mobx";
import { rIdK, } from "sync-core/src/state/index";
import { Block, Space, User } from "./state";
const websocketUri = "ws://127.0.0.1:8787/ws";
export class ObjectPool {
    apply(tx) {
        if (this.knownTXs.includes(tx.id)) {
            return;
        }
        this.knownTXs.push(tx.id);
        for (const mutation of tx.forwards) {
            const { onClass, onClassId } = mutation;
            const object = this.objects.find((o) => o.id === onClassId && o.type === onClass);
            if (!object) {
                console.warn("requesting pull of for tx", onClass, onClassId, tx);
                this.requestPullIfNeeded(onClass, onClassId);
                continue;
            }
            console.log(`[client pool] apply onClass: '${object.type}'`, object);
            object.applyTX(tx);
        }
        const msg = {
            type: "tx",
            from: "client",
            tx,
        };
        this.websocketOperationWithRetry(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(msg));
        }));
    }
    websocketOperationWithRetry(operation, retries = 5) {
        return new Promise((resolve, reject) => {
            const tryOperation = () => {
                const attempt = () => __awaiter(this, void 0, void 0, function* () {
                    if (!this.ws) {
                        throw new Error("No websocket connection");
                    }
                    const res = yield operation();
                    return res;
                });
                attempt()
                    .then((result) => resolve(result))
                    .catch((err) => {
                    if (retries > 0) {
                        setTimeout(tryOperation, retries * 10);
                    }
                    else {
                        reject(err);
                    }
                });
            };
            tryOperation();
        });
    }
    get(id, classType) {
        const res = this.objects.find((o) => o.id === id && o.type === classType);
        return res;
    }
    push(object) {
        if (!this.get(object.id, object.type)) {
            this.objects.push(object);
        }
        else {
            console.warn("tried to add duplicate to client pool:", object.id, object.type);
        }
    }
    requestPullIfNeeded(classType, classId) {
        // TODO: queue to prevent dups
        if (this.requestedPulls.has(classId)) {
            const requestedPull = this.requestedPulls.get(classId);
            if (requestedPull &&
                requestedPull.type === classType &&
                requestedPull.timestamp > Date.now() - 10000) {
                return;
            }
        }
        const run = () => __awaiter(this, void 0, void 0, function* () {
            const index = this.objects.findIndex((o) => o.id === classId && o.type === classType);
            if (index === -1) {
                const msg = {
                    type: "pullRequest",
                    classType,
                    classId,
                };
                this.websocketOperationWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(msg));
                }));
            }
        });
        this.requestedPulls.set(classId, {
            type: classType,
            id: classId,
            timestamp: Date.now(),
        });
        run();
    }
    constructor() {
        this.recentFailures = 0;
        this.requestedPulls = new Map();
        this.knownTXs = [];
        makeAutoObservable(this);
        this.objects = [];
        this.beforeUnload = (event) => {
            //
        };
        window.addEventListener("beforeunload", this.beforeUnload);
        const interval = 1000;
        this.tryConnect();
        this.tryConnectId = window.setInterval(() => this.tryConnect(), interval);
        this.resetFailuresId = window.setInterval(() => (this.recentFailures = 0), 15 * interval);
    }
    dispose() {
        var _a;
        window.clearInterval(this.tryConnectId);
        window.clearInterval(this.resetFailuresId);
        window.removeEventListener("beforeunload", this.beforeUnload);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.close();
    }
    tryConnect() {
        if (this.connecting || this.ws)
            return;
        this.connecting = true;
        const ws = new WebSocket(websocketUri);
        ws.onopen = () => {
            this.connecting = false;
            this.ws = ws;
        };
        ws.onclose = () => {
            if (this.ws) {
                this.ws = undefined;
                // this.options.onDisconnected?.()
                if (++this.recentFailures >= 5) {
                    // If we disconnect 5 times within 15 reconnection intervals, then the
                    // client is likely desynchronized and needs to refresh.
                    this.dispose();
                    // this.options.onDesynchronized?.()
                }
            }
            else {
                this.connecting = false;
            }
        };
        ws.onmessage = ({ data }) => {
            if (typeof data === "string") {
                this.handleMessage(JSON.parse(data));
            }
        };
    }
    // TODO:
    awaitObject(classType, classId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.requestPullIfNeeded(classType, classId);
            return new Promise((resolve, reject) => {
                const run = (attempts) => __awaiter(this, void 0, void 0, function* () {
                    const object = this.get(classId, classType);
                    if (object) {
                        resolve(object);
                    }
                    else {
                        if (attempts > 0) {
                            setTimeout(() => run(attempts - 1), 300);
                        }
                        else {
                            resolve(undefined);
                        }
                    }
                });
                run(5);
            });
        });
    }
    handleMessage(msg) {
        switch (msg.type) {
            case "req:client-apply-tx":
                const fromModelMsg = msg;
                const tx = JSON.parse(fromModelMsg.payload);
                this.apply(tx);
                break;
            case "pullResponse":
                const obj = JSON.parse(msg.object);
                const existing = this.objects.find((o) => o.id === obj.id && o.type === obj.type);
                if (existing) {
                    // TODO:ensure no duplicate objects
                    this.objects = this.objects.filter((o) => o.id !== obj.id);
                }
                {
                    let object;
                    switch (obj.type) {
                        case "Space":
                            object = Space.fromJSON(obj);
                            this.push(object);
                            break;
                        case "Block":
                            object = Block.fromJSON(obj);
                            this.push(object);
                            break;
                        case "User":
                            object = User.fromJSON(obj);
                            this.push(object);
                            break;
                        default:
                            throw new Error("Unknown class type");
                    }
                    // TODO: maybe(?) – move to ClientModel
                    for (const key of Object.keys(object)) {
                        const relation = object.getRelation(key);
                        if (!relation)
                            continue;
                        if (relation) {
                            const idKey = rIdK(key);
                            const idValue = object[idKey];
                            if (!idValue || idValue === "" || idValue.length === 0)
                                continue;
                            if (relation.relationship === "ManyToOne") {
                                // for (let id of idValue) {
                                const referencedObject = this.get(idValue, relation.type);
                                if (!referencedObject) {
                                    this.requestPullIfNeeded(relation.type, idValue);
                                    continue;
                                }
                                if (!referencedObject[relation.property].find((o) => o && o.id === object.id)) {
                                    referencedObject[relation.property].push(object);
                                }
                                object[key] = referencedObject;
                            }
                            if (relation.relationship === "OneToMany") {
                                for (const id of idValue) {
                                    const referencedObject = this.get(id, relation.type);
                                    if (!referencedObject) {
                                        console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${id}`);
                                        this.requestPullIfNeeded(relation.type, id);
                                        continue;
                                    }
                                    if (referencedObject[relation.property] !== object) {
                                        referencedObject[relation.property] = object;
                                    }
                                    object[key].push(referencedObject);
                                }
                            }
                            if (relation.relationship === "OneToOne") {
                                const referencedObject = this.get(idValue, relation.type);
                                if (!referencedObject) {
                                    console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${idValue}`);
                                    this.requestPullIfNeeded(relation.type, idValue);
                                    continue;
                                }
                                if (referencedObject[relation.property] !== object) {
                                    referencedObject[relation.property] = object;
                                }
                                object[key] = referencedObject;
                            }
                            if (relation.relationship === "ManyToMany") {
                                // console("Applytin")
                                for (const id of idValue) {
                                    const referencedObject = this.get(id, relation.type);
                                    if (!referencedObject) {
                                        console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${id}`);
                                        this.requestPullIfNeeded(relation.type, id);
                                        continue;
                                    }
                                    if (!referencedObject[relation.property].find((o) => o && o.id === object.id)) {
                                        referencedObject[relation.property].push(object);
                                    }
                                    if (!object[key].find((o) => o && o.id === referencedObject.id)) {
                                        object[key].push(referencedObject);
                                    }
                                }
                            }
                        }
                    }
                    object.persistState();
                    break;
                }
            default:
                throw new Error("Unknown message type");
        }
    }
}
__decorate([
    observable,
    __metadata("design:type", Array)
], ObjectPool.prototype, "objects", void 0);
export const clientPool = new ObjectPool();
