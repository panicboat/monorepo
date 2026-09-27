import { afterEach, describe, expect, it, vi } from "vitest";
import { context, propagation } from "@opentelemetry/api";
import type { UnaryRequest } from "@connectrpc/connect";
import { traceContextInterceptor } from "./otel-interceptor";

// Use a minimal carrier because the interceptor only accesses request headers.
function fakeReq(header: Headers) {
  return { header } as UnaryRequest;
}

describe("traceContextInterceptor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("injects the active context into request headers via a Headers-compatible setter", async () => {
    const header = new Headers();
    const injectSpy = vi
      .spyOn(propagation, "inject")
      .mockImplementation((_ctx, carrier, setter) => {
        setter?.set(carrier as Headers, "traceparent", "00-abc-def-01");
      });

    const next: Parameters<typeof traceContextInterceptor>[0] = async (
      req,
    ) => {
      expect(req.header.get("traceparent")).toBe("00-abc-def-01");
      return {} as never;
    };

    await traceContextInterceptor(next)(fakeReq(header));

    // Assert the custom setter mutates Headers because the default carrier setter cannot.
    expect(injectSpy).toHaveBeenCalledWith(
      context.active(),
      header,
      expect.objectContaining({ set: expect.any(Function) }),
    );
  });

  it("passes the request through to next and returns its result", async () => {
    vi.spyOn(propagation, "inject").mockImplementation(() => {});
    const header = new Headers();
    const expected = { ok: true };
    const next = async () => expected as never;

    const result = await traceContextInterceptor(next)(fakeReq(header));

    expect(result).toBe(expected);
  });
});
