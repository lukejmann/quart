import { Model } from "sync-core/src/state/model";
export declare function ClientModel<T extends {
    new (...args: any[]): Model;
}>(type: string): <T_1 extends new (...args: any[]) => any>(target: T_1) => {
    new (...args: any[]): {
        [x: string]: any;
    };
} & T_1;
