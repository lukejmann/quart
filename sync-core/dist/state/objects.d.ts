import { Model } from "./model";
export declare class Space extends Model {
    title: string;
    background: string;
    blocks: Block[];
    user?: User;
    selectedBlocks: Block[];
}
export declare class Block extends Model {
    actionId?: string;
    background: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
    selected: boolean;
    space?: Space;
    autorun: boolean;
    inputsUpdated(): void;
}
export declare class User extends Model {
    spaces: Space[];
    username: string;
}
