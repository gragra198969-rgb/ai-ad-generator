export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Browser mutations must come from this origin. Requests without browser
// origin headers still require a verified Clerk session in every handler.
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError("Cross-site request rejected.", 403);
  }
  if (origin && origin !== new URL(req.url).origin) {
    throw new RequestError("Cross-site request rejected.", 403);
  }
}

export async function readJsonObject(req: Request, limit = 16384): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new RequestError("Send product details as JSON.", 415);
  }
  if (Number(req.headers.get("content-length")) > limit) throw new RequestError("Request is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError("Invalid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("Invalid request details.");
  return body as Record<string, unknown>;
}

export function textField(input: Record<string, unknown>, name: string, max = 1000) {
  const value = input[name];
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max) throw new RequestError(`${name} must be text of at most ${max} characters.`);
  return value.trim();
}
