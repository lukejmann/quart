// @ts-ignore - inline the HTML, via build

import * as dog from "dog";
import type { Bindings } from "./types";

// export the custom DO classes
export { Lobby } from "./lobby";
export { Pool } from "./pool";
export { Space, Block, User } from "./object";

const worker: ModuleWorker<Bindings> = {
  async fetch(req, env, ctx) {
    console.log("[ HELLO ][fetch] req.url", req.url);
    let { pathname } = new URL(req.url);
    if (!/^(HEAD|GET)$/.test(req.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 404 });
    }

    // ~> determine request identifier
    // NOTE: ideally result of some cookie/auth process
    let { searchParams } = new URL(req.url);
    let reqid = searchParams.get("u") || "anon";

    let gid = env.LOBBY.idFromName("lobby-id");

    let pool = await dog.identify(gid, reqid, {
      parent: env.LOBBY,
      child: env.POOL,
    });

    return pool.fetch(req);
  },
};

export default worker;
