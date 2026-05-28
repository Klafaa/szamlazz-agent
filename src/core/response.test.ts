import { describe, it, expect } from "vitest";
import {
  parseXml,
  header,
  decodeBase64,
  assertSuccess,
} from "./response.js";
import type { RawResponse } from "./transport.js";

function raw(headers: Record<string, string>): RawResponse {
  return { body: new Uint8Array(), headers, text: "" };
}

describe("parseXml", () => {
  it("parses a simple document into an object", () => {
    const out = parseXml<{ a: { b: string } }>("<a><b>x</b></a>");
    expect(out.a.b).toBe("x");
  });

  it("keeps values as strings (parseTagValue disabled)", () => {
    const out = parseXml<{ a: { n: unknown } }>("<a><n>007</n></a>");
    expect(out.a.n).toBe("007");
  });
});

describe("header", () => {
  it("reads a szlahu_ prefixed header", () => {
    expect(header(raw({ szlahu_szamlaszam: "E-1" }), "szamlaszam")).toBe("E-1");
    expect(header(raw({}), "missing")).toBeUndefined();
  });
});

describe("decodeBase64", () => {
  it("decodes base64 into bytes", () => {
    // "PDF" => bytes 0x50 0x44 0x46
    expect(Array.from(decodeBase64("UERG"))).toEqual([0x50, 0x44, 0x46]);
  });

  it("ignores embedded whitespace and newlines", () => {
    expect(Array.from(decodeBase64("UE\n RG"))).toEqual([0x50, 0x44, 0x46]);
  });
});

describe("assertSuccess", () => {
  it("is a no-op when there is no envelope", () => {
    expect(() => assertSuccess(undefined, "<x/>")).not.toThrow();
  });

  it("succeeds on sikeres=true regardless of hibakod", () => {
    expect(() => assertSuccess({ sikeres: "true", hibakod: "0" }, "<x/>")).not.toThrow();
  });

  it("throws on a non-zero hibakod even without a sikeres flag", () => {
    expect(() => assertSuccess({ hibakod: "3" }, "<x/>")).toThrow();
  });

  it("does not throw on hibakod=0 without a sikeres flag", () => {
    expect(() => assertSuccess({ hibakod: "0" }, "<x/>")).not.toThrow();
  });

  it("includes the error message and code", () => {
    try {
      assertSuccess({ sikeres: "false", hibakod: "57", hibauzenet: "bad" }, "<x/>");
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { code?: number }).code).toBe(57);
      expect((err as Error).message).toBe("bad");
    }
  });
});
