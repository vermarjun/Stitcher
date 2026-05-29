// Set required env var before any import that loads config.ts
process.env["AGENT_API_KEY"] = "valid-test-key-12345";

import { authMiddleware } from "../../src/middleware/auth";
import type { FastifyRequest, FastifyReply } from "fastify";

function makeReply() {
  const reply = {
    _status: 0,
    _sent: false,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    send(body: unknown) {
      this._sent = true;
      this._body = body;
      return Promise.resolve();
    },
  } as unknown as FastifyReply & { _status: number; _sent: boolean; _body: unknown };
  return reply;
}

function makeRequest(headers: Record<string, string | undefined> = {}): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("authMiddleware", () => {
  it("sends 401 and short-circuits when X-Api-Key header is missing", async () => {
    const request = makeRequest({});
    const reply = makeReply();

    const handlerCalled = { value: false };

    // Simulate Fastify preHandler: if authMiddleware returns, handler is skipped
    const result = await authMiddleware(request, reply);

    // The function must return (i.e. not undefined implies early return after send)
    // The reply must be sent with 401
    expect((reply as ReturnType<typeof makeReply>)._sent).toBe(true);
    expect((reply as ReturnType<typeof makeReply>)._status).toBe(401);
    expect((reply as ReturnType<typeof makeReply>)._body).toMatchObject({
      error: expect.stringContaining("Unauthorised"),
    });

    void handlerCalled;
  });

  it("sends 401 when an invalid (wrong) key is supplied", async () => {
    const request = makeRequest({ "x-api-key": "wrong-key" });
    const reply = makeReply();

    await authMiddleware(request, reply);

    expect((reply as ReturnType<typeof makeReply>)._sent).toBe(true);
    expect((reply as ReturnType<typeof makeReply>)._status).toBe(401);
  });

  it("does NOT send a response when the correct key is supplied", async () => {
    const request = makeRequest({ "x-api-key": "valid-test-key-12345" });
    const reply = makeReply();

    await authMiddleware(request, reply);

    // Reply should not have been touched — handler is allowed to proceed
    expect((reply as ReturnType<typeof makeReply>)._sent).toBe(false);
  });

  it("sends 401 when x-api-key header is an array (invalid type)", async () => {
    // Fastify allows headers to be string[], which we must also reject
    const request = {
      headers: { "x-api-key": ["valid-test-key-12345", "extra"] },
    } as unknown as FastifyRequest;
    const reply = makeReply();

    await authMiddleware(request, reply);

    expect((reply as ReturnType<typeof makeReply>)._sent).toBe(true);
    expect((reply as ReturnType<typeof makeReply>)._status).toBe(401);
  });
});
