var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ManyToOne, Model, OneToMany, property, } from "./model";
// NOTE: don't init relationships in constructor. Or won't sync to other object (value equality)
export class Space extends Model {
    constructor() {
        super(...arguments);
        this.title = "Untitled Space";
        this.background = "black";
        this.blocks = [];
        this.selectedBlocks = [];
    }
}
__decorate([
    property,
    __metadata("design:type", String)
], Space.prototype, "title", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], Space.prototype, "background", void 0);
__decorate([
    OneToMany("space", "Block"),
    __metadata("design:type", Array)
], Space.prototype, "blocks", void 0);
__decorate([
    ManyToOne("spaces", "User"),
    __metadata("design:type", User)
], Space.prototype, "user", void 0);
__decorate([
    property,
    __metadata("design:type", Array)
], Space.prototype, "selectedBlocks", void 0);
export class Block extends Model {
    constructor() {
        super(...arguments);
        this.background = "white";
        this.position = { x: 0, y: 0 };
        this.size = { width: 2, height: 1 };
        this.selected = false;
        this.autorun = false;
    }
    inputsUpdated() {
        console.log("inputs updated");
    }
}
__decorate([
    property,
    __metadata("design:type", String)
], Block.prototype, "actionId", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], Block.prototype, "background", void 0);
__decorate([
    property,
    __metadata("design:type", Object)
], Block.prototype, "position", void 0);
__decorate([
    property,
    __metadata("design:type", Object)
], Block.prototype, "size", void 0);
__decorate([
    property,
    __metadata("design:type", Object)
], Block.prototype, "selected", void 0);
__decorate([
    ManyToOne("blocks", "Space"),
    __metadata("design:type", Space)
], Block.prototype, "space", void 0);
export class User extends Model {
    constructor() {
        super(...arguments);
        this.spaces = [];
        this.username = "Anonymous";
    }
}
__decorate([
    OneToMany("user", "Space"),
    __metadata("design:type", Array)
], User.prototype, "spaces", void 0);
__decorate([
    property,
    __metadata("design:type", String)
], User.prototype, "username", void 0);
