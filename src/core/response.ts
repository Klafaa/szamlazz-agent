import { XMLParser } from "fast-xml-parser";
import { SzamlazzError } from "./errors.js";
import type { RawResponse } from "./transport.js";

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  // NAV's taxpayer response uses ns2:/ns3: prefixes; Agent + FDC payloads use
  // default namespaces. Stripping prefixes gives stable, prefix-free keys.
  removeNSPrefix: true,
});

/** Parses an XML response body into a plain object. */
export function parseXml<T = Record<string, unknown>>(xml: string): T {
  return parser.parse(xml) as T;
}

/** Reads a `szlahu_*` response header (without the prefix). */
export function header(res: RawResponse, name: string): string | undefined {
  return res.headers[`szlahu_${name}`];
}

/** Decodes a base64 string (e.g. an embedded PDF) into bytes. */
export function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/\s/g, "");
  // Buffer is available on Node; fall back to atob elsewhere.
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Throws when an Agent XML response signals failure. Many endpoints report
 * errors in the body (`hibakod`/`hibauzenet` or `sikeres=false`) rather than
 * in headers, so this is checked in addition to the header-level guard in the
 * transport layer.
 */
export function assertSuccess(
  value: Record<string, unknown> | undefined,
  rawXml: string,
): void {
  if (!value) return;
  const sikeres = value["sikeres"];
  const hibakod = value["hibakod"];
  const hibauzenet = value["hibauzenet"];

  // An explicit success flag is authoritative — some responses still carry a
  // `hibakod` of 0 on success, so don't treat its mere presence as failure.
  if (sikeres === "true" || sikeres === true) return;

  const errorCode = hibakod !== undefined ? Number(hibakod) : undefined;
  const failed =
    sikeres === "false" ||
    sikeres === false ||
    (errorCode !== undefined && errorCode !== 0);
  if (failed) {
    throw new SzamlazzError(
      typeof hibauzenet === "string" ? hibauzenet : "Szamla Agent error",
      { code: errorCode, responseBody: rawXml },
    );
  }
}
