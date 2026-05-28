import { document, elem, leaf } from "../core/xml.js";
import { parseXml, assertSuccess, decodeBase64, header } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

export interface ReverseInvoiceOptions {
  /** Invoice number to cancel (`szamlaszam`). */
  invoiceNumber: string;
  /** Create an e-invoice for the storno (`eszamla`). */
  eInvoice?: boolean;
  issueDate?: string;
  fulfillmentDate?: string;
  emailReplyTo?: string;
  emailSubject?: string;
  emailText?: string;
  buyerEmail?: string;
}

export interface ReverseInvoiceResult {
  success: boolean;
  /** Storno invoice number (`szamlaszam`). */
  invoiceNumber?: string;
  pdf?: Uint8Array;
}

const NS = "http://www.szamlazz.hu/xmlszamlast";

export function buildReverseInvoiceXml(
  agentKey: string,
  opts: ReverseInvoiceOptions,
  requestPdf: boolean,
): string {
  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("eszamla", opts.eInvoice ?? false),
    leaf("szamlaLetoltes", requestPdf),
    leaf("valaszVerzio", 2),
  ]);

  const fejlec = elem("fejlec", [
    leaf("szamlaszam", opts.invoiceNumber),
    leaf("keltDatum", opts.issueDate),
    leaf("teljesitesDatum", opts.fulfillmentDate),
  ]);

  const elado = elem("elado", [
    leaf("emailReplyto", opts.emailReplyTo),
    leaf("emailTargy", opts.emailSubject),
    leaf("emailSzoveg", opts.emailText),
  ]);

  const vevo = elem("vevo", [leaf("email", opts.buyerEmail)]);

  return document("xmlszamlast", NS, [beallitasok, fejlec, elado, vevo]);
}

export function parseReverseInvoiceResponse(res: RawResponse): ReverseInvoiceResult {
  const parsed = parseXml<{ xmlszamlavalasz?: Record<string, unknown> }>(res.text);
  const v = parsed.xmlszamlavalasz;
  assertSuccess(v, res.text);
  const pdfBase64 = v?.["pdf"];
  return {
    success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true,
    invoiceNumber: (v?.["szamlaszam"] as string) ?? header(res, "szamlaszam"),
    pdf: typeof pdfBase64 === "string" ? decodeBase64(pdfBase64) : undefined,
  };
}
