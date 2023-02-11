var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result)
    __defProp(target, key, result);
  return result;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ../node_modules/dog/index.js
var GROUPID = "x-dog-group-identifier";
var CLIENTID = "x-dog-client-identifier";
var OBJECTID = "x-dog-replica-identifier";
var NEIGHBORID = "x-dog-neighbor-identifier";
var TARGETID = "x-dog-target-identifier";
var ISEMPTY = "x-dog-client-empty";
var CLOSE = "/~$~/close";
var NEIGHBOR = "/~$~/jello";
var BROADCAST = "/~$~/message";
var WHISPER = "/~$~/whisper";
var GOSSIP = "/~$~/gossip";
var IDENTIFY = "/~$~/identify";
var Encoder = /* @__PURE__ */ new TextEncoder();
var STATUS_CODES = {
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "411": "Length Required",
  "413": "Payload Too Large",
  "422": "Unprocessable Entity",
  "426": "Upgrade Required"
};
function abort(code, message) {
  message = message || STATUS_CODES[code];
  let length = Encoder.encode(message).byteLength;
  return new Response(message, {
    status: code,
    statusText: STATUS_CODES[code],
    headers: {
      "Connection": "close",
      "Content-Type": "text/plain",
      "Content-Length": String(length)
    }
  });
}
function validate(req, replicaid) {
  let oid = req.headers.get(OBJECTID);
  if (oid == null)
    throw new Error("Missing: Replica ID");
  if (replicaid && oid !== replicaid)
    throw new Error("Mismatch: Replica ID");
  let gid = req.headers.get(GROUPID);
  if (gid == null)
    throw new Error("Missing: Group ID");
  let nid = req.headers.get(NEIGHBORID);
  let rid = req.headers.get(CLIENTID) || nid;
  if (rid == null)
    throw new Error("Missing: Request ID");
  let tid = req.headers.get(TARGETID);
  return { gid, rid, oid, tid };
}
function load(ns, uid) {
  let doid = ns.idFromString(uid);
  return ns.get(doid);
}
var Group = class {
  #child;
  #mapping;
  #kids;
  #sorted;
  #current;
  constructor(state, env) {
    this.uid = state.id.toString();
    this.#mapping = new Map();
    this.#kids = new Map();
    this.#sorted = [];
    let refs = this.link(env);
    this.#child = refs.child;
  }
  receive(req) {
    return abort(404);
  }
  clusterize(req, target) {
    return target.newUniqueId();
  }
  async fetch(input, init) {
    let request = new Request(input, init);
    let { pathname } = new URL(request.url, "http://dog");
    if (pathname === CLOSE) {
      try {
        return await this.#close(request);
      } catch (err) {
        return abort(400, err.message);
      }
    }
    if (pathname === IDENTIFY) {
      try {
        request.headers.set(OBJECTID, "");
        let { rid } = validate(request);
        return this.#identify(request, rid);
      } catch (err) {
        return abort(400, err.message);
      }
    }
    return this.receive(request);
  }
  async #identify(request, rid) {
    let alive;
    let sid = this.#mapping.get(rid) || this.#current || this.#sorted[0];
    if (sid != null)
      alive = this.#kids.get(sid);
    if (alive != null && this.limit >= ++alive) {
    } else {
      let pair = this.#sorted.length > 0 && await this.#sort();
      if (pair) {
        sid = pair[0];
        alive = pair[1] + 1;
      } else {
        sid = (await this.clusterize(request, this.#child)).toString();
        this.#welcome(sid);
        alive = 1;
      }
    }
    this.#current = alive < this.limit ? sid : void 0;
    this.#mapping.set(rid, sid);
    this.#kids.set(sid, alive);
    return new Response(sid);
  }
  async #welcome(nid) {
    let items = [...this.#kids.keys()];
    this.#sorted.unshift(nid);
    this.#kids.set(nid, 1);
    if (items.length > 0) {
      await Promise.all(items.map((sid) => Promise.all([
        this.#introduce(nid, sid),
        this.#introduce(sid, nid)
      ])));
    }
  }
  #introduce(stranger, target) {
    let headers = new Headers();
    headers.set(OBJECTID, target);
    headers.set(NEIGHBORID, stranger);
    headers.set(GROUPID, this.uid);
    let url = new URL(NEIGHBOR, "http://dog");
    let stub = load(this.#child, target);
    return stub.fetch(url.href, { headers });
  }
  async #sort() {
    let tuples = [...this.#kids];
    if (tuples.length > 1) {
      tuples.sort((a, b) => a[1] - b[1]);
    }
    let bucket;
    let i = 0, list = [];
    for (; i < tuples.length; i++) {
      if (tuples[i][1] < this.limit) {
        if (!bucket)
          bucket = tuples[i];
        list.push(tuples[i][0]);
      }
    }
    this.#sorted = list;
    return bucket;
  }
  async #close(req) {
    var { rid, oid, gid } = validate(req);
    if (gid !== this.uid)
      throw new Error("Mismatch: Group ID");
    let alive = this.#kids.get(oid);
    if (alive == null)
      throw new Error("Unknown: Replica ID");
    alive = Math.max(0, --alive);
    this.#kids.set(oid, alive);
    if (req.headers.get(ISEMPTY) === "1") {
      this.#mapping.delete(rid);
    }
    let bucket = await this.#sort();
    this.#current = bucket ? bucket[0] : void 0;
    return new Response("OK");
  }
};
function send(conns, msg) {
  for (let ws of conns)
    ws.send(msg);
}
var Replica = class {
  #pool;
  #neighbors;
  #parent;
  #self;
  #gid;
  constructor(state, env) {
    this.uid = state.id.toString();
    this.#neighbors = new Set();
    this.#pool = new Map();
    let refs = this.link(env);
    this.#parent = refs.parent;
    this.#self = refs.self;
  }
  async connect(req) {
    if (req.method !== "GET")
      return abort(405);
    let value = req.headers.get("upgrade");
    if (value !== "websocket")
      return abort(426);
    value = (req.headers.get("sec-websocket-key") || "").trim();
    if (!/^[+/0-9A-Za-z]{22}==$/.test(value))
      return abort(400);
    value = req.headers.get("sec-websocket-version");
    if (value !== "13")
      return abort(400);
    try {
      var { rid, gid } = validate(req, this.uid);
    } catch (err) {
      return abort(400, err.message);
    }
    let { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    let socket = {
      uid: rid,
      send: server.send.bind(server),
      close: server.close.bind(server),
      broadcast: this.#broadcast.bind(this, gid, rid),
      whisper: this.#whisper.bind(this, gid, rid),
      emit: this.#emit.bind(this, rid)
    };
    let closer = async (evt) => {
      try {
        if (evt.type === "error" && this.onerror)
          await this.onerror(socket);
        else if (this.onclose)
          await this.onclose(socket);
      } finally {
        let state2 = this.#pool.get(rid);
        let isEmpty;
        if (!state2 || state2.socket.size < 2) {
          this.#pool.delete(rid);
          isEmpty = true;
        } else {
          state2.socket.delete(server);
          this.#pool.set(rid, state2);
          isEmpty = false;
        }
        await this.#close(rid, gid, isEmpty);
        server.close();
      }
    };
    server.addEventListener("close", closer);
    server.addEventListener("error", closer);
    if (this.onmessage) {
      server.addEventListener("message", (evt) => {
        this.onmessage(socket, evt.data);
      });
    }
    if (this.onopen) {
      await this.onopen(socket);
    }
    let state = this.#pool.get(rid) || {
      group: gid,
      socket: new Set()
    };
    state.socket.add(server);
    this.#pool.set(rid, state);
    return new Response(null, {
      status: 101,
      statusText: "Switching Protocols",
      webSocket: client
    });
  }
  async gossip(msg) {
    if (this.#neighbors.size < 1)
      return [];
    let list = await this.#dispatch({
      group: this.#gid,
      sender: this.uid,
      route: GOSSIP,
      body: msg == null ? msg : JSON.stringify(msg)
    });
    return Promise.all(list.map((r) => r.json()));
  }
  async fetch(input, init) {
    let request = new Request(input, init);
    try {
      var { pathname } = new URL(request.url, "foo://");
      var { rid, gid, tid } = validate(request, this.uid);
    } catch (err) {
      return abort(400, err.message);
    }
    if (pathname === NEIGHBOR) {
      this.#gid = this.#gid || gid;
      this.#neighbors.add(rid);
      return new Response();
    }
    if (pathname === BROADCAST) {
      try {
        this.#emit(rid, await request.text());
        return new Response();
      } catch (err) {
        let msg = err.stack;
        return abort(400, msg || "Error parsing broadcast message");
      }
    }
    if (pathname === WHISPER) {
      try {
        if (!tid)
          throw new Error("Missing: Target ID");
        let state = this.#pool.get(tid);
        if (state)
          send(state.socket, await request.text());
        return new Response();
      } catch (err) {
        let msg = err.stack;
        return abort(400, msg || "Error parsing whisper message");
      }
    }
    if (pathname === GOSSIP) {
      try {
        if (!this.ongossip)
          throw new Error("Missing: `ongossip` handler");
        let payload = await this.ongossip(await request.json());
        let body = payload == null ? null : JSON.stringify(payload);
        let headers = { "Content-Type": "application/json" };
        return new Response(body, { headers });
      } catch (err) {
        let msg = err.stack;
        return abort(400, msg || "Error while gossiping");
      }
    }
    let res;
    try {
      return res = await this.receive(request);
    } catch (err) {
      let stack = err.stack;
      return res = abort(400, stack || "Error in `receive` method");
    } finally {
      if (res.status !== 101) {
        await this.#close(rid, gid, true);
      }
    }
  }
  emit(msg) {
    this.#emit(this.#gid, msg, true);
  }
  broadcast(msg) {
    return this.#broadcast(this.#gid, this.uid, msg, true);
  }
  whisper(target, msg) {
    return this.#whisper(this.#gid, this.uid, target, msg);
  }
  #emit(sender, msg, self2) {
    if (typeof msg === "object") {
      msg = JSON.stringify(msg);
    }
    for (let [rid, state] of this.#pool) {
      if (self2 || rid !== sender)
        send(state.socket, msg);
    }
  }
  async #broadcast(group, sender, msg, self2) {
    let body = typeof msg === "object" ? JSON.stringify(msg) : msg;
    this.#emit(sender, body, self2);
    await this.#dispatch({
      group,
      sender,
      body,
      route: BROADCAST
    });
  }
  async #dispatch(params) {
    let list = [...this.#neighbors];
    if (list.length < 1)
      return;
    let commons = {
      [NEIGHBORID]: this.uid,
      [GROUPID]: params.group,
      [CLIENTID]: params.sender
    };
    if (params.target) {
      commons[TARGETID] = params.target;
    }
    let url = new URL(params.route, "http://dog");
    return Promise.all(list.map((sid) => {
      let stub = load(this.#self, sid);
      let headers = new Headers(commons);
      headers.set(OBJECTID, sid);
      return stub.fetch(url.href, {
        method: "POST",
        headers,
        body: params.body
      });
    }));
  }
  async #whisper(group, sender, target, msg) {
    if (sender === target)
      return;
    let body = typeof msg === "object" ? JSON.stringify(msg) : msg;
    let state = this.#pool.get(target);
    if (state)
      return send(state.socket, body);
    await this.#dispatch({
      group,
      sender,
      target,
      body,
      route: WHISPER
    });
  }
  async #close(rid, gid, isEmpty) {
    let headers = new Headers();
    headers.set(GROUPID, gid);
    headers.set(OBJECTID, this.uid);
    headers.set(CLIENTID, rid);
    headers.set(ISEMPTY, isEmpty ? "1" : "0");
    let url = new URL(CLOSE, "http://dog");
    let group = load(this.#parent, gid);
    await group.fetch(url.href, { headers });
  }
};
var identify = async function(gid, rid, family) {
  let group = family.parent.get(gid);
  let request = new Request("http://dog" + IDENTIFY);
  request.headers.set(GROUPID, gid.toString());
  request.headers.set(CLIENTID, rid);
  let text = await group.fetch(request).then((r) => r.text());
  let sid = family.child.idFromString(text);
  let stub = family.child.get(sid);
  let prev = stub.fetch.bind(stub);
  stub.fetch = function(input, init) {
    let request2 = new Request(input, init);
    request2.headers.set(CLIENTID, rid);
    request2.headers.set(OBJECTID, stub.id.toString());
    request2.headers.set(GROUPID, gid.toString());
    return prev(request2);
  };
  return stub;
};

