import { makeObservable, observable, reaction, toJS } from "mobx";
import { clientPool } from "./pool";
import { getRelation, isKeyAProperty, rIdK, } from "sync-core/src/state/model";
export function ClientModel(type) {
    return function ClientModel(target) {
        // TODO: add object manager
        return class extends target {
            constructor(...args) {
                var _a, _b, _c, _d, _e;
                if (type === "Value") {
                }
                super(...args);
                this.type = type;
                this.objectManager = clientPool;
                this.objectManager.push(this);
                this.getPersistedState = () => {
                    const resp = this.trueState;
                    return resp;
                };
                this.getRawState = () => {
                    const extraKeysToPersist = ["id", "type"];
                    const stateDup = toJS(this);
                    for (const key of Object.keys(this)) {
                        const relation = getRelation(this, key);
                        const isProperty = isKeyAProperty(this, key);
                        if (!relation && !isProperty && !extraKeysToPersist.includes(key)) {
                            delete stateDup[key];
                        }
                    }
                    return stateDup;
                };
                this.persistState = () => {
                    this.trueState = this.getRawState();
                };
                this.persistKeys = (keys) => {
                    const stateDup = toJS(this);
                    for (const key of keys) {
                        this.trueState[key] = stateDup[key];
                    }
                };
                this.syncClassesToRelationIds = (idKey, key, valueId, valueType) => {
                    // console.log(`DB17 reaction to id ${idKey} value`, value)
                    if (!Array.isArray(valueId)) {
                        if (valueId === "") {
                            this[key] = null;
                        }
                        this[key] = this.objectManager.get(valueId, valueType);
                    }
                    else {
                        this[key] = valueId.map((id) => this.objectManager.get(id, valueType));
                        console.log(`this[${key}]`, this[key]);
                    }
                };
                for (const key of Object.keys(this)) {
                    const relation = getRelation(this, key);
                    if (relation) {
                        const idKey = rIdK(key);
                        if (relation.relationship === "OneToMany" ||
                            relation.relationship === "ManyToMany") {
                            if (relation.relationship === "ManyToMany") {
                                console.log("mtm this[idKey]", this[idKey]);
                            }
                            this[idKey] =
                                ((_a = this[idKey]) === null || _a === void 0 ? void 0 : _a.length) > 0
                                    ? this[idKey]
                                    : (_c = (_b = this[key]) === null || _b === void 0 ? void 0 : _b.map((obj) => obj.id)) !== null && _c !== void 0 ? _c : [];
                            // console.l
                            if (relation.relationship === "ManyToMany") {
                            }
                        }
                        else {
                            if (idKey === "id__owner") {
                            }
                            this[idKey] =
                                this[idKey] !== "" &&
                                    this[idKey] !== null &&
                                    this[idKey] !== undefined
                                    ? this[idKey]
                                    : (_e = (_d = this[key]) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : "";
                        }
                        const annotations = {};
                        annotations[idKey] = observable;
                        annotations[key] = observable;
                        makeObservable(this, annotations);
                        reaction(() => toJS(this[idKey]), (value) => {
                            //
                            // this.syncClassesToRelationIds(idKey, key, value, relation.type)
                        });
                    }
                    const isProperty = isKeyAProperty(this, key);
                    if (isProperty) {
                        const annotations = {};
                        annotations[key] = observable;
                        makeObservable(this, annotations);
                    }
                }
                this.persistState();
            }
        };
    };
}
