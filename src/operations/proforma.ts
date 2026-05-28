import { document, elem, leaf } from "../core/xml.js";
import { parseXml, assertSuccess } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

export interface DeleteProformaOptions {
  /** Proforma number to delete (`szamlaszam`). */
  proformaNumber?: string;
  /** Or delete by order number (`rendelesSzam`). */
  orderNumber?: string;
}

export interface DeleteProformaResult {
  success: boolean;
}

const NS = "http://www.szamlazz.hu/xmlszamladbkdel";

export function buildDeleteProformaXml(
  agentKey: string,
  opts: DeleteProformaOptions,
): string {
  const beallitasok = elem("beallitasok", [leaf("szamlaagentkulcs", agentKey)]);
  const fejlec = elem("fejlec", [
    leaf("szamlaszam", opts.proformaNumber),
    leaf("rendelesSzam", opts.orderNumber),
  ]);
  return document("xmlszamladbkdel", NS, [beallitasok, fejlec]);
}

export function parseDeleteProformaResponse(
  res: RawResponse,
): DeleteProformaResult {
  const parsed = parseXml<{ xmlszamladbkdelvalasz?: Record<string, unknown> }>(
    res.text,
  );
  const v = parsed.xmlszamladbkdelvalasz;
  assertSuccess(v, res.text);
  return { success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true };
}