// worker/lobby.ts
var Lobby = class extends Group {
  constructor() {
    super(...arguments);
    this.limit = 1;
  }
  link(env) {
    return {
      child: env.POOL,
      self: env.LOBBY
    };
  }
  clusterize(req, target) {
    console.log("[ HELLO ][clusterize] req", JSON.stringify(req));
    return target.newUniqueId();
  }
};

// worker/headers.ts
var POOLID = "x-quaternion-pool-identifier";
var MODELID = "x-quaternion-model-identifier";

// worker/utils.ts
function validate2(req, replicaid) {
  let oid = req.headers.get(MODELID);
  if (oid == null)
    throw new Error("Missing: Replica ID");
  let pid = req.headers.get(POOLID);
  if (pid == null)
    throw new Error("Missing: Group ID");
  return { oid, pid };
}
function load2(ns, name) {
  let doid = ns.idFromName(name);
  return ns.get(doid);
}

// worker/pool.ts
var Pool = class extends Replica {
  constructor() {
    super(...arguments);
    this.pushedTXs = new Set();
    this.connectedModels = new Map();
    this.poolToModelMessageQueue = new Map();
    this.poolToModelResponseSocket = new Map();
    this.clientKnownTXs = new Set();
  }
  link(env) {
    this.env = env;
    return {
      parent: env.LOBBY,
      self: env.POOL
    };
  }
  receive(req) {
    return __async(this, null, function* () {
      let { pathname } = new URL(req.url);
      if (pathname === "/ws") {
        return this.connect(req);
      } else {
        return new Response("NOT FOUND", { status: 404 });
      }
    });
  }
  onopen(socket) {
    let output = {
      type: "user:join",
      from: socket.uid,
      time: Date.now()
    };
    socket.broadcast(output, true);
  }
  onclose(socket) {
    return __async(this, null, function* () {
      let output = {
        type: "user:exit",
        from: socket.uid,
        time: Date.now()
      };
      socket.broadcast(output);
    });
  }
  ongossip(msg) {
    return __async(this, null, function* () {
      if (msg.type === "intra:user:list") {
        return [];
      }
      throw new Error(`Missing: "${msg.type}" ongossip`);
    });
  }
  objectToEnv(classType) {
    console.log("[POOL] objectToEnv", classType);
    switch (classType) {
      case "Space":
        return this.env.SPACE;
      case "Block":
        return this.env.BLOCK;
      case "User":
        return this.env.USER;
      default:
        throw new Error("Unknown object type");
    }
  }
  onmessage(socket, data) {
    return __async(this, null, function* () {
      let input = JSON.parse(data);
      console.log("[POOL] onmessage", input);
      switch (input.type) {
        case "tx":
          return this.handleClientTX(socket, input);
        case "pullRequest":
          return this.handleClientPull(socket, input);
        default:
          return socket.broadcast({ msg: "received" }, true);
      }
    });
  }
  processPoolToModelMessageQueue(modelId) {
    return __async(this, null, function* () {
      let queue = this.poolToModelMessageQueue.get(modelId);
      if (queue) {
        for (let msg of queue) {
          const modelState = this.connectedModels.get(modelId);
          if (modelState && modelState.socket) {
            modelState.socket.send(JSON.stringify(msg));
          } else {
            throw new Error("Model not found");
          }
        }
      }
      this.poolToModelMessageQueue.delete(modelId);
    });
  }
  processPoolToModelMessageQueueIfConnected(modelId) {
    return __async(this, null, function* () {
      const modelState = this.connectedModels.get(modelId);
      if (modelState && modelState.status === "connected") {
        this.processPoolToModelMessageQueue(modelId);
      }
    });
  }
  onOpenModelConnection(modelId, ws) {
    return __async(this, null, function* () {
      if (this.connectedModels.has(modelId)) {
        this.connectedModels.set(modelId, {
          modelId,
          status: "connected",
          socket: ws
        });
      } else
        throw new Error("Model not found");
      this.processPoolToModelMessageQueue(modelId);
    });
  }
  onRequestFromModel(modelId, data) {
    return __async(this, null, function* () {
      const msg = JSON.parse(data);
      const asTX = JSON.parse(msg.payload);
      if (this.clientKnownTXs.has(asTX.id)) {
        return;
      }
      this.broadcast(msg);
      this.clientKnownTXs.add(asTX.id);
    });
  }
  onResponseFromModel(modelId, data) {
    return __async(this, null, function* () {
      const msg = JSON.parse(data);
      if (msg.success === false) {
        throw new Error("ModelToPoolMessage failed");
        return;
      }
      const socket = this.poolToModelResponseSocket.get(msg.rid);
      if (!socket) {
        throw new Error("Socket not found");
        return;
      }
      switch (msg.type) {
        case "res:pull":
          const response = {
            type: "pullResponse",
            classType: modelId.type,
            classId: modelId.id,
            object: msg.state
          };
          socket.broadcast(response, true);
          break;
        case "res:apply-tx":
          console.log("[POOL] res:apply-tx success", msg.success);
          break;
        default:
          throw new Error("Unknown message type");
      }
    });
  }
  onCloseFromModel(modelId) {
    return __async(this, null, function* () {
    });
  }
  onErrorFromModel(modelId) {
    return __async(this, null, function* () {
    });
  }
  connectToModel(modelId) {
    return __async(this, null, function* () {
      const headers = new Headers();
      headers.set(POOLID, this.uid);
      headers.set(MODELID, modelId.id);
      headers.set("upgrade", "websocket");
      const url = new URL(`http://quaternions/ws/${modelId.id}`);
      const model = load2(this.objectToEnv(modelId.type), modelId.id);
      const resp = yield model.fetch(url.href, { headers });
      const ws = resp.webSocket;
      ws.accept();
      ws.addEventListener("message", (e) => {
        const parsed = JSON.parse(e.data);
        if (parsed.type.includes("res"))
          this.onResponseFromModel(modelId, e.data);
        else if (parsed.type.includes("req"))
          this.onRequestFromModel(modelId, e.data);
        else
          throw new Error("Unknown message type");
      });
      ws.addEventListener("close", () => {
        this.onCloseFromModel(modelId);
      });
      ws.addEventListener("error", () => {
        this.onErrorFromModel(modelId);
      });
      yield this.onOpenModelConnection(modelId, ws);
    });
  }
  submitMessageToModel(modelId, msg, responseSocket) {
    if (!this.connectedModels.has(modelId)) {
      this.connectedModels.set(modelId, {
        modelId,
        status: "connecting",
        socket: null
      });
      this.connectToModel(modelId);
    }
    if (this.poolToModelMessageQueue.has(modelId)) {
      this.poolToModelMessageQueue.get(modelId).push(msg);
    } else {
      this.poolToModelMessageQueue.set(modelId, [msg]);
    }
    this.poolToModelResponseSocket.set(msg.rid, responseSocket);
  }
  handleClientTX(socket, msg) {
    return __async(this, null, function* () {
      const tx = msg.tx;
      this.clientKnownTXs.add(tx.id);
      const models = new Set();
      for (const mutation of tx.forwards) {
        const mut = mutation;
        const modelId = {
          type: mut.onClass,
          id: mut.onClassId
        };
        models.add(modelId);
      }
      for (const modelId of models) {
        this.submitMessageToModel(modelId, {
          rid: crypto.randomUUID(),
          type: "req:apply-tx",
          tx
        }, socket);
        this.processPoolToModelMessageQueueIfConnected(modelId);
      }
    });
  }
  handleClientPull(socket, msg) {
    return __async(this, null, function* () {
      const modelId = {
        type: msg.classType,
        id: msg.classId
      };
      this.submitMessageToModel(modelId, {
        rid: crypto.randomUUID(),
        type: "req:pull"
      }, socket);
      this.processPoolToModelMessageQueueIfConnected(modelId);
    });
  }
};

