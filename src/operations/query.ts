import { document, leaf } from "../core/xml.js";
import { parseXml, decodeBase64 } from "../core/response.js";
import { SzamlazzError } from "../core/errors.js";
import type { RawResponse } from "../core/transport.js";

/** Identify a document either by invoice number or by order number. */
export interface DocumentSelector {
  /** Invoice number (`szamlaszam`). */
  invoiceNumber?: string;
  /** Order number (`rendelesSzam`). */
  orderNumber?: string;
}

const PDF_NS = "http://www.szamlazz.hu/xmlszamlapdf";
const XML_NS = "http://www.szamlazz.hu/xmlszamlaxml";

export function buildGetPdfXml(agentKey: string, sel: DocumentSelector): string {
  return document("xmlszamlapdf", PDF_NS, [
    leaf("szamlaagentkulcs", agentKey),
    leaf("szamlaszam", sel.invoiceNumber),
    leaf("rendelesSzam", sel.orderNumber),
    leaf("valaszVerzio", 1),
  ]);
}

/** Returns the raw PDF bytes for an existing document. */
export function parseGetPdfResponse(res: RawResponse): Uint8Array {
  if (looksLikePdf(res.body)) return res.body;
  // valaszVerzio=2 style envelope with base64 pdf.
  const parsed = parseXml<{ xmlszamlavalasz?: Record<string, unknown> }>(res.text);
  const pdf = parsed.xmlszamlavalasz?.["pdf"];
  if (typeof pdf === "string") return decodeBase64(pdf);
  throw new SzamlazzError("Response did not contain a PDF.", {
    responseBody: res.text,
  });
}

export function buildGetInvoiceXmlXml(
  agentKey: string,
  sel: DocumentSelector,
): string {
  return document("xmlszamlaxml", XML_NS, [
    leaf("szamlaagentkulcs", agentKey),
    leaf("szamlaszam", sel.invoiceNumber),
    leaf("rendelesSzam", sel.orderNumber),
    leaf("pdf", false),
  ]);
}

export interface InvoiceXmlResult {
  /** Parsed invoice document. */
  invoice: Record<string, unknown>;
  /** Raw XML string as returned by the Agent. */
  raw: string;
}

export function parseGetInvoiceXmlResponse(res: RawResponse): InvoiceXmlResult {
  const parsed = parseXml<Record<string, unknown>>(res.text);
  return { invoice: parsed, raw: res.text };
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}
