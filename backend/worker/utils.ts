import * as HEADERS from "./headers";
export const Encoder = /* @__PURE__ */ new TextEncoder();
export const Decoder = /* @__PURE__ */ new TextDecoder();

// Common error codes' status text
export const STATUS_CODES: Record<string | number, string> = {
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "411": "Length Required",
  "413": "Payload Too Large",
  "422": "Unprocessable Entity",
  "426": "Upgrade Required",
} as const;

/**
 * @see https://github.com/lukeed/worktop/blob/3187246b95d50c7b34f987b95e734a1dbcf2d778/src/internal/ws.ts#L4
 */
export function abort(code: number, message?: string) {
  message = message || STATUS_CODES[code];
  let length = Encoder.encode(message).byteLength;
  return new Response(message, {
    status: code,
    statusText: STATUS_CODES[code],
    headers: {
      Connection: "close",
      "Content-Type": "text/plain",
      "Content-Length": String(length),
    },
  });
}

/**
 * Ensure the request HEADER values exist & match
 */
export function validate(req: Request, replicaid?: string) {
  let oid = req.headers.get(HEADERS.MODELID);
  if (oid == null) throw new Error("Missing: Replica ID");
  // TODO: add ID sync check
  // if (replicaid && oid !== replicaid) throw new Error("Mismatch: Replica ID");

  let pid = req.headers.get(HEADERS.POOLID);
  if (pid == null) throw new Error("Missing: Group ID");

  //   let nid = req.headers.get(NEIGHBORID);
  // let rid = req.headers.get(CLIENTID);
  // if (rid == null) throw new Error("Missing: Request ID");

  return { oid, pid };
}

/**
 * Helper to load a `DurableObjectId` & then get the Stub
 */
export function load(
  ns: DurableObjectNamespace,
  uid: string
): DurableObjectStub {
  let doid = ns.idFromString(uid);
  return ns.get(doid);
}

export function load2(
  ns: DurableObjectNamespace,
  name: string
): DurableObjectStub {
  let doid = ns.idFromName(name);
  return ns.get(doid);
}