// ../node_modules/reflect-metadata/Reflect.js
var Reflect2;
(function(Reflect3) {
  (function(factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : Function("return this;")();
    var exporter = makeExporter(Reflect3);
    if (typeof root.Reflect === "undefined") {
      root.Reflect = Reflect3;
    } else {
      exporter = makeExporter(root.Reflect, exporter);
    }
    factory(exporter);
    function makeExporter(target, previous) {
      return function(key, value) {
        if (typeof target[key] !== "function") {
          Object.defineProperty(target, key, { configurable: true, writable: true, value });
        }
        if (previous)
          previous(key, value);
      };
    }
  })(function(exporter) {
    var hasOwn = Object.prototype.hasOwnProperty;
    var supportsSymbol = typeof Symbol === "function";
    var toPrimitiveSymbol = supportsSymbol && typeof Symbol.toPrimitive !== "undefined" ? Symbol.toPrimitive : "@@toPrimitive";
    var iteratorSymbol = supportsSymbol && typeof Symbol.iterator !== "undefined" ? Symbol.iterator : "@@iterator";
    var supportsCreate = typeof Object.create === "function";
    var supportsProto = { __proto__: [] } instanceof Array;
    var downLevel = !supportsCreate && !supportsProto;
    var HashMap = {
      create: supportsCreate ? function() {
        return MakeDictionary(Object.create(null));
      } : supportsProto ? function() {
        return MakeDictionary({ __proto__: null });
      } : function() {
        return MakeDictionary({});
      },
      has: downLevel ? function(map, key) {
        return hasOwn.call(map, key);
      } : function(map, key) {
        return key in map;
      },
      get: downLevel ? function(map, key) {
        return hasOwn.call(map, key) ? map[key] : void 0;
      } : function(map, key) {
        return map[key];
      }
    };
    var functionPrototype = Object.getPrototypeOf(Function);
    var usePolyfill = typeof process === "object" && process.env && process.env["REFLECT_METADATA_USE_MAP_POLYFILL"] === "true";
    var _Map = !usePolyfill && typeof Map === "function" && typeof Map.prototype.entries === "function" ? Map : CreateMapPolyfill();
    var _Set = !usePolyfill && typeof Set === "function" && typeof Set.prototype.entries === "function" ? Set : CreateSetPolyfill();
    var _WeakMap = !usePolyfill && typeof WeakMap === "function" ? WeakMap : CreateWeakMapPolyfill();
    var Metadata = new _WeakMap();
    function decorate(decorators, target, propertyKey, attributes) {
      if (!IsUndefined(propertyKey)) {
        if (!IsArray(decorators))
          throw new TypeError();
        if (!IsObject(target))
          throw new TypeError();
        if (!IsObject(attributes) && !IsUndefined(attributes) && !IsNull(attributes))
          throw new TypeError();
        if (IsNull(attributes))
          attributes = void 0;
        propertyKey = ToPropertyKey(propertyKey);
        return DecorateProperty(decorators, target, propertyKey, attributes);
      } else {
        if (!IsArray(decorators))
          throw new TypeError();
        if (!IsConstructor(target))
          throw new TypeError();
        return DecorateConstructor(decorators, target);
      }
    }
    exporter("decorate", decorate);
    function metadata(metadataKey, metadataValue) {
      function decorator(target, propertyKey) {
        if (!IsObject(target))
          throw new TypeError();
        if (!IsUndefined(propertyKey) && !IsPropertyKey(propertyKey))
          throw new TypeError();
        OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
      }
      return decorator;
    }
    exporter("metadata", metadata);
    function defineMetadata(metadataKey, metadataValue, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
    }
    exporter("defineMetadata", defineMetadata);
    function hasMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryHasMetadata(metadataKey, target, propertyKey);
    }
    exporter("hasMetadata", hasMetadata);
    function hasOwnMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryHasOwnMetadata(metadataKey, target, propertyKey);
    }
    exporter("hasOwnMetadata", hasOwnMetadata);
    function getMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryGetMetadata(metadataKey, target, propertyKey);
    }
    exporter("getMetadata", getMetadata);
    function getOwnMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryGetOwnMetadata(metadataKey, target, propertyKey);
    }
    exporter("getOwnMetadata", getOwnMetadata);
    function getMetadataKeys(target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryMetadataKeys(target, propertyKey);
    }
    exporter("getMetadataKeys", getMetadataKeys);
    function getOwnMetadataKeys(target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      return OrdinaryOwnMetadataKeys(target, propertyKey);
    }
    exporter("getOwnMetadataKeys", getOwnMetadataKeys);
    function deleteMetadata(metadataKey, target, propertyKey) {
      if (!IsObject(target))
        throw new TypeError();
      if (!IsUndefined(propertyKey))
        propertyKey = ToPropertyKey(propertyKey);
      var metadataMap = GetOrCreateMetadataMap(target, propertyKey, false);
      if (IsUndefined(metadataMap))
        return false;
      if (!metadataMap.delete(metadataKey))
        return false;
      if (metadataMap.size > 0)
        return true;
      var targetMetadata = Metadata.get(target);
      targetMetadata.delete(propertyKey);
      if (targetMetadata.size > 0)
        return true;
      Metadata.delete(target);
      return true;
    }
    exporter("deleteMetadata", deleteMetadata);
    function DecorateConstructor(decorators, target) {
      for (var i = decorators.length - 1; i >= 0; --i) {
        var decorator = decorators[i];
        var decorated = decorator(target);
        if (!IsUndefined(decorated) && !IsNull(decorated)) {
          if (!IsConstructor(decorated))
            throw new TypeError();
          target = decorated;
        }
      }
      return target;
    }
    function DecorateProperty(decorators, target, propertyKey, descriptor) {
      for (var i = decorators.length - 1; i >= 0; --i) {
        var decorator = decorators[i];
        var decorated = decorator(target, propertyKey, descriptor);
        if (!IsUndefined(decorated) && !IsNull(decorated)) {
          if (!IsObject(decorated))
            throw new TypeError();
          descriptor = decorated;
        }
      }
      return descriptor;
    }
    function GetOrCreateMetadataMap(O, P, Create) {
      var targetMetadata = Metadata.get(O);
      if (IsUndefined(targetMetadata)) {
        if (!Create)
          return void 0;
        targetMetadata = new _Map();
        Metadata.set(O, targetMetadata);
      }
      var metadataMap = targetMetadata.get(P);
      if (IsUndefined(metadataMap)) {
        if (!Create)
          return void 0;
        metadataMap = new _Map();
        targetMetadata.set(P, metadataMap);
      }
      return metadataMap;
    }
    function OrdinaryHasMetadata(MetadataKey, O, P) {
      var hasOwn2 = OrdinaryHasOwnMetadata(MetadataKey, O, P);
      if (hasOwn2)
        return true;
      var parent = OrdinaryGetPrototypeOf(O);
      if (!IsNull(parent))
        return OrdinaryHasMetadata(MetadataKey, parent, P);
      return false;
    }
    function OrdinaryHasOwnMetadata(MetadataKey, O, P) {
      var metadataMap = GetOrCreateMetadataMap(O, P, false);
      if (IsUndefined(metadataMap))
        return false;
      return ToBoolean(metadataMap.has(MetadataKey));
    }
    function OrdinaryGetMetadata(MetadataKey, O, P) {
      var hasOwn2 = OrdinaryHasOwnMetadata(MetadataKey, O, P);
      if (hasOwn2)
        return OrdinaryGetOwnMetadata(MetadataKey, O, P);
      var parent = OrdinaryGetPrototypeOf(O);
      if (!IsNull(parent))
        return OrdinaryGetMetadata(MetadataKey, parent, P);
      return void 0;
    }
    function OrdinaryGetOwnMetadata(MetadataKey, O, P) {
      var metadataMap = GetOrCreateMetadataMap(O, P, false);
      if (IsUndefined(metadataMap))
        return void 0;
      return metadataMap.get(MetadataKey);
    }
    function OrdinaryDefineOwnMetadata(MetadataKey, MetadataValue, O, P) {
      var metadataMap = GetOrCreateMetadataMap(O, P, true);
      metadataMap.set(MetadataKey, MetadataValue);
    }
    function OrdinaryMetadataKeys(O, P) {
      var ownKeys = OrdinaryOwnMetadataKeys(O, P);
      var parent = OrdinaryGetPrototypeOf(O);
      if (parent === null)
        return ownKeys;
      var parentKeys = OrdinaryMetadataKeys(parent, P);
      if (parentKeys.length <= 0)
        return ownKeys;
      if (ownKeys.length <= 0)
        return parentKeys;
      var set = new _Set();
      var keys = [];
      for (var _i = 0, ownKeys_1 = ownKeys; _i < ownKeys_1.length; _i++) {
        var key = ownKeys_1[_i];
        var hasKey = set.has(key);
        if (!hasKey) {
          set.add(key);
          keys.push(key);
        }
      }
      for (var _a = 0, parentKeys_1 = parentKeys; _a < parentKeys_1.length; _a++) {
        var key = parentKeys_1[_a];
        var hasKey = set.has(key);
        if (!hasKey) {
          set.add(key);
          keys.push(key);
        }
      }
      return keys;
    }
    function OrdinaryOwnMetadataKeys(O, P) {
      var keys = [];
      var metadataMap = GetOrCreateMetadataMap(O, P, false);
      if (IsUndefined(metadataMap))
        return keys;
      var keysObj = metadataMap.keys();
      var iterator = GetIterator(keysObj);
      var k = 0;
      while (true) {
        var next = IteratorStep(iterator);
        if (!next) {
          keys.length = k;
          return keys;
        }
        var nextValue = IteratorValue(next);
        try {
          keys[k] = nextValue;
        } catch (e) {
          try {
            IteratorClose(iterator);
          } finally {
            throw e;
          }
        }
        k++;
      }
    }
    function Type(x) {
      if (x === null)
        return 1;
      switch (typeof x) {
        case "undefined":
          return 0;
        case "boolean":
          return 2;
        case "string":
          return 3;
        case "symbol":
          return 4;
        case "number":
          return 5;
        case "object":
          return x === null ? 1 : 6;
        default:
          return 6;
      }
    }
    function IsUndefined(x) {
      return x === void 0;
    }
    function IsNull(x) {
      return x === null;
    }
    function IsSymbol(x) {
      return typeof x === "symbol";
    }
    function IsObject(x) {
      return typeof x === "object" ? x !== null : typeof x === "function";
    }
    function ToPrimitive(input, PreferredType) {
      switch (Type(input)) {
        case 0:
          return input;
        case 1:
          return input;
        case 2:
          return input;
        case 3:
          return input;
        case 4:
          return input;
        case 5:
          return input;
      }
      var hint = PreferredType === 3 ? "string" : PreferredType === 5 ? "number" : "default";
      var exoticToPrim = GetMethod(input, toPrimitiveSymbol);
      if (exoticToPrim !== void 0) {
        var result = exoticToPrim.call(input, hint);
        if (IsObject(result))
          throw new TypeError();
        return result;
      }
      return OrdinaryToPrimitive(input, hint === "default" ? "number" : hint);
    }
    function OrdinaryToPrimitive(O, hint) {
      if (hint === "string") {
        var toString_1 = O.toString;
        if (IsCallable(toString_1)) {
          var result = toString_1.call(O);
          if (!IsObject(result))
            return result;
        }
        var valueOf = O.valueOf;
        if (IsCallable(valueOf)) {
          var result = valueOf.call(O);
          if (!IsObject(result))
            return result;
        }
      } else {
        var valueOf = O.valueOf;
        if (IsCallable(valueOf)) {
          var result = valueOf.call(O);
          if (!IsObject(result))
            return result;
        }
        var toString_2 = O.toString;
        if (IsCallable(toString_2)) {
          var result = toString_2.call(O);
          if (!IsObject(result))
            return result;
        }
      }
      throw new TypeError();
    }
    function ToBoolean(argument) {
      return !!argument;
    }
    function ToString(argument) {
      return "" + argument;
    }
    function ToPropertyKey(argument) {
      var key = ToPrimitive(argument, 3);
      if (IsSymbol(key))
        return key;
      return ToString(key);
    }
    function IsArray(argument) {
      return Array.isArray ? Array.isArray(argument) : argument instanceof Object ? argument instanceof Array : Object.prototype.toString.call(argument) === "[object Array]";
    }
    function IsCallable(argument) {
      return typeof argument === "function";
    }
    function IsConstructor(argument) {
      return typeof argument === "function";
    }
    function IsPropertyKey(argument) {
      switch (Type(argument)) {
        case 3:
          return true;
        case 4:
          return true;
        default:
          return false;
      }
    }
    function GetMethod(V, P) {
      var func = V[P];
      if (func === void 0 || func === null)
        return void 0;
      if (!IsCallable(func))
        throw new TypeError();
      return func;
    }
    function GetIterator(obj) {
      var method = GetMethod(obj, iteratorSymbol);
      if (!IsCallable(method))
        throw new TypeError();
      var iterator = method.call(obj);
      if (!IsObject(iterator))
        throw new TypeError();
      return iterator;
    }
    function IteratorValue(iterResult) {
      return iterResult.value;
    }
    function IteratorStep(iterator) {
      var result = iterator.next();
      return result.done ? false : result;
    }
    function IteratorClose(iterator) {
      var f = iterator["return"];
      if (f)
        f.call(iterator);
    }
    function OrdinaryGetPrototypeOf(O) {
      var proto = Object.getPrototypeOf(O);
      if (typeof O !== "function" || O === functionPrototype)
        return proto;
      if (proto !== functionPrototype)
        return proto;
      var prototype = O.prototype;
      var prototypeProto = prototype && Object.getPrototypeOf(prototype);
      if (prototypeProto == null || prototypeProto === Object.prototype)
        return proto;
      var constructor = prototypeProto.constructor;
      if (typeof constructor !== "function")
        return proto;
      if (constructor === O)
        return proto;
      return constructor;
    }
    function CreateMapPolyfill() {
      var cacheSentinel = {};
      var arraySentinel = [];
      var MapIterator = function() {
        function MapIterator2(keys, values, selector) {
          this._index = 0;
          this._keys = keys;
          this._values = values;
          this._selector = selector;
        }
        MapIterator2.prototype["@@iterator"] = function() {
          return this;
        };
        MapIterator2.prototype[iteratorSymbol] = function() {
          return this;
        };
        MapIterator2.prototype.next = function() {
          var index = this._index;
          if (index >= 0 && index < this._keys.length) {
            var result = this._selector(this._keys[index], this._values[index]);
            if (index + 1 >= this._keys.length) {
              this._index = -1;
              this._keys = arraySentinel;
              this._values = arraySentinel;
            } else {
              this._index++;
            }
            return { value: result, done: false };
          }
          return { value: void 0, done: true };
        };
        MapIterator2.prototype.throw = function(error) {
          if (this._index >= 0) {
            this._index = -1;
            this._keys = arraySentinel;
            this._values = arraySentinel;
          }
          throw error;
        };
        MapIterator2.prototype.return = function(value) {
          if (this._index >= 0) {
            this._index = -1;
            this._keys = arraySentinel;
            this._values = arraySentinel;
          }
          return { value, done: true };
        };
        return MapIterator2;
      }();
      return function() {
        function Map2() {
          this._keys = [];
          this._values = [];
          this._cacheKey = cacheSentinel;
          this._cacheIndex = -2;
        }
        Object.defineProperty(Map2.prototype, "size", {
          get: function() {
            return this._keys.length;
          },
          enumerable: true,
          configurable: true
        });
        Map2.prototype.has = function(key) {
          return this._find(key, false) >= 0;
        };
        Map2.prototype.get = function(key) {
          var index = this._find(key, false);
          return index >= 0 ? this._values[index] : void 0;
        };
        Map2.prototype.set = function(key, value) {
          var index = this._find(key, true);
          this._values[index] = value;
          return this;
        };
        Map2.prototype.delete = function(key) {
          var index = this._find(key, false);
          if (index >= 0) {
            var size = this._keys.length;
            for (var i = index + 1; i < size; i++) {
              this._keys[i - 1] = this._keys[i];
              this._values[i - 1] = this._values[i];
            }
            this._keys.length--;
            this._values.length--;
            if (key === this._cacheKey) {
              this._cacheKey = cacheSentinel;
              this._cacheIndex = -2;
            }
            return true;
          }
          return false;
        };
        Map2.prototype.clear = function() {
          this._keys.length = 0;
          this._values.length = 0;
          this._cacheKey = cacheSentinel;
          this._cacheIndex = -2;
        };
        Map2.prototype.keys = function() {
          return new MapIterator(this._keys, this._values, getKey);
        };
        Map2.prototype.values = function() {
          return new MapIterator(this._keys, this._values, getValue);
        };
        Map2.prototype.entries = function() {
          return new MapIterator(this._keys, this._values, getEntry);
        };
        Map2.prototype["@@iterator"] = function() {
          return this.entries();
        };
        Map2.prototype[iteratorSymbol] = function() {
          return this.entries();
        };
        Map2.prototype._find = function(key, insert) {
          if (this._cacheKey !== key) {
            this._cacheIndex = this._keys.indexOf(this._cacheKey = key);
          }
          if (this._cacheIndex < 0 && insert) {
            this._cacheIndex = this._keys.length;
            this._keys.push(key);
            this._values.push(void 0);
          }
          return this._cacheIndex;
        };
        return Map2;
      }();
      function getKey(key, _) {
        return key;
      }
      function getValue(_, value) {
        return value;
      }
      function getEntry(key, value) {
        return [key, value];
      }
    }
    function CreateSetPolyfill() {
      return function() {
        function Set2() {
          this._map = new _Map();
        }
        Object.defineProperty(Set2.prototype, "size", {
          get: function() {
            return this._map.size;
          },
          enumerable: true,
          configurable: true
        });
        Set2.prototype.has = function(value) {
          return this._map.has(value);
        };
        Set2.prototype.add = function(value) {
          return this._map.set(value, value), this;
        };
        Set2.prototype.delete = function(value) {
          return this._map.delete(value);
        };
        Set2.prototype.clear = function() {
          this._map.clear();
        };
        Set2.prototype.keys = function() {
          return this._map.keys();
        };
        Set2.prototype.values = function() {
          return this._map.values();
        };
        Set2.prototype.entries = function() {
          return this._map.entries();
        };
        Set2.prototype["@@iterator"] = function() {
          return this.keys();
        };
        Set2.prototype[iteratorSymbol] = function() {
          return this.keys();
        };
        return Set2;
      }();
    }
    function CreateWeakMapPolyfill() {
      var UUID_SIZE = 16;
      var keys = HashMap.create();
      var rootKey = CreateUniqueKey();
      return function() {
        function WeakMap2() {
          this._key = CreateUniqueKey();
        }
        WeakMap2.prototype.has = function(target) {
          var table = GetOrCreateWeakMapTable(target, false);
          return table !== void 0 ? HashMap.has(table, this._key) : false;
        };
        WeakMap2.prototype.get = function(target) {
          var table = GetOrCreateWeakMapTable(target, false);
          return table !== void 0 ? HashMap.get(table, this._key) : void 0;
        };
        WeakMap2.prototype.set = function(target, value) {
          var table = GetOrCreateWeakMapTable(target, true);
          table[this._key] = value;
          return this;
        };
        WeakMap2.prototype.delete = function(target) {
          var table = GetOrCreateWeakMapTable(target, false);
          return table !== void 0 ? delete table[this._key] : false;
        };
        WeakMap2.prototype.clear = function() {
          this._key = CreateUniqueKey();
        };
        return WeakMap2;
      }();
      function CreateUniqueKey() {
        var key;
        do
          key = "@@WeakMap@@" + CreateUUID();
        while (HashMap.has(keys, key));
        keys[key] = true;
        return key;
      }
      function GetOrCreateWeakMapTable(target, create) {
        if (!hasOwn.call(target, rootKey)) {
          if (!create)
            return void 0;
          Object.defineProperty(target, rootKey, { value: HashMap.create() });
        }
        return target[rootKey];
      }
      function FillRandomBytes(buffer, size) {
        for (var i = 0; i < size; ++i)
          buffer[i] = Math.random() * 255 | 0;
        return buffer;
      }
      function GenRandomBytes(size) {
        if (typeof Uint8Array === "function") {
          if (typeof crypto !== "undefined")
            return crypto.getRandomValues(new Uint8Array(size));
          if (typeof msCrypto !== "undefined")
            return msCrypto.getRandomValues(new Uint8Array(size));
          return FillRandomBytes(new Uint8Array(size), size);
        }
        return FillRandomBytes(new Array(size), size);
      }
      function CreateUUID() {
        var data = GenRandomBytes(UUID_SIZE);
        data[6] = data[6] & 79 | 64;
        data[8] = data[8] & 191 | 128;
        var result = "";
        for (var offset = 0; offset < UUID_SIZE; ++offset) {
          var byte = data[offset];
          if (offset === 4 || offset === 6 || offset === 8)
            result += "-";
          if (byte < 16)
            result += "0";
          result += byte.toString(16).toLowerCase();
        }
        return result;
      }
    }
    function MakeDictionary(obj) {
      obj.__ = void 0;
      delete obj.__;
      return obj;
    }
  });
})(Reflect2 || (Reflect2 = {}));

