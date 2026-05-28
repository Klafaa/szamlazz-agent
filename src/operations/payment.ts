import { document, elem, leaf } from "../core/xml.js";
import { parseXml, assertSuccess } from "../core/response.js";
import type { RawResponse } from "../core/transport.js";

/** A single credit-entry / payment row (`kifizetes`). */
export interface PaymentEntry {
  /** Payment date, `YYYY-MM-DD` (`datum`). */
  date: string;
  /** Payment method / title (`jogcim`). */
  title: string;
  /** Amount paid (`osszeg`). */
  amount: number;
  /** Optional note (`leiras`). */
  description?: string;
}

export interface RegisterPaymentOptions {
  /** Invoice number the payment belongs to (`szamlaszam`). */
  invoiceNumber: string;
  /** Add to existing entries instead of replacing them (`additiv`). */
  additive?: boolean;
  entries: PaymentEntry[];
}

export interface RegisterPaymentResult {
  success: boolean;
}

const NS = "http://www.szamlazz.hu/xmlszamlakifiz";

export function buildRegisterPaymentXml(
  agentKey: string,
  opts: RegisterPaymentOptions,
): string {
  const beallitasok = elem("beallitasok", [
    leaf("szamlaagentkulcs", agentKey),
    leaf("szamlaszam", opts.invoiceNumber),
    leaf("additiv", opts.additive ?? false),
  ]);

  const entries = opts.entries.map((e) =>
    elem("kifizetes", [
      leaf("datum", e.date),
      leaf("jogcim", e.title),
      leaf("osszeg", e.amount),
      leaf("leiras", e.description),
    ]),
  );

  return document("xmlszamlakifiz", NS, [beallitasok, ...entries]);
}

export function parseRegisterPaymentResponse(
  res: RawResponse,
): RegisterPaymentResult {
  const parsed = parseXml<{ xmlszamlakifizvalasz?: Record<string, unknown> }>(
    res.text,
  );
  const v = parsed.xmlszamlakifizvalasz;
  assertSuccess(v, res.text);
  return { success: v ? v["sikeres"] === "true" || v["sikeres"] === true : true };
}
