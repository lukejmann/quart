export {};
// import { Block, Space, User } from "../state";
// export class Space extends Model {
//   @property
//   title: string = "Untitled Space";
//   @property
//   background: string = "black";
//   @OneToMany<Block>("space", "Block")
//   blocks: Block[] = [];
//   @ManyToOne<User>("spaces", "User")
//   user?: User;
//   @property
//   selectedBlocks: Block[] = [];
// }
// class Block extends Model {
//   @property
//   actionId?: string;
//   @property
//   background: string = "white";
//   @property
//   position: { x: number; y: number } = { x: 0, y: 0 };
//   @property
//   size: { width: number; height: number } = { width: 2, height: 1 };
//   @property
//   selected = false;
//   @ManyToOne<Space>("blocks", "Space")
//   space?: Space;
//   autorun = false;
//   inputsUpdated() {
//     console.log("inputs updated");
//   }
// }
// class User extends Model {
//   @OneToMany<Space>("user", "Space")
//   spaces: Space[] = [];
//   @property
//   username: string = "Anonymous";
// }
//