// ../sync-core/src/state/types.ts
var Op;
(function(Op2) {
  Op2["UPDATE"] = "UPDATE";
  Op2["DELETE"] = "DELETE";
  Op2["INSERT"] = "INSERT";
})(Op || (Op = {}));

// ../sync-core/src/state/model.tsx
var relationMetadataKey = Symbol("relation");
function ManyToOne(property2, type) {
  return function ManyToOne2(target, propertyKey) {
    console.log("target", target);
    const relation = {
      type,
      property: property2,
      relationship: "ManyToOne"
    };
    console.log("target relation", relation);
    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}
function OneToMany(property2, type) {
  return function OneToMany2(target, propertyKey) {
    console.log("target", target);
    const relation = {
      type,
      property: property2,
      relationship: "OneToMany"
    };
    console.log("target relation", relation);
    Reflect.defineMetadata(relationMetadataKey, relation, target, propertyKey);
  };
}
var remoteCallInstructionMetadatakey = Symbol("remoteCallInstruction");
function getRemoteCallInstruction(target, propertyKey) {
  return Reflect.getMetadata(remoteCallInstructionMetadatakey, target, propertyKey);
}
var remoteFunctionMetadata = Symbol("remoteFunction");
var propertyMetadatakey = Symbol("property");
function property(target, propertyKey) {
  Reflect.defineMetadata(propertyMetadatakey, true, target, propertyKey);
}
function getRelation(target, propertyKey) {
  const r = Reflect.getMetadata(relationMetadataKey, target, propertyKey);
  return Reflect.getMetadata(relationMetadataKey, target, propertyKey);
}
function isKeyAProperty(target, propertyKey) {
  return Reflect.getMetadata(propertyMetadatakey, target, propertyKey) ?? false;
}
var rIdK = (key) => {
  return `id__${key}`;
};
var Model = class {
  constructor(id) {
    this.type = "";
    this.txs = [];
    this.id = id;
  }
  save() {
    const { forwards, backwards } = this.parseMutations();
    const { forwards: instructionsForwards } = this.parseInstructions();
    const tx = {
      id: crypto.randomUUID(),
      forwards,
      backwards,
      instructions: instructionsForwards
    };
    this.objectManager.apply(tx);
    this.persistState();
  }
  applyTX(tx) {
    if (this.txs.includes(tx.id)) {
      return;
    }
    this.txs.push(tx.id);
    const diffedKeys = [];
    for (const mutation of tx.forwards.filter((m) => m.onClass === this.type && m.onClassId === this.id)) {
      if (mutation.mutationType === "property") {
        const {
          onPropertyKey: key,
          withValue: value,
          operation: op
        } = mutation;
        if (op === Op.UPDATE) {
          this[key] = value;
        }
        if (op === Op.DELETE) {
          this[key] = Array.isArray(this[key]) ? this[key].filter((id) => id !== value) : "";
        }
        if (op === Op.INSERT) {
          this[key].push(value);
          console.log(`inserted ${value} into ${property}`);
        }
        diffedKeys.push(key);
      }
      if (mutation.mutationType === "relation") {
        const {
          onRelationKey: key,
          withIdValue: value,
          operation: op
        } = mutation;
        if (op === Op.UPDATE) {
          this[rIdK(key)] = value;
        }
        if (op === Op.DELETE) {
          console.log(`deleting ${rIdK(key)}`, this[rIdK(key)]);
          this[rIdK(key)] = Array.isArray(this[rIdK(key)]) ? this[rIdK(key)].filter((id) => id !== value) : "";
          console.log(`deleted ${value} from ${property}`);
        }
        if (op === Op.INSERT) {
          try {
            console.log(`inserting ${rIdK(key)}`, this[rIdK(key)]);
            this[rIdK(key)].push(value);
            console.log(`DB16 inserted ${value} into ${rIdK(key)} this`, JSON.stringify(this.id__inputBlocks), mutation);
          } catch (e) {
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
    this.persistKeys(diffedKeys);
  }
  getPersistedState() {
  }
  persistState() {
  }
  getRawState() {
  }
  persistKeys(keys) {
  }
  syncClassesToRelationIds(idKey, key, valueId, valueType) {
  }
  parseMutationsForRelation(relationKey, relation, oldValue, newValue) {
    const forwards = [];
    const backwards = [];
    if (oldValue == newValue) {
      return { forwards, backwards };
    }
    console.log(`relation ${relationKey} changed from ${oldValue} to ${newValue}`);
    if (Array.isArray(oldValue)) {
      const oldModels = oldValue;
      const newModels = newValue;
      console.log(`relation ${relationKey} found on ${this.type} ${this.id}`);
      console.log(`oldModels`, oldModels);
      console.log(`newModels`, newModels);
      const newValuesCast = newValue.filter((v) => v).map((v) => v.id);
      const oldValuesCast = oldValue.filter((v) => v).map((v) => v.id);
      forwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: newValuesCast
      });
      backwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: oldValuesCast
      });
    } else {
      const oldValueCast = oldValue?.id ?? null;
      const newValueCast = newValue?.id ?? null;
      forwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: newValueCast ? newValueCast : ""
      });
      backwards.push({
        mutationType: "relation",
        onClass: this.type,
        onClassId: this.id,
        operation: Op.UPDATE,
        onRelationKey: relationKey,
        withIdValue: oldValueCast ? oldValueCast : ""
      });
    }
    if (relation.relationship === "ManyToOne") {
      console.log(`relation ${relationKey} is ManyToOne`);
      const oldValueCast = oldValue?.id ?? null;
      const newValueCast = newValue?.id ?? null;
      if (newValue == null) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
      }
      if (oldValue == null) {
        console.log(`oldValue is null`);
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id
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
          withIdValue: this.id
        });
      }
      for (const removed of removedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: ""
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
          withIdValue: this.id
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: added,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
      }
      for (const removed of removedModels) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.DELETE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
        console.log(`pushed DELETE forwards`);
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: removed,
          operation: Op.INSERT,
          onRelationKey: relation.property,
          withIdValue: this.id
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
          withIdValue: ""
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: oldValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
      }
      if (oldValue == null) {
        forwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: this.id
        });
        backwards.push({
          mutationType: "relation",
          onClass: relation.type,
          onClassId: newValueCast.id,
          operation: Op.UPDATE,
          onRelationKey: relation.property,
          withIdValue: ""
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
      withValue: newValue
    });
    backwards.push({
      mutationType: "property",
      onClass: this.type,
      onClassId: this.id,
      operation: Op.UPDATE,
      onPropertyKey: propertyKey,
      withValue: oldValue
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
    let backwards = void 0;
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
          functionToCall: instruction.functionToCall
        });
      }
    }
    return { forwards, backwards };
  }
  recieve() {
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
};

// ../sync-core/src/state/objects.tsx
var Space = class extends Model {
  constructor() {
    super(...arguments);
    this.title = "Untitled Space";
    this.background = "black";
    this.blocks = [];
    this.selectedBlocks = [];
  }
};
__decorateClass([
  property
], Space.prototype, "title", 2);
__decorateClass([
  property
], Space.prototype, "background", 2);
__decorateClass([
  OneToMany("space", "Block")
], Space.prototype, "blocks", 2);
__decorateClass([
  ManyToOne("spaces", "User")
], Space.prototype, "user", 2);
__decorateClass([
  property
], Space.prototype, "selectedBlocks", 2);
var Block = class extends Model {
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
};
__decorateClass([
  property
], Block.prototype, "actionId", 2);
__decorateClass([
  property
], Block.prototype, "background", 2);
__decorateClass([
  property
], Block.prototype, "position", 2);
__decorateClass([
  property
], Block.prototype, "size", 2);
__decorateClass([
  property
], Block.prototype, "selected", 2);
__decorateClass([
  ManyToOne("blocks", "Space")
], Block.prototype, "space", 2);
var User = class extends Model {
  constructor() {
    super(...arguments);
    this.spaces = [];
    this.username = "Anonymous";
  }
};
__decorateClass([
  OneToMany("user", "Space")
], User.prototype, "spaces", 2);
__decorateClass([
  property
], User.prototype, "username", 2);

// worker/object.ts
function DurableModel(type) {
  console.log("type", type);
  return function DurableModel2(target) {
    return class extends target {
      constructor(...args) {
        const startTime = Date.now();
        super(...args);
        const state = args[0];
        this.uid = state.id.toString();
        const env = args[1];
        this.parent = env.POOL;
        this.state = state;
        this.type = type;
        this.connectedPools = new Map();
      }
      getPersistedState() {
        return __async(this, null, function* () {
          const state = this.state.storage.get("state");
          state["id"] = state["uuid"];
          return state;
        });
      }
      persistState() {
        return __async(this, null, function* () {
          const extraKeysToPersist = ["uuid", "type"];
          const stateDup = {};
          for (const key of Object.keys(this)) {
            const isRelationId = key.startsWith("id__");
            const isProperty = isKeyAProperty(this, key);
            if (isRelationId || isProperty || extraKeysToPersist.includes(key)) {
              stateDup[key] = this[key];
            }
          }
          stateDup["id"] = stateDup["uuid"];
          return this.state.storage.put("state", stateDup);
        });
      }
      persistKeys(keys) {
        return __async(this, null, function* () {
          const extraKeysToPersist = ["uuid", "type"];
          const stateDup = yield this.state.storage.get("state");
          for (const key of keys) {
            const isRelationId = key.startsWith("id__");
            const isProperty = isKeyAProperty(this, key);
            if (isRelationId || isProperty || extraKeysToPersist.includes(key)) {
              stateDup[key] = this[key];
            }
          }
          return this.state.storage.put("state", stateDup);
        });
      }
      initialize(id) {
        return __async(this, null, function* () {
          this.uuid = id;
          const stored = yield this.getPersistedState();
          if (stored) {
            for (const key of Object.keys(stored)) {
              this[key] = stored[key];
            }
          } else {
            for (const key of Object.keys(this)) {
              const relation = getRelation(this, key);
              if (relation) {
                const idKey = rIdK(key);
                this[idKey] = relation.relationship === "OneToMany" ? [] : "";
              }
            }
            this.persistState();
          }
        });
      }
      receiveTX(tx) {
        return __async(this, null, function* () {
          const stored = yield this.getPersistedState();
          this.applyTX(tx);
        });
      }
      onOpenPoolConnection(socket) {
        return __async(this, null, function* () {
          this.connectedPools.set(socket.pid, socket);
        });
      }
      emitTXToConnectedPools(tx) {
        return __async(this, null, function* () {
          for (const [poolId, socket] of this.connectedPools) {
            const message = {
              rid: crypto.randomUUID(),
              type: "req:client-apply-tx",
              payload: JSON.stringify(tx)
            };
            socket.send(JSON.stringify(message));
          }
        });
      }
      handleApplyTXMessage(socket, message) {
        return __async(this, null, function* () {
          try {
            this.receiveTX(message.tx);
          } catch (e) {
            const response2 = {
              rid: message.rid,
              type: "res:apply-tx",
              success: false,
              error: e
            };
            socket.send(JSON.stringify(response2));
          }
          const response = {
            rid: message.rid,
            type: "res:apply-tx",
            success: true
          };
          socket.send(JSON.stringify(response));
          this.emitTXToConnectedPools(message.tx);
        });
      }
      handlePullMessage(socket, message) {
        return __async(this, null, function* () {
          try {
            const stored = yield this.getPersistedState();
            const response = {
              rid: message.rid,
              type: "res:pull",
              success: true,
              state: JSON.stringify(stored)
            };
            socket.send(JSON.stringify(response));
          } catch (e) {
            const response = {
              rid: message.rid,
              type: "res:pull",
              success: false,
              error: e,
              state: ""
            };
            socket.send(JSON.stringify(response));
          }
        });
      }
      onMessageFromPool(socket, message) {
        const msg = JSON.parse(message);
        switch (msg.type) {
          case "req:pull":
            this.handlePullMessage(socket, msg);
            break;
          case "req:apply-tx":
            this.handleApplyTXMessage(socket, msg);
            break;
          default:
            throw new Error("Unknown message type");
        }
      }
      onCloseFromPool(socket) {
        return __async(this, null, function* () {
          this.connectedPools.delete(socket.pid);
        });
      }
      onErrorFromPool(socket) {
        return __async(this, null, function* () {
        });
      }
      connect(req) {
        return __async(this, null, function* () {
          if (req.method !== "GET")
            throw new Error("Method not allowed");
          let value = req.headers.get("upgrade");
          if (value !== "websocket")
            throw new Error("Upgrade required");
          var { oid, pid } = validate2(req, this.id);
          let { 0: pool, 1: object } = new WebSocketPair();
          object.accept();
          let socket = {
            pid,
            oid,
            send: object.send.bind(object),
            close: object.close.bind(object)
          };
          let closer = (evt) => __async(this, null, function* () {
            try {
              if (evt.type === "error")
                yield this.onErrorFromPool(socket);
              else {
                yield this.onCloseFromPool(socket);
              }
            } finally {
              this.connectedPools.delete(pid);
              try {
                object.close();
              } catch (e) {
              }
            }
          });
          object.addEventListener("close", closer);
          object.addEventListener("error", closer);
          object.addEventListener("message", (evt) => {
            this.onMessageFromPool(socket, evt.data);
          });
          yield this.onOpenPoolConnection(socket);
          console.log(`[OBJECT][CONNECT] connected to pool ${pid}`);
          return new Response(null, {
            status: 101,
            statusText: "Switching Protocols",
            webSocket: pool
          });
        });
      }
      fetch(req) {
        return __async(this, null, function* () {
          let url = new URL(req.url);
          if (!this.initializePromise) {
            const id = url.pathname.split("/")[2];
            this.initializePromise = this.initialize(id).catch((err) => {
              this.initializePromise = void 0;
              throw err;
            });
          }
          let { pathname, searchParams } = new URL(req.url);
          yield this.initializePromise;
          if (url.pathname.split("/")[1] === "ws") {
            return this.connect(req);
          }
          const endTime = Date.now();
          return new Response("response");
        });
      }
    };
  };
}
var Space2 = class extends Space {
};
Space2 = __decorateClass([
  DurableModel("Space")
], Space2);
var Block2 = class extends Block {
};
Block2 = __decorateClass([
  DurableModel("Block")
], Block2);
var User2 = class extends User {
};
User2 = __decorateClass([
  DurableModel("User")
], User2);

// worker/index.ts
var worker = {
  fetch(req, env, ctx) {
    return __async(this, null, function* () {
      console.log("[ HELLO ][fetch] req.url", req.url);
      let { pathname } = new URL(req.url);
      if (!/^(HEAD|GET)$/.test(req.method)) {
        return new Response("Method not allowed", { status: 405 });
      }
      if (pathname === "/favicon.ico") {
        return new Response(null, { status: 404 });
      }
      let { searchParams } = new URL(req.url);
      let reqid = searchParams.get("u") || "anon";
      let gid = env.LOBBY.idFromName("lobby-id");
      let pool = yield identify(gid, reqid, {
        parent: env.LOBBY,
        child: env.POOL
      });
      return pool.fetch(req);
    });
  }
};
var worker_default = worker;
export {
  Block2 as Block,
  Lobby,
  Pool,
  Space2 as Space,
  User2 as User,
  worker_default as default
};
/*! *****************************************************************************
Copyright (C) Microsoft. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
